import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

const schema = z.object({ tagCode: z.string().min(1) });
const lineUserId = /^U[0-9a-f]{32}$/;

export async function POST(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag code" }, { status: 400 });

  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Messaging API channel access token is not configured" }, { status: 503 });
  }

  const tag = await prisma.tag.findUnique({
    where: { brandId_code: { brandId: integration.brandId, code: parsed.data.tagCode } },
    include: { members: { include: { member: { select: { lineUserId: true } } } } },
  });
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  const audiences = tag.members
    .map(({ member }) => member.lineUserId)
    .filter((id) => lineUserId.test(id))
    .map((id) => ({ id }));
  if (!audiences.length) {
    return NextResponse.json({ error: "Tag has no valid LINE user IDs to sync" }, { status: 422 });
  }

  const response = await fetch("https://api.line.me/v2/bot/audienceGroup/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: tag.name.slice(0, 120), audiences }),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: "LINE audience sync failed", details: body }, { status: response.status });
  }

  const syncedAt = new Date();
  await prisma.tag.update({
    where: { id: tag.id },
    data: { lineAudienceGroupId: body.audienceGroupId, lineAudienceSyncedAt: syncedAt },
  });
  return NextResponse.json({
    tag: tag.code,
    uploadedUsers: audiences.length,
    audienceGroupId: body.audienceGroupId,
    syncedAt,
  });
}

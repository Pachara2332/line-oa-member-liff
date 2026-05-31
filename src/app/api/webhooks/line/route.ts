import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidLineSignature } from "@/lib/line-webhook";

type LineWebhookEvent = {
  type: string;
  timestamp: number;
  webhookEventId?: string;
  source?: { type?: string; userId?: string };
};

export async function POST(request: Request) {
  const body = await request.text();
  if (!isValidLineSignature(body, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "Invalid LINE signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };
  for (const event of payload.events ?? []) {
    const lineUserId = event.source?.userId;
    if (event.type !== "follow" || !lineUserId) continue;

    const members = await prisma.member.findMany({
      where: { lineUserId },
      select: { id: true, brandId: true },
      take: 2,
    });
    const matchedMember = members.length === 1 ? members[0] : null;
    await prisma.lineFollowEvent.upsert({
      where: { webhookEventId: event.webhookEventId ?? `follow:${lineUserId}:${event.timestamp}` },
      update: {},
      create: {
        webhookEventId: event.webhookEventId ?? `follow:${lineUserId}:${event.timestamp}`,
        lineUserId,
        memberId: matchedMember?.id,
        brandId: matchedMember?.brandId,
        followedAt: new Date(event.timestamp),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

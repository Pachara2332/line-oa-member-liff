import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tags = await prisma.tag.findMany({
    where: { brandId: integration.brandId },
    include: {
      source: { select: { code: true, name: true } },
      members: {
        include: { member: { select: { lineUserId: true } } },
        orderBy: { assignedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    brand: integration.brand,
    audiences: tags.map((tag) => ({
      tag: {
        code: tag.code,
        name: tag.name,
        lineAudienceGroupId: tag.lineAudienceGroupId,
        lineAudienceSyncedAt: tag.lineAudienceSyncedAt,
      },
      source: tag.source,
      lineUserIds: tag.members.map(({ member }) => member.lineUserId),
    })),
  });
}

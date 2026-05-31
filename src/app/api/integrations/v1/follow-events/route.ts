import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const followEvents = await prisma.lineFollowEvent.findMany({
    where: { brandId: integration.brandId },
    include: {
      member: {
        select: {
          displayName: true,
          source: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { followedAt: "desc" },
  });
  return NextResponse.json({ brand: integration.brand, followEvents });
}

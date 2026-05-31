import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = await prisma.couponClaim.findMany({
    where: { coupon: { brandId: integration.brandId } },
    include: {
      coupon: { select: { title: true } },
      member: {
        select: {
          lineUserId: true,
          displayName: true,
          source: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { claimedAt: "desc" },
  });
  return NextResponse.json({ brand: integration.brand, claims });
}

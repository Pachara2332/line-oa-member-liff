import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

const schema = z.object({ claimId: z.string().min(1) });

export async function POST(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid claim ID" }, { status: 400 });

  const claim = await prisma.couponClaim.findFirst({
    where: { id: parsed.data.claimId, coupon: { brandId: integration.brandId } },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "CLAIMED") {
    return NextResponse.json({ error: "Coupon was already redeemed or is no longer usable" }, { status: 409 });
  }

  const usedAt = new Date();
  const result = await prisma.couponClaim.updateMany({
    where: { id: claim.id, status: "CLAIMED" },
    data: { status: "USED", usedAt },
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: "Coupon was already redeemed" }, { status: 409 });
  }
  return NextResponse.json({ claim: { ...claim, status: "USED", usedAt } });
}

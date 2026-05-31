import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyMemberToken } from "@/lib/tokens";

const schema = z.object({ couponId: z.string(), memberToken: z.string() });

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const member = await verifyMemberToken(data.memberToken);
    const coupon = await prisma.coupon.findFirst({
      where: { id: data.couponId, brandId: member.brandId, active: true },
      include: { _count: { select: { claims: true } } },
    });
    if (!coupon) return NextResponse.json({ error: "ไม่พบคูปอง" }, { status: 404 });
    if (coupon.quota !== null && coupon._count.claims >= coupon.quota) {
      return NextResponse.json({ error: "สิทธิ์เต็มแล้ว" }, { status: 409 });
    }
    const claim = await prisma.couponClaim.upsert({
      where: { couponId_memberId: { couponId: coupon.id, memberId: member.memberId } },
      update: {},
      create: { couponId: coupon.id, memberId: member.memberId },
    });
    return NextResponse.json({ claim: { id: claim.id, status: claim.status, claimedAt: claim.claimedAt } });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถรับสิทธิ์ได้" }, { status: 400 });
  }
}

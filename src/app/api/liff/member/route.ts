import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyLineIdToken } from "@/lib/line";
import { createMemberToken, verifyScanToken } from "@/lib/tokens";

const schema = z.object({
  scanToken: z.string(),
  idToken: z.string(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลเข้าสู่ระบบไม่ครบถ้วน" }, { status: 400 });
  }

  try {
    const scan = await verifyScanToken(parsed.data.scanToken);
    const source = await prisma.qrSource.findUnique({ where: { id: scan.sourceId } });
    if (!source || !source.active) throw new Error("QR source not found");

    const profile = await verifyLineIdToken(parsed.data.idToken, undefined);
    const member = await prisma.member.findUnique({
      where: { brandId_lineUserId: { brandId: source.brandId, lineUserId: profile.sub } },
    });
    if (!member) return NextResponse.json({ member: null });

    const tag = await prisma.tag.upsert({
      where: { brandId_code: { brandId: source.brandId, code: `source:${source.code}` } },
      update: { sourceId: source.id, name: source.name },
      create: {
        brandId: source.brandId,
        sourceId: source.id,
        code: `source:${source.code}`,
        name: source.name,
      },
    });
    await prisma.$transaction([
      prisma.qrScan.updateMany({
        where: { id: scan.scanId, sourceId: source.id, memberId: null },
        data: { memberId: member.id },
      }),
      prisma.memberTag.upsert({
        where: { memberId_tagId: { memberId: member.id, tagId: tag.id } },
        update: {},
        create: { memberId: member.id, tagId: tag.id, reason: "LIFF_RETURN_VISIT" },
      }),
    ]);

    const coupons = await prisma.coupon.findMany({
      where: { brandId: source.brandId, active: true },
      select: { id: true, title: true, description: true },
      orderBy: { createdAt: "asc" },
    });
    const claims = await prisma.couponClaim.findMany({
      where: { memberId: member.id },
      select: { couponId: true },
    });

    return NextResponse.json({
      member: { id: member.id, displayName: member.displayName },
      memberToken: await createMemberToken(member.id, member.brandId),
      coupons,
      claimedCouponIds: claims.map(({ couponId }) => couponId),
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบสถานะสมาชิกได้ กรุณาลองใหม่" }, { status: 400 });
  }
}

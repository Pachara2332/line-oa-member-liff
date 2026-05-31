import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyLineIdToken } from "@/lib/line";
import { createMemberToken, verifyScanToken } from "@/lib/tokens";

const schema = z.object({
  scanToken: z.string(),
  idToken: z.string().optional(),
  demoLineUserId: z.string().optional(),
  displayName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(30),
  email: z.email().optional().or(z.literal("")),
  birthDate: z.string().optional(),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  try {
    const scan = await verifyScanToken(parsed.data.scanToken);
    const source = await prisma.qrSource.findUnique({ where: { id: scan.sourceId } });
    if (!source || !source.active) throw new Error("QR source not found");
    const profile = await verifyLineIdToken(parsed.data.idToken, parsed.data.demoLineUserId);
    const member = await prisma.member.upsert({
      where: { brandId_lineUserId: { brandId: source.brandId, lineUserId: profile.sub } },
      update: {
        sourceId: source.id,
        displayName: parsed.data.displayName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        consentAt: new Date(),
      },
      create: {
        brandId: source.brandId,
        sourceId: source.id,
        lineUserId: profile.sub,
        displayName: parsed.data.displayName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        consentAt: new Date(),
      },
    });
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
        create: { memberId: member.id, tagId: tag.id, reason: "LIFF_QR_REGISTRATION" },
      }),
      prisma.lineFollowEvent.updateMany({
        where: { lineUserId: member.lineUserId, memberId: null },
        data: { memberId: member.id, brandId: member.brandId },
      }),
    ]);
    const coupons = await prisma.coupon.findMany({
      where: { brandId: source.brandId, active: true },
      select: { id: true, title: true, description: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      member: { id: member.id, displayName: member.displayName },
      memberToken: await createMemberToken(member.id, member.brandId),
      tags: [{ code: tag.code, name: tag.name }],
      coupons,
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่" }, { status: 400 });
  }
}

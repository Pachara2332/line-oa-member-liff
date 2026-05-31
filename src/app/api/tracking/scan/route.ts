import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createScanToken } from "@/lib/tokens";

const schema = z.object({ sourceCode: z.string().trim().min(1).max(100) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid QR source" }, { status: 400 });
  try {
    const source = await prisma.qrSource.findUnique({
      where: { code: parsed.data.sourceCode },
      include: { brand: { select: { name: true } } },
    });
    if (!source || !source.active) {
      return NextResponse.json({ error: "QR source is not available" }, { status: 404 });
    }
    const scan = await prisma.qrScan.create({ data: { sourceId: source.id } });
    return NextResponse.json({
      scanToken: await createScanToken(scan.id, source.id),
      source: { code: source.code, name: source.name },
      brand: { name: source.brand.name },
    });
  } catch {
    return NextResponse.json(
      { error: "ระบบยังไม่พร้อมเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง" },
      { status: 503 },
    );
  }
}

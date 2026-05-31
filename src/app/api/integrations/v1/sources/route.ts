import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

const schema = z.object({
  code: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  qrUrl: z.string().url().optional(),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.qrSource.findMany({
    where: { brandId: integration.brandId },
    include: {
      tag: { select: { code: true, name: true } },
      _count: { select: { scans: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ brand: integration.brand, sources });
}

export async function POST(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid QR source input" }, { status: 400 });

  const { name, active } = parsed.data;
  
  // Auto-generate random hash for code if not provided (8 chars)
  const code = parsed.data.code || require("node:crypto").randomBytes(4).toString("hex");
  
  // Auto-generate LIFF URL if not provided
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const qrUrl = parsed.data.qrUrl || (liffId ? `https://liff.line.me/${liffId}?source=${code}` : `http://localhost:3000/join?source=${code}`);

  const existing = await prisma.qrSource.findUnique({ where: { code } });
  if (existing && existing.brandId !== integration.brandId) {
    return NextResponse.json({ error: "QR source code already exists" }, { status: 409 });
  }
  const source = await prisma.qrSource.upsert({
    where: { code },
    update: { name, qrUrl, active },
    create: { brandId: integration.brandId, code, name, qrUrl, active },
  });
  const tag = await prisma.tag.upsert({
    where: { brandId_code: { brandId: integration.brandId, code: `source:${source.code}` } },
    update: { sourceId: source.id, name: source.name },
    create: {
      brandId: integration.brandId,
      sourceId: source.id,
      code: `source:${source.code}`,
      name: source.name,
    },
  });
  return NextResponse.json({ source, tag }, { status: existing ? 200 : 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

const schema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  qrUrl: z.url(),
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid QR source" }, { status: 400 });

  const existing = await prisma.qrSource.findUnique({ where: { code: parsed.data.code } });
  if (existing && existing.brandId !== integration.brandId) {
    return NextResponse.json({ error: "QR source code already exists" }, { status: 409 });
  }
  const source = await prisma.qrSource.upsert({
    where: { code: parsed.data.code },
    update: { name: parsed.data.name, qrUrl: parsed.data.qrUrl, active: parsed.data.active },
    create: { brandId: integration.brandId, ...parsed.data },
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

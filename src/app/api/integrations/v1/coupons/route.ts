import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  quota: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coupons = await prisma.coupon.findMany({
    where: { brandId: integration.brandId },
    include: { _count: { select: { claims: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ brand: integration.brand, coupons });
}

export async function POST(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });

  const coupon = await prisma.coupon.upsert({
    where: { brandId_title: { brandId: integration.brandId, title: parsed.data.title } },
    update: parsed.data,
    create: { brandId: integration.brandId, ...parsed.data },
  });
  return NextResponse.json({ coupon });
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const brand = await prisma.brand.upsert({
    where: { slug: "demo-brand" },
    update: {},
    create: { name: "Demo Refresh", slug: "demo-brand" },
  });

  for (const source of [
    { name: "QR on can - Batch A", code: "CAN-A-001" },
    { name: "General social QR", code: "SOCIAL-001" },
    { name: "Organic (LINE OA Search/Landing Page)", code: "ORGANIC" },
  ]) {
    await prisma.qrSource.upsert({
      where: { code: source.code },
      update: {},
      create: {
        brandId: brand.id,
        ...source,
        qrUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/join?source=${source.code}`,
      },
    });
  }

  const sources = await prisma.qrSource.findMany({ where: { brandId: brand.id } });
  for (const source of sources) {
    const tag = await prisma.tag.upsert({
      where: { brandId_code: { brandId: brand.id, code: `source:${source.code}` } },
      update: { sourceId: source.id, name: source.name },
      create: {
        brandId: brand.id,
        sourceId: source.id,
        code: `source:${source.code}`,
        name: source.name,
      },
    });
    const members = await prisma.member.findMany({
      where: { sourceId: source.id },
      select: { id: true },
    });
    for (const member of members) {
      await prisma.memberTag.upsert({
        where: { memberId_tagId: { memberId: member.id, tagId: tag.id } },
        update: {},
        create: { memberId: member.id, tagId: tag.id, reason: "SOURCE_TAG_BACKFILL" },
      });
    }
  }

  for (const coupon of [
    { title: "Welcome Discount 10%", description: "ส่วนลดต้อนรับสมาชิกใหม่ 10%", quota: 500 },
    { title: "Free Product Sample", description: "รับสินค้าตัวอย่างฟรี 1 ชิ้น", quota: 100 },
  ]) {
    await prisma.coupon.upsert({
      where: { brandId_title: { brandId: brand.id, title: coupon.title } },
      update: {},
      create: { brandId: brand.id, ...coupon },
    });
  }

  if (process.env.INTEGRATION_API_KEY) {
    await prisma.integrationApiKey.upsert({
      where: {
        keyHash: createHash("sha256").update(process.env.INTEGRATION_API_KEY).digest("hex"),
      },
      update: { active: true },
      create: {
        brandId: brand.id,
        name: "Demo brand integration",
        keyHash: createHash("sha256").update(process.env.INTEGRATION_API_KEY).digest("hex"),
      },
    });
  }
}

main().finally(async () => prisma.$disconnect());

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireIntegration } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.member.findMany({
    where: { brandId: integration.brandId },
    include: {
      source: { select: { code: true, name: true } },
      tags: { include: { tag: { select: { code: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ brand: integration.brand, members });
}

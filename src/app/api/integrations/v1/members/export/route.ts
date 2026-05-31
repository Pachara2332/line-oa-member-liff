import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { requireIntegration } from "@/lib/integration-auth";

export async function GET(request: Request) {
  const integration = await requireIntegration(request);
  if (!integration) return new Response("Unauthorized", { status: 401 });

  const members = await prisma.member.findMany({
    where: { brandId: integration.brandId },
    include: { source: true, tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows = [
    ["lineUserId", "displayName", "phone", "email", "sourceCode", "sourceName", "tags", "registeredAt"],
    ...members.map((member) => [
      member.lineUserId,
      member.displayName,
      member.phone,
      member.email,
      member.source.code,
      member.source.name,
      member.tags.map(({ tag }) => tag.code).join("|"),
      member.createdAt.toISOString(),
    ]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${integration.brand.slug}-members.csv"`,
    },
  });
}

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export async function requireIntegration(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  return prisma.integrationApiKey.findFirst({
    where: {
      keyHash: createHash("sha256").update(apiKey).digest("hex"),
      active: true,
    },
    include: { brand: true },
  });
}

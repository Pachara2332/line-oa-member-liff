import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "local-development-secret-change-me",
);

export async function createScanToken(scanId: string, sourceId: string) {
  return new SignJWT({ scanId, sourceId, type: "scan" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}

export async function verifyScanToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "scan") throw new Error("Invalid scan token");
  return payload as { scanId: string; sourceId: string; type: "scan" };
}

export async function createMemberToken(memberId: string, brandId: string) {
  return new SignJWT({ memberId, brandId, type: "member" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret);
}

export async function verifyMemberToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "member") throw new Error("Invalid member token");
  return payload as { memberId: string; brandId: string; type: "member" };
}

import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidLineSignature(body: string, signature: string | null) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

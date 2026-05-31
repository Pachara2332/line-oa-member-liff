export type LineProfile = {
  sub: string;
  name?: string;
  picture?: string;
};

export async function verifyLineIdToken(
  idToken: string | undefined,
  demoLineUserId: string | undefined,
): Promise<LineProfile> {
  if (process.env.ALLOW_DEMO_LIFF === "true" && demoLineUserId) {
    return { sub: demoLineUserId, name: "Demo LINE User" };
  }

  if (!idToken || !process.env.LINE_LIFF_CHANNEL_ID) {
    throw new Error("Missing LINE credentials");
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: process.env.LINE_LIFF_CHANNEL_ID,
  });
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("LINE ID token verification failed");
  return (await response.json()) as LineProfile;
}

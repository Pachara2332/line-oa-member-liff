import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const incoming = await searchParams;
  const forwarded = new URLSearchParams();

  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) {
      value.forEach((item) => forwarded.append(key, item));
    } else if (value) {
      forwarded.set(key, value);
    }
  }

  redirect(`/join${forwarded.size ? `?${forwarded.toString()}` : ""}`);
}

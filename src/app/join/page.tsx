import { MemberJourney } from "@/components/member-journey";

function getSourceFromLiffState(liffState: string | undefined) {
  if (!liffState) return "";
  try {
    return new URL(decodeURIComponent(liffState), "https://liff.local").searchParams.get("source") ?? "";
  } catch {
    return "";
  }
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; demo?: string; "liff.state"?: string }>;
}) {
  const params = await searchParams;
  const source = params.source || getSourceFromLiffState(params["liff.state"]);
  return <MemberJourney demoRequested={params.demo === "1"} sourceCode={source} />;
}

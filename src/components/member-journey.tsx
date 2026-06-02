"use client";

import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Check, Gift, LoaderCircle, MapPin, Sparkles } from "lucide-react";

type Coupon = { id: string; title: string; description: string | null };
type TrackingContext = {
  scanToken: string;
  source: { code: string; name: string };
  brand: { name: string };
};
type LiffProfile = {
  name?: string;
  email?: string;
  birthdate?: string;
  phone_number?: string;
};

const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
const allowDemoLiff = process.env.NEXT_PUBLIC_ALLOW_DEMO_LIFF === "true";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned ${response.status} ${response.statusText || "an invalid response"}`);
  }
}

function getSourceFromLocation() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const directSource = params.get("source");
  if (directSource) return directSource;

  const liffState = params.get("liff.state");
  if (!liffState) return "";

  try {
    return new URL(decodeURIComponent(liffState), window.location.origin).searchParams.get("source") ?? "";
  } catch {
    return "";
  }
}

export function MemberJourney({
  sourceCode,
  demoRequested,
}: {
  sourceCode: string;
  demoRequested: boolean;
}) {
  const demoMode = allowDemoLiff && demoRequested;
  const [effectiveSource, setEffectiveSource] = useState(sourceCode);
  const [tracking, setTracking] = useState<TrackingContext>();
  const [idToken, setIdToken] = useState<string>();
  const [liffReady, setLiffReady] = useState(demoMode);
  const [liffProfile, setLiffProfile] = useState<LiffProfile>();
  const [loading, setLoading] = useState(true);
  const [memberLookupDone, setMemberLookupDone] = useState(demoMode);
  const [liffError, setLiffError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberToken, setMemberToken] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string>();

  useEffect(() => {
    if (!effectiveSource) return;

    fetch("/api/tracking/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode: effectiveSource }),
    })
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.error);
        setTracking(body);
      })
      .catch((error: unknown) => {
        const detail = getErrorMessage(error);
        setMessage(`ระบบสมัครสมาชิกติดต่อ API ไม่สำเร็จ (${detail}) กรุณาลองใหม่อีกครั้ง`);
      })
      .finally(() => setLoading(false));
  }, [effectiveSource]);

  useEffect(() => {
    if (demoMode) {
      return;
    }
    if (!liffId) return;
    import("@line/liff")
      .then(async ({ default: liff }) => {
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        const token = liff.getIDToken();
        if (!token) throw new Error("LINE ID token is missing");
        setIdToken(token);
        setLiffProfile(liff.getDecodedIDToken() ?? undefined);
        setEffectiveSource((current) => current || getSourceFromLocation());
        setLiffReady(true);
      })
      .catch((error: unknown) => {
        const detail = getErrorMessage(error);
        setLiffError(`ไม่สามารถเข้าสู่ระบบผ่าน LINE ได้ (${detail}) กรุณาเปิดใหม่จาก LINE OA`);
      });
  }, [demoMode]);

  useEffect(() => {
    if (demoMode || !tracking || !idToken) return;

    fetch("/api/liff/member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanToken: tracking.scanToken, idToken }),
    })
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.error);
        if (!body.member) return;
        setMemberName(body.member.displayName || "");
        setMemberToken(body.memberToken);
        setCoupons(body.coupons);
        setClaimed(body.claimedCouponIds);
      })
      .catch((error: unknown) => setMessage(getErrorMessage(error)))
      .finally(() => setMemberLookupDone(true));
  }, [demoMode, idToken, tracking]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tracking) return;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName"));
    const response = await fetch("/api/liff/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanToken: tracking.scanToken,
        idToken,
        demoLineUserId: demoMode ? `demo-${form.get("phone")}` : undefined,
        displayName,
        phone: form.get("phone"),
        email: form.get("email"),
        birthDate: form.get("birthDate"),
        consent: form.get("consent") === "on",
      }),
    });
    const body = await readJson(response);
    setSubmitting(false);
    if (!response.ok) {
      setMessage(body.error);
      return;
    }
    setMemberName(displayName);
    setMemberToken(body.memberToken);
    setCoupons(body.coupons);
    setClaimed(body.claimedCouponIds);
  }

  async function claim(couponId: string) {
    setClaiming(couponId);
    setMessage("");
    const response = await fetch("/api/coupons/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponId, memberToken }),
    });
    const body = await readJson(response);
    setClaiming(undefined);
    if (!response.ok) {
      setMessage(body.error);
      return;
    }
    setClaimed((current) => current.includes(couponId) ? current : [...current, couponId]);
  }

  if (!demoMode && !liffId) return <ErrorScreen message="ยังไม่ได้ตั้งค่า LIFF ID" />;
  if (!liffReady) return liffError ? <ErrorScreen message={liffError} /> : <LoadingScreen />;
  if (!effectiveSource) return <ErrorScreen message="QR Code นี้ไม่มี source กรุณาสแกน QR Code ใหม่" />;
  if (loading) return message ? <ErrorScreen message={message} /> : <LoadingScreen />;
  if (!tracking) return <ErrorScreen message={message} />;
  if (!memberLookupDone) return <LoadingScreen />;
  if (memberToken) {
    return (
      <main className="mx-auto min-h-screen max-w-lg bg-[#f4faf6] px-5 py-7">
        <header className="rounded-[2rem] bg-[#0d6b4d] p-6 text-white shadow-lg shadow-emerald-900/15">
          <BadgeCheck className="text-emerald-200" size={36} />
          <p className="mt-5 text-sm text-emerald-100">สถานะสมาชิก</p>
          <h1 className="mt-1 text-3xl font-bold">สวัสดี {memberName}</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50">เลือกรับสิทธิ์พิเศษสำหรับสมาชิกใหม่ได้ทันที</p>
        </header>
        <section className="mt-7 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Member Benefits</p>
            <h2 className="mt-1 text-2xl font-bold">คูปองของคุณ</h2>
          </div>
          {coupons.map((coupon) => {
            const isClaimed = claimed.includes(coupon.id);
            return (
              <article className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm" key={coupon.id}>
                <div className="p-5">
                  <Gift className="text-[#e5942a]" size={28} />
                  <h3 className="mt-4 text-xl font-bold">{coupon.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{coupon.description}</p>
                </div>
                <button className="flex w-full items-center justify-center gap-2 bg-[#0d6b4d] px-5 py-4 font-bold text-white disabled:bg-emerald-100 disabled:text-emerald-800" disabled={isClaimed || claiming === coupon.id} onClick={() => claim(coupon.id)}>
                  {isClaimed ? <><Check size={18} /> รับสิทธิ์แล้ว</> : claiming === coupon.id ? "กำลังรับสิทธิ์..." : "กดรับสิทธิ์"}
                </button>
              </article>
            );
          })}
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[#f4faf6] px-5 py-7">
      <header className="relative overflow-hidden rounded-[2rem] bg-[#0d6b4d] p-6 text-white shadow-lg shadow-emerald-900/15">
        <Sparkles className="absolute right-5 top-5 text-emerald-300/70" size={30} />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">LINE OA Membership</p>
        <h1 className="mt-8 text-3xl font-bold">สมัครสมาชิก<br />รับสิทธิ์พิเศษ</h1>
        <p className="mt-3 text-sm leading-6 text-emerald-50">ลงทะเบียนเพียงไม่กี่ขั้นตอน เพื่อรับข่าวสารและคูปองจาก {tracking.brand.name}</p>
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-emerald-50">
          <MapPin size={15} /> {tracking.source.name}
        </div>
      </header>
      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
        {demoMode && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Demo mode: ระบบจะจำลอง LINE user จากเบอร์โทรสำหรับการทดสอบ local</p>}
        <form className="space-y-4" onSubmit={register}>
          <Field defaultValue={liffProfile?.name} label="ชื่อ - นามสกุล" name="displayName" placeholder="กรอกชื่อของคุณ" required />
          <Field defaultValue={liffProfile?.phone_number} label="เบอร์โทรศัพท์" name="phone" placeholder="08x-xxx-xxxx" required type="tel" />
          <Field defaultValue={liffProfile?.email} label="Email" name="email" placeholder="name@example.com" type="email" />
          <Field defaultValue={liffProfile?.birthdate} label="วันเกิด" name="birthDate" type="date" />
          <label className="flex gap-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <input className="mt-1 accent-emerald-700" name="consent" required type="checkbox" />
            ยินยอมให้จัดเก็บข้อมูลเพื่อสมัครสมาชิก รับสิทธิ์ และรับข่าวสารจากแบรนด์
          </label>
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d6b4d] px-4 py-4 font-bold text-white hover:bg-[#07563d] disabled:opacity-60" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin" size={18} />}
            {submitting ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
          </button>
        </form>
      </section>
      <p className="mt-5 text-center text-[11px] text-slate-400">Source: {tracking.source.code}</p>
    </main>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-600" {...props} />
    </label>
  );
}

function LoadingScreen() {
  return <main className="flex min-h-screen items-center justify-center text-emerald-700"><LoaderCircle className="animate-spin" size={34} /></main>;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-sm rounded-3xl bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-bold">ไม่สามารถเปิดหน้าสมัครสมาชิกได้</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        <button
          className="mt-5 rounded-xl bg-[#0d6b4d] px-5 py-3 text-sm font-bold text-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          ลองใหม่อีกครั้ง
        </button>
      </section>
    </main>
  );
}

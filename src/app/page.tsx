import Link from "next/link";
import { ArrowRight, BadgeCheck, Gift, Sparkles, Zap } from "lucide-react";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const params = await searchParams;
  const source = params.source || "ORGANIC";

  return (
    <main className="min-h-screen bg-slate-50 selection:bg-emerald-200">
      <div className="relative overflow-hidden bg-emerald-950 pb-32 pt-20">
        <div className="absolute -left-[10%] -top-[20%] h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute -right-[10%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-teal-500/20 blur-[100px]" />
        
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/50 bg-emerald-800/30 px-4 py-1.5 text-sm font-medium text-emerald-300">
            <Sparkles size={16} /> Welcome to the Club
          </div>
          <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            สัมผัสประสบการณ์<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              สิทธิพิเศษเหนือระดับ
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-emerald-100/80">
            สมัครสมาชิกวันนี้ เพื่อรับข่าวสาร สิทธิประโยชน์ และคูปองส่วนลดพิเศษเฉพาะคุณ 
            พร้อมระบบสะสมแต้มที่ง่ายและสะดวกที่สุดผ่าน LINE
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link 
              href={`/join?source=${source}`}
              className="group flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-4 font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/40 active:scale-95"
            >
              สมัครสมาชิกฟรี 
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="grid gap-8 sm:grid-cols-3">
          <FeatureCard 
            icon={<Gift className="text-amber-500" size={32} />}
            title="Welcome Coupon"
            desc="รับทันทีคูปองส่วนลดพิเศษสำหรับสมาชิกใหม่"
          />
          <FeatureCard 
            icon={<Zap className="text-blue-500" size={32} />}
            title="Fast & Seamless"
            desc="ไม่ต้องโหลดแอป สมัครผ่าน LINE ได้เลย"
          />
          <FeatureCard 
            icon={<BadgeCheck className="text-emerald-500" size={32} />}
            title="Exclusive Offers"
            desc="สิทธิพิเศษและโปรโมชั่นก่อนใคร"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="inline-flex rounded-2xl bg-slate-50 p-4">
        {icon}
      </div>
      <h3 className="mt-6 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

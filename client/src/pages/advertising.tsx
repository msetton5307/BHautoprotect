import { useRef } from "react";
import Navigation from "@/components/navigation";
import { QuoteForm } from "@/components/quote-form";
import { Button } from "@/components/ui/button";
import { Check, Shield, Clock3 } from "lucide-react";

const highlights = [
  {
    icon: Shield,
    title: "Nationwide coverage",
    description: "Use any ASE-certified repair shop with direct payment from BH Auto Protect.",
  },
  {
    icon: Clock3,
    title: "Rapid approvals",
    description: "Average claim turnaround is under 24 hours so you get back on the road fast.",
  },
  {
    icon: Check,
    title: "Conversion ready",
    description: "Purpose-built landing experience keeps attention on your headline offer and lead form.",
  },
];

const checklist = [
  "100K+ drivers protected coast to coast",
  "30,000+ repair partners ready to serve you",
  "Flexible monthly payments with no hidden fees",
  "Concierge team available 24/7 for claims",
];

export default function AdvertisingLanding() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleQuoteClick = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation onGetQuote={handleQuoteClick} />

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_55%)]" aria-hidden />
        <section className="relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
              <div className="space-y-8">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Limited-time online offer
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight text-white">
                  Drive with confidence and advertise your exclusive BH Auto Protect savings
                </h1>
                <p className="text-lg sm:text-xl text-blue-100 max-w-2xl">
                  Share this dedicated landing page with your audience and capture customer information instantly. Every submission receives concierge-level plan recommendations tailored to their vehicle.
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-transform duration-500 hover:-translate-y-1"
                    >
                      <item.icon className="h-8 w-8 text-amber-300" />
                      <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm text-blue-100">{item.description}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-blue-50 px-8 py-6 text-base font-semibold shadow-lg shadow-slate-900/30"
                    onClick={handleQuoteClick}
                  >
                    Jump to offer form
                  </Button>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100 max-w-xl">
                    <Check className="h-5 w-5 text-emerald-300" />
                    <span>Shareable URL ideal for ads, email campaigns, and partner promotions.</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-8 rounded-[36px] bg-white/10 blur-3xl" aria-hidden />
                <div className="relative rounded-[32px] border border-white/20 bg-gradient-to-br from-white/15 via-white/5 to-transparent p-8 backdrop-blur-xl">
                  <h2 className="text-3xl font-semibold text-white">Everything customers need in one place</h2>
                  <p className="mt-3 text-blue-100">
                    Share this page and let shoppers explore coverage perks, then complete the secure form to lock in their discounted quote.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-blue-100">
                    {checklist.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="mt-1 h-4 w-4 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-white text-slate-900">
          <div className="absolute inset-x-0 -top-12 flex justify-center" aria-hidden>
            <div className="h-24 w-24 rounded-full bg-amber-200/70 blur-3xl" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                  Customer quote request
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                  Capture qualified leads directly from your campaigns
                </h2>
                <p className="text-lg text-slate-600">
                  Embed this URL in your ads, social posts, or referral emails. Visitors land on a streamlined experience and complete the same trusted quote request form used on your main website.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <Shield className="h-6 w-6 text-primary" />
                    <p className="mt-3 font-semibold text-slate-900">Security first</p>
                    <p className="mt-2">
                      Encrypted submission flows keep customer data protected and routed straight to your sales team.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <Clock3 className="h-6 w-6 text-primary" />
                    <p className="mt-3 font-semibold text-slate-900">Instant notifications</p>
                    <p className="mt-2">
                      Every completed form triggers your internal workflows so your advisors can respond immediately.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-6 rounded-[32px] bg-slate-100" aria-hidden />
                <div className="relative rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
                  <QuoteForm
                    ref={formRef}
                    title="Lock in your exclusive offer"
                    description="Complete the secure form below to receive your personalized coverage quote and promotional pricing."
                    submitLabel="Claim my savings"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

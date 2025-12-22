import { useRef } from "react";
import Navigation from "@/components/navigation";
import { QuoteForm } from "@/components/quote-form";
import { Check, Gift, ShieldCheck, Sparkles, Star, Wrench } from "lucide-react";

const perks = [
  {
    title: "$700 instant coverage credit",
    bullets: [
      "Promo applied automatically at submission",
      "Savings locked in for 72 hours",
      "No payment required today",
    ],
    icon: Gift,
  },
  {
    title: "Premium protection plans",
    bullets: [
      "Comprehensive coverage beyond powertrain",
      "Modern tech and electronics included",
      "Plans tailored to your budget",
    ],
    icon: ShieldCheck,
  },
  {
    title: "Repairs on your schedule",
    bullets: [
      "Use any certified mechanic nationwide",
      "Direct payment to repair facility",
      "Flexible timing that fits your life",
    ],
    icon: Wrench,
  },
];

const trustSignals = [
  { label: "4.8/5 rating", icon: Star },
  { label: "15,000+ vehicles protected", icon: ShieldCheck },
  { label: "Licensed in all 50 states", icon: Sparkles },
];

const testimonials = [
  {
    quote: "Fast quote, friendly specialist, and the discount really showed up.",
    name: "Jasmine R.",
    state: "FL",
  },
  {
    quote: "Covered my transmission repair with zero hassle.",
    name: "David L.",
    state: "AZ",
  },
  {
    quote: "Easy process and clear pricing. Highly recommend.",
    name: "Marissa K.",
    state: "OH",
  },
];

export default function PromoPage() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleQuoteClick = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation
        onGetQuote={handleQuoteClick}
        showNavigationLinks={false}
        showGetQuoteButton={false}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 pb-28 pt-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-secondary to-primary p-6 text-white shadow-2xl sm:p-12 lg:p-16">
          <div className="absolute -left-32 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="absolute -right-20 top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr,1fr] lg:items-start">
            <div className="order-2 space-y-6 lg:order-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/90">
                <Sparkles className="h-4 w-4" /> VIP Promo Event
              </span>
              <div className="space-y-4">
                <h1 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl">
                  Get Up to $700 Off Extended Coverage for Your Car
                </h1>
                <p className="max-w-xl text-sm text-blue-50 sm:text-base">
                  Takes under 2 minutes · No payment required · Offer locked for 72 hours.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-blue-50 sm:text-sm">
                {trustSignals.map((signal) => (
                  <span
                    key={signal.label}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1"
                  >
                    <signal.icon className="h-4 w-4 text-yellow-200" />
                    {signal.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="order-1 space-y-6 lg:order-2">
              <QuoteForm
                ref={formRef}
                title="Start your 2-step quote"
                description="Step 1 takes under a minute. Step 2 confirms where to send your $700 discount quote."
                submitLabel="Get My $700 Discount Quote"
                leadSource="BWF-Promo"
              />
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-blue-50">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                  Driver reviews
                </p>
                <div className="mt-4 grid gap-4">
                  {testimonials.map((testimonial) => (
                    <div key={testimonial.quote} className="space-y-2">
                      <p className="text-sm text-blue-50">“{testimonial.quote}”</p>
                      <p className="text-xs font-semibold text-white">
                        {testimonial.name} · {testimonial.state}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="perks" className="grid gap-10 lg:grid-cols-3">
          {perks.map((perk) => (
            <div
              key={perk.title}
              className="group rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg transition hover:-translate-y-2 hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner shadow-primary/20">
                <perk.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{perk.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-blue-100">
                {perk.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-200" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="grid gap-12 lg:grid-cols-[1.1fr,1fr] lg:items-start">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Secure your discounted quote in two minutes</h2>
            <ul className="space-y-3 text-sm text-blue-100">
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>Only the details needed to tailor coverage to your car.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>Secure submission with your $700 credit held for 72 hours.</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>No obligation and no payment until you approve your plan.</span>
              </li>
            </ul>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-blue-100">
              <p className="font-semibold text-white">Here&apos;s what happens next:</p>
              <ol className="mt-4 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">1</span>
                  <span>Share your vehicle details in step one.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">2</span>
                  <span>Confirm where we should send your discounted quote.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">3</span>
                  <span>A licensed specialist reviews your options with the $700 credit applied.</span>
                </li>
              </ol>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 text-blue-50 shadow-2xl backdrop-blur sm:p-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Every plan includes</p>
              <ul className="space-y-4 text-sm text-blue-100">
                <li className="flex items-start gap-3">
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <span>Roadside assistance, towing, and rental coverage</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <span>Fast claims with live specialist support</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <span>Flexible deductibles that match your budget</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <div
          className="mx-auto flex w-full max-w-6xl"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <button
            type="button"
            onClick={handleQuoteClick}
            className="flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-green-600"
          >
            Get My $700 Discount Quote
          </button>
        </div>
      </div>
    </div>
  );
}

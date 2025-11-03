import { useRef } from "react";
import Navigation from "@/components/navigation";
import { QuoteForm } from "@/components/quote-form";
import { Button } from "@/components/ui/button";
import { Check, Clock, Gift, ShieldCheck, Sparkles, Wrench } from "lucide-react";

const perks = [
  {
    title: "$700 instant coverage credit",
    description:
      "Claim your limited-time discount the moment you submit the form. We'll lock in pricing with $700 already applied.",
    icon: Gift,
  },
  {
    title: "Premium protection plans",
    description:
      "Choose from comprehensive vehicle service contracts that go beyond powertrain and cover critical technology.",
    icon: ShieldCheck,
  },
  {
    title: "Repairs on your schedule",
    description:
      "Use any certified mechanic nationwide and let us handle payment directly so you can drive away stress-free.",
    icon: Wrench,
  },
];

const inclusions = [
  "Roadside assistance, towing, and rental car coverage",
  "Fast claims with 24/7 support from live specialists",
  "Flexible deductibles that match how you drive",
];

const milestones = [
  { label: "15,000+ vehicles protected", sublabel: "Families, commuters, and car lovers nationwide" },
  { label: "4.8/5 satisfaction", sublabel: "Drivers love our fast, no-hassle claims" },
  { label: "72-hour pricing guarantee", sublabel: "Submit now and your savings stay locked in" },
];

export default function PromoPage() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleQuoteClick = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation onGetQuote={handleQuoteClick} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-24 pt-16">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-secondary to-primary p-10 text-white shadow-2xl sm:p-16">
          <div className="absolute -left-32 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="absolute -right-20 top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="relative grid gap-12 lg:grid-cols-[1.2fr,1fr] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/90">
                <Sparkles className="h-4 w-4" /> VIP Promo Event
              </span>
              <div className="space-y-4">
                <h1 className="text-4xl font-black sm:text-5xl lg:text-6xl">
                  Drive into savings with <span className="text-yellow-200">$700 off</span> your vehicle protection.
                </h1>
                <p className="max-w-xl text-lg text-blue-50">
                  This exclusive advertisement unlocks our biggest discount of the season. Share a few details and we&apos;ll send a
                  personalized quote with $700 already taken off your plan price.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-white text-slate-900 shadow-xl shadow-primary/30 transition hover:bg-blue-50"
                  onClick={handleQuoteClick}
                >
                  Claim My $700 Savings
                </Button>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                  <Clock className="h-5 w-5" />
                  Offer locks in for 72 hours after you submit.
                </div>
              </div>
              <div className="grid gap-6 rounded-2xl border border-white/20 bg-white/10 p-6 text-sm leading-relaxed text-blue-50 sm:grid-cols-3">
                {milestones.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-lg font-semibold text-white">{item.label}</p>
                    <p className="text-blue-100">{item.sublabel}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-lg sm:p-8">
                  <div className="space-y-3 text-center">
                    <p className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                      <Gift className="h-4 w-4" /> Bonus Included
                    </p>
                    <h2 className="text-2xl font-bold">We pay the first $700</h2>
                    <p className="text-sm text-slate-600">
                      Submit your information today and our team will call with a quote that already includes the discount. No hidden hoops—just premium coverage for less.
                    </p>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    {inclusions.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
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
              <p className="mt-3 text-sm text-blue-100">{perk.description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-12 lg:grid-cols-[1.1fr,1fr] lg:items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Secure your discounted quote in two minutes</h2>
            <p className="text-base text-blue-100">
              We only ask for information that helps our specialists tailor a plan for your vehicle. It&apos;s fast, secure, and obligates you to nothing—except locking in that $700 savings.
            </p>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-blue-100">
              <p className="font-semibold text-white">Here&apos;s what happens next:</p>
              <ol className="mt-4 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">1</span>
                  <span>Share your vehicle and contact details in the secure form.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">2</span>
                  <span>Our licensed protection specialist calls within a business day with your discounted quote.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/40 text-sm font-semibold text-white">3</span>
                  <span>You decide how to activate coverage—your $700 credit is waiting.</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl sm:p-8">
            <QuoteForm
              ref={formRef}
              className="bg-transparent"
              title="Lock in your $700 discount"
              description="Complete the form below and we’ll prepare a custom quote with the promo automatically applied."
              submitLabel="Send me my discounted quote"
              leadSource="promo-700-off"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

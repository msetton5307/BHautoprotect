import { useState } from "react";
import Navigation from "@/components/navigation";
import QuoteModal from "@/components/quote-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Shield, FileText, Clock, Wrench } from "lucide-react";

const coverageHighlights = [
  {
    icon: Shield,
    title: "Core component protection",
    description:
      "Engine, transmission, drivetrain, and electrical systems are covered from day one with low deductibles and concierge support.",
  },
  {
    icon: FileText,
    title: "Clear, modern policy language",
    description:
      "No dense legal jargon—our contracts use plain language summaries, highlighted coverage examples, and easy-to-read exclusions.",
  },
  {
    icon: Clock,
    title: "Rapid claims handling",
    description:
      "File online or by phone 24/7. Claims are assigned to a dedicated specialist within 1 business hour with real-time status updates.",
  },
];

const coverageList = [
  "Powertrain essentials (engine, transmission, AWD/4WD components)",
  "Advanced electronics, infotainment systems, sensors, and ADAS technology",
  "Air conditioning, heating, fuel systems, and cooling assemblies",
  "Rental car reimbursement and trip interruption coverage while repairs are in progress",
  "Nationwide roadside assistance including towing, battery service, and lockout support",
];

const claimSteps = [
  {
    step: "01",
    title: "Contact claims concierge",
    description:
      "Call or submit a claim in the portal anytime. We'll confirm your coverage and recommend a preferred repair facility if you need one.",
  },
  {
    step: "02",
    title: "Approve the repair plan",
    description:
      "Your specialist coordinates directly with the shop, reviews diagnostics, and sends you a transparent cost breakdown before any work starts.",
  },
  {
    step: "03",
    title: "Drive away with confidence",
    description:
      "We pay the shop directly for covered repairs and reimburse eligible rental or travel expenses so you can get back on the road quickly.",
  },
];

export default function PolicyOverview() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const openQuoteModal = () => setIsQuoteModalOpen(true);
  const closeQuoteModal = () => setIsQuoteModalOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={openQuoteModal} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-100 text-primary px-4 py-1 text-sm font-semibold tracking-[0.18em] uppercase">
              Protection built for real drivers
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Your BH Auto Protect policy, demystified
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Every contract includes straightforward coverage, white-glove claim support, and practical extras that keep you moving.
              Explore the highlights below or download a sample policy to review the fine print at your own pace.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <Button className="bg-gradient-to-r from-primary via-secondary to-primary text-white px-8 py-6 text-base" size="lg" onClick={openQuoteModal}>
                Get my personalized quote
              </Button>
              <a
                href="#policy-snapshot"
                className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-6 py-3 text-base font-semibold text-primary shadow-sm hover:border-primary hover:text-primary/90"
              >
                View sample policy
              </a>
            </div>
            <div className="mt-10 grid sm:grid-cols-2 gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <span>Backed by ASE-certified claims specialists</span>
              </div>
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-primary" />
                <span>Use any licensed repair facility nationwide</span>
              </div>
            </div>
          </div>
          <Card className="shadow-xl border-blue-100 bg-white">
            <CardContent className="p-8 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Coverage snapshot</p>
                <p className="mt-3 text-2xl font-bold text-gray-900">Average claim paid: $1,287</p>
                <p className="mt-2 text-sm text-gray-500">Most customers activate coverage within 7 days of purchasing their vehicle.</p>
              </div>
              <ul className="space-y-4">
                {coverageList.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-secondary mt-1" />
                    <span className="text-sm text-gray-600 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-primary">
                Need help comparing coverage? Call <a className="font-semibold" href="tel:+13024068053">(302) 406-8053</a> and our concierge team will walk through the policy with you.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid lg:grid-cols-3 gap-6" id="coverage">
          {coverageHighlights.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-blue-100 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-7 space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">What your policy includes</h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Whether you choose Basic, Silver, or Gold, every policy is built around the same promise: quick coverage decisions,
              transparent pricing, and real humans who can help at every turn.
            </p>
            <ul className="mt-6 space-y-4">
              {coverageList.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-1 h-5 w-5 text-secondary" />
                  <span className="text-sm text-gray-600 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-blue-100 bg-white shadow-lg">
            <CardContent className="p-8 space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">How claims are paid</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                92% of covered claims are paid directly to the repair facility—no paperwork, no waiting on reimbursements. If a claim isn't covered, we'll explain exactly why and offer maintenance tips to prevent future issues.
              </p>
              <ul className="space-y-4">
                {claimSteps.map((step) => (
                  <li key={step.step} className="flex gap-4">
                    <span className="font-semibold text-primary text-sm tracking-[0.2em] pt-1">{step.step}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{step.title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section id="policy-snapshot" className="rounded-3xl bg-white border border-blue-100 shadow-xl p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Sample contract preview</p>
              <h2 className="mt-3 text-3xl font-bold text-gray-900">Download the latest BH Auto Protect policy</h2>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Review the full terms, including waiting periods, transfer options, cancellation policy, and state-specific endorsements.
                The sample mirrors what you'll receive digitally after purchase.
              </p>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-primary via-secondary to-primary text-white px-8 py-6 text-base"
              size="lg"
            >
              <a href="/legal/terms">
                Review full policy terms
              </a>
            </Button>
          </div>
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-semibold text-primary">State compliance</p>
              <p className="mt-1 text-gray-600">Fully compliant in all 50 states with required disclosures.</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-semibold text-primary">Transfer friendly</p>
              <p className="mt-1 text-gray-600">Sell your car? Transfer coverage to the next owner in minutes.</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-semibold text-primary">Flexible billing</p>
              <p className="mt-1 text-gray-600">Monthly, semi-annual, or paid-in-full options with autopay reminders.</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-semibold text-primary">Money-back guarantee</p>
              <p className="mt-1 text-gray-600">30-day review period with a full refund if you change your mind.</p>
            </div>
          </div>
        </section>

        <section className="text-center bg-gradient-to-r from-primary via-secondary to-primary text-white rounded-3xl px-8 py-16 shadow-lg">
          <h2 className="text-3xl font-bold">Ready to protect your next repair bill?</h2>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg opacity-90">
            Get a custom quote in under two minutes and see how affordable comprehensive protection can be. Our team is on standby if you'd rather talk it through.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="bg-white text-primary hover:bg-blue-50 px-8 py-6 text-base" size="lg" onClick={openQuoteModal}>
              Start my quote
            </Button>
            <a
              href="tel:+13024068053"
              className="inline-flex items-center justify-center rounded-lg border border-white/60 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              Speak with an advisor
            </a>
          </div>
        </section>
      </main>
      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}

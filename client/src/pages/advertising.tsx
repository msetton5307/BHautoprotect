import { useRef } from "react";
import Navigation from "@/components/navigation";
import { QuoteForm } from "@/components/quote-form";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const benefits = [
  "Plans for new and used vehicles",
  "Use any certified repair shop",
  "Fast claims and direct payments",
];

export default function AdvertisingLanding() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleQuoteClick = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation onGetQuote={handleQuoteClick} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-16">
        <section className="space-y-6 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">Protection plans drivers can trust</h1>
          <p className="mx-auto max-w-2xl text-lg text-blue-100">
            Introduce customers to BH Auto Protect&apos;s coverage options and help them request a personalized quote in just a few minutes.
          </p>
          <div className="grid gap-4 text-left text-sm text-blue-100 sm:grid-cols-3">
            {benefits.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" className="bg-white text-primary hover:bg-blue-50" onClick={handleQuoteClick}>
              Start my quote
            </Button>
            <p className="text-sm text-blue-200">No obligations. We only ask for what we need to tailor coverage.</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl sm:p-8">
          <div className="mx-auto max-w-xl space-y-4 text-center">
            <h2 className="text-3xl font-semibold">Request your personalized plan</h2>
            <p className="text-base text-slate-600">
              Tell us about the vehicle you want to protect. A specialist will follow up with pricing and plan details that match your mileage and driving habits.
            </p>
          </div>
          <div className="mt-8">
            <QuoteForm
              ref={formRef}
              title="Tell us about your vehicle"
              description="We use these details to match you with the right level of coverage."
              submitLabel="Get my quote"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

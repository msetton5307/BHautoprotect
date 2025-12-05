import { useMemo, useState } from "react";
import Navigation from "@/components/navigation";
import { COVERAGE_PLANS, type CoveragePlanId } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import QuoteModal from "@/components/quote-modal";

const PLAN_META: Record<CoveragePlanId, { tagline: string; accent: string; badge?: string; highlight: string }> = {
  gold: {
    tagline: "Full protection for premium vehicles",
    accent: "from-amber-500 via-orange-500 to-amber-400",
    badge: "Best value",
    highlight: "Covers advanced tech, hybrid systems, and full suspension",
  },
  silver: {
    tagline: "Balanced coverage for daily drivers",
    accent: "from-blue-500 via-indigo-500 to-blue-400",
    badge: "Popular pick",
    highlight: "Expanded protection beyond core components",
  },
  basic: {
    tagline: "Essential coverage that keeps you moving",
    accent: "from-slate-500 via-slate-600 to-slate-500",
    highlight: "Covers the core systems with roadside support",
  },
};

const FeatureList = ({ features }: { features: readonly string[] }) => (
  <ul className="space-y-3 text-sm text-gray-700">
    {features.map((feature) => (
      <li key={feature} className="flex items-start gap-2">
        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-3.5 w-3.5" />
        </span>
        <span className="leading-relaxed">{feature}</span>
      </li>
    ))}
  </ul>
);

type PlanCardProps = {
  planId: CoveragePlanId;
  onSelect: () => void;
};

function PlanCard({ planId, onSelect }: PlanCardProps) {
  const plan = COVERAGE_PLANS[planId];
  const meta = PLAN_META[planId];
  const visibleFeatures = useMemo(() => plan.features.slice(0, 8), [plan.features]);
  const remainingCount = plan.features.length - visibleFeatures.length;

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-none shadow-xl ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className={`relative overflow-hidden bg-gradient-to-r ${meta.accent} px-6 pb-10 pt-8 text-white`}>
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Plan</p>
            <h3 className="text-3xl font-bold leading-tight">{plan.name}</h3>
            <p className="mt-2 text-sm text-white/90">{meta.tagline}</p>
          </div>
          {meta.badge ? (
            <Badge className="flex items-center gap-1 bg-white/15 text-xs font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" /> {meta.badge}
            </Badge>
          ) : null}
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-6 bg-white px-6 py-7">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">What&apos;s included</p>
          <p className="mt-1 text-sm text-gray-600">{meta.highlight}</p>
        </div>

        <FeatureList features={visibleFeatures} />
        {remainingCount > 0 ? (
          <p className="text-sm font-semibold text-gray-700">+ {remainingCount} more covered components</p>
        ) : null}

        <div className="mt-auto flex flex-col gap-3">
          {plan.description ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {plan.description}
            </div>
          ) : null}
          <Button
            className="w-full bg-slate-900 text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800"
            size="lg"
            onClick={onSelect}
          >
            Get this plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Plans() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const openQuoteModal = () => setIsQuoteModalOpen(true);
  const closeQuoteModal = () => setIsQuoteModalOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={openQuoteModal} />
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Coverage plans</p>
          <h1 className="mt-3 text-4xl font-bold text-gray-900">Pick the protection that fits your drive</h1>
          <p className="mt-4 text-lg text-gray-600">
            Clean, simple plan cards with the highlights that matter. Compare what&apos;s covered and lock in your quote in one click.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          <PlanCard planId="basic" onSelect={openQuoteModal} />
          <PlanCard planId="gold" onSelect={openQuoteModal} />
          <PlanCard planId="silver" onSelect={openQuoteModal} />
        </div>
      </section>
      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}

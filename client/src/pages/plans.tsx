import { useState } from "react";
import Navigation from "@/components/navigation";
import { COVERAGE_PLANS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import QuoteModal from "@/components/quote-modal";

export default function Plans() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const openQuoteModal = () => setIsQuoteModalOpen(true);
  const closeQuoteModal = () => setIsQuoteModalOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={openQuoteModal} />
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 text-center">Coverage Plans</h1>
        <p className="text-lg text-gray-600 text-center mb-12">
          Explore our plans and choose the level of protection that's right for you.
        </p>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Basic Plan */}
          <Card className="relative hover:shadow-lg transition-shadow">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{COVERAGE_PLANS.basic.name}</h3>
                {COVERAGE_PLANS.basic.description && (
                  <p className="text-sm font-semibold text-primary">
                    {COVERAGE_PLANS.basic.description}
                  </p>
                )}
              </div>
              <ul className="space-y-2.5 mb-6">
                {COVERAGE_PLANS.basic.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={openQuoteModal}
              >
                Get a Quote
              </Button>
            </CardContent>
          </Card>

          {/* Gold Plan */}
          <Card className="relative border-2 border-primary hover:shadow-lg transition-shadow">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{COVERAGE_PLANS.gold.name}</h3>
                {COVERAGE_PLANS.gold.description && (
                  <p className="text-sm font-semibold text-primary">
                    {COVERAGE_PLANS.gold.description}
                  </p>
                )}
              </div>
              <ul className="space-y-2.5 mb-6">
                {COVERAGE_PLANS.gold.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={openQuoteModal}
              >
                Get a Quote
              </Button>
            </CardContent>
          </Card>

          {/* Silver Plan */}
          <Card className="relative hover:shadow-lg transition-shadow">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{COVERAGE_PLANS.silver.name}</h3>
                {COVERAGE_PLANS.silver.description && (
                  <p className="text-sm font-semibold text-primary">
                    {COVERAGE_PLANS.silver.description}
                  </p>
                )}
              </div>
              <ul className="space-y-2.5 mb-6">
                {COVERAGE_PLANS.silver.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={openQuoteModal}
              >
                Get a Quote
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}

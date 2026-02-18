import { useState } from "react";
import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import QuoteModal from "@/components/quote-modal";

type DisplayPlan = {
  name: string;
  features: readonly string[];
  description?: string;
  highlighted?: boolean;
};

const DISPLAY_PLANS: readonly DisplayPlan[] = [
  {
    name: "ESSENTIAL",
    features: [
      "Engine",
      "Transmission",
      "Drive Axle(s)",
      "AWD/4X4",
      "Cooling",
      "Brakes",
      "Dead Battery",
      "Out of Gas",
      "Parts & Labor",
      "Towing",
      "Locksmith",
      "Rental Car",
      "24/7 Roadside",
      "Steering (Manual or Power)",
      "Turbo / Supercharger",
      "Air Conditioning",
      "Fuel System",
      "Seals & Gaskets",
      "Electrical",
    ],
  },
  {
    name: "PREMIUM",
    features: [
      "Engine",
      "Transmission",
      "Drive Axle(s)",
      "AWD/4X4",
      "Cooling",
      "Brakes",
      "Dead Battery",
      "Out of Gas",
      "Parts & Labor",
      "Towing",
      "Locksmith",
      "Rental Car",
      "24/7 Roadside",
      "Steering (Manual or Power)",
      "Turbo / Supercharger",
      "Air Conditioning",
      "Fuel System",
      "Seals & Gaskets",
      "Electrical",
      "Anti-Lock Brakes (ABS)",
      "Heating",
      "Hi Tech Electronics",
      "Rear Suspension",
      "Front Suspension",
      "Hybrid",
    ],
  },
  {
    name: "EXCLUSIONARY",
    highlighted: true,
    description: "Most Comprehensive!",
    features: [
      "Engine",
      "Transmission",
      "Brakes",
      "Drive Axle(s)",
      "AWD / 4x4",
      "Dead Battery",
      "Cooling system",
      "Out of Gas",
      "Parts & Labor",
      "Towing",
      "Locksmith",
      "Rental Car",
      "24/7 Roadside",
      "Steering (Manual or Power)",
      "Turbo / Supercharger",
      "Air Conditioning",
      "Fuel System",
      "Seals & Gaskets",
      "Electrical",
      "Anti-Lock Brakes (ABS)",
      "Heating",
      "Hi Tech Electronics",
      "Rear Suspension",
      "Front Suspension",
      "Hybrid",
      "Many More",
    ],
  },
  {
    name: "EV EXCLUSIONARY",
    features: [
      "Electric Motor",
      "Transaxles",
      "Charger",
      "Battery Control Module",
      "Auxiliary Heater",
      "Brakes",
      "Drive Axle(s)",
      "AWD / 4x4",
      "Cooling system",
      "Parts & Labor",
      "Towing",
      "Locksmith",
      "Rental Car",
      "24/7 Roadside",
      "Steering",
      "Turbo / Supercharger",
      "Air Conditioning",
      "Electrical",
      "Anti-Lock Brakes (ABS)",
      "Heating",
      "Hi Tech Electronics",
      "Rear Suspension",
      "Front Suspension",
      "Many More",
    ],
  },
] as const;

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
        <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-8">
          {DISPLAY_PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative hover:shadow-lg transition-shadow ${
                plan.highlighted ? "border-2 border-primary" : ""
              }`}
            >
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm font-semibold text-primary">{plan.description}</p>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature) => (
                    <li key={`${plan.name}-${feature}`} className="flex items-center">
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
          ))}
        </div>
      </section>
      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}

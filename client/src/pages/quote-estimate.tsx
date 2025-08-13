import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Phone, FileText } from "lucide-react";
import Navigation from "@/components/navigation";
import { apiRequest } from "@/lib/queryClient";
import { calculateQuote } from "@/lib/pricing";
import { COVERAGE_PLANS } from "@/lib/constants";

export default function QuoteEstimate() {
  const [, setLocation] = useLocation();
  const [estimates, setEstimates] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('gold');

  useEffect(() => {
    // In a real app, this would come from URL params or localStorage
    // For now, simulate with sample data
    const sampleData = {
      vehicle: {
        year: 2021,
        make: 'Toyota',
        model: 'Camry',
        odometer: 35000,
      },
      coverage: {
        plan: 'gold' as const,
        deductible: 250,
      },
      location: {
        zip: '12345',
        state: 'CA',
      },
    };

    const estimate = calculateQuote(sampleData.vehicle, sampleData.coverage, sampleData.location);
    setEstimates(estimate);
  }, []);

  const lockQuoteMutation = useMutation({
    mutationFn: async (plan: string) => {
      return apiRequest("POST", "/api/quotes", {
        plan,
        deductible: 250,
        termMonths: 36,
        priceMonthly: estimates.plans[plan].monthly * 100, // Convert to cents
        priceTotal: estimates.plans[plan].total * 100,
      });
    },
    onSuccess: () => {
      setLocation("/");
    },
  });

  if (!estimates) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Coverage Options</h1>
          <p className="text-gray-600">Choose the plan that's right for your vehicle</p>
        </div>

        {/* Plan Comparison */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {Object.entries(estimates.plans).map(([planKey, plan]: [string, any]) => (
            <Card 
              key={planKey} 
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                planKey === estimates.recommended ? 'border-2 border-primary' : ''
              } ${selectedPlan === planKey ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedPlan(planKey)}
            >
              {planKey === estimates.recommended && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                  Recommended
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-center">
                  <h3 className="text-2xl font-bold mb-2">{COVERAGE_PLANS[planKey as keyof typeof COVERAGE_PLANS].name}</h3>
                  <div className="text-4xl font-bold text-primary mb-2">
                    ${plan.monthly}<span className="text-lg text-gray-500">/mo</span>
                  </div>
                  <p className="text-gray-600">{COVERAGE_PLANS[planKey as keyof typeof COVERAGE_PLANS].description}</p>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center">
                      <Check className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    Total: ${plan.total} (36 months)
                  </p>
                  <p className="text-xs text-gray-400">
                    Save 10% if paid in full
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to get protected?</h2>
            <p className="text-gray-600">
              Your selected plan: <span className="font-semibold text-primary">
                {COVERAGE_PLANS[selectedPlan as keyof typeof COVERAGE_PLANS].name} - 
                ${estimates.plans[selectedPlan].monthly}/month
              </span>
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Button 
              size="lg" 
              className="bg-accent hover:bg-green-600"
              onClick={() => lockQuoteMutation.mutate(selectedPlan)}
              disabled={lockQuoteMutation.isPending}
            >
              <FileText className="w-5 h-5 mr-2" />
              {lockQuoteMutation.isPending ? "Saving..." : "Lock My Quote"}
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => window.open('tel:1-800-555-0123')}
            >
              <Phone className="w-5 h-5 mr-2" />
              Talk to an Agent
            </Button>
            
            <Button 
              size="lg" 
              className="bg-primary hover:bg-secondary"
              onClick={() => lockQuoteMutation.mutate(selectedPlan)}
            >
              Proceed to E-Sign
            </Button>
          </div>
        </div>

        {/* Disclaimers */}
        <div className="mt-8 text-center">
          <div className="bg-gray-100 rounded-lg p-6 max-w-4xl mx-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Important Information</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {estimates.disclaimers.map((disclaimer: string, index: number) => (
                <li key={index}>{disclaimer}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

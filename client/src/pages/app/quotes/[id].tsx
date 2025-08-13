import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Send, Download } from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

export default function QuoteDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: quoteData, isLoading: quoteLoading, error } = useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  if (isLoading || quoteLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  // Mock quote data since we don't have the backend endpoint yet
  const quote = {
    id: id,
    plan: 'gold',
    deductible: 250,
    priceMonthly: 12900, // in cents
    priceTotal: 46440, // in cents
    status: 'draft',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    breakdown: {
      basePrice: 11900,
      fees: 500,
      taxes: 500,
    },
    lead: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '(555) 123-4567',
    },
    vehicle: {
      year: 2021,
      make: 'Toyota',
      model: 'Camry',
      trim: 'LE',
      odometer: 35000,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  onClick={() => window.history.back()}
                  className="mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Quote #{quote.id.slice(0, 8)}
                  </h1>
                  <p className="text-gray-600">
                    {quote.lead.firstName} {quote.lead.lastName} - {quote.vehicle.year} {quote.vehicle.make} {quote.vehicle.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge 
                  variant={quote.status === 'accepted' ? 'default' : 'secondary'}
                >
                  {quote.status}
                </Badge>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button>
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quote Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Coverage Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Coverage Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-primary mb-4">
                        {quote.plan.charAt(0).toUpperCase() + quote.plan.slice(1)} Plan
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Monthly Payment:</span>
                          <span className="font-semibold">${quote.priceMonthly / 100}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deductible:</span>
                          <span className="font-semibold">${quote.deductible}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Term:</span>
                          <span className="font-semibold">36 months</span>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                          <span className="font-semibold">Total Cost:</span>
                          <span className="font-semibold text-lg">${quote.priceTotal / 100}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">What's Covered:</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Engine & Transmission</li>
                        <li>• Air Conditioning & Heating</li>
                        <li>• Electrical System</li>
                        <li>• Fuel System</li>
                        <li>• 24/7 Roadside Assistance</li>
                        <li>• Rental Car Coverage</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Base Coverage:</span>
                      <span>${quote.breakdown.basePrice / 100}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fees:</span>
                      <span>${quote.breakdown.fees / 100}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxes:</span>
                      <span>${quote.breakdown.taxes / 100}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-semibold">
                      <span>Monthly Total:</span>
                      <span>${quote.priceMonthly / 100}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Terms & Conditions */}
              <Card>
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm text-gray-600">
                    <p>
                      <strong>Waiting Period:</strong> 30 days or 1,000 miles from coverage start date, whichever comes first.
                    </p>
                    <p>
                      <strong>Coverage Area:</strong> United States and Canada for emergency repairs.
                    </p>
                    <p>
                      <strong>Repair Facilities:</strong> Any licensed repair facility. We recommend using our network for faster processing.
                    </p>
                    <p>
                      <strong>Cancellation:</strong> You may cancel this coverage at any time with 30 days written notice.
                    </p>
                    <p>
                      <strong>Quote Validity:</strong> This quote is valid until {quote.validUntil.toLocaleDateString()}.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{quote.lead.firstName} {quote.lead.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{quote.lead.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{quote.lead.phone}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Vehicle</p>
                    <p className="font-medium">
                      {quote.vehicle.year} {quote.vehicle.make} {quote.vehicle.model} {quote.vehicle.trim}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mileage</p>
                    <p className="font-medium">{quote.vehicle.odometer.toLocaleString()} miles</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quote Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full">
                    <Send className="w-4 h-4 mr-2" />
                    Send via Email
                  </Button>
                  <Button className="w-full" variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Send via SMS
                  </Button>
                  <Button className="w-full" variant="outline">
                    Generate Contract
                  </Button>
                  <Button className="w-full" variant="outline">
                    Duplicate Quote
                  </Button>
                </CardContent>
              </Card>

              {/* Alternative Plans */}
              <Card>
                <CardHeader>
                  <CardTitle>Alternative Plans</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="border rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Powertrain</span>
                      <span className="text-sm">$79/mo</span>
                    </div>
                    <p className="text-xs text-gray-600">Basic engine protection</p>
                  </div>
                  <div className="border rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Platinum</span>
                      <span className="text-sm">$199/mo</span>
                    </div>
                    <p className="text-xs text-gray-600">Comprehensive coverage</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { US_STATES } from "@/lib/constants";

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuoteData {
  vehicle: {
    year: string;
    make: string;
    model: string;
    trim: string;
    odometer: string;
    vin: string;
    usage: string;
  };
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    zip: string;
    state: string;
  };
  coverage: {
    payment: string;
    addOns: string[];
  };
  consent: {
    tcpa: boolean;
    terms: boolean;
  };
}

export default function QuoteModal({ isOpen, onClose }: QuoteModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [quoteData, setQuoteData] = useState<QuoteData>({
    vehicle: {
      year: '',
      make: '',
      model: '',
      trim: '',
      odometer: '',
      vin: '',
      usage: 'personal',
    },
    owner: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      zip: '',
      state: '',
    },
    coverage: {
      payment: 'monthly',
      addOns: [],
    },
    consent: {
      tcpa: false,
      terms: false,
    },
  });

  const { toast } = useToast();

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: QuoteData) => {
      return apiRequest("POST", "/api/leads", {
        lead: {
          firstName: data.owner.firstName,
          lastName: data.owner.lastName,
          email: data.owner.email,
          phone: data.owner.phone,
          zip: data.owner.zip,
          state: data.owner.state,
          consentTCPA: data.consent.tcpa,
          source: 'web',
        },
        vehicle: {
          year: parseInt(data.vehicle.year),
          make: data.vehicle.make,
          model: data.vehicle.model,
          trim: data.vehicle.trim || null,
          vin: data.vehicle.vin || null,
          odometer: parseInt(data.vehicle.odometer),
          usage: data.vehicle.usage,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Quote Submitted Successfully",
        description: "A BH Auto Protect specialist will contact you within 24 hours.",
      });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error Submitting Quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCurrentStep(1);
    setQuoteData({
      vehicle: {
        year: '',
        make: '',
        model: '',
        trim: '',
        odometer: '',
        vin: '',
        usage: 'personal',
      },
    owner: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      zip: '',
      state: '',
    },
    coverage: {
      payment: 'monthly',
      addOns: [],
    },
    consent: {
      tcpa: false,
      terms: false,
    },
  });
  };

  const nextStep = () => {
    if (currentStep === 1) {
      const { year, make, model, odometer } = quoteData.vehicle;
      if (!year || !make || !model || !odometer) {
        toast({
          title: "Missing Vehicle Information",
          description: "Please complete all required vehicle fields.",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep === 2) {
      const { firstName, lastName, email, phone, zip, state } = quoteData.owner;
      if (!firstName || !lastName || !email || !phone || !zip || !state) {
        toast({
          title: "Missing Contact Information",
          description: "Please complete all required contact fields.",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitQuote = () => {
    if (!quoteData.consent.tcpa || !quoteData.consent.terms) {
      toast({
        title: "Consent Required",
        description: "Please accept all required consents to continue.",
        variant: "destructive",
      });
      return;
    }
    
    submitQuoteMutation.mutate(quoteData);
  };

  const handleVehicleChange = (field: string, value: string) => {
    setQuoteData(prev => ({
      ...prev,
      vehicle: { ...prev.vehicle, [field]: value }
    }));
  };

  const handleOwnerChange = (field: string, value: string) => {
    setQuoteData(prev => ({
      ...prev,
      owner: { ...prev.owner, [field]: value }
    }));
  };

  const handleCoverageChange = (field: string, value: string) => {
    setQuoteData(prev => ({
      ...prev,
      coverage: { ...prev.coverage, [field]: value }
    }));
  };

  const handleConsentChange = (field: string, value: boolean) => {
    setQuoteData(prev => ({
      ...prev,
      consent: { ...prev.consent, [field]: value }
    }));
  };

  const progress = (currentStep / 3) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Get Your Free Quote</DialogTitle>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-500">Step {currentStep} of 3</span>
              <span className="text-sm font-medium text-gray-500">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-center mt-6 space-x-8">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                currentStep >= 1 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Vehicle</span>
            </div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                currentStep >= 2 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Owner</span>
            </div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                currentStep >= 3 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Coverage</span>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          {/* Step 1: Vehicle Information */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Tell us about your vehicle</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="e.g., 2020"
                    value={quoteData.vehicle.year}
                    onChange={(e) => handleVehicleChange('year', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    placeholder="e.g., Toyota"
                    value={quoteData.vehicle.make}
                    onChange={(e) => handleVehicleChange('make', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    placeholder="e.g., Camry"
                    value={quoteData.vehicle.model}
                    onChange={(e) => handleVehicleChange('model', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="trim">Trim (Optional)</Label>
                  <Input
                    id="trim"
                    placeholder="e.g., XLE"
                    value={quoteData.vehicle.trim}
                    onChange={(e) => handleVehicleChange('trim', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="odometer">Odometer Reading</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 45000"
                    value={quoteData.vehicle.odometer}
                    onChange={(e) => handleVehicleChange('odometer', e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="vin">VIN (Optional)</Label>
                  <Input 
                    type="text" 
                    placeholder="17-character VIN" 
                    value={quoteData.vehicle.vin}
                    onChange={(e) => handleVehicleChange('vin', e.target.value)}
                  />
                  <p className="text-sm text-gray-500 mt-1">Providing your VIN helps us give you a more accurate quote</p>
                </div>
                <div className="md:col-span-2">
                  <Label>Usage</Label>
                  <RadioGroup 
                    value={quoteData.vehicle.usage} 
                    onValueChange={(value) => handleVehicleChange('usage', value)}
                    className="grid grid-cols-2 gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="personal" id="personal" />
                      <Label htmlFor="personal">Personal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="commercial" id="commercial" />
                      <Label htmlFor="commercial">Commercial</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Owner Information */}
          {currentStep === 2 && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Contact Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    value={quoteData.owner.firstName}
                    onChange={(e) => handleOwnerChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    value={quoteData.owner.lastName}
                    onChange={(e) => handleOwnerChange('lastName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    value={quoteData.owner.email}
                    onChange={(e) => handleOwnerChange('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    type="tel"
                    value={quoteData.owner.phone}
                    onChange={(e) => handleOwnerChange('phone', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    value={quoteData.owner.zip}
                    onChange={(e) => handleOwnerChange('zip', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={quoteData.owner.state} onValueChange={(value) => handleOwnerChange('state', value)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Coverage Preferences */}
          {currentStep === 3 && (
            <div>
              <h3 className="text-xl font-semibold mb-6">Coverage Preferences</h3>
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Payment Preference</Label>
                  <RadioGroup
                    value={quoteData.coverage.payment}
                    onValueChange={(value) => handleCoverageChange('payment', value)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="ml-2">Monthly Payments</Label>
                    </div>
                    <div className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value="full" id="full" />
                      <Label htmlFor="full" className="ml-2">Paid in Full (Save more)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Consent & Terms</h4>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <Checkbox
                        id="tcpa"
                        checked={quoteData.consent.tcpa}
                        onCheckedChange={(checked) => handleConsentChange('tcpa', !!checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="tcpa" className="ml-3 text-sm">
                        By clicking Continue, you agree to be contacted by phone, SMS, or email regarding your auto warranty options. Consent is not a condition of purchase. Msg & data rates may apply.
                      </Label>
                    </div>
                    <div className="flex items-start">
                      <Checkbox
                        id="terms"
                        checked={quoteData.consent.terms}
                        onCheckedChange={(checked) => handleConsentChange('terms', !!checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="terms" className="ml-3 text-sm">
                        I agree to the <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a> and <a href="/legal/terms" className="text-primary hover:underline">Terms of Service</a>
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={previousStep} 
            disabled={currentStep === 1}
            className={currentStep === 1 ? "invisible" : ""}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex-1"></div>
          
          {currentStep < 3 ? (
            <Button onClick={nextStep}>
              Next Step
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={submitQuote} 
              disabled={submitQuoteMutation.isPending}
              className="bg-accent hover:bg-green-600"
            >
              {submitQuoteMutation.isPending ? "Submitting..." : "Get My Quote"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

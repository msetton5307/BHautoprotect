import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calculator, Zap, TrendingUp, DollarSign } from "lucide-react";
import { calculateQuote } from "@/lib/pricing";
import { COVERAGE_PLANS, DEDUCTIBLE_OPTIONS, VEHICLE_MAKES, US_STATES, VEHICLE_YEARS } from "@/lib/constants";

interface VehicleData {
  year: number;
  make: string;
  model: string;
  odometer: number;
}

interface CoverageData {
  plan: 'powertrain' | 'gold' | 'platinum';
  deductible: number;
}

interface LocationData {
  zip: string;
  state: string;
}

interface PricingEngineProps {
  onQuoteCalculated?: (estimate: any) => void;
  initialData?: {
    vehicle?: Partial<VehicleData>;
    coverage?: Partial<CoverageData>;
    location?: Partial<LocationData>;
  };
}

export default function PricingEngine({ onQuoteCalculated, initialData }: PricingEngineProps) {
  const [vehicle, setVehicle] = useState<VehicleData>({
    year: new Date().getFullYear() - 3,
    make: '',
    model: '',
    odometer: 30000,
    ...initialData?.vehicle,
  });

  const [coverage, setCoverage] = useState<CoverageData>({
    plan: 'gold',
    deductible: 250,
    ...initialData?.coverage,
  });

  const [location, setLocation] = useState<LocationData>({
    zip: '',
    state: '',
    ...initialData?.location,
  });

  const [estimate, setEstimate] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [realTimeMode, setRealTimeMode] = useState(true);

  // Calculate quote automatically when inputs change (if real-time mode is enabled)
  useEffect(() => {
    if (realTimeMode && vehicle.year && vehicle.make && vehicle.odometer && location.state) {
      calculatePricing();
    }
  }, [vehicle, coverage, location, realTimeMode]);

  const calculatePricing = async () => {
    setIsCalculating(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = calculateQuote(vehicle, coverage, location);
      setEstimate(result);
      
      if (onQuoteCalculated) {
        onQuoteCalculated(result);
      }
    } catch (error) {
      console.error('Error calculating quote:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleManualCalculate = () => {
    if (vehicle.year && vehicle.make && vehicle.odometer && location.state) {
      calculatePricing();
    }
  };

  const isFormValid = vehicle.year && vehicle.make && vehicle.odometer && location.state;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Pricing Engine
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="realtime" className="text-sm">Real-time calculations</Label>
            <Switch
              id="realtime"
              checked={realTimeMode}
              onCheckedChange={setRealTimeMode}
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          {/* Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Select value={vehicle.year.toString()} onValueChange={(value) => setVehicle({ ...vehicle, year: parseInt(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Select value={vehicle.make} onValueChange={(value) => setVehicle({ ...vehicle, make: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Make" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_MAKES.map((make) => (
                        <SelectItem key={make.value} value={make.value}>
                          {make.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={vehicle.model}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                  placeholder="Enter model"
                />
              </div>
              <div>
                <Label htmlFor="odometer">Odometer Reading</Label>
                <Input
                  id="odometer"
                  type="number"
                  value={vehicle.odometer}
                  onChange={(e) => setVehicle({ ...vehicle, odometer: parseInt(e.target.value) || 0 })}
                  placeholder="Enter mileage"
                />
              </div>
            </CardContent>
          </Card>

          {/* Coverage Options */}
          <Card>
            <CardHeader>
              <CardTitle>Coverage Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Coverage Plan</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(COVERAGE_PLANS).map(([key, plan]) => (
                    <Button
                      key={key}
                      variant={coverage.plan === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCoverage({ ...coverage, plan: key as any })}
                      className="flex flex-col h-auto p-3"
                    >
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-xs">${plan.basePrice}/mo</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Deductible</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {DEDUCTIBLE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={coverage.deductible === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCoverage({ ...coverage, deductible: option.value })}
                      className="flex flex-col h-auto p-3"
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs">{option.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={location.zip}
                    onChange={(e) => setLocation({ ...location, zip: e.target.value })}
                    placeholder="Enter ZIP"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={location.state} onValueChange={(value) => setLocation({ ...location, state: value })}>
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
            </CardContent>
          </Card>

          {/* Manual Calculate Button */}
          {!realTimeMode && (
            <Button
              onClick={handleManualCalculate}
              disabled={!isFormValid || isCalculating}
              className="w-full"
            >
              {isCalculating ? (
                <>
                  <TrendingUp className="w-4 h-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate Quote
                </>
              )}
            </Button>
          )}
        </div>

        {/* Results */}
        <div>
          {isCalculating ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                  <p>Calculating your personalized quote...</p>
                </div>
              </CardContent>
            </Card>
          ) : estimate ? (
            <div className="space-y-4">
              {/* Current Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2" />
                    Your Quote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">
                      {COVERAGE_PLANS[coverage.plan].name} Plan
                    </p>
                    <p className="text-3xl font-bold text-primary mb-1">
                      ${estimate.plans[coverage.plan].monthly}/month
                    </p>
                    <p className="text-sm text-gray-600">
                      Total: ${estimate.plans[coverage.plan].total} (36 months)
                    </p>
                    <Badge className="mt-2" variant={coverage.plan === estimate.recommended ? "default" : "outline"}>
                      {coverage.plan === estimate.recommended ? "Recommended" : "Selected"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* All Plans Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>All Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(estimate.plans).map(([planKey, plan]: [string, any]) => (
                      <div
                        key={planKey}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          coverage.plan === planKey 
                            ? 'border-primary bg-primary/5' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setCoverage({ ...coverage, plan: planKey as any })}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">
                              {COVERAGE_PLANS[planKey as keyof typeof COVERAGE_PLANS].name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {COVERAGE_PLANS[planKey as keyof typeof COVERAGE_PLANS].description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${plan.monthly}/mo</p>
                            <p className="text-sm text-gray-500">${plan.total} total</p>
                          </div>
                        </div>
                        {planKey === estimate.recommended && (
                          <Badge size="sm" className="mt-2">Recommended</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Factors */}
              <Card>
                <CardHeader>
                  <CardTitle>Pricing Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Vehicle Age:</span>
                      <span>{new Date().getFullYear() - vehicle.year} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mileage:</span>
                      <span>{vehicle.odometer.toLocaleString()} miles</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Location:</span>
                      <span>{location.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deductible:</span>
                      <span>${coverage.deductible}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Disclaimers */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs text-gray-500 space-y-1">
                    {estimate.disclaimers.map((disclaimer: string, index: number) => (
                      <p key={index}>• {disclaimer}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Enter vehicle and location information to see pricing</p>
                  {!realTimeMode && (
                    <p className="text-sm mt-2">Click "Calculate Quote" when ready</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

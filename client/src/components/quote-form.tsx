import {
  FormEvent,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { US_STATES } from "@/lib/constants";
import {
  VehicleMake,
  fetchVehicleMakes,
  fetchVehicleModels,
} from "@/data/vehicle-library";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuoteFormProps {
  className?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmitted?: () => void;
  leadSource?: string;
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
  consent: {
    tcpa: boolean;
    terms: boolean;
  };
}

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      ready: (callback: () => void) => void;
      reset: (widgetId?: number) => void;
    };
  }
}

export const QuoteForm = forwardRef<HTMLFormElement, QuoteFormProps>(
  (
    {
      className,
      title = "Get Your Free Quote",
      description = "Provide a few quick details and we'll prepare a personalized quote for your vehicle warranty coverage.",
      submitLabel = "Get my quote",
      onSubmitted,
      leadSource = "web",
    },
    ref,
  ) => {
    const [quoteData, setQuoteData] = useState<QuoteData>({
      vehicle: {
        year: "",
        make: "",
        model: "",
        trim: "",
        odometer: "",
        vin: "",
        usage: "personal",
      },
      owner: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        zip: "",
        state: "",
      },
      consent: {
        tcpa: false,
        terms: false,
      },
    });
    const [manualMake, setManualMake] = useState(false);
    const [manualModel, setManualModel] = useState(false);

    const {
      data: fetchedVehicleMakes,
      isLoading: vehicleMakesLoading,
      isError: vehicleMakesError,
    } = useQuery({
      queryKey: ["vehicle-makes"],
      queryFn: ({ signal }) => fetchVehicleMakes(signal),
    });

    const vehicleMakes = fetchedVehicleMakes ?? [];

    const normalizedSelectedMake = quoteData.vehicle.make.trim();
    const normalizedSelectedYear = quoteData.vehicle.year.trim();
    const isFourDigitYear = /^\d{4}$/.test(normalizedSelectedYear);
    const yearFilterForModels = isFourDigitYear ? normalizedSelectedYear : undefined;
    const modelEmptyMessage = isFourDigitYear
      ? "No models found for selected year"
      : "Enter the vehicle year to browse models";
    const noModelsHelperText = isFourDigitYear
      ? `We couldn't find models for this make in ${yearFilterForModels}. Enter your model manually.`
      : "Enter your vehicle year to see models available in the United States or enter your model manually.";

    const selectedMake = useMemo<VehicleMake | null>(() => {
      if (!normalizedSelectedMake) return null;
      const target = normalizedSelectedMake.toLowerCase();
      return (
        vehicleMakes.find((make) => make.name.toLowerCase() === target) ?? null
      );
    }, [vehicleMakes, normalizedSelectedMake]);

    const shouldLoadModels =
      !manualMake && !!selectedMake && !!yearFilterForModels;

    const {
      data: fetchedVehicleModels,
      isLoading: vehicleModelsLoading,
      isError: vehicleModelsError,
    } = useQuery({
      queryKey: [
        "vehicle-models",
        selectedMake?.id ?? null,
        yearFilterForModels ?? null,
      ],
      queryFn: ({ signal }) =>
        fetchVehicleModels(
          selectedMake as VehicleMake,
          yearFilterForModels as string,
          signal,
        ),
      enabled: shouldLoadModels,
    });

    const vehicleModels = fetchedVehicleModels ?? [];

    const makeOptions = useMemo(
      () => [
        ...vehicleMakes.map((make) => ({
          label: make.name,
          value: make.name,
        })),
        { label: "Make not listed", value: "__manual_make" },
      ],
      [vehicleMakes],
    );

    const modelOptions = useMemo(
      () => [
        ...vehicleModels.map((model) => ({
          label: model,
          value: model,
        })),
        { label: "Model not listed", value: "__manual_model" },
      ],
      [vehicleModels],
    );

    const disableModelCombobox = !isFourDigitYear || !selectedMake;

    useEffect(() => {
      if (manualMake) {
        setManualModel(true);
        return;
      }

      if (!selectedMake) {
        setManualModel(false);
        return;
      }

      if (!isFourDigitYear) {
        setManualModel(false);
        return;
      }

      if (vehicleModelsError) {
        setManualModel(true);
        return;
      }

      if (vehicleModelsLoading) {
        return;
      }

      if (vehicleModels.length === 0) {
        setManualModel(true);
        return;
      }

      setManualModel(false);
    }, [
      isFourDigitYear,
      manualMake,
      selectedMake,
      vehicleModels,
      vehicleModelsError,
      vehicleModelsLoading,
    ]);

    const noModelsAvailable =
      isFourDigitYear &&
      !vehicleModelsLoading &&
      !vehicleModelsError &&
      !!selectedMake &&
      vehicleModels.length === 0;

    const canShowModelSelectButton =
      !manualMake &&
      !vehicleModelsError &&
      isFourDigitYear &&
      !!selectedMake &&
      (vehicleModels.length > 0 || vehicleModelsLoading);

    const { toast } = useToast();
    const [, navigate] = useLocation();
    const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
    const recaptchaWidgetIdRef = useRef<number | null>(null);
    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
    const [recaptchaReady, setRecaptchaReady] = useState(false);
    const [recaptchaError, setRecaptchaError] = useState(false);
    const recaptchaSiteKey =
      import.meta.env.VITE_RECAPTCHA_SITE_KEY ??
      "6LdzavUrAAAAAG40FqY9lEYBl451R5eDUHTAeSZg";

    useEffect(() => {
      if (typeof window === "undefined" || !recaptchaContainerRef.current) {
        return;
      }

      const scriptSrc = "https://www.google.com/recaptcha/api.js?render=explicit";
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${scriptSrc}"]`,
      );

      const initializeRecaptcha = () => {
        if (!window.grecaptcha || recaptchaWidgetIdRef.current !== null) {
          return;
        }

        window.grecaptcha.ready(() => {
          if (!recaptchaContainerRef.current || !window.grecaptcha) {
            return;
          }

          recaptchaWidgetIdRef.current = window.grecaptcha.render(
            recaptchaContainerRef.current,
            {
              sitekey: recaptchaSiteKey,
              callback: (token: string) => {
                setRecaptchaToken(token);
                setRecaptchaError(false);
              },
              "expired-callback": () => {
                setRecaptchaToken(null);
              },
              "error-callback": () => {
                setRecaptchaToken(null);
                setRecaptchaError(true);
              },
            },
          );

          setRecaptchaReady(true);
        });
      };

      if (script) {
        if (window.grecaptcha) {
          initializeRecaptcha();
          return;
        }

        script.addEventListener("load", initializeRecaptcha, { once: true });
        return () => {
          script?.removeEventListener("load", initializeRecaptcha);
        };
      }

      script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", initializeRecaptcha, { once: true });
      document.body.appendChild(script);

      return () => {
        script?.removeEventListener("load", initializeRecaptcha);
      };
    }, [recaptchaSiteKey]);

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
            source: leadSource,
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
          recaptchaToken,
        });
      },
      onSuccess: () => {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            "lastLeadSubmission",
            JSON.stringify({
              source: leadSource,
              submittedAt: new Date().toISOString(),
            }),
          );
        }

        navigate("/thank-you");
        onSubmitted?.();
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
      setQuoteData({
        vehicle: {
          year: "",
          make: "",
          model: "",
          trim: "",
          odometer: "",
          vin: "",
          usage: "personal",
        },
        owner: {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          zip: "",
          state: "",
        },
        consent: {
          tcpa: false,
          terms: false,
        },
      });
      setManualMake(false);
      setManualModel(false);
      setRecaptchaToken(null);
      setRecaptchaError(false);
      if (
        typeof window !== "undefined" &&
        window.grecaptcha &&
        recaptchaWidgetIdRef.current !== null
      ) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
    };

    const handleMakeSelection = (value: string) => {
      if (value === "__manual_make") {
        setManualMake(true);
        setManualModel(true);
        handleVehicleChange("make", "");
        handleVehicleChange("model", "");
        return;
      }

      setManualMake(false);
      setManualModel(false);
      handleVehicleChange("make", value);
      handleVehicleChange("model", "");
    };

    const handleModelSelection = (value: string) => {
      if (value === "__manual_model") {
        setManualModel(true);
        handleVehicleChange("model", "");
        return;
      }

      setManualModel(false);
      handleVehicleChange("model", value);
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

      if (!recaptchaToken) {
        setRecaptchaError(true);
        toast({
          title: "Verification Required",
          description: "Please confirm you are not a robot before continuing.",
          variant: "destructive",
        });
        return;
      }

      submitQuoteMutation.mutate(quoteData);
    };

    const handleVehicleChange = (field: keyof QuoteData["vehicle"], value: string) => {
      setQuoteData((prev) => {
        const nextVehicle = { ...prev.vehicle, [field]: value };

        if (field === "year" && value !== prev.vehicle.year) {
          nextVehicle.model = "";
        }

        if (field === "make" && value !== prev.vehicle.make) {
          nextVehicle.model = "";
        }

        return {
          ...prev,
          vehicle: nextVehicle,
        };
      });
    };

    const handleOwnerChange = (field: string, value: string) => {
      setQuoteData((prev) => ({
        ...prev,
        owner: { ...prev.owner, [field]: value },
      }));
    };

    const handleConsentChange = (field: string, value: boolean) => {
      setQuoteData((prev) => ({
        ...prev,
        consent: { ...prev.consent, [field]: value },
      }));
    };

    const validateRequiredFields = () => {
      const { year, make, model, odometer } = quoteData.vehicle;
      const { firstName, lastName, email, phone, zip, state } = quoteData.owner;

      if (!year || !make || !model || !odometer) {
        toast({
          title: "Missing Vehicle Information",
          description: "Please complete all required vehicle fields.",
          variant: "destructive",
        });
        return false;
      }

      if (!firstName || !lastName || !email || !phone || !zip || !state) {
        toast({
          title: "Missing Contact Information",
          description: "Please complete all required contact fields.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validateRequiredFields()) {
        return;
      }

      submitQuote();
    };

    return (
      <form ref={ref} onSubmit={handleSubmit} className={cn("space-y-8", className)}>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-500">{description}</p>
        </div>

        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Vehicle information</h3>
              <p className="text-sm text-gray-500">Tell us about the car or truck you'd like to protect.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                placeholder="e.g., 2020"
                value={quoteData.vehicle.year}
                onChange={(e) => handleVehicleChange("year", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="make">Make</Label>
              {manualMake ? (
                <div className="space-y-2">
                  <Input
                    id="make"
                    placeholder="Start typing your vehicle make"
                    value={quoteData.vehicle.make}
                    onChange={(e) => handleVehicleChange("make", e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0"
                    onClick={() => {
                      setManualMake(false);
                      setManualModel(false);
                      handleVehicleChange("make", "");
                      handleVehicleChange("model", "");
                    }}
                  >
                    Select make from list
                  </Button>
                  {vehicleMakesError ? (
                    <p className="text-sm text-red-600">
                      We couldn't load vehicle makes right now. Please enter your make manually.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <SearchableSelect
                    id="make"
                    value={quoteData.vehicle.make || undefined}
                    onSelect={handleMakeSelection}
                    options={makeOptions}
                    placeholder={
                      vehicleMakesLoading && vehicleMakes.length === 0
                        ? "Loading makes..."
                        : "Search or select make"
                    }
                    emptyMessage="No vehicle makes found"
                    searchPlaceholder="Search makes..."
                    loading={vehicleMakesLoading && vehicleMakes.length === 0}
                    loadingMessage="Loading vehicle makes..."
                  />
                  {vehicleMakesError ? (
                    <p className="text-sm text-red-600">
                      We couldn't load vehicle makes. Please enter your make manually.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              {manualModel || manualMake ? (
                <div className="space-y-2">
                  <Input
                    id="model"
                    placeholder="Start typing your vehicle model"
                    value={quoteData.vehicle.model}
                    onChange={(e) => handleVehicleChange("model", e.target.value)}
                    required
                  />
                  {canShowModelSelectButton && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0"
                      onClick={() => {
                        setManualModel(false);
                        handleVehicleChange("model", "");
                      }}
                    >
                      Select model from list
                    </Button>
                  )}
                  {vehicleModelsError ? (
                    <p className="text-sm text-red-600">
                      We couldn't load vehicle models. Please enter your model manually.
                    </p>
                  ) : noModelsAvailable ? (
                    <p className="text-sm text-muted-foreground">{noModelsHelperText}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <SearchableSelect
                    id="model"
                    value={quoteData.vehicle.model || undefined}
                    onSelect={handleModelSelection}
                    options={modelOptions}
                    placeholder={
                      !isFourDigitYear || !selectedMake
                        ? "Enter year to search models"
                        : vehicleModelsLoading && vehicleModels.length === 0
                          ? "Loading models..."
                          : "Search or select model"
                    }
                    emptyMessage={modelEmptyMessage}
                    searchPlaceholder="Search models..."
                    loading={
                      !disableModelCombobox && vehicleModelsLoading && vehicleModels.length === 0
                    }
                    loadingMessage="Loading vehicle models..."
                    disabled={disableModelCombobox}
                  />
                  {vehicleModelsError ? (
                    <p className="text-sm text-red-600">
                      We couldn't load vehicle models. Please enter your model manually.
                    </p>
                  ) : disableModelCombobox ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedMake
                        ? "Enter your vehicle year to see models available in the United States or enter your model manually."
                        : "Select a make to browse models or enter your model manually."}
                    </p>
                  ) : noModelsAvailable ? (
                    <p className="text-sm text-muted-foreground">{noModelsHelperText}</p>
                  ) : null}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="trim">Trim (Optional)</Label>
              <Input
                id="trim"
                placeholder="Trim level (if known)"
                value={quoteData.vehicle.trim}
                onChange={(e) => handleVehicleChange("trim", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="odometer">Odometer reading</Label>
              <Input
                id="odometer"
                type="number"
                placeholder="How many miles are on the dash?"
                value={quoteData.vehicle.odometer}
                onChange={(e) => handleVehicleChange("odometer", e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="vin">VIN (optional)</Label>
              <Input
                id="vin"
                type="text"
                placeholder="17-character VIN"
                value={quoteData.vehicle.vin}
                onChange={(e) => handleVehicleChange("vin", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">Providing your VIN helps us give you a more accurate quote.</p>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Contact details</h3>
              <p className="text-sm text-gray-500">We'll deliver your quote and follow up with any questions.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={quoteData.owner.firstName}
                onChange={(e) => handleOwnerChange("firstName", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={quoteData.owner.lastName}
                onChange={(e) => handleOwnerChange("lastName", e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={quoteData.owner.email}
                onChange={(e) => handleOwnerChange("email", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={quoteData.owner.phone}
                onChange={(e) => handleOwnerChange("phone", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="zip">ZIP code</Label>
              <Input
                id="zip"
                value={quoteData.owner.zip}
                onChange={(e) => handleOwnerChange("zip", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Select value={quoteData.owner.state} onValueChange={(value) => handleOwnerChange("state", value)} required>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
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
        </section>

        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Consent &amp; terms</h3>
            <p className="text-sm text-gray-500">
              We respect your privacy and will only use your information to share quote details and coverage options.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start">
              <Checkbox
                id="tcpa"
                checked={quoteData.consent.tcpa}
                onCheckedChange={(checked) => handleConsentChange("tcpa", !!checked)}
                className="mt-1"
              />
              <Label htmlFor="tcpa" className="ml-3 text-sm space-y-2">
                <span>
                  By submitting this form I consent to BH Auto Protect contacting me about vehicle protection services using
                  automated calls, prerecorded voice messages, SMS/text messages, or email at the information provided above.
                  Message and data rates may apply. Messaging frequency may vary.
                </span>
                <span>
                  Reply STOP to unsubscribe. Consent is not required to receive services and I may call BH Auto Protect
                  directly at <a href="tel:+13024068053" className="text-primary font-semibold">(302) 406-8053</a>. I
                  consent to BH Auto Protect's <a href="/legal/terms" className="text-primary hover:underline">mobile terms
                  and conditions</a> and <a href="/legal/privacy" className="text-primary hover:underline">privacy
                  statement</a>.
                </span>
              </Label>
            </div>
            <div className="flex items-start">
              <Checkbox
                id="terms"
                checked={quoteData.consent.terms}
                onCheckedChange={(checked) => handleConsentChange("terms", !!checked)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="ml-3 text-sm">
                I agree to the <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a> and
                <a href="/legal/terms" className="text-primary hover:underline">Terms of Service</a>.
              </Label>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Verification</h3>
            <p className="text-sm text-gray-500">
              Complete the reCAPTCHA challenge so we can process your quote request.
            </p>
          </div>
          <div>
            <div
              ref={recaptchaContainerRef}
              className="mt-2"
              data-sitekey={recaptchaSiteKey}
            />
            {!recaptchaReady && (
              <p className="text-sm text-gray-500 mt-2">Loading verification...</p>
            )}
            {recaptchaError && (
              <p className="text-sm font-medium text-destructive mt-2">
                Please verify that you are not a robot.
              </p>
            )}
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitQuoteMutation.isPending} className="bg-accent hover:bg-green-600 px-8">
            {submitQuoteMutation.isPending ? "Submitting..." : submitLabel}
          </Button>
        </div>
      </form>
    );
  },
);

QuoteForm.displayName = "QuoteForm";


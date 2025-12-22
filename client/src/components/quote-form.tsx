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
    odometer: string;
    usage: string;
  };
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    state: string;
  };
  consent: {
    agreement: boolean;
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
          size?: "invisible" | "compact" | "normal";
          badge?: "bottomright" | "bottomleft" | "inline";
        },
      ) => number;
      ready: (callback: () => void) => void;
      reset: (widgetId?: number) => void;
      execute: (widgetId: number) => void;
    };
  }
}

export const QuoteForm = forwardRef<HTMLFormElement, QuoteFormProps>(
  (
    {
      className,
      title = "Get Your Free Quote",
      description = "Provide a few quick details and we'll prepare a personalized quote for your vehicle warranty coverage.",
      submitLabel = "Get My $700 Discount Quote",
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
        odometer: "",
        usage: "personal",
      },
      owner: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        state: "",
      },
      consent: {
        agreement: true,
      },
    });
    const [manualMake, setManualMake] = useState(false);
    const [manualModel, setManualModel] = useState(false);
    const [formStep, setFormStep] = useState<1 | 2>(1);
    const [pendingRecaptchaSubmit, setPendingRecaptchaSubmit] = useState(false);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      if (Array.from(params.keys()).length === 0) {
        return;
      }

      setQuoteData((prev) => {
        const next: QuoteData = {
          vehicle: { ...prev.vehicle },
          owner: { ...prev.owner },
          consent: { ...prev.consent },
        };
        let updated = false;

        const assignVehicleField = (
          field: keyof QuoteData["vehicle"],
          value: string | null,
        ) => {
          const trimmed = value?.trim();
          if (!trimmed) {
            return;
          }
          next.vehicle[field] = trimmed;
          updated = true;
        };

        const assignOwnerField = (
          field: keyof QuoteData["owner"],
          value: string | null,
        ) => {
          const trimmed = value?.trim();
          if (!trimmed) {
            return;
          }
          next.owner[field] = trimmed;
          updated = true;
        };

        assignVehicleField("year", params.get("year"));
        assignVehicleField("make", params.get("make"));
        assignVehicleField("model", params.get("model"));
        assignVehicleField("odometer", params.get("mileage"));

        assignOwnerField("firstName", params.get("first_name"));
        assignOwnerField("lastName", params.get("last_name"));
        assignOwnerField("email", params.get("email"));
        assignOwnerField("phone", params.get("phone"));

        const stateParam = params.get("state");
        if (stateParam?.trim()) {
          const normalizedState = stateParam.trim().toLowerCase();
          const matchedState = US_STATES.find(
            (state) =>
              state.value.toLowerCase() === normalizedState ||
              state.label.toLowerCase() === normalizedState,
          );
          if (matchedState) {
            next.owner.state = matchedState.value;
            updated = true;
          }
        }

        return updated ? next : prev;
      });
    }, []);

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

    useEffect(() => {
      if (vehicleMakesLoading) {
        return;
      }

      const makeValue = quoteData.vehicle.make.trim();
      if (!makeValue) {
        return;
      }

      const makeExists = vehicleMakes.some(
        (make) => make.name.toLowerCase() === makeValue.toLowerCase(),
      );

      if (!makeExists && !manualMake) {
        setManualMake(true);
      }
    }, [
      manualMake,
      quoteData.vehicle.make,
      vehicleMakes,
      vehicleMakesLoading,
    ]);

    useEffect(() => {
      if (manualMake || vehicleModelsLoading || vehicleModelsError) {
        return;
      }

      const modelValue = quoteData.vehicle.model.trim();
      if (!modelValue) {
        return;
      }

      const modelExists = vehicleModels.some(
        (model) => model.toLowerCase() === modelValue.toLowerCase(),
      );

      if (!modelExists && !manualModel) {
        setManualModel(true);
      }
    }, [
      manualMake,
      manualModel,
      quoteData.vehicle.model,
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
      if (formStep !== 2) {
        return;
      }

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
              size: "invisible",
              badge: "bottomright",
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
    }, [formStep, recaptchaSiteKey]);

    const submitQuoteMutation = useMutation({
      mutationFn: async (data: QuoteData) => {
        return apiRequest("POST", "/api/leads", {
          lead: {
            firstName: data.owner.firstName,
            lastName: data.owner.lastName,
            email: data.owner.email,
            phone: data.owner.phone,
            state: data.owner.state,
            consentTCPA: data.consent.agreement,
            source: leadSource,
          },
          vehicle: {
            year: parseInt(data.vehicle.year),
            make: data.vehicle.make,
            model: data.vehicle.model,
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
        if (
          typeof window !== "undefined" &&
          window.grecaptcha &&
          recaptchaWidgetIdRef.current !== null
        ) {
          window.grecaptcha.reset(recaptchaWidgetIdRef.current);
        }
        setRecaptchaToken(null);
        toast({
          title: "Error Submitting Quote",
          description: error.message,
          variant: "destructive",
        });
      },
    });

    const mutateQuote = submitQuoteMutation.mutate;

    const resetForm = () => {
      setQuoteData({
        vehicle: {
          year: "",
          make: "",
          model: "",
          odometer: "",
          usage: "personal",
        },
        owner: {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          state: "",
        },
        consent: {
          agreement: true,
        },
      });
      setManualMake(false);
      setManualModel(false);
      setFormStep(1);
      setRecaptchaToken(null);
      setRecaptchaError(false);
      setPendingRecaptchaSubmit(false);
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

    useEffect(() => {
      if (!pendingRecaptchaSubmit || !recaptchaToken) {
        return;
      }

      setPendingRecaptchaSubmit(false);
      mutateQuote(quoteData);
    }, [pendingRecaptchaSubmit, recaptchaToken, mutateQuote, quoteData]);

    const submitQuote = () => {
      if (submitQuoteMutation.isPending) {
        return;
      }

      if (!recaptchaReady) {
        toast({
          title: "Verification Initializing",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        });
        return;
      }

      if (!recaptchaToken) {
        if (
          typeof window !== "undefined" &&
          window.grecaptcha &&
          recaptchaWidgetIdRef.current !== null
        ) {
          setPendingRecaptchaSubmit(true);
          window.grecaptcha.execute(recaptchaWidgetIdRef.current);
          return;
        }

        setRecaptchaError(true);
        toast({
          title: "Verification Required",
          description: "Please complete the reCAPTCHA challenge before submitting.",
          variant: "destructive",
        });
        return;
      }

      mutateQuote(quoteData);
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

    const validateVehicleFields = () => {
      const { year, make, model, odometer } = quoteData.vehicle;

      if (!year || !make || !model || !odometer) {
        toast({
          title: "Missing Vehicle Information",
          description: "Please complete all required vehicle fields.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    };

    const validateContactFields = () => {
      const { firstName, lastName, email, phone, state } = quoteData.owner;

      if (!firstName || !lastName || !email || !phone || !state) {
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

      if (formStep === 1) {
        if (!validateVehicleFields()) {
          return;
        }

        setFormStep(2);
        return;
      }

      if (!validateVehicleFields()) {
        return;
      }

      if (!validateContactFields()) {
        return;
      }

      submitQuote();
    };

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn(
          "space-y-6 rounded-2xl border border-gray-100 bg-white/95 p-6 text-slate-900 shadow-lg backdrop-blur",
          className,
        )}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
            <span>Step {formStep} of 2</span>
            {formStep === 2 ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setFormStep(1)}
              >
                Edit vehicle details
              </button>
            ) : null}
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Vehicle information</h3>
            <p className="text-sm text-gray-500">Tell us about the car or truck you'd like to protect.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 2020"
                value={quoteData.vehicle.year}
                onChange={(e) => handleVehicleChange("year", e.target.value)}
                className="h-11"
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
                    className="h-11"
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
                    triggerClassName="h-11"
                  />
                  <div className="min-h-[1.25rem]">
                    {vehicleMakesError ? (
                      <p className="text-sm text-red-600">
                        We couldn't load vehicle makes. Please enter your make manually.
                      </p>
                    ) : null}
                  </div>
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
                    className="h-11"
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
                    triggerClassName="h-11"
                  />
                  <div className="min-h-[1.25rem]">
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
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="odometer">Odometer reading</Label>
              <Input
                id="odometer"
                type="number"
                inputMode="numeric"
                placeholder="How many miles are on the dash?"
                value={quoteData.vehicle.odometer}
                onChange={(e) => handleVehicleChange("odometer", e.target.value)}
                className="h-11"
                required
              />
            </div>
          </div>
        </div>

        {formStep === 2 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">Contact information</h3>
              <p className="text-sm text-gray-500">We'll deliver your quote and follow up with any questions.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={quoteData.owner.firstName}
                  onChange={(e) => handleOwnerChange("firstName", e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={quoteData.owner.lastName}
                  onChange={(e) => handleOwnerChange("lastName", e.target.value)}
                  className="h-11"
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
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  value={quoteData.owner.phone}
                  onChange={(e) => handleOwnerChange("phone", e.target.value)}
                  className="h-11"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Used only to deliver your quote — no spam.
                </p>
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select value={quoteData.owner.state} onValueChange={(value) => handleOwnerChange("state", value)} required>
                  <SelectTrigger id="state" className="h-11">
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
          </div>
        ) : null}

        <div
          ref={recaptchaContainerRef}
          className={cn("flex justify-center", formStep === 2 ? "pt-2" : "hidden")}
          data-sitekey={recaptchaSiteKey}
        />

        <div className="flex flex-col gap-3 pt-2">
          {formStep === 1 ? (
            <>
              <Button type="submit" className="h-12 bg-accent px-8 text-base hover:bg-green-600">
                Continue
              </Button>
              <p className="text-xs font-medium text-gray-600">
                No obligation · No credit card required.
              </p>
            </>
          ) : (
            <>
              <Button type="submit" disabled={submitQuoteMutation.isPending} className="h-12 bg-accent px-8 text-base hover:bg-green-600">
                {submitQuoteMutation.isPending ? "Submitting..." : submitLabel}
              </Button>
              <p className="text-xs font-medium text-gray-600">
                No obligation · No credit card required.
              </p>
              <p className="text-xs font-medium leading-relaxed text-gray-600">
                By submitting this form I consent to BH Auto Protect contacting me about vehicle protection services using
                automated calls, prerecorded voice messages, SMS/text messages, or email at the information provided above.
                Message and data rates may apply and messaging frequency may vary. Reply STOP to unsubscribe.
                <br />
                <span className="font-semibold text-gray-700">Consent not required to purchase.</span> I may call BH Auto Protect directly at{" "}
                <a href="tel:+18339400234" className="text-primary font-semibold">
                  (833) 940-0234
                </a>
                .
                <br />
                I consent to BH Auto Protect&apos;s{" "}
                <a href="/legal/terms" className="text-primary hover:underline">
                  mobile terms and conditions
                </a>{" "}
                and{" "}
                <a href="/legal/privacy" className="text-primary hover:underline">
                  privacy statement
                </a>
                , and I agree to the{" "}
                <a href="/legal/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/legal/terms" className="text-primary hover:underline">
                  Terms of Service
                </a>
                .
              </p>
              <p className="text-xs text-gray-500">
                This site is protected by reCAPTCHA and the Google{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="text-primary hover:underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="https://policies.google.com/terms"
                  className="text-primary hover:underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Terms of Service
                </a>{" "}
                apply.
              </p>
              {recaptchaError && (
                <p className="text-xs font-semibold text-destructive">
                  Verification failed. Please complete the reCAPTCHA challenge and try again.
                </p>
              )}
            </>
          )}
        </div>
      </form>
    );
  },
);

QuoteForm.displayName = "QuoteForm";

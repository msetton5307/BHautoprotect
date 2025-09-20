import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type CustomerContract,
  type CustomerSessionSnapshot,
  fetchCustomerJson,
} from "@/lib/customer-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDown, ShieldCheck } from "lucide-react";

type Props = {
  session: CustomerSessionSnapshot | null;
  initialContractId?: string | null;
};

type ContractFormState = {
  signatureName: string;
  signatureEmail: string;
  paymentMethod: string;
  paymentCardNumber: string;
  paymentExpMonth: string;
  paymentExpYear: string;
  paymentCvv: string;
  paymentNotes: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  shippingSameAsBilling: boolean;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  consent: boolean;
};

type PreviewState = {
  contractId: string;
  fileName: string;
  dataUrl: string;
};

const STATUS_CLASS: Record<string, string> = {
  signed: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  sent: "bg-amber-100 text-amber-900 border border-amber-200",
  draft: "bg-slate-200 text-slate-700 border border-slate-300",
  void: "bg-slate-200 text-slate-600 border border-slate-300",
};

function getStatusLabel(status: string): string {
  switch (status) {
    case "signed":
      return "Signed";
    case "sent":
      return "Awaiting signature";
    default:
      return status;
  }
}

function buildDownloadLink(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function normalizeDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export default function CustomerPortalContracts({ session, initialContractId }: Props) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<Record<string, ContractFormState>>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const isAuthenticated = Boolean(session);
  const baseContractsPath = isAuthenticated ? "/api/customer/contracts" : "/api/contracts";

  const contractsQuery = useQuery({
    queryKey: isAuthenticated
      ? [baseContractsPath]
      : [baseContractsPath, initialContractId ?? null],
    queryFn: async () => {
      if (isAuthenticated) {
        const response = await fetchCustomerJson<{ data: CustomerContract[] }>(baseContractsPath);
        return response.data;
      }

      if (!initialContractId) {
        return [] as CustomerContract[];
      }

      const response = await fetchCustomerJson<{ data: { contract: CustomerContract } | null }>(
        `${baseContractsPath}/${initialContractId}`,
      );
      const contract = response.data?.contract;
      return contract ? [contract] : [];
    },
    enabled: isAuthenticated || Boolean(initialContractId),
    initialData: isAuthenticated ? session?.contracts ?? [] : undefined,
  });

  const contracts = contractsQuery.data ?? [];
  const defaultEmail = session?.customer.email ?? "";

  useEffect(() => {
    setFormState((current) => {
      const next = { ...current };
      const activeIds = new Set<string>();
      contracts.forEach((contract) => {
        activeIds.add(contract.id);
        if (!next[contract.id]) {
          const expMonth = contract.paymentExpMonth ? String(contract.paymentExpMonth).padStart(2, "0") : "";
          const expYear = contract.paymentExpYear ? String(contract.paymentExpYear) : "";
          const billingCountry = contract.billingCountry ?? "United States";
          const shippingSameAsBilling = !contract.shippingAddressLine1 && !contract.shippingCity;
          next[contract.id] = {
            signatureName: contract.signatureName ?? "",
            signatureEmail: contract.signatureEmail ?? defaultEmail,
            paymentMethod: contract.paymentMethod ?? "",
            paymentCardNumber: contract.paymentCardNumber ?? "",
            paymentExpMonth: expMonth,
            paymentExpYear: expYear,
            paymentCvv: contract.paymentCvv ?? "",
            paymentNotes: contract.paymentNotes ?? "",
            billingAddressLine1: contract.billingAddressLine1 ?? "",
            billingAddressLine2: contract.billingAddressLine2 ?? "",
            billingCity: contract.billingCity ?? "",
            billingState: contract.billingState ?? "",
            billingPostalCode: contract.billingPostalCode ?? "",
            billingCountry,
            shippingSameAsBilling,
            shippingAddressLine1: contract.shippingAddressLine1 ?? "",
            shippingAddressLine2: contract.shippingAddressLine2 ?? "",
            shippingCity: contract.shippingCity ?? "",
            shippingState: contract.shippingState ?? "",
            shippingPostalCode: contract.shippingPostalCode ?? "",
            shippingCountry: contract.shippingCountry ?? billingCountry,
            consent: contract.status === "signed" ? true : Boolean(contract.signatureConsent),
          };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [contracts, defaultEmail]);

  const signMutation = useMutation({
    mutationFn: async ({
      contractId,
      payload,
      isGuest,
    }: {
      contractId: string;
      payload: {
        signatureName: string;
        signatureEmail?: string;
        consent: boolean;
        paymentMethod?: string;
        paymentCardNumber: string;
        paymentCvv: string;
        paymentExpMonth: number;
        paymentExpYear: number;
        paymentNotes?: string;
        billingAddressLine1: string;
        billingAddressLine2?: string;
        billingCity: string;
        billingState: string;
        billingPostalCode: string;
        billingCountry: string;
        shippingAddressLine1: string;
        shippingAddressLine2?: string;
        shippingCity: string;
        shippingState: string;
        shippingPostalCode: string;
        shippingCountry: string;
      };
      isGuest: boolean;
    }) => {
      const basePath = isGuest ? "/api/contracts" : "/api/customer/contracts";
      const response = await fetchCustomerJson<{ data: { contract: CustomerContract } }>(
        `${basePath}/${contractId}/sign`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      return response.data.contract;
    },
    onSuccess: () => {
      toast({
        title: "Contract signed",
        description: "Your coverage will be activated and a confirmation will arrive shortly.",
      });
      void contractsQuery.refetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "We couldn’t record your signature. Please try again.";
      toast({ title: "Signature failed", description: message, variant: "destructive" });
    },
  });

  const isLoading = contractsQuery.isLoading || contractsQuery.isFetching;

  const handleInputChange = (
    contractId: string,
    field: keyof ContractFormState,
    value: string | boolean,
  ) => {
    setFormState((current) => ({
      ...current,
      [contractId]: {
        ...current[contractId],
        [field]: value,
      },
    }));
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const response = await fetchCustomerJson<{
        data: { fileName: string; fileType: string; dataUrl: string };
      }>(`${baseContractsPath}/${contractId}/pdf`);
      const { fileName, dataUrl } = response.data;
      setPreview({ contractId, fileName: fileName || "contract.pdf", dataUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn’t open that contract.";
      toast({ title: "Preview failed", description: message, variant: "destructive" });
    }
  };

  const handleSign = (contract: CustomerContract) => {
    const form =
      formState[contract.id] ?? {
        signatureName: "",
        signatureEmail: contract.signatureEmail ?? defaultEmail,
        paymentMethod: "",
        paymentCardNumber: "",
        paymentExpMonth: "",
        paymentExpYear: "",
        paymentCvv: "",
        paymentNotes: "",
        billingAddressLine1: "",
        billingAddressLine2: "",
        billingCity: "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "United States",
        shippingSameAsBilling: true,
        shippingAddressLine1: "",
        shippingAddressLine2: "",
        shippingCity: "",
        shippingState: "",
        shippingPostalCode: "",
        shippingCountry: "United States",
        consent: false,
      };

    if (!form.signatureName.trim()) {
      toast({ title: "Add your signature", description: "Please enter your full name." });
      return;
    }

    if (!form.consent) {
      toast({
        title: "Consent required",
        description: "You must agree to sign digitally before we can activate coverage.",
        variant: "destructive",
      });
      return;
    }

    const cardNumberDigits = normalizeDigits(form.paymentCardNumber);
    if (cardNumberDigits.length < 13 || cardNumberDigits.length > 19) {
      toast({
        title: "Check card number",
        description: "Enter the full card number without spaces.",
        variant: "destructive",
      });
      return;
    }

    const cvv = normalizeDigits(form.paymentCvv);
    if (cvv.length < 3 || cvv.length > 4) {
      toast({
        title: "Check CVV",
        description: "The security code should be 3 or 4 digits.",
        variant: "destructive",
      });
      return;
    }

    const expMonth = Number.parseInt(form.paymentExpMonth, 10);
    const expYear = Number.parseInt(form.paymentExpYear, 10);
    if (Number.isNaN(expMonth) || expMonth < 1 || expMonth > 12 || Number.isNaN(expYear)) {
      toast({
        title: "Check expiration",
        description: "Enter a valid expiration month and year.",
        variant: "destructive",
      });
      return;
    }

    const billingLine1 = form.billingAddressLine1.trim();
    const billingCity = form.billingCity.trim();
    const billingState = form.billingState.trim();
    const billingPostal = form.billingPostalCode.trim();
    const billingCountry = form.billingCountry.trim() || "United States";

    if (!billingLine1 || !billingCity || !billingState || !billingPostal) {
      toast({
        title: "Billing address required",
        description: "Please complete the billing address fields.",
        variant: "destructive",
      });
      return;
    }

    const shippingFields = form.shippingSameAsBilling
      ? {
          shippingAddressLine1: billingLine1,
          shippingAddressLine2: form.billingAddressLine2.trim() || undefined,
          shippingCity: billingCity,
          shippingState: billingState,
          shippingPostalCode: billingPostal,
          shippingCountry: billingCountry,
        }
      : {
          shippingAddressLine1: form.shippingAddressLine1.trim(),
          shippingAddressLine2: form.shippingAddressLine2.trim() || undefined,
          shippingCity: form.shippingCity.trim(),
          shippingState: form.shippingState.trim(),
          shippingPostalCode: form.shippingPostalCode.trim(),
          shippingCountry: form.shippingCountry.trim() || "United States",
        };

    if (
      !shippingFields.shippingAddressLine1 ||
      !shippingFields.shippingCity ||
      !shippingFields.shippingState ||
      !shippingFields.shippingPostalCode
    ) {
      toast({
        title: "Shipping address required",
        description: "Please provide the shipping address we should use for your packet.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      signatureName: form.signatureName.trim(),
      consent: true,
      signatureEmail: form.signatureEmail.trim() || undefined,
      paymentMethod: form.paymentMethod.trim() || undefined,
      paymentCardNumber: cardNumberDigits,
      paymentCvv: cvv,
      paymentExpMonth: expMonth,
      paymentExpYear: expYear,
      paymentNotes: form.paymentNotes.trim() || undefined,
      billingAddressLine1: billingLine1,
      billingAddressLine2: form.billingAddressLine2.trim() || undefined,
      billingCity,
      billingState,
      billingPostalCode: billingPostal,
      billingCountry,
      ...shippingFields,
    };

    signMutation.mutate({ contractId: contract.id, payload, isGuest: !isAuthenticated });
  };

  const pendingCount = useMemo(
    () => contracts.filter((contract) => contract.status !== "signed").length,
    [contracts],
  );

  const headerTitle = isAuthenticated ? "Contracts & Activation" : "Review & Sign";
  const headerCopy = isAuthenticated
    ? "Review your service agreement, provide your signature, and confirm how you’d like to handle monthly payments."
    : "Review your service agreement, preview the PDF, and submit your signature without signing in.";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{headerTitle}</h1>
        <p className="mt-2 text-slate-600">{headerCopy}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-48" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{isAuthenticated ? "No contracts yet" : "Contract unavailable"}</CardTitle>
            <CardDescription>
              {isAuthenticated
                ? "We’ll notify you here as soon as a coverage agreement is ready for review."
                : "We couldn’t find a contract that matches this link. Double-check the URL or contact our team for help."}
            </CardDescription>
          </CardHeader>
          {isAuthenticated ? (
            <CardContent>
              <p className="text-sm text-slate-600">
                Already spoke with our team? Keep an eye on your inbox—once your contract is prepared it will appear in this
                section for digital signature.
              </p>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Action needed</p>
              <p>
                {pendingCount === 1
                  ? "1 contract is awaiting your signature."
                  : `${pendingCount} contracts are awaiting your signature.`}
              </p>
            </div>
          ) : null}

          {contracts.map((contract) => {
            const form =
              formState[contract.id] ?? {
                signatureName: "",
                signatureEmail: contract.signatureEmail ?? defaultEmail,
                paymentMethod: "",
                paymentCardNumber: "",
                paymentExpMonth: "",
                paymentExpYear: "",
                paymentCvv: "",
                paymentNotes: "",
                billingAddressLine1: "",
                billingAddressLine2: "",
                billingCity: "",
                billingState: "",
                billingPostalCode: "",
                billingCountry: "United States",
                shippingSameAsBilling: true,
                shippingAddressLine1: "",
                shippingAddressLine2: "",
                shippingCity: "",
                shippingState: "",
                shippingPostalCode: "",
                shippingCountry: "United States",
                consent: false,
              };
            const statusClass = STATUS_CLASS[contract.status] ?? STATUS_CLASS.draft;
            const isSigning =
              signMutation.isPending &&
              (signMutation.variables as { contractId?: string } | undefined)?.contractId === contract.id;

            return (
              <Card key={contract.id} className="shadow-sm">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-slate-500" />
                      {contract.fileName}
                    </CardTitle>
                    <CardDescription>
                      {getStatusLabel(contract.status)}
                      {contract.signedAt ? ` • Signed ${new Date(contract.signedAt).toLocaleString()}` : ""}
                    </CardDescription>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                    {getStatusLabel(contract.status)}
                  </span>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => handleViewContract(contract.id)}>
                      <FileDown className="mr-2 h-4 w-4" /> Preview contract
                    </Button>
                  </div>

                  {contract.status === "signed" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Thanks for signing! Our concierge team is finalizing activation and will follow up with a confirmation
                      packet.
                    </div>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleSign(contract);
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-name`}>Your signature (type your full name)</Label>
                          <Input
                            id={`${contract.id}-name`}
                            value={form.signatureName}
                            onChange={(event) => handleInputChange(contract.id, "signatureName", event.target.value)}
                            placeholder="Jane Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-email`}>Email for confirmation</Label>
                          <Input
                            id={`${contract.id}-email`}
                            type="email"
                            value={form.signatureEmail}
                            onChange={(event) => handleInputChange(contract.id, "signatureEmail", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-method`}>Card nickname</Label>
                          <Input
                            id={`${contract.id}-method`}
                            placeholder="Primary business card"
                            value={form.paymentMethod}
                            onChange={(event) => handleInputChange(contract.id, "paymentMethod", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-card`}>Card number</Label>
                          <Input
                            id={`${contract.id}-card`}
                            inputMode="numeric"
                            autoComplete="cc-number"
                            placeholder="1234 5678 9012 3456"
                            value={form.paymentCardNumber}
                            onChange={(event) => handleInputChange(contract.id, "paymentCardNumber", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-expMonth`}>Exp. month (MM)</Label>
                          <Input
                            id={`${contract.id}-expMonth`}
                            inputMode="numeric"
                            placeholder="08"
                            value={form.paymentExpMonth}
                            onChange={(event) => handleInputChange(contract.id, "paymentExpMonth", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-expYear`}>Exp. year (YYYY)</Label>
                          <Input
                            id={`${contract.id}-expYear`}
                            inputMode="numeric"
                            placeholder="2026"
                            value={form.paymentExpYear}
                            onChange={(event) => handleInputChange(contract.id, "paymentExpYear", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-cvv`}>CVV</Label>
                          <Input
                            id={`${contract.id}-cvv`}
                            inputMode="numeric"
                            placeholder="123"
                            value={form.paymentCvv}
                            onChange={(event) => handleInputChange(contract.id, "paymentCvv", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${contract.id}-billing-line1`}>Billing address</Label>
                        <Input
                          id={`${contract.id}-billing-line1`}
                          autoComplete="address-line1"
                          placeholder="123 Main St."
                          value={form.billingAddressLine1}
                          onChange={(event) =>
                            handleInputChange(contract.id, "billingAddressLine1", event.target.value)
                          }
                        />
                        <Input
                          id={`${contract.id}-billing-line2`}
                          autoComplete="address-line2"
                          placeholder="Apartment, suite, etc. (optional)"
                          value={form.billingAddressLine2}
                          onChange={(event) =>
                            handleInputChange(contract.id, "billingAddressLine2", event.target.value)
                          }
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${contract.id}-billing-city`}>City</Label>
                          <Input
                            id={`${contract.id}-billing-city`}
                            autoComplete="address-level2"
                            value={form.billingCity}
                            onChange={(event) => handleInputChange(contract.id, "billingCity", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-billing-state`}>State</Label>
                          <Input
                            id={`${contract.id}-billing-state`}
                            autoComplete="address-level1"
                            value={form.billingState}
                            onChange={(event) => handleInputChange(contract.id, "billingState", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-billing-postal`}>Postal code</Label>
                          <Input
                            id={`${contract.id}-billing-postal`}
                            autoComplete="postal-code"
                            value={form.billingPostalCode}
                            onChange={(event) =>
                              handleInputChange(contract.id, "billingPostalCode", event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${contract.id}-billing-country`}>Country</Label>
                        <Input
                          id={`${contract.id}-billing-country`}
                          value={form.billingCountry}
                          onChange={(event) => handleInputChange(contract.id, "billingCountry", event.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${contract.id}-shipping-same`}
                          checked={form.shippingSameAsBilling}
                          onCheckedChange={(checked) =>
                            handleInputChange(contract.id, "shippingSameAsBilling", checked === true)
                          }
                        />
                        <Label htmlFor={`${contract.id}-shipping-same`} className="text-sm font-medium">
                          Shipping address matches billing
                        </Label>
                      </div>

                      {!form.shippingSameAsBilling ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`${contract.id}-shipping-line1`}>Shipping address</Label>
                            <Input
                              id={`${contract.id}-shipping-line1`}
                              autoComplete="shipping address-line1"
                              placeholder="123 Main St."
                              value={form.shippingAddressLine1}
                              onChange={(event) =>
                                handleInputChange(contract.id, "shippingAddressLine1", event.target.value)
                              }
                            />
                            <Input
                              id={`${contract.id}-shipping-line2`}
                              autoComplete="shipping address-line2"
                              placeholder="Apartment, suite, etc. (optional)"
                              value={form.shippingAddressLine2}
                              onChange={(event) =>
                                handleInputChange(contract.id, "shippingAddressLine2", event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={`${contract.id}-shipping-city`}>City</Label>
                              <Input
                                id={`${contract.id}-shipping-city`}
                                autoComplete="shipping address-level2"
                                value={form.shippingCity}
                                onChange={(event) =>
                                  handleInputChange(contract.id, "shippingCity", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${contract.id}-shipping-state`}>State</Label>
                              <Input
                                id={`${contract.id}-shipping-state`}
                                autoComplete="shipping address-level1"
                                value={form.shippingState}
                                onChange={(event) =>
                                  handleInputChange(contract.id, "shippingState", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${contract.id}-shipping-postal`}>Postal code</Label>
                              <Input
                                id={`${contract.id}-shipping-postal`}
                                autoComplete="shipping postal-code"
                                value={form.shippingPostalCode}
                                onChange={(event) =>
                                  handleInputChange(contract.id, "shippingPostalCode", event.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${contract.id}-shipping-country`}>Country</Label>
                            <Input
                              id={`${contract.id}-shipping-country`}
                              value={form.shippingCountry}
                              onChange={(event) =>
                                handleInputChange(contract.id, "shippingCountry", event.target.value)
                              }
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor={`${contract.id}-notes`}>Notes for our team</Label>
                        <Textarea
                          id={`${contract.id}-notes`}
                          rows={4}
                          value={form.paymentNotes}
                          onChange={(event) => handleInputChange(contract.id, "paymentNotes", event.target.value)}
                          placeholder="Anything else we should know before activation?"
                        />
                      </div>

                      <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <Checkbox
                          id={`${contract.id}-consent`}
                          checked={form.consent}
                          onCheckedChange={(checked) => handleInputChange(contract.id, "consent", checked === true)}
                        />
                        <Label htmlFor={`${contract.id}-consent`} className="leading-relaxed">
                          I agree to sign this contract electronically. BH Auto Protect may deliver policy documents digitally and
                          contact me to finalize coverage. I authorize BH Auto Protect to begin coverage and process my payment
                          method as described in the contract.
                        </Label>
                      </div>

                      <Button type="submit" disabled={isSigning} className="w-full sm:w-auto">
                        {isSigning ? "Submitting..." : "Sign contract"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={(open) => (!open ? setPreview(null) : undefined)}>
        <DialogContent className="w-[95vw] max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.fileName ?? "Contract"}</DialogTitle>
            <DialogDescription>Preview the contract. Download it if you need an offline copy.</DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] w-full overflow-hidden rounded-lg border bg-slate-50">
            {preview ? (
              <iframe
                title={preview.fileName ?? "Contract preview"}
                src={preview.dataUrl}
                className="h-full w-full"
                style={{ border: "none" }}
              >
                This browser cannot display PDFs. Please download the file instead.
              </iframe>
            ) : null}
          </div>
          <DialogFooter className="justify-between gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
            {preview ? (
              <Button
                onClick={() => buildDownloadLink(preview.dataUrl, preview.fileName || "contract.pdf")}
                variant="secondary"
              >
                Download PDF
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { FileDown, ShieldCheck } from "lucide-react";

type Props = {
  session: CustomerSessionSnapshot;
};

type ContractFormState = {
  signatureName: string;
  signatureEmail: string;
  paymentMethod: string;
  paymentLastFour: string;
  paymentExpMonth: string;
  paymentExpYear: string;
  paymentNotes: string;
  consent: boolean;
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

export default function CustomerPortalContracts({ session }: Props) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<Record<string, ContractFormState>>({});

  const contractsQuery = useQuery({
    queryKey: ["/api/customer/contracts"],
    queryFn: async () => {
      const response = await fetchCustomerJson<{ data: CustomerContract[] }>("/api/customer/contracts");
      return response.data;
    },
    initialData: session.contracts,
  });

  const contracts = contractsQuery.data ?? [];

  useEffect(() => {
    setFormState((current) => {
      const next = { ...current };
      const activeIds = new Set<string>();
      contracts.forEach((contract) => {
        activeIds.add(contract.id);
        if (!next[contract.id]) {
          next[contract.id] = {
            signatureName: contract.signatureName ?? "",
            signatureEmail: contract.signatureEmail ?? session.customer.email,
            paymentMethod: contract.paymentMethod ?? "",
            paymentLastFour: contract.paymentLastFour ?? "",
            paymentExpMonth: contract.paymentExpMonth ? String(contract.paymentExpMonth) : "",
            paymentExpYear: contract.paymentExpYear ? String(contract.paymentExpYear) : "",
            paymentNotes: contract.paymentNotes ?? "",
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
  }, [contracts, session.customer.email]);

  const signMutation = useMutation({
    mutationFn: async ({
      contractId,
      payload,
    }: {
      contractId: string;
      payload: {
        signatureName: string;
        signatureEmail?: string;
        consent: boolean;
        paymentMethod?: string;
        paymentLastFour?: string;
        paymentExpMonth?: number;
        paymentExpYear?: number;
        paymentNotes?: string;
      };
    }) => {
      const response = await fetchCustomerJson<{ data: { contract: CustomerContract } }>(
        `/api/customer/contracts/${contractId}/sign`,
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
      }>(`/api/customer/contracts/${contractId}/pdf`);
      const { fileName, dataUrl } = response.data;
      buildDownloadLink(dataUrl, fileName || "contract.pdf");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn’t open that contract.";
      toast({ title: "Download failed", description: message, variant: "destructive" });
    }
  };

  const handleSign = (contract: CustomerContract) => {
    const form = formState[contract.id] ?? {
      signatureName: "",
      signatureEmail: session.customer.email,
      paymentMethod: "",
      paymentLastFour: "",
      paymentExpMonth: "",
      paymentExpYear: "",
      paymentNotes: "",
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

    const payload: {
      signatureName: string;
      signatureEmail?: string;
      consent: boolean;
      paymentMethod?: string;
      paymentLastFour?: string;
      paymentExpMonth?: number;
      paymentExpYear?: number;
      paymentNotes?: string;
    } = {
      signatureName: form.signatureName.trim(),
      consent: true,
    };

    const signatureEmail = form.signatureEmail.trim();
    if (signatureEmail) {
      payload.signatureEmail = signatureEmail;
    }
    if (form.paymentMethod.trim()) {
      payload.paymentMethod = form.paymentMethod.trim();
    }
    if (form.paymentLastFour.trim()) {
      payload.paymentLastFour = form.paymentLastFour.trim();
    }
    if (form.paymentExpMonth.trim()) {
      const expMonth = Number(form.paymentExpMonth);
      if (!Number.isNaN(expMonth)) {
        payload.paymentExpMonth = expMonth;
      }
    }
    if (form.paymentExpYear.trim()) {
      const expYear = Number(form.paymentExpYear);
      if (!Number.isNaN(expYear)) {
        payload.paymentExpYear = expYear;
      }
    }
    if (form.paymentNotes.trim()) {
      payload.paymentNotes = form.paymentNotes.trim();
    }

    signMutation.mutate({ contractId: contract.id, payload });
  };

  const pendingCount = useMemo(
    () => contracts.filter((contract) => contract.status !== "signed").length,
    [contracts],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Contracts &amp; Activation</h1>
        <p className="text-slate-600 mt-2">
          Review your service agreement, provide your signature, and confirm how you’d like to handle monthly
          payments.
        </p>
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
            <CardTitle>No contracts yet</CardTitle>
            <CardDescription>
              We’ll notify you here as soon as a coverage agreement is ready for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Already spoke with our team? Keep an eye on your inbox—once your contract is prepared it will appear in
              this section for digital signature.
            </p>
          </CardContent>
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
            const form = formState[contract.id] ?? {
              signatureName: "",
              signatureEmail: session.customer.email,
              paymentMethod: "",
              paymentLastFour: "",
              paymentExpMonth: "",
              paymentExpYear: "",
              paymentNotes: "",
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
                      {contract.signedAt ? ` • Signed ${new Date(contract.signedAt).toLocaleString()}` : ''}
                    </CardDescription>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                    {getStatusLabel(contract.status)}
                  </span>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => handleViewContract(contract.id)}>
                      <FileDown className="mr-2 h-4 w-4" /> View contract PDF
                    </Button>
                  </div>

                  {contract.status === 'signed' ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Thanks for signing! Our concierge team is finalizing activation and will follow up with a
                      confirmation packet.
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
                            onChange={(event) =>
                              handleInputChange(contract.id, "signatureName", event.target.value)
                            }
                            placeholder="Jane Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-email`}>Email for confirmation</Label>
                          <Input
                            id={`${contract.id}-email`}
                            type="email"
                            value={form.signatureEmail}
                            onChange={(event) =>
                              handleInputChange(contract.id, "signatureEmail", event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${contract.id}-method`}>Preferred payment method</Label>
                          <Input
                            id={`${contract.id}-method`}
                            placeholder="Visa ending in 1234"
                            value={form.paymentMethod}
                            onChange={(event) =>
                              handleInputChange(contract.id, "paymentMethod", event.target.value)
                            }
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2 space-y-2">
                            <Label htmlFor={`${contract.id}-lastFour`}>Card last digits</Label>
                            <Input
                              id={`${contract.id}-lastFour`}
                              inputMode="numeric"
                              maxLength={4}
                              value={form.paymentLastFour}
                              onChange={(event) =>
                                handleInputChange(contract.id, "paymentLastFour", event.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${contract.id}-expMonth`}>Exp. MM</Label>
                            <Input
                              id={`${contract.id}-expMonth`}
                              inputMode="numeric"
                              maxLength={2}
                              value={form.paymentExpMonth}
                              onChange={(event) =>
                                handleInputChange(contract.id, "paymentExpMonth", event.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${contract.id}-expYear`}>Exp. YY</Label>
                            <Input
                              id={`${contract.id}-expYear`}
                              inputMode="numeric"
                              maxLength={4}
                              value={form.paymentExpYear}
                              onChange={(event) =>
                                handleInputChange(contract.id, "paymentExpYear", event.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${contract.id}-notes`}>Notes for our team</Label>
                        <Textarea
                          id={`${contract.id}-notes`}
                          placeholder="Share any questions or requests about your billing preferences."
                          value={form.paymentNotes}
                          onChange={(event) =>
                            handleInputChange(contract.id, "paymentNotes", event.target.value)
                          }
                          rows={3}
                        />
                      </div>

                      <div className="flex items-start space-x-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <Checkbox
                          id={`${contract.id}-consent`}
                          checked={form.consent}
                          onCheckedChange={(checked) =>
                            handleInputChange(contract.id, "consent", checked === true)
                          }
                        />
                        <Label
                          htmlFor={`${contract.id}-consent`}
                          className="text-sm text-slate-600 leading-snug"
                        >
                          I understand that typing my name counts as my electronic signature and authorizes BH Auto
                          Protect to begin coverage and process my payment method as described in the contract.
                        </Label>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={isSigning}>
                          {isSigning ? 'Submitting...' : 'Sign contract'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleViewContract(contract.id)}
                        >
                          Review PDF again
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchCustomerJson,
  type CustomerSessionSnapshot,
  type CustomerPolicy,
  type CustomerPaymentProfile,
  type PolicyCharge,
} from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  session: CustomerSessionSnapshot;
};

type PaymentFormState = {
  paymentMethod: string;
  accountName: string;
  accountIdentifier: string;
  cardBrand: string;
  cardLastFour: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  billingZip: string;
  autopayEnabled: boolean;
  notes: string;
};

const initialForm: PaymentFormState = {
  paymentMethod: "",
  accountName: "",
  accountIdentifier: "",
  cardBrand: "",
  cardLastFour: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  billingZip: "",
  autopayEnabled: false,
  notes: "",
};

function describePolicy(policy: CustomerPolicy): string {
  const vehicle = policy.vehicle;
  if (!vehicle) return `Policy ${policy.id}`;
  const parts = [vehicle.year ?? undefined, vehicle.make ?? undefined, vehicle.model ?? undefined]
    .map((part) => (part == null ? "" : String(part)))
    .filter(Boolean);
  const summary = parts.join(" ");
  return summary ? `${summary} · ${policy.id}` : `Policy ${policy.id}`;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const chargeStatusCopy: Record<PolicyCharge["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-transparent" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700 border-transparent" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 border-transparent" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-700 border-transparent" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-700 border-transparent" },
};

function formatChargeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PaymentCard({
  policy,
  profile,
  onSave,
  saving,
  charges,
  chargesLoading,
}: {
  policy: CustomerPolicy;
  profile: CustomerPaymentProfile | undefined;
  onSave: (form: PaymentFormState) => void;
  saving: boolean;
  charges: PolicyCharge[];
  chargesLoading: boolean;
}) {
  const [form, setForm] = useState<PaymentFormState>(initialForm);

  useEffect(() => {
    if (!profile) {
      setForm(initialForm);
      return;
    }
    setForm({
      paymentMethod: profile.paymentMethod ?? "",
      accountName: profile.accountName ?? "",
      accountIdentifier: profile.accountIdentifier ?? "",
      cardBrand: profile.cardBrand ?? "",
      cardLastFour: profile.cardLastFour ?? "",
      cardExpiryMonth: profile.cardExpiryMonth != null ? String(profile.cardExpiryMonth).padStart(2, "0") : "",
      cardExpiryYear: profile.cardExpiryYear != null ? String(profile.cardExpiryYear) : "",
      billingZip: profile.billingZip ?? "",
      autopayEnabled: profile.autopayEnabled,
      notes: profile.notes ?? "",
    });
  }, [profile]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(form);
  };

  const previewBrand = form.cardBrand || profile?.cardBrand || form.paymentMethod || profile?.paymentMethod || "Card on file";
  const previewLastFour = form.cardLastFour || profile?.cardLastFour || profile?.accountIdentifier || "••••";
  const previewExpiry = (() => {
    const month = form.cardExpiryMonth || (profile?.cardExpiryMonth != null ? String(profile.cardExpiryMonth).padStart(2, "0") : "");
    const year = form.cardExpiryYear || (profile?.cardExpiryYear != null ? String(profile.cardExpiryYear).slice(-2) : "");
    return month && year ? `${month}/${year}` : "MM/YY";
  })();
  const previewName =
    form.accountName ||
    profile?.accountName ||
    [policy.lead?.firstName, policy.lead?.lastName].filter(Boolean).join(" ") ||
    "Authorized payer";

  const recentCharges = charges.slice(0, 6);

  return (
    <Card key={policy.id} className="border border-slate-200 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg text-slate-900">{describePolicy(policy)}</CardTitle>
          <Badge variant="outline" className={form.autopayEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}>
            {form.autopayEnabled ? "Autopay enabled" : "Autopay off"}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          Securely share the card our billing specialists should use. We only store the pieces we need to verify with you by
          phone before any charge is processed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-600 to-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-300">
              <span>BH AUTOPROTECT</span>
              <span>{policy.id}</span>
            </div>
            <div className="mt-8 text-sm text-slate-200">{previewBrand}</div>
            <div className="mt-3 text-2xl font-semibold tracking-[0.32em] text-white">•••• {previewLastFour || "••••"}</div>
            <div className="mt-6 flex items-center justify-between text-xs text-slate-300">
              <div>
                <p className="font-semibold text-slate-100">Cardholder</p>
                <p className="mt-1 text-sm text-slate-200">{previewName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-100">Expires</p>
                <p className="mt-1 text-sm text-slate-200">{previewExpiry}</p>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`method-${policy.id}`}>Card nickname</Label>
                <Input
                  id={`method-${policy.id}`}
                  placeholder="Primary business card"
                  value={form.paymentMethod}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`brand-${policy.id}`}>Card brand</Label>
                <Input
                  id={`brand-${policy.id}`}
                  placeholder="Visa, Mastercard, AmEx"
                  value={form.cardBrand}
                  onChange={(event) => setForm((current) => ({ ...current, cardBrand: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`name-${policy.id}`}>Name on card</Label>
                <Input
                  id={`name-${policy.id}`}
                  placeholder="Who should we bill?"
                  value={form.accountName}
                  onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`identifier-${policy.id}`}>Internal reference</Label>
                <Input
                  id={`identifier-${policy.id}`}
                  placeholder="Invoice or account #"
                  value={form.accountIdentifier}
                  onChange={(event) => setForm((current) => ({ ...current, accountIdentifier: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`last-four-${policy.id}`}>Last four digits</Label>
                <Input
                  id={`last-four-${policy.id}`}
                  placeholder="1234"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.cardLastFour}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setForm((current) => ({ ...current, cardLastFour: value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`exp-month-${policy.id}`}>Exp. month</Label>
                <Input
                  id={`exp-month-${policy.id}`}
                  placeholder="MM"
                  inputMode="numeric"
                  maxLength={2}
                  value={form.cardExpiryMonth}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                    setForm((current) => ({ ...current, cardExpiryMonth: value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`exp-year-${policy.id}`}>Exp. year</Label>
                <Input
                  id={`exp-year-${policy.id}`}
                  placeholder="YYYY"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.cardExpiryYear}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setForm((current) => ({ ...current, cardExpiryYear: value }));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`zip-${policy.id}`}>Billing ZIP</Label>
                <Input
                  id={`zip-${policy.id}`}
                  placeholder="12345"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.billingZip}
                  onChange={(event) => setForm((current) => ({ ...current, billingZip: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`notes-${policy.id}`}>Notes for our team</Label>
                <Textarea
                  id={`notes-${policy.id}`}
                  rows={4}
                  placeholder="Payment timing, shared cards, or special handling"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Autopay</p>
                <p className="text-xs text-slate-500">
                  Let us draft each payment automatically once everything is verified.
                </p>
              </div>
              <Switch
                checked={form.autopayEnabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, autopayEnabled: checked }))}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? "Saving..." : "Save card details"}
            </Button>
          </form>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent charges</h3>
            {recentCharges.length > 0 ? (
              <span className="text-xs text-slate-500">Showing {recentCharges.length} of {charges.length}</span>
            ) : null}
          </div>
          {chargesLoading ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
              Loading charge history...
            </div>
          ) : recentCharges.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
              Once we post charges for this policy, you’ll see them itemized here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentCharges.map((charge) => {
                    const status = chargeStatusCopy[charge.status];
                    return (
                      <tr key={charge.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{charge.description}</div>
                          {charge.notes ? <div className="text-xs text-slate-500">{charge.notes}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatChargeDate(charge.chargedAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {currencyFormatter.format((charge.amountCents ?? 0) / 100)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerPortalPayments({ session }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const policiesQuery = useQuery<{ data?: { policies?: CustomerPolicy[] } }>([
    "/api/customer/policies",
  ]);
  const paymentProfilesQuery = useQuery<{ data?: { paymentProfiles?: CustomerPaymentProfile[] } }>([
    "/api/customer/payment-profiles",
  ]);
  const chargesQuery = useQuery<{ data?: { charges?: PolicyCharge[] } }>([
    "/api/customer/payment-charges",
  ]);

  const policies = useMemo(() => {
    const apiPolicies = policiesQuery.data?.data?.policies;
    if (Array.isArray(apiPolicies) && apiPolicies.length > 0) {
      return apiPolicies;
    }
    return session.policies;
  }, [policiesQuery.data, session.policies]);

  const profilesByPolicy = useMemo(() => {
    const profiles = paymentProfilesQuery.data?.data?.paymentProfiles ?? [];
    const map = new Map<string, CustomerPaymentProfile>();
    for (const profile of profiles) {
      map.set(profile.policyId, profile);
    }
    return map;
  }, [paymentProfilesQuery.data]);

  const chargesByPolicy = useMemo(() => {
    const charges = chargesQuery.data?.data?.charges ?? [];
    const map = new Map<string, PolicyCharge[]>();
    for (const charge of charges) {
      const existing = map.get(charge.policyId) ?? [];
      existing.push(charge);
      map.set(charge.policyId, existing);
    }
    for (const [policyId, list] of map) {
      list.sort((a, b) => new Date(b.chargedAt).valueOf() - new Date(a.chargedAt).valueOf());
      map.set(policyId, list);
    }
    return map;
  }, [chargesQuery.data]);

  const mutation = useMutation({
    mutationFn: async ({ policyId, form }: { policyId: string; form: PaymentFormState }) => {
      const payload: Record<string, unknown> = {
        paymentMethod: form.paymentMethod.trim() || undefined,
        accountName: form.accountName.trim() || undefined,
        accountIdentifier: form.accountIdentifier.trim() || undefined,
        cardBrand: form.cardBrand.trim() || undefined,
        cardLastFour: form.cardLastFour.trim() || undefined,
        cardExpiryMonth: form.cardExpiryMonth ? Number(form.cardExpiryMonth) : undefined,
        cardExpiryYear: form.cardExpiryYear ? Number(form.cardExpiryYear) : undefined,
        billingZip: form.billingZip.trim() || undefined,
        autopayEnabled: form.autopayEnabled,
        notes: form.notes.trim() || undefined,
      };
      return fetchCustomerJson<{ data: CustomerPaymentProfile }>(
        `/api/customer/policies/${policyId}/payment-profile`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: () => {
      toast({
        title: "Preferences saved",
        description: "We updated your billing instructions.",
      });
      void queryClient.invalidateQueries(["/api/customer/payment-profiles"]);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "We couldn’t save those details.";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Payment Center</h1>
        <p className="text-slate-600 mt-2">
          Keep your preferred card on file, enable autopay, and review every charge tied to your protection plan.
        </p>
      </div>

      <div className="space-y-6">
        {policies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-slate-500">
              We don’t see any policies linked to your portal yet. Once your coverage is active you’ll be able to manage your
              billing preferences here.
            </CardContent>
          </Card>
        ) : (
          policies.map((policy) => (
            <PaymentCard
              key={policy.id}
              policy={policy}
              profile={profilesByPolicy.get(policy.id)}
              saving={mutation.isLoading}
              charges={chargesByPolicy.get(policy.id) ?? []}
              chargesLoading={chargesQuery.isLoading}
              onSave={(form) => mutation.mutate({ policyId: policy.id, form })}
            />
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  fetchCustomerJson,
  type CustomerSessionSnapshot,
  type CustomerPolicy,
  type CustomerPaymentProfile,
} from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  session: CustomerSessionSnapshot;
};

type PaymentFormState = {
  paymentMethod: string;
  accountName: string;
  accountIdentifier: string;
  autopayEnabled: boolean;
  notes: string;
};

const initialForm: PaymentFormState = {
  paymentMethod: "",
  accountName: "",
  accountIdentifier: "",
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

function PaymentCard({
  policy,
  profile,
  onSave,
  saving,
}: {
  policy: CustomerPolicy;
  profile: CustomerPaymentProfile | undefined;
  onSave: (form: PaymentFormState) => void;
  saving: boolean;
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
      autopayEnabled: profile.autopayEnabled,
      notes: profile.notes ?? "",
    });
  }, [profile]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <Card key={policy.id} className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-slate-900">{describePolicy(policy)}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`method-${policy.id}`}>Payment method</Label>
              <Input
                id={`method-${policy.id}`}
                placeholder="Visa ending in 1234, ACH, etc."
                value={form.paymentMethod}
                onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`name-${policy.id}`}>Name on account</Label>
              <Input
                id={`name-${policy.id}`}
                placeholder="Who should we bill?"
                value={form.accountName}
                onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`identifier-${policy.id}`}>Billing identifier</Label>
            <Input
              id={`identifier-${policy.id}`}
              placeholder="Last four digits or billing reference"
              value={form.accountIdentifier}
              onChange={(event) => setForm((current) => ({ ...current, accountIdentifier: event.target.value }))}
            />
            <p className="text-xs text-slate-500">
              We only store the last few digits of your payment details. A specialist will confirm the full information over
              the phone before charging anything.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Autopay</p>
              <p className="text-xs text-slate-500">Enable recurring payments once everything is set up.</p>
            </div>
            <Switch
              checked={form.autopayEnabled}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, autopayEnabled: checked }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notes-${policy.id}`}>Notes for our billing team</Label>
            <Textarea
              id={`notes-${policy.id}`}
              rows={4}
              placeholder="Share billing preferences, special instructions, or timing requests."
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save payment preferences"}
          </Button>
        </form>
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

  const mutation = useMutation({
    mutationFn: async ({ policyId, form }: { policyId: string; form: PaymentFormState }) => {
      const payload: Record<string, unknown> = {
        paymentMethod: form.paymentMethod.trim() || undefined,
        accountName: form.accountName.trim() || undefined,
        accountIdentifier: form.accountIdentifier.trim() || undefined,
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
        <h1 className="text-3xl font-bold text-slate-900">Payment Preferences</h1>
        <p className="text-slate-600 mt-2">
          Manage the details our billing team will use when collecting your monthly coverage payments.
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
              onSave={(form) => mutation.mutate({ policyId: policy.id, form })}
            />
          ))
        )}
      </div>
    </div>
  );
}

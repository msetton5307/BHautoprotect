import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCustomerJson,
  type CustomerSessionSnapshot,
  type CustomerPolicy,
  type CustomerClaim,
} from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  session: CustomerSessionSnapshot;
};

type ClaimFormState = {
  policyId: string;
  claimReason: string;
  message: string;
  preferredPhone: string;
  currentOdometer: string;
};

const initialForm: ClaimFormState = {
  policyId: "",
  claimReason: "",
  message: "",
  preferredPhone: "",
  currentOdometer: "",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return dateFormatter.format(date);
}

function describePolicy(policy: CustomerPolicy): string {
  const vehicle = policy.vehicle;
  if (!vehicle) return `Policy ${policy.id}`;
  const parts = [vehicle.year ?? undefined, vehicle.make ?? undefined, vehicle.model ?? undefined]
    .map((part) => (part == null ? "" : String(part)))
    .filter(Boolean);
  const summary = parts.join(" ");
  return summary ? `${summary} · ${policy.id}` : `Policy ${policy.id}`;
}

function normalizeNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "denied":
      return "destructive";
    case "claim_covered_closed":
      return "secondary";
    case "awaiting_customer_action":
      return "outline";
    default:
      return "default";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export default function CustomerPortalClaims({ session }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClaimFormState>(initialForm);

  const policiesQuery = useQuery<{ data?: { policies?: CustomerPolicy[] } }>([
    "/api/customer/policies",
  ]);
  const claimsQuery = useQuery<{ data?: { claims?: CustomerClaim[] } }>([
    "/api/customer/claims",
  ]);

  const policies = useMemo(() => {
    const apiPolicies = policiesQuery.data?.data?.policies;
    if (Array.isArray(apiPolicies) && apiPolicies.length > 0) {
      return apiPolicies;
    }
    return session.policies;
  }, [policiesQuery.data, session.policies]);

  const claims = useMemo(() => claimsQuery.data?.data?.claims ?? [], [claimsQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        policyId: form.policyId,
        message: form.message.trim(),
      };
      if (form.claimReason.trim()) {
        payload.claimReason = form.claimReason.trim();
      }
      if (form.preferredPhone.trim()) {
        payload.preferredPhone = form.preferredPhone.trim();
      }
      const odometer = normalizeNumberInput(form.currentOdometer);
      if (odometer !== undefined) {
        payload.currentOdometer = odometer;
      }

      return fetchCustomerJson<{ data: CustomerClaim }>("/api/customer/claims", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({
        title: "Claim submitted",
        description: "Our claims team will reach out shortly with next steps.",
      });
      setForm(initialForm);
      void queryClient.invalidateQueries(["/api/customer/claims"]);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "We couldn’t submit your claim.";
      toast({ title: "Submission failed", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.policyId) {
      toast({ title: "Select a policy", description: "Choose the policy you need help with." });
      return;
    }
    if (!form.message.trim()) {
      toast({ title: "Describe the issue", description: "Let us know what happened." });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Claims Center</h1>
        <p className="text-slate-600 mt-2">
          Tell us what happened and we’ll coordinate the repairs, logistics, and next steps for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a New Claim</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="policy">Covered vehicle</Label>
              <Select
                value={form.policyId}
                onValueChange={(value) => setForm((current) => ({ ...current, policyId: value }))}
                disabled={policies.length === 0}
              >
                <SelectTrigger id="policy">
                  <SelectValue placeholder={policies.length === 0 ? "No policies available" : "Select a policy"} />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {describePolicy(policy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="summary">What happened?</Label>
                <Input
                  id="summary"
                  placeholder="Transmission issues, warning lights, noise..."
                  value={form.claimReason}
                  onChange={(event) => setForm((current) => ({ ...current, claimReason: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Preferred phone</Label>
                <Input
                  id="phone"
                  placeholder="Where can we reach you?"
                  value={form.preferredPhone}
                  onChange={(event) => setForm((current) => ({ ...current, preferredPhone: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details for our claims team</Label>
              <Textarea
                id="details"
                rows={5}
                placeholder="Tell us when the issue started, what you were doing, and anything else we should know."
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="odometer">Current odometer (optional)</Label>
                <Input
                  id="odometer"
                  inputMode="numeric"
                  placeholder="eg. 82,350"
                  value={form.currentOdometer}
                  onChange={(event) => setForm((current) => ({ ...current, currentOdometer: event.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={mutation.isLoading || policies.length === 0}>
              {mutation.isLoading ? "Submitting..." : "Submit Claim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {claimsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : claims.length === 0 ? (
            <p className="text-sm text-slate-500">You haven’t filed any claims yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Last update</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">#{claim.id}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(claim.status)} className="capitalize">
                        {formatStatus(claim.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(claim.createdAt)}</TableCell>
                    <TableCell>{formatDate(claim.updatedAt)}</TableCell>
                    <TableCell className="max-w-xs text-sm text-slate-600 line-clamp-3">{claim.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

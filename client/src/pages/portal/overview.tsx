import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CustomerSessionSnapshot,
  type CustomerPolicy,
  type CustomerClaim,
} from "@/lib/customer-auth";

type Props = {
  session: CustomerSessionSnapshot;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "To be scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "To be scheduled";
  return dateFormatter.format(date);
}

function summarizeVehicle(policy: CustomerPolicy): string {
  const parts = [
    policy.vehicle?.year ?? undefined,
    policy.vehicle?.make ?? undefined,
    policy.vehicle?.model ?? undefined,
  ]
    .map((part) => (part == null ? "" : String(part)))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Vehicle details on file";
}

function friendlyPlanName(plan: string | null): string {
  if (!plan) return "Vehicle Protection";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function computeMonthlyTotal(policies: CustomerPolicy[]): number {
  return policies.reduce((total, policy) => total + (policy.monthlyPayment ?? 0), 0);
}

function computeOpenClaims(claims: CustomerClaim[]): number {
  return claims.filter((claim) => claim.status !== "claim_covered_closed").length;
}

export default function CustomerPortalOverview({ session }: Props) {
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

  const monthlyTotal = computeMonthlyTotal(policies);
  const activeClaims = computeOpenClaims(claims);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-slate-600 mt-2">
          Review your active coverage, keep an eye on open claims, and stay ahead of upcoming payments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/10 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Policies</CardTitle>
          </CardHeader>
          <CardContent>
            {policiesQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-semibold text-slate-900">{policies.length}</p>
            )}
            <p className="text-sm text-slate-500 mt-1">Coverage plans linked to your account</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Open Claims</CardTitle>
          </CardHeader>
          <CardContent>
            {claimsQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-semibold text-amber-900">{activeClaims}</p>
            )}
            <p className="text-sm text-amber-700/80 mt-1">We’ll keep you updated every step of the way</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Monthly Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {policiesQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-semibold text-emerald-900">
                {monthlyTotal > 0 ? currencyFormatter.format(monthlyTotal) : "—"}
              </p>
            )}
            <p className="text-sm text-emerald-700/80 mt-1">Estimated monthly payment across all policies</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Coverage Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policiesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : policies.length === 0 ? (
            <p className="text-sm text-slate-500">
              We haven’t linked any policies yet. If you recently purchased coverage, give us a day to finish the setup
              or request access using the “Add Coverage” tab.
            </p>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="border border-slate-200 rounded-xl p-4 md:p-6 bg-gradient-to-br from-white via-slate-50 to-white"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{summarizeVehicle(policy)}</h3>
                      <p className="text-sm text-slate-500">
                        Policy #{policy.id}
                      </p>
                    </div>
                    <Badge className="w-fit" variant="secondary">
                      {friendlyPlanName(policy.package)} Plan
                    </Badge>
                  </div>
                  <div className="grid md:grid-cols-4 gap-4 mt-4 text-sm text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-700">Coverage start</p>
                      <p>{formatDate(policy.policyStartDate)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Expires</p>
                      <p>{formatDate(policy.expirationDate)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Deductible</p>
                      <p>{policy.deductible != null ? currencyFormatter.format(policy.deductible) : "On file"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Monthly payment</p>
                      <p>
                        {policy.monthlyPayment != null
                          ? currencyFormatter.format(policy.monthlyPayment)
                          : "On file"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-500">
                    <p>
                      Questions about your coverage? Reach us anytime at{' '}
                      <a className="text-primary font-medium" href="tel:18882001234">
                        1 (888) 200-1234
                      </a>{' '}
                      or email{' '}
                      <a className="text-primary font-medium" href="mailto:support@bhautoprotect.com">
                        support@bhautoprotect.com
                      </a>
                      .
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Claim Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {claimsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : claims.length === 0 ? (
            <p className="text-sm text-slate-500">
              You don’t have any claims in progress. If your vehicle needs attention, head to the Claims tab to start a
              new request.
            </p>
          ) : (
            <div className="space-y-3">
              {claims.slice(0, 3).map((claim) => (
                <div key={claim.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Claim #{claim.id}</p>
                      <p className="text-xs text-slate-500">Filed {formatDate(claim.createdAt)}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {claim.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 line-clamp-2">{claim.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

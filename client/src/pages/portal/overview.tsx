import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CustomerSessionSnapshot,
  type CustomerPolicy,
  type CustomerClaim,
} from "@/lib/customer-auth";
import type { CustomerDocumentRequestRecord } from "@/lib/document-requests";
import { DOCUMENT_REQUEST_TYPE_COPY, summarizeVehicle as summarizeDocumentVehicle } from "@/lib/document-requests";
import { UploadCloud, CheckCircle2, Clock3 } from "lucide-react";

type Props = {
  session: CustomerSessionSnapshot;
};

type StatCardProps = {
  label: string;
  helper?: string;
  isLoading?: boolean;
  value: string;
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
  return plan
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFromCents(value: number | null | undefined): string {
  if (value == null) return "On file";
  return currencyFormatter.format(value / 100);
}

function formatDeductible(value: number | null | undefined): string {
  if (value == null) return "On file";
  return currencyFormatter.format(value);
}

function computeTotalPremium(policies: CustomerPolicy[]): number {
  return policies.reduce((total, policy) => total + (policy.totalPremium ?? 0), 0);
}

function computeOpenClaims(claims: CustomerClaim[]): number {
  return claims.filter((claim) => claim.status !== "claim_covered_closed").length;
}

function StatCard({ label, helper, isLoading, value }: StatCardProps) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-semibold text-slate-900">{value}</p>}
        {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function CustomerPortalOverview({ session }: Props) {
  const policiesQuery = useQuery<{ data?: { policies?: CustomerPolicy[] } }>([
    "/api/customer/policies",
  ]);
  const claimsQuery = useQuery<{ data?: { claims?: CustomerClaim[] } }>([
    "/api/customer/claims",
  ]);
  const documentsQuery = useQuery<{ data?: { requests?: CustomerDocumentRequestRecord[] } }>({
    queryKey: ["/api/customer/document-requests"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const policies = useMemo(() => {
    const apiPolicies = policiesQuery.data?.data?.policies;
    if (Array.isArray(apiPolicies) && apiPolicies.length > 0) {
      return apiPolicies;
    }
    return session.policies;
  }, [policiesQuery.data, session.policies]);

  const claims = useMemo(() => claimsQuery.data?.data?.claims ?? [], [claimsQuery.data]);
  const documentRequests = useMemo(
    () => documentsQuery.data?.data?.requests ?? [],
    [documentsQuery.data],
  );

  const totalPremium = computeTotalPremium(policies);
  const activeClaims = computeOpenClaims(claims);
  const outstandingDocuments = useMemo(
    () =>
      documentRequests.filter(
        (request) => request.status !== "completed" && request.status !== "cancelled",
      ),
    [documentRequests],
  );
  const outstandingByPolicy = useMemo(() => {
    const map = new Map<string, CustomerDocumentRequestRecord[]>();
    for (const request of outstandingDocuments) {
      const list = map.get(request.policyId) ?? [];
      list.push(request);
      map.set(request.policyId, list);
    }
    return map;
  }, [outstandingDocuments]);
  const nextDocumentDue = useMemo(() => {
    let earliest: string | null = null;
    for (const request of outstandingDocuments) {
      if (!request.dueDate) continue;
      if (!earliest || new Date(request.dueDate).valueOf() < new Date(earliest).valueOf()) {
        earliest = request.dueDate;
      }
    }
    return earliest;
  }, [outstandingDocuments]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Action center</h2>
            <p className="text-sm text-slate-500">
              Anything listed here needs a quick upload. Tap to jump straight to the documents page.
            </p>
          </div>
          <Link href="/portal/documents" className="text-sm font-medium text-primary">
            View documents
          </Link>
        </div>
        <Card className="border-slate-200 bg-white">
          <CardContent className="space-y-4 py-5 text-sm text-slate-600">
            {documentsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : outstandingDocuments.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-slate-800">You’re all caught up</p>
                  <p className="text-xs text-slate-500">We’ll nudge you here as soon as something new comes in.</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {outstandingDocuments.slice(0, 3).map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/portal/documents?request=${request.id}`}
                      className="group block rounded-md border border-slate-200 bg-white px-4 py-3 transition hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex items-start gap-3">
                        <UploadCloud className="mt-1 h-4 w-4 text-primary" />
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900 group-hover:text-primary">{request.title}</p>
                          <p className="text-xs text-slate-500">
                            {DOCUMENT_REQUEST_TYPE_COPY[request.type].label} • {summarizeDocumentVehicle(request.policy)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {request.dueDate ? (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <Clock3 className="h-3.5 w-3.5" /> Due {formatDate(request.dueDate)}
                              </span>
                            ) : (
                              "Send when you can"
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
                {outstandingDocuments.length > 3 ? (
                  <li className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    {outstandingDocuments.length - 3} more request(s) are waiting in Documents.
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">At a glance</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active policies"
            value={String(policies.length)}
            helper="Coverage connected to your login"
            isLoading={policiesQuery.isLoading}
          />
          <StatCard
            label="Open claims"
            value={String(activeClaims)}
            helper="We’ll let you know as they move forward"
            isLoading={claimsQuery.isLoading}
          />
          <StatCard
            label="Total premium"
            value={totalPremium > 0 ? formatFromCents(totalPremium) : "—"}
            helper="Total premium on file"
            isLoading={policiesQuery.isLoading}
          />
          <StatCard
            label="Document tasks"
            value={String(outstandingDocuments.length)}
            helper={
              outstandingDocuments.length === 0
                ? "Nothing pending right now"
                : nextDocumentDue
                  ? `Next due ${formatDate(nextDocumentDue)}`
                  : "Upload whenever you’re ready"
            }
            isLoading={documentsQuery.isLoading}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Coverage on file</h2>
          <p className="text-sm text-slate-500">Quick reference for each vehicle you’ve protected with BH Auto Protect.</p>
        </div>
        {policiesQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : policies.length === 0 ? (
          <Card className="border-slate-200 bg-white">
            <CardContent className="py-6 text-sm text-slate-600">
              We haven’t linked any policies yet. Recently purchased coverage may take up to one business day to appear. You can request access from the Add Coverage page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {policies.map((policy) => (
              <Card key={policy.id} className="border-slate-200 bg-white">
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{summarizeVehicle(policy)}</p>
                      <p className="text-sm font-semibold text-slate-700">Policy #{policy.id}</p>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {friendlyPlanName(policy.package)} plan
                    </Badge>
                  </div>
                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                    <div>
                      <p className="font-medium text-slate-700">Coverage start</p>
                      <p>{formatDate(policy.policyStartDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Expires</p>
                      <p>{formatDate(policy.expirationDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Deductible</p>
                      <p>{formatDeductible(policy.deductible)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Monthly payment</p>
                      <p>{formatFromCents(policy.monthlyPayment)}</p>
                    </div>
                  </div>
                  {(() => {
                    const policyRequests = outstandingByPolicy.get(policy.id) ?? [];
                    if (policyRequests.length === 0) {
                      return null;
                    }
                    return (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Documents needed
                        </p>
                        <ul className="mt-2 space-y-3">
                          {policyRequests.map((request) => (
                            <li key={request.id} className="flex gap-3">
                              <UploadCloud className="mt-1 h-4 w-4 text-primary" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-900">
                                  {DOCUMENT_REQUEST_TYPE_COPY[request.type].label}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {DOCUMENT_REQUEST_TYPE_COPY[request.type].hint}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <Link
                          href="/portal/documents"
                          className="mt-3 inline-flex text-xs font-semibold text-primary hover:text-primary/80"
                        >
                          Upload documents
                        </Link>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent claim updates</h2>
          <p className="text-sm text-slate-500">
            Here’s what’s currently open. Head to the Claims page to view history or start something new.
          </p>
        </div>
        <Card className="border-slate-200 bg-white">
          <CardContent className="py-5">
            {claimsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : claims.length === 0 ? (
              <p className="text-sm text-slate-600">You don’t have any claims in progress right now.</p>
            ) : (
              <ul className="space-y-3">
                {claims.slice(0, 3).map((claim) => (
                  <li key={claim.id} className="rounded-md border border-slate-200 px-4 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Claim #{claim.id}</p>
                        <p className="text-xs text-slate-500">Filed {formatDate(claim.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{claim.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

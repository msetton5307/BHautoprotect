import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { Filter, Search, ArrowUpDown, Clock3, AlertTriangle, CheckCircle2 } from "lucide-react";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

type ClaimRecord = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  nextEstimate?: string | null;
  nextPayment?: string | null;
  year?: string | null;
  make?: string | null;
  model?: string | null;
};

type ClaimStatus =
  | "new"
  | "denied"
  | "awaiting_customer_action"
  | "awaiting_inspection"
  | "claim_covered_open"
  | "claim_covered_closed";

const statusMeta: Record<ClaimStatus, { label: string; description: string; badgeClass: string }> = {
  new: {
    label: "New",
    description: "Recently submitted and awaiting review.",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  denied: {
    label: "Denied",
    description: "Customer has been notified of denial.",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
  awaiting_customer_action: {
    label: "Awaiting customer",
    description: "Needs documentation or response from the customer.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  awaiting_inspection: {
    label: "Awaiting inspection",
    description: "Inspection or diagnostics are in progress.",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  claim_covered_open: {
    label: "Covered - open",
    description: "Approved claim with work still in progress.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  claim_covered_closed: {
    label: "Covered - closed",
    description: "Work completed and claim fully paid.",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

type StatusMeta = (typeof statusMeta)[ClaimStatus];

const statusFilters: { value: ClaimStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: statusMeta.new.label },
  { value: "awaiting_customer_action", label: statusMeta.awaiting_customer_action.label },
  { value: "awaiting_inspection", label: statusMeta.awaiting_inspection.label },
  { value: "claim_covered_open", label: statusMeta.claim_covered_open.label },
  { value: "claim_covered_closed", label: statusMeta.claim_covered_closed.label },
  { value: "denied", label: statusMeta.denied.label },
];

const openStatuses: ClaimStatus[] = [
  "new",
  "awaiting_customer_action",
  "awaiting_inspection",
  "claim_covered_open",
];

const attentionStatuses: ClaimStatus[] = ["awaiting_customer_action", "awaiting_inspection", "denied"];

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const formatName = (claim: ClaimRecord) =>
  `${claim.firstName ?? ""} ${claim.lastName ?? ""}`.trim() || "Unassigned";

const formatVehicle = (claim: ClaimRecord) => {
  const details = [claim.year, claim.make, claim.model].filter(Boolean).join(" ");
  return details || "—";
};

const formatStatusLabel = (status: ClaimRecord["status"]) =>
  status
    ? status
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Unknown";

const getStatusMeta = (status: ClaimRecord["status"]): StatusMeta => {
  if (status && statusMeta[status as ClaimStatus]) {
    return statusMeta[status as ClaimStatus];
  }

  return {
    label: formatStatusLabel(status),
    description: "Status not recognized",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
  } satisfies StatusMeta;
};

export default function AdminClaims() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/claims'],
    enabled: authenticated,
    queryFn: async () => {
      const res = await fetchWithAuth('/api/admin/claims', { headers: getAuthHeaders() });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch claims');
      return res.json();
    }
  });

  const claims: ClaimRecord[] = data?.data || [];

  const { totalClaims, openClaims, attentionClaims } = useMemo(() => {
    const total = claims.length;
    const open = claims.filter((claim) => openStatuses.includes((claim.status ?? "") as ClaimStatus)).length;
    const needsAttention = claims.filter((claim) => attentionStatuses.includes((claim.status ?? "") as ClaimStatus)).length;
    return { totalClaims: total, openClaims: open, attentionClaims: needsAttention };
  }, [claims]);

  const filteredClaims = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return claims
      .filter((claim) => {
        if (statusFilter !== "all" && claim.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          claim.firstName,
          claim.lastName,
          claim.email,
          claim.phone,
          claim.id,
          claim.message,
          claim.make,
          claim.model,
          claim.year,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aDate = a.updatedAt ?? a.createdAt ?? "";
        const bDate = b.updatedAt ?? b.createdAt ?? "";
        const aTime = aDate ? new Date(aDate).getTime() : 0;
        const bTime = bDate ? new Date(bDate).getTime() : 0;
        return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [claims, searchTerm, statusFilter, sortOrder]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Claims dashboard</h1>
            <p className="text-sm text-slate-600">Track active repairs, customer follow-ups, and closed cases in one view.</p>
          </div>
          <Button asChild>
            <Link href="/admin/claims/new">Add claim</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Total claims</CardDescription>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{totalClaims}</div>
              <p className="mt-1 text-xs text-slate-500">Includes every submission regardless of outcome.</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Open cases</CardDescription>
              <Clock3 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{openClaims}</div>
              <p className="mt-1 text-xs text-slate-500">Marked as new, awaiting action, inspection, or in-progress repairs.</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Needs attention</CardDescription>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{attentionClaims}</div>
              <p className="mt-1 text-xs text-slate-500">Awaiting documents, inspection results, or recently denied.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Claims</CardTitle>
                <CardDescription>Filter by status or search by name, email, vehicle, or claim ID.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by customer, email, vehicle, or ID"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ClaimStatus | "all")}> 
                  <SelectTrigger className="sm:w-[220px]">
                    <Filter className="mr-2 h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilters.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="w-full justify-center lg:w-auto"
                onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {sortOrder === "desc" ? "Newest" : "Oldest"} first
              </Button>
            </div>

            <ScrollArea className="max-h-[540px] rounded-lg border">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="min-w-[160px]">Claimant</TableHead>
                    <TableHead className="min-w-[160px]">Contact</TableHead>
                    <TableHead className="min-w-[140px]">Vehicle</TableHead>
                    <TableHead className="min-w-[220px]">Summary</TableHead>
                    <TableHead className="min-w-[140px]">Status</TableHead>
                    <TableHead className="min-w-[140px]">Last update</TableHead>
                    <TableHead className="w-[90px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => {
                    const meta = getStatusMeta(claim.status);
                    return (
                      <TableRow key={claim.id} className="hover:bg-slate-50/70">
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-900">{formatName(claim)}</div>
                          <div className="text-xs text-slate-500">#{claim.id}</div>
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-600">
                          <div>{claim.email || "—"}</div>
                          <div className="text-xs text-slate-500">{claim.phone || "—"}</div>
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-600">{formatVehicle(claim)}</TableCell>
                        <TableCell className="align-top text-sm text-slate-600">
                          {claim.message ? (
                            <span title={claim.message} className="line-clamp-2">
                              {claim.message}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={`capitalize ${meta.badgeClass}`}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-600">
                          <div>{formatDate(claim.createdAt)}</div>
                          <div className="text-xs text-slate-500">Updated {formatDateTime(claim.updatedAt)}</div>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/claims/${claim.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredClaims.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-500">
                        {searchTerm || statusFilter !== "all"
                          ? "No claims match your filters."
                          : "No claims have been submitted yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

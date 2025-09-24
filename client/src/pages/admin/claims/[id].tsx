import { useState, useEffect, ChangeEvent, FormEvent, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock3, FileText, Mail, Phone, ShieldCheck } from "lucide-react";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

type ClaimStatus =
  | "new"
  | "denied"
  | "awaiting_customer_action"
  | "awaiting_inspection"
  | "claim_covered_open"
  | "claim_covered_closed";

const statusMeta: Record<ClaimStatus, { label: string; badgeClass: string; summary: string }> = {
  new: {
    label: "New",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    summary: "Claim has been submitted and is awaiting assignment.",
  },
  denied: {
    label: "Denied",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    summary: "Customer has been notified that the claim was not covered.",
  },
  awaiting_customer_action: {
    label: "Awaiting customer",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    summary: "Waiting on documentation or follow-up from the customer.",
  },
  awaiting_inspection: {
    label: "Awaiting inspection",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    summary: "Inspection appointment or diagnostics pending.",
  },
  claim_covered_open: {
    label: "Covered - open",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    summary: "Approved claim in progress with the repair facility.",
  },
  claim_covered_closed: {
    label: "Covered - closed",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
    summary: "Repair is complete and the claim is fully closed.",
  },
};

const statusOptions: { value: ClaimStatus; label: string }[] = Object.entries(statusMeta).map(([value, meta]) => ({
  value: value as ClaimStatus,
  label: meta.label,
}));

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

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export default function AdminClaimDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/claims', id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/claims/${id}`, { headers: getAuthHeaders() });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch claim');
      return res.json();
    },
    enabled: authenticated && !!id,
  });

  const claim = data?.data;
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (claim) setFormData(claim);
  }, [claim]);

  const statusValue = useMemo<ClaimStatus>(() => {
    const current = (formData.status ?? claim?.status) as ClaimStatus | undefined;
    return current && current in statusMeta ? current : "new";
  }, [claim?.status, formData.status]);

  const statusDetails = statusMeta[statusValue];

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetchWithAuth(`/api/admin/claims/${id}`, {
        method: 'PATCH',
        headers: authJsonHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to update claim');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/claims', id] });
      toast({ title: 'Success', description: 'Claim updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update claim', variant: 'destructive' });
    },
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value: ClaimStatus) => {
    setFormData((prev: any) => ({ ...prev, status: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

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

  if (isLoading || !claim) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="px-2">
            <Link href="/admin/claims">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to claims
            </Link>
          </Button>
          <Badge variant="outline" className={`capitalize ${statusDetails?.badgeClass ?? "border-slate-200"}`}>
            {statusDetails?.label ?? "Status"}
          </Badge>
          <span className="text-xs uppercase tracking-[0.32em] text-slate-400">#{claim.id}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200/80 md:col-span-2">
            <CardHeader className="pb-4">
              <CardDescription>Current status</CardDescription>
              <CardTitle className="text-xl text-slate-900">{statusDetails?.label ?? "Claim"}</CardTitle>
              {statusDetails?.summary && (
                <p className="text-sm text-slate-600">{statusDetails.summary}</p>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Submitted</p>
                <p className="mt-1 text-sm text-slate-900">{formatDate(claim.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Last updated</p>
                <p className="mt-1 text-sm text-slate-900">{formatDateTime(claim.updatedAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Next payment</p>
                <p className="mt-1 text-sm text-slate-900">{formData.nextPayment || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardDescription>Primary contact</CardDescription>
              <CardTitle className="text-lg text-slate-900">{`${claim.firstName ?? ""} ${claim.lastName ?? ""}`.trim() || "—"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{claim.email || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{claim.phone || "Not provided"}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <span>{claim.policyId ? `Policy ${claim.policyId}` : "No linked policy"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80">
          <CardHeader className="space-y-1">
            <CardTitle>Claim workspace</CardTitle>
            <CardDescription>Update status, repair milestones, contact details, and vehicle information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Status & next steps</h3>
                        <p className="text-sm text-slate-600">Choose the current state of the claim and track upcoming actions.</p>
                      </div>
                      <Clock3 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Status</Label>
                        <Select value={statusValue} onValueChange={handleStatusChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="nextEstimate">Next estimate</Label>
                        <Input name="nextEstimate" value={formData.nextEstimate || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="nextPayment">Next payment (from policy)</Label>
                        <Input name="nextPayment" value={formData.nextPayment || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="agentClaimNumber">Agent claim number</Label>
                        <Input name="agentClaimNumber" value={formData.agentClaimNumber || ""} onChange={handleInputChange} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="claimReason">Claim reason</Label>
                        <Input name="claimReason" value={formData.claimReason || ""} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Vehicle details</h3>
                        <p className="text-sm text-slate-600">Verify VIN, mileage, and the affected vehicle configuration.</p>
                      </div>
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Input name="year" value={formData.year || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="make">Make</Label>
                        <Input name="make" value={formData.make || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="model">Model</Label>
                        <Input name="model" value={formData.model || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="trim">Trim</Label>
                        <Input name="trim" value={formData.trim || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="vin">VIN</Label>
                        <Input name="vin" value={formData.vin || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="serial">Serial</Label>
                        <Input name="serial" value={formData.serial || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="odometer">Odometer at claim</Label>
                        <Input name="odometer" value={formData.odometer || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="currentOdometer">Current odometer</Label>
                        <Input name="currentOdometer" value={formData.currentOdometer || ""} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">Internal notes</h3>
                    <p className="text-sm text-slate-600">Share detailed updates for teammates and future follow-ups.</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="message">Claim notes</Label>
                        <Textarea
                          name="message"
                          value={formData.message || ""}
                          onChange={handleInputChange}
                          rows={4}
                          placeholder="Document shop conversations, approvals, or context."
                        />
                      </div>
                      <div>
                        <Label htmlFor="previousNotes">Previous notes</Label>
                        <Textarea
                          name="previousNotes"
                          value={formData.previousNotes || ""}
                          onChange={handleInputChange}
                          rows={4}
                          placeholder="Historical notes or customer-provided updates."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">Contact information</h3>
                    <p className="text-sm text-slate-600">Keep customer details current for outreach and status updates.</p>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="firstName">First name</Label>
                          <Input name="firstName" value={formData.firstName || ""} onChange={handleInputChange} />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last name</Label>
                          <Input name="lastName" value={formData.lastName || ""} onChange={handleInputChange} />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input name="email" value={formData.email || ""} onChange={handleInputChange} />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input name="phone" value={formData.phone || ""} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">Audit trail</h3>
                    <p className="text-sm text-slate-600">Reference the claim lifecycle and important identifiers.</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Claim ID</span>
                        <span className="font-medium text-slate-900">{claim.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Submitted</span>
                        <span className="font-medium text-slate-900">{formatDateTime(claim.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Last modified</span>
                        <span className="font-medium text-slate-900">{formatDateTime(claim.updatedAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Linked policy</span>
                        <span className="font-medium text-slate-900">{claim.policyId ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 pt-6">
                <p className="text-sm text-slate-500">Last saved {formatDateTime(claim.updatedAt)}</p>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


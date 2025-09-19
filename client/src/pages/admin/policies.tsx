import { useCallback } from "react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminNav from "@/components/admin-nav";
import { fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { Link, useLocation } from "wouter";

const formatCurrency = (value: number | null | undefined) =>
  value != null ? `$${Number(value).toLocaleString()}` : "—";

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : "—";

export default function AdminPolicies() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/policies'],
    queryFn: () =>
      fetchWithAuth('/api/admin/policies', { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch policies');
        return res.json();
      })
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const policies = data?.data || [];

  const getPolicyHolderName = (policy: any) =>
    policy.lead ? `${policy.lead.firstName ?? ''} ${policy.lead.lastName ?? ''}`.trim() : '';

  const handleNavigate = useCallback((policyId: string) => {
    navigate(`/admin/policies/${policyId}`);
  }, [navigate]);

  const handleRowKeyDown = useCallback((event: KeyboardEvent<HTMLTableRowElement>, policyId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate(policyId);
    }
  }, [handleNavigate]);

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Policy management</h1>
            <p className="text-sm text-slate-600">
              Review customer policies, confirm coverage details, and jump into the full record with a single click.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin" className="flex items-center gap-2">
                Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
                Public site
              </Link>
            </Button>
          </div>
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Policies</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Each row shows the essentials at a glance. Select any policy to open its full details, attach documents,
                  and send polished updates.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                Live data
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="text-sm">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-200">
                  <TableHead className="whitespace-nowrap px-4 py-3">Policy</TableHead>
                  <TableHead className="whitespace-nowrap px-4 py-3">Customer</TableHead>
                  <TableHead className="whitespace-nowrap px-4 py-3">Vehicle</TableHead>
                  <TableHead className="whitespace-nowrap px-4 py-3">Coverage</TableHead>
                  <TableHead className="whitespace-nowrap px-4 py-3">Payments</TableHead>
                  <TableHead className="whitespace-nowrap px-4 py-3">Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy: any) => {
                  const holderName = getPolicyHolderName(policy) || '—';
                  const vehicle = policy.vehicle
                    ? `${policy.vehicle.year ?? ''} ${policy.vehicle.make ?? ''} ${policy.vehicle.model ?? ''}`.trim()
                    : '';

                  return (
                    <TableRow
                      key={policy.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => handleNavigate(policy.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, policy.id)}
                      className="cursor-pointer border-slate-200/80 transition-colors hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
                    >
                      <TableCell className="px-4 py-3 align-top text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs text-slate-500">{policy.id}</span>
                          <span className="text-sm font-medium text-slate-900">{policy.package || 'Package TBD'}</span>
                          <span className="text-xs text-slate-500">Deductible: {formatCurrency(policy.deductible)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{holderName}</span>
                          <span className="text-xs text-slate-500">{policy.lead?.email || 'No email on file'}</span>
                          <span className="text-xs text-slate-500">{policy.lead?.phone || 'No phone on file'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{vehicle || 'Vehicle pending'}</span>
                          <span className="text-xs text-slate-500">Exp. miles: {policy.expirationMiles ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-500">Policy start</span>
                          <span>{formatDate(policy.policyStartDate)}</span>
                          <span className="text-xs text-slate-500">Expires</span>
                          <span>{formatDate(policy.expirationDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>Total premium: {formatCurrency(policy.totalPremium)}</span>
                          <span>Down: {formatCurrency(policy.downPayment)}</span>
                          <span>Monthly: {formatCurrency(policy.monthlyPayment)}</span>
                          <span>Total paid: {formatCurrency(policy.totalPayments)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-600">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-500">Created</span>
                          <span>{formatDate(policy.createdAt)}</span>
                          <span className="text-xs text-slate-500">Last updated</span>
                          <span>{formatDate(policy.updatedAt)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {policies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No policies found. Policies that sync from carriers will appear here automatically.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

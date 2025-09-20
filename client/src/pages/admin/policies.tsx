import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Link, useLocation } from "wouter";

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric / 100);
};

const formatDeductible = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
};

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : "—";

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

type CoverageStatus = 'active' | 'expiring-soon' | 'upcoming' | 'expired' | 'unknown';
type CoverageFilter = CoverageStatus | 'all';

const coverageStatusLabels: Record<CoverageStatus, string> = {
  active: 'Active',
  'expiring-soon': 'Expiring soon',
  upcoming: 'Upcoming',
  expired: 'Expired',
  unknown: 'Unknown',
};

const coverageStatusBadgeClass: Record<CoverageStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'expiring-soon': 'border-amber-200 bg-amber-50 text-amber-700',
  upcoming: 'border-sky-200 bg-sky-50 text-sky-700',
  expired: 'border-rose-200 bg-rose-50 text-rose-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

const getCoverageStatus = (policy: any): CoverageStatus => {
  const now = new Date();
  const start = policy?.policyStartDate ? new Date(policy.policyStartDate) : null;
  const expiration = policy?.expirationDate ? new Date(policy.expirationDate) : null;

  if (!expiration) {
    return 'unknown';
  }

  if (expiration.getTime() < now.getTime()) {
    return 'expired';
  }

  if (start && start.getTime() > now.getTime()) {
    return 'upcoming';
  }

  const daysUntilExpiration = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiration <= 30) {
    return 'expiring-soon';
  }

  return 'active';
};

const getCoverageSummary = (policy: any) => {
  const status = getCoverageStatus(policy);
  const now = new Date();
  const start = policy?.policyStartDate ? new Date(policy.policyStartDate) : null;
  const expiration = policy?.expirationDate ? new Date(policy.expirationDate) : null;

  switch (status) {
    case 'upcoming':
      return start
        ? `Begins ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : 'Coverage begins soon';
    case 'active':
    case 'expiring-soon':
      if (expiration) {
        const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 0) {
          return 'Expires today';
        }
        return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
      }
      return 'Coverage active';
    case 'expired':
      if (expiration) {
        const daysAgo = Math.ceil((now.getTime() - expiration.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo <= 0) {
          return 'Expired today';
        }
        return `Expired ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
      }
      return 'Coverage expired';
    default:
      return 'Status pending';
  }
};

export default function AdminPolicies() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const queriesEnabled = authenticated && !checking;
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/policies'],
    queryFn: async () => {
      const res = await fetchWithAuth('/api/admin/policies', { headers: getAuthHeaders() });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Your session has expired. Please sign in again.');
      }
      if (!res.ok) throw new Error('Failed to fetch policies');
      return res.json();
    },
    enabled: queriesEnabled,
  });

  const policies = useMemo(() => {
    const payload = data?.data;
    return Array.isArray(payload) ? payload : [];
  }, [data]);

  const packageOptions = useMemo(() => {
    const unique = new Set<string>();
    policies.forEach((policy: any) => {
      if (policy.package) {
        unique.add(policy.package);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [policies]);

  const hasUnassignedPackage = useMemo(
    () => policies.some((policy: any) => !policy.package),
    [policies]
  );

  const getPolicyHolderName = useCallback(
    (policy: any) =>
      policy.lead
        ? `${policy.lead.firstName ?? ''} ${policy.lead.lastName ?? ''}`.trim()
        : '',
    []
  );

  const sortOptions = useMemo(
    () => [
      { value: 'createdAt', label: 'Date created' },
      { value: 'policyStartDate', label: 'Policy start' },
      { value: 'expirationDate', label: 'Expiration date' },
      { value: 'holderName', label: 'Customer name' },
      { value: 'totalPremium', label: 'Total premium' },
      { value: 'package', label: 'Package' },
    ],
    []
  );

  const sortFieldLabel =
    sortOptions.find((option) => option.value === sortField)?.label || 'Date created';

  const filteredPolicies = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return policies.filter((policy: any) => {
      const values = [
        policy.id,
        policy.package,
        policy.policyStartDate,
        policy.expirationDate,
        policy.lead?.firstName,
        policy.lead?.lastName,
        policy.lead?.email,
        policy.lead?.phone,
        policy.vehicle?.year,
        policy.vehicle?.make,
        policy.vehicle?.model,
        policy.vehicle?.vin,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');

      const matchesSearch = !normalizedSearch || values.includes(normalizedSearch);
      const matchesPackage =
        packageFilter === 'all'
          ? true
          : packageFilter === 'none'
            ? !policy.package
            : policy.package === packageFilter;

      const status = getCoverageStatus(policy);
      const matchesCoverage = coverageFilter === 'all' || status === coverageFilter;

      return matchesSearch && matchesPackage && matchesCoverage;
    });
  }, [policies, searchTerm, packageFilter, coverageFilter]);

  const getValue = useCallback(
    (policy: any, field: string) => {
      switch (field) {
        case 'policyStartDate':
          return policy.policyStartDate;
        case 'expirationDate':
          return policy.expirationDate;
        case 'holderName':
          return getPolicyHolderName(policy);
        case 'totalPremium':
          return policy.totalPremium;
        case 'package':
          return policy.package;
        default:
          return policy.createdAt;
      }
    },
    [getPolicyHolderName]
  );

  const sortedPolicies = useMemo(() => {
    return [...filteredPolicies].sort((a: any, b: any) => {
      const aVal = getValue(a, sortField);
      const bVal = getValue(b, sortField);

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (sortField === 'totalPremium') {
        const numA = Number(aVal);
        const numB = Number(bVal);
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      if (
        sortField === 'policyStartDate' ||
        sortField === 'expirationDate' ||
        sortField === 'createdAt'
      ) {
        const timeA = new Date(aVal).getTime();
        const timeB = new Date(bVal).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredPolicies, getValue, sortField, sortOrder]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setPackageFilter('all');
    setCoverageFilter('all');
    setSortField('createdAt');
    setSortOrder('desc');
  }, []);

  const handleNavigate = useCallback((policyId: string) => {
    navigate(`/admin/policies/${policyId}`);
  }, [navigate]);

  const handleRowKeyDown = useCallback((event: KeyboardEvent<HTMLTableRowElement>, policyId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate(policyId);
    }
  }, [handleNavigate]);

  const coverageOptions: { value: CoverageFilter; label: string }[] = [
    { value: 'all', label: 'All coverage states' },
    { value: 'active', label: 'Active' },
    { value: 'expiring-soon', label: 'Expiring soon' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'expired', label: 'Expired' },
    { value: 'unknown', label: 'Unknown' },
  ];

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
          <div className="flex flex-wrap gap-2" />
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Filter className="h-5 w-5" />
              Tune your policy list
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Combine search, filters, and sorting to mirror the lead management experience for policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Policy number, customer, vehicle..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Package</label>
                <Select value={packageFilter} onValueChange={setPackageFilter}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200 bg-white text-sm shadow-sm">
                    <SelectValue placeholder="Filter by package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All packages</SelectItem>
                    {packageOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    {hasUnassignedPackage && (
                      <SelectItem value="none">No package</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage</label>
                <Select value={coverageFilter} onValueChange={(value) => setCoverageFilter(value as CoverageFilter)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200 bg-white text-sm shadow-sm">
                    <SelectValue placeholder="Filter by coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {coverageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</label>
                <div className="flex items-center gap-2">
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="h-11 flex-1 rounded-xl border-slate-200 bg-white text-sm shadow-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="h-11 w-24 rounded-xl border-slate-200 bg-white text-sm shadow-sm"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                  {filteredPolicies.length} showing · {policies.length} total
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                  Sorted by {sortFieldLabel} · {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Badge>
                {coverageFilter !== 'all' && (
                  <Badge className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Coverage: {coverageStatusLabels[coverageFilter]}
                  </Badge>
                )}
                {packageFilter !== 'all' && (
                  <Badge className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600">
                    Package: {packageFilter === 'none' ? 'No package' : packageFilter}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Policy roster</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Policies now share the same interactive roster experience as leads for quick review and action.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                Live data
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table className="text-sm">
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-slate-200">
                      <TableHead className="whitespace-nowrap px-4 py-3">Coverage</TableHead>
                      <TableHead className="whitespace-nowrap px-4 py-3">Policy</TableHead>
                      <TableHead className="whitespace-nowrap px-4 py-3">Customer</TableHead>
                      <TableHead className="whitespace-nowrap px-4 py-3">Vehicle</TableHead>
                      <TableHead className="whitespace-nowrap px-4 py-3">Financials</TableHead>
                      <TableHead className="whitespace-nowrap px-4 py-3">Timeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPolicies.map((policy: any) => {
                      const holderName = getPolicyHolderName(policy) || '—';
                      const vehicleSummary = policy.vehicle
                        ? [policy.vehicle.year, policy.vehicle.make, policy.vehicle.model]
                            .filter(Boolean)
                            .join(' ')
                        : '';
                      const coverageStatus = getCoverageStatus(policy);
                      const coverageSummary = getCoverageSummary(policy);

                      return (
                        <TableRow
                          key={policy.id}
                          className="border-slate-200/80 transition-colors hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none cursor-pointer"
                          role="button"
                          tabIndex={0}
                          aria-label={`Open policy ${policy.id}`}
                          onClick={() => handleNavigate(policy.id)}
                          onKeyDown={(event) => handleRowKeyDown(event, policy.id)}
                        >
                          <TableCell className="px-4 py-3 align-top text-slate-700">
                            <div className="flex flex-col gap-2">
                              <Badge
                                variant="outline"
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${coverageStatusBadgeClass[coverageStatus]}`}
                              >
                                {coverageStatusLabels[coverageStatus]}
                              </Badge>
                              <span className="text-xs text-slate-500">{coverageSummary}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top text-slate-700 whitespace-normal break-words">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs uppercase tracking-wide text-slate-400">{policy.id}</span>
                              <span className="font-medium text-slate-900">{policy.package || 'Package TBD'}</span>
                              <span className="text-xs text-slate-500">Deductible · {formatDeductible(policy.deductible)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top text-slate-700 whitespace-normal break-words">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-slate-900">{holderName}</span>
                              <span className="text-xs text-slate-500">{policy.lead?.email || 'No email on file'}</span>
                              <span className="text-xs text-slate-500">{policy.lead?.phone || 'No phone on file'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top text-slate-700 whitespace-normal break-words">
                            <div className="flex flex-col gap-1">
                              <span>{vehicleSummary || 'Vehicle pending'}</span>
                              <span className="text-xs text-slate-500">VIN · {policy.vehicle?.vin || '—'}</span>
                              <span className="text-xs text-slate-500">Miles · {policy.expirationMiles ?? '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top text-slate-700 whitespace-normal break-words">
                            <div className="flex flex-col gap-1">
                              <span>Total premium · {formatCurrency(policy.totalPremium)}</span>
                              <span>Down · {formatCurrency(policy.downPayment)}</span>
                              <span>Monthly · {formatCurrency(policy.monthlyPayment)}</span>
                              <span>Total paid · {formatCurrency(policy.totalPayments)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top text-slate-600 whitespace-normal break-words">
                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                              <span>Created · {formatDateTime(policy.createdAt)}</span>
                              <span>Policy start · {formatDate(policy.policyStartDate)}</span>
                              <span>Expires · {formatDate(policy.expirationDate)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {sortedPolicies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No policies match your filters yet. Try expanding your search or resetting filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" className="mt-2" />
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, ArrowUpDown, LayoutList } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { getAuthHeaders, clearCredentials, fetchWithAuth } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { cn } from "@/lib/utils";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

const ITEMS_PER_PAGE = 25;

export default function AdminLeads() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queriesEnabled = authenticated && !checking;

  const leadsQuery = useQuery({
    queryKey: ['/api/admin/leads'],
    queryFn: async () => {
      const res = await fetchWithAuth('/api/admin/leads', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json();
    },
    enabled: queriesEnabled,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: authJsonHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to update lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads'] });
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const leads = leadsQuery.data?.data || [];

  const duplicateIds = useMemo(() => {
    const emails = new Map<string, string>();
    const phones = new Map<string, string>();
    const dups = new Set<string>();
    for (const item of leads) {
      const lead = item.lead;
      if (lead.email) {
        const existing = emails.get(lead.email);
        if (existing) {
          dups.add(lead.id);
          dups.add(existing);
        } else {
          emails.set(lead.email, lead.id);
        }
      }
      if (lead.phone) {
        const existing = phones.get(lead.phone);
        if (existing) {
          dups.add(lead.id);
          dups.add(existing);
        } else {
          phones.set(lead.phone, lead.id);
        }
      }
    }
    return dups;
  }, [leads]);

  // Filter leads based on search and status
  const filteredLeads = leads.filter((item: any) => {
    const lead = item.lead;
    const vehicle = item.vehicle || {};
    const values = [
      lead.id,
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.state,
      vehicle.year,
      vehicle.make,
      vehicle.model,
      lead.source,
      lead.status,
      lead.createdAt
        ? new Date(lead.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : '',
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
      .join(' ');

    const matchesSearch = values.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const isDuplicate = duplicateIds.has(lead.id);

    return matchesSearch && matchesStatus && (!hideDuplicates || !isDuplicate);
  });

  const getValue = (item: any, field: string) => {
    const lead = item.lead;
    const vehicle = item.vehicle || {};
    switch (field) {
      case 'id':
        return lead.id;
      case 'firstName':
        return lead.firstName;
      case 'lastName':
        return lead.lastName;
      case 'email':
        return lead.email;
      case 'phone':
        return lead.phone;
      case 'state':
        return lead.state;
      case 'year':
        return vehicle.year;
      case 'make':
        return vehicle.make;
      case 'model':
        return vehicle.model;
      case 'referrer':
        return lead.referrer || lead.source;
      case 'createdAt':
        return lead.createdAt;
      case 'status':
        return lead.status;
      default:
        return '';
    }
  };

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const aVal = getValue(a, sortField);
    const bVal = getValue(b, sortField);
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    if (sortField === 'year') {
      const numA = Number(aVal);
      const numB = Number(bVal);
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }
    if (sortField === 'createdAt') {
      const timeA = new Date(aVal).getTime();
      const timeB = new Date(bVal).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    }
    return sortOrder === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortField, sortOrder, hideDuplicates, leads.length]);

  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(sortedLeads.length / ITEMS_PER_PAGE));
    if (currentPage > maxPages) {
      setCurrentPage(maxPages);
    }
  }, [currentPage, sortedLeads.length]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / ITEMS_PER_PAGE));
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLeads = sortedLeads.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const showingFrom = sortedLeads.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + ITEMS_PER_PAGE, sortedLeads.length);

  const pageButtons = useMemo(() => {
    if (totalPages <= 1) {
      return [] as JSX.Element[];
    }
    const pageSet = new Set<number>([1, totalPages, currentPage]);
    if (currentPage > 1) pageSet.add(currentPage - 1);
    if (currentPage > 2) pageSet.add(currentPage - 2);
    if (currentPage < totalPages) pageSet.add(currentPage + 1);
    if (currentPage < totalPages - 1) pageSet.add(currentPage + 2);
    if (totalPages > 2) pageSet.add(2);
    if (totalPages > 3) pageSet.add(totalPages - 1);

    const sortedPages = Array.from(pageSet)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

    const nodes: JSX.Element[] = [];
    let lastPage = 0;
    for (const page of sortedPages) {
      if (lastPage && page - lastPage > 1) {
        nodes.push(
          <span key={`ellipsis-${page}`} className="px-1 text-xs text-slate-400">
            …
          </span>
        );
      }
      nodes.push(
        <Button
          key={`page-${page}`}
          type="button"
          variant={page === currentPage ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCurrentPage(page)}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </Button>
      );
      lastPage = page;
    }

    return nodes;
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortField('createdAt');
    setSortOrder('desc');
    setHideDuplicates(false);
  };

  const sortOptions: { value: string; label: string }[] = [
    { value: 'createdAt', label: 'Date created' },
    { value: 'status', label: 'Status' },
    { value: 'firstName', label: 'First name' },
    { value: 'lastName', label: 'Last name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'state', label: 'State' },
    { value: 'year', label: 'Vehicle year' },
    { value: 'make', label: 'Vehicle make' },
  ];

  const sortFieldLabel = sortOptions.find((option) => option.value === sortField)?.label || 'Date created';

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateLeadMutation.mutate({
      id: leadId,
      updates: { status: newStatus },
    });
  };

  const handleRowNavigate = useCallback((leadId: string) => {
    navigate(`/admin/leads/${leadId}`);
  }, [navigate]);

  const handleRowKeyDown = useCallback((event: KeyboardEvent<HTMLTableRowElement>, leadId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowNavigate(leadId);
    }
  }, [handleRowNavigate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

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

  if (leadsQuery.isLoading && !leadsQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:px-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-500">Leads</p>
            <h1 className="text-3xl font-semibold text-slate-900">Lead management</h1>
            <p className="text-sm text-slate-600">
              Review incoming opportunities, quickly clean up duplicates, and drill into the records that matter.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={hideDuplicates ? 'default' : 'outline'}
              onClick={() => setHideDuplicates(!hideDuplicates)}
              className="flex items-center gap-2"
            >
              <LayoutList className="h-4 w-4" />
              {hideDuplicates ? 'Show duplicates' : 'Hide duplicates'}
            </Button>
            <Button asChild>
              <Link href="/admin/leads/new">Add lead</Link>
            </Button>
          </div>
        </header>

        <Card className="border border-slate-200/70 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Keep things tidy by narrowing results and sorting how you need.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="md:col-span-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">Search</Label>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, phone, vehicle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 rounded-md border-slate-200 bg-white pl-10 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-2 h-11 rounded-md border-slate-200 bg-white text-sm">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="callback">Callback</SelectItem>
                    <SelectItem value="left-message">Left message</SelectItem>
                    <SelectItem value="no-contact">No contact</SelectItem>
                    <SelectItem value="wrong-number">Wrong number</SelectItem>
                    <SelectItem value="fake-lead">Fake lead</SelectItem>
                    <SelectItem value="not-interested">Not interested</SelectItem>
                    <SelectItem value="duplicate-lead">Duplicate lead</SelectItem>
                    <SelectItem value="dnc">DNC</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">Sort</Label>
                <div className="mt-2 flex gap-2">
                  <Select value={sortField} onValueChange={(value) => setSortField(value)}>
                    <SelectTrigger className="h-11 flex-1 rounded-md border-slate-200 bg-white text-sm">
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
                    className="h-11 w-24 shrink-0 rounded-md border-slate-200 bg-white text-sm"
                  >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p>
                  Showing {sortedLeads.length === 0 ? 0 : `${showingFrom}-${showingTo}`} of {sortedLeads.length} filtered leads
                  {` · ${leads.length} total`}
                </p>
                <p className="text-xs text-slate-500">
                  Sorted by {sortFieldLabel} · {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hideDuplicates && (
                  <Badge className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Duplicates hidden
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/70 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Lead list</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  A compact overview of every lead with quick status controls.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                Live updates every 5 seconds
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <Table className="min-w-[960px] text-sm">
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-slate-200">
                    <TableHead className="w-[180px] px-4 py-3">Status</TableHead>
                    <TableHead className="w-[220px] px-4 py-3">Lead</TableHead>
                    <TableHead className="w-[220px] px-4 py-3">Contact</TableHead>
                    <TableHead className="px-4 py-3">Location</TableHead>
                    <TableHead className="px-4 py-3">Vehicle</TableHead>
                    <TableHead className="px-4 py-3">Source</TableHead>
                    <TableHead className="w-[140px] px-4 py-3 text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((item: any) => {
                    const lead = item.lead;
                    const vehicle = item.vehicle || {};
                    const isDuplicate = duplicateIds.has(lead.id);
                    return (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          'border-slate-200/80 transition-colors hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none cursor-pointer',
                          isDuplicate && 'bg-amber-50/70 hover:bg-amber-50'
                        )}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open lead ${lead.id}`}
                        onClick={() => handleRowNavigate(lead.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, lead.id)}
                      >
                        <TableCell className="px-4 py-4">
                          <div
                            className="max-w-[180px]"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Select value={lead.status} onValueChange={(value) => handleStatusChange(lead.id, value)}>
                              <SelectTrigger className="h-9 w-full justify-between rounded-md border-slate-200 text-xs">
                                <SelectValue>
                                  <span className="flex items-center gap-2">
                                    <span className={cn('h-2 w-2 rounded-full', {
                                      'bg-sky-500': lead.status === 'new',
                                      'bg-indigo-500': lead.status === 'quoted',
                                      'bg-emerald-500': lead.status === 'sold',
                                      'bg-amber-500': lead.status === 'duplicate-lead',
                                      'bg-rose-500': lead.status === 'fake-lead',
                                      'bg-slate-400':
                                        !['new', 'quoted', 'sold', 'duplicate-lead', 'fake-lead'].includes(lead.status),
                                    })} />
                                    <span className="capitalize text-slate-700">{lead.status.replace('-', ' ')}</span>
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="quoted">Quoted</SelectItem>
                                <SelectItem value="callback">Callback</SelectItem>
                                <SelectItem value="left-message">Left message</SelectItem>
                                <SelectItem value="no-contact">No contact</SelectItem>
                                <SelectItem value="wrong-number">Wrong number</SelectItem>
                                <SelectItem value="fake-lead">Fake lead</SelectItem>
                                <SelectItem value="not-interested">Not interested</SelectItem>
                                <SelectItem value="duplicate-lead">Duplicate lead</SelectItem>
                                <SelectItem value="dnc">DNC</SelectItem>
                                <SelectItem value="sold">Sold</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">
                              {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
                            </p>
                            <p className="font-mono text-xs text-slate-500">{lead.id}</p>
                            {isDuplicate && (
                              <Badge className="mt-1 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                                Duplicate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-slate-700">
                          <div className="space-y-1">
                            <p>{lead.email || '—'}</p>
                            <p className="text-xs text-slate-500">{lead.phone || 'No phone'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-slate-700">
                          <span>{[lead.city || lead.shippingCity, lead.state].filter(Boolean).join(', ') || '—'}</span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-slate-700">
                          <span className="text-sm text-slate-600">
                            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle pending'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-slate-700">
                          {lead.referrer || lead.source ? (
                            <Badge className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600">
                              {lead.referrer || lead.source}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-xs text-slate-500">
                          {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleString('en-US', {
                                timeZone: 'America/New_York',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No leads match your filters yet. Try expanding your search or resetting filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {sortedLeads.length > 0 && (
              <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                <span>{`Showing ${showingFrom}-${showingTo} of ${sortedLeads.length} leads`}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  {pageButtons}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages || sortedLeads.length === 0}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

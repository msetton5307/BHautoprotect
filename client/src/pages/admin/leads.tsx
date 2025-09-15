import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Filter, Eye } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { getAuthHeaders, clearCredentials } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export default function AdminLeads() {
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['/api/admin/leads'],
    queryFn: async () => {
      const res = await fetch('/api/admin/leads', {
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
    enabled: authenticated,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const res = await fetch(`/api/admin/leads/${id}`, {
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

  const leads = leadsData?.data || [];

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateLeadMutation.mutate({
      id: leadId,
      updates: { status: newStatus },
    });
  };

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
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-2">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Users className="h-6 w-6 mr-2" />
                Lead Management
              </h1>
              <p className="text-gray-600">Track and manage all customer leads</p>
            </div>
            <div className="flex space-x-4">
              <Button
                variant={hideDuplicates ? "default" : "outline"}
                onClick={() => setHideDuplicates(!hideDuplicates)}
              >
                {hideDuplicates ? "Show Duplicates" : "Hide Duplicates"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href="/">Public Site</Link>
              </Button>
              <Button asChild>
                <Link href="/admin/leads/new">Add Lead</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                  <SelectItem value="left-message">Left Message</SelectItem>
                  <SelectItem value="no-contact">No Contact</SelectItem>
                  <SelectItem value="wrong-number">Wrong Number</SelectItem>
                  <SelectItem value="fake-lead">Fake Lead</SelectItem>
                  <SelectItem value="not-interested">Not Interested</SelectItem>
                  <SelectItem value="duplicate-lead">Duplicate Lead</SelectItem>
                  <SelectItem value="dnc">DNC</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-gray-600 flex items-center">
                Showing {filteredLeads.length} of {leads.length} leads
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>Complete list of customer leads and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('status')}>Status</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('id')}>ID</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('firstName')}>First Name</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('lastName')}>Last Name</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('email')}>Email</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('phone')}>Phone</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('state')}>Registered State</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('year')}>Year</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('make')}>Make</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('model')}>Model</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('referrer')}>Referrer</TableHead>
                    <TableHead className="cursor-pointer whitespace-nowrap p-2" onClick={() => handleSort('createdAt')}>Date Created</TableHead>
                    <TableHead className="whitespace-nowrap p-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeads.map((item: any) => {
                    const lead = item.lead;
                    const vehicle = item.vehicle || {};
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="p-2 whitespace-nowrap">
                          <Select
                            value={lead.status}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="callback">Callback</SelectItem>
                              <SelectItem value="left-message">Left Message</SelectItem>
                              <SelectItem value="no-contact">No Contact</SelectItem>
                              <SelectItem value="wrong-number">Wrong Number</SelectItem>
                              <SelectItem value="fake-lead">Fake Lead</SelectItem>
                              <SelectItem value="not-interested">Not Interested</SelectItem>
                              <SelectItem value="duplicate-lead">Duplicate Lead</SelectItem>
                              <SelectItem value="dnc">DNC</SelectItem>
                              <SelectItem value="sold">Sold</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.id}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.firstName}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.lastName}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.email}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.phone}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.state}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{vehicle.year || '-'}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{vehicle.make || '-'}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{vehicle.model || '-'}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{lead.referrer || lead.source || '-'}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">
                          {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
                            : ''}
                        </TableCell>
                        <TableCell className="p-2 whitespace-nowrap">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/leads/${lead.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {sortedLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                        No leads found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
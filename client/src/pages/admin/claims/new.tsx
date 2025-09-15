import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clearCredentials, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export default function AdminClaimNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    policyId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    claimReason: "",
    message: "",
  });

  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/admin/policy-holders'],
    enabled: authenticated,
    queryFn: async () => {
      const [polRes, leadRes] = await Promise.all([
        fetch('/api/admin/policies', { headers: getAuthHeaders() }),
        fetch('/api/admin/leads', { headers: getAuthHeaders() })
      ]);
      if (polRes.status === 401 || leadRes.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!polRes.ok || !leadRes.ok) throw new Error('Failed to fetch data');
      const policies = (await polRes.json()).data;
      const leads = (await leadRes.json()).data;
      const leadMap = new Map(leads.map((l: any) => [l.lead.id, l.lead]));
      return policies.map((p: any) => ({ policy: p, lead: leadMap.get(p.leadId) })).filter((c: any) => c.lead);
    }
  });

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

  const filtered = (customers || []).filter((c: any) => {
    const value = `${c.lead.firstName} ${c.lead.lastName} ${c.lead.email} ${c.lead.phone} ${c.policy.id}`.toLowerCase();
    return value.includes(search.toLowerCase());
  });

  const createClaim = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(data),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to create claim');
      return res.json();
    },
    onSuccess: (res) => {
      toast({ title: 'Success', description: 'Claim created successfully' });
      setLocation(`/admin/claims/${res.data.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create claim', variant: 'destructive' });
    }
  });

  const handleSelect = (c: any) => {
    setForm({
      policyId: c.policy.id,
      firstName: c.lead.firstName || '',
      lastName: c.lead.lastName || '',
      email: c.lead.email || '',
      phone: c.lead.phone || '',
      claimReason: '',
      message: '',
    });
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClaim.mutate(form);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Button variant="ghost" asChild>
          <Link href="/admin/claims">&larr; Back to Claims</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Select Policy Holder</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by name, email, phone or policy ID"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-4"
            />
            <div className="rounded-md border max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Policy ID</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.policy.id}>
                      <TableCell>{c.lead.firstName} {c.lead.lastName}</TableCell>
                      <TableCell>{c.lead.email}</TableCell>
                      <TableCell>{c.lead.phone}</TableCell>
                      <TableCell>{c.policy.id}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleSelect(c)}>Select</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                        No results
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {form.policyId && (
          <Card>
            <CardHeader>
              <CardTitle>Create Claim</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Policy ID</Label>
                    <Input value={form.policyId} disabled />
                  </div>
                  <div>
                    <Label htmlFor="claimReason">Claim Reason</Label>
                    <Input id="claimReason" value={form.claimReason} onChange={e => handleChange('claimReason', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="message">Claim Description</Label>
                  <Textarea id="message" value={form.message} onChange={e => handleChange('message', e.target.value)} />
                </div>
                <Button type="submit" disabled={createClaim.isLoading}>Create Claim</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


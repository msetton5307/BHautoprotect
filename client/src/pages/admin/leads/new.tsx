import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export default function AdminLeadNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    state: '',
    year: '',
    make: '',
    model: '',
    mileage: '',
    referrer: '',
  });

  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const createLead = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetchWithAuth('/api/admin/leads', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          lead: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            state: data.state,
            source: data.referrer,
          },
          vehicle: {
            year: Number(data.year),
            make: data.make,
            model: data.model,
            odometer: Number(data.mileage) || 0,
          },
        }),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to create lead');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Lead created successfully' });
      setLocation('/admin/leads');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create lead',
        variant: 'destructive',
      });
    },
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

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLead.mutate(form);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Add New Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="state">Registered State</Label>
                <Input id="state" value={form.state} onChange={e => handleChange('state', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" value={form.year} onChange={e => handleChange('year', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input id="make" value={form.make} onChange={e => handleChange('make', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={form.model} onChange={e => handleChange('model', e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="mileage">Mileage</Label>
                <Input
                  id="mileage"
                  type="number"
                  min={0}
                  value={form.mileage}
                  onChange={e => handleChange('mileage', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="referrer">Referrer</Label>
                <Input id="referrer" value={form.referrer} onChange={e => handleChange('referrer', e.target.value)} />
              </div>
              <Button type="submit" disabled={createLead.isLoading}>Create Lead</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

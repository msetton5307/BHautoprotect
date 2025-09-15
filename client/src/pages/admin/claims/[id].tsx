import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { clearCredentials, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

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
      const res = await fetch(`/api/admin/claims/${id}`, { headers: getAuthHeaders() });
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

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch(`/api/admin/claims/${id}`, {
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

  const handleStatusChange = (value: string) => {
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/claims">&larr; Back to Claims</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Update Claim</CardTitle>
            <CardDescription>Modify claim information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>ID</Label>
                  <Input value={formData.id} disabled />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                      <SelectItem value="awaiting_customer_action">Awaiting Customer Action</SelectItem>
                      <SelectItem value="awaiting_inspection">Awaiting Inspection</SelectItem>
                      <SelectItem value="claim_covered_open">Claim Covered Open</SelectItem>
                      <SelectItem value="claim_covered_closed">Claim Covered Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nextEstimate">Next Estimate</Label>
                  <Input name="nextEstimate" value={formData.nextEstimate || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="nextPayment">Next Payment (from policy)</Label>
                  <Input name="nextPayment" value={formData.nextPayment || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input name="firstName" value={formData.firstName || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input name="lastName" value={formData.lastName || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" value={formData.email || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input name="phone" value={formData.phone || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input name="year" value={formData.year || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input name="make" value={formData.make || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input name="model" value={formData.model || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="trim">Trim</Label>
                  <Input name="trim" value={formData.trim || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="vin">VIN</Label>
                  <Input name="vin" value={formData.vin || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="serial">Serial</Label>
                  <Input name="serial" value={formData.serial || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="odometer">Odometer</Label>
                  <Input name="odometer" value={formData.odometer || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="currentOdometer">Current Odometer Reading</Label>
                  <Input name="currentOdometer" value={formData.currentOdometer || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="claimReason">Claim Reason</Label>
                  <Input name="claimReason" value={formData.claimReason || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="agentClaimNumber">Agent Claim Number</Label>
                  <Input name="agentClaimNumber" value={formData.agentClaimNumber || ''} onChange={handleInputChange} />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Claim Notes</Label>
                <Textarea name="message" value={formData.message || ''} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="previousNotes">Previous Notes</Label>
                <Textarea name="previousNotes" value={formData.previousNotes || ''} onChange={handleInputChange} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Created</Label>
                  <Input value={formData.createdAt ? new Date(formData.createdAt).toLocaleString() : ''} disabled />
                </div>
                <div>
                  <Label>Modified</Label>
                  <Input value={formData.updatedAt ? new Date(formData.updatedAt).toLocaleString() : ''} disabled />
                </div>
              </div>
              <Button type="submit">Submit</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


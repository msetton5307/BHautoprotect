import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminNav from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const getAuthHeaders = () => ({
  Authorization: 'Basic ' + btoa('admin:password'),
  'Content-Type': 'application/json',
});

export default function AdminClaimDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/claims', id],
    queryFn: () =>
      fetch(`/api/admin/claims/${id}`, { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch claim');
        return res.json();
      }),
    enabled: !!id,
  });

  const claim = data?.data;
  const [status, setStatus] = useState('new');

  useEffect(() => {
    if (claim) setStatus(claim.status);
  }, [claim]);

  const updateMutation = useMutation({
    mutationFn: (updates: any) =>
      fetch(`/api/admin/claims/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update claim');
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/claims', id] });
      toast({ title: 'Success', description: 'Claim updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update claim', variant: 'destructive' });
    },
  });

  const handleStatusChange = (value: string) => {
    setStatus(value);
    updateMutation.mutate({ status: value });
  };

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/claims">&larr; Back to Claims</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Claim Details</CardTitle>
            <CardDescription>Review claim information and update status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <p>{claim.firstName} {claim.lastName}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p>{claim.email}</p>
              </div>
              <div>
                <Label>Phone</Label>
                <p>{claim.phone}</p>
              </div>
              <div>
                <Label>Submitted</Label>
                <p>{new Date(claim.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <p className="whitespace-pre-line">{claim.message}</p>
            </div>
            <div className="max-w-xs">
              <Label>Status</Label>
              <Select value={status} onValueChange={handleStatusChange}>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


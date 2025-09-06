import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminNav from "@/components/admin-nav";
import { getAuthHeaders } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";

export default function AdminPolicyDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/policies", id],
    queryFn: () =>
      fetch(`/api/admin/policies/${id}`, { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error("Failed to fetch policy");
        return res.json();
      }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const policy = data?.data;
  const lead = policy?.lead || {};
  const vehicle = policy?.vehicle || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/policies">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Policies
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Policy Details</CardTitle>
            <CardDescription>ID: {policy.id}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Package:</span> {policy.package || "N/A"}</div>
            <div><span className="font-medium">Policy Start:</span> {policy.policyStartDate ? new Date(policy.policyStartDate).toLocaleDateString() : "N/A"}</div>
            <div><span className="font-medium">Expiration Date:</span> {policy.expirationDate ? new Date(policy.expirationDate).toLocaleDateString() : "N/A"}</div>
            <div><span className="font-medium">Expiration Miles:</span> {policy.expirationMiles ?? "N/A"}</div>
            <div><span className="font-medium">Deductible:</span> {policy.deductible != null ? `$${policy.deductible}` : "N/A"}</div>
            <div><span className="font-medium">Total Premium:</span> {policy.totalPremium != null ? `$${policy.totalPremium}` : "N/A"}</div>
            <div><span className="font-medium">Down Payment:</span> {policy.downPayment != null ? `$${policy.downPayment}` : "N/A"}</div>
            <div><span className="font-medium">Monthly Payment:</span> {policy.monthlyPayment != null ? `$${policy.monthlyPayment}` : "N/A"}</div>
            <div><span className="font-medium">Total Payments:</span> {policy.totalPayments != null ? `$${policy.totalPayments}` : "N/A"}</div>
            <div><span className="font-medium">Created:</span> {new Date(policy.createdAt).toLocaleDateString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Name:</span> {lead ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'N/A' : 'N/A'}</div>
            <div><span className="font-medium">Email:</span> {lead.email || 'N/A'}</div>
            <div><span className="font-medium">Phone:</span> {lead.phone || 'N/A'}</div>
            <div><span className="font-medium">State:</span> {lead.state || 'N/A'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Year:</span> {vehicle.year || 'N/A'}</div>
            <div><span className="font-medium">Make:</span> {vehicle.make || 'N/A'}</div>
            <div><span className="font-medium">Model:</span> {vehicle.model || 'N/A'}</div>
            <div><span className="font-medium">Trim:</span> {vehicle.trim || 'N/A'}</div>
            <div><span className="font-medium">VIN:</span> {vehicle.vin || 'N/A'}</div>
            <div><span className="font-medium">Odometer:</span> {vehicle.odometer != null ? vehicle.odometer : 'N/A'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

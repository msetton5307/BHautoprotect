import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import AdminNav from "@/components/admin-nav";
import { getAuthHeaders } from "@/lib/auth";
import { Link } from "wouter";
import { Eye } from "lucide-react";

export default function AdminPolicies() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/policies'],
    queryFn: () =>
      fetch('/api/admin/policies', { headers: getAuthHeaders() }).then(res => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              Open a policy to review its details, attach documents, add notes, and send polished email updates to the
              customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Expiration Date</TableHead>
                    <TableHead>Exp. Miles</TableHead>
                    <TableHead>Deductible</TableHead>
                    <TableHead>Total Premium</TableHead>
                    <TableHead>Down Payment</TableHead>
                    <TableHead>Monthly Payment</TableHead>
                    <TableHead>Total Payments</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy: any) => (
                    <TableRow key={policy.id} className="hover:bg-muted/40">
                      <TableCell>{policy.id}</TableCell>
                      <TableCell>{getPolicyHolderName(policy) || 'N/A'}</TableCell>
                      <TableCell>{policy.lead?.email || 'N/A'}</TableCell>
                      <TableCell>{policy.lead?.phone || 'N/A'}</TableCell>
                      <TableCell>{policy.vehicle ? `${policy.vehicle.year} ${policy.vehicle.make} ${policy.vehicle.model}` : 'N/A'}</TableCell>
                      <TableCell>{policy.package || 'N/A'}</TableCell>
                      <TableCell>{policy.policyStartDate ? new Date(policy.policyStartDate).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>{policy.expirationDate ? new Date(policy.expirationDate).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>{policy.expirationMiles ?? 'N/A'}</TableCell>
                      <TableCell>{policy.deductible != null ? `$${policy.deductible}` : 'N/A'}</TableCell>
                      <TableCell>{policy.totalPremium != null ? `$${policy.totalPremium}` : 'N/A'}</TableCell>
                      <TableCell>{policy.downPayment != null ? `$${policy.downPayment}` : 'N/A'}</TableCell>
                      <TableCell>{policy.monthlyPayment != null ? `$${policy.monthlyPayment}` : 'N/A'}</TableCell>
                      <TableCell>{policy.totalPayments != null ? `$${policy.totalPayments}` : 'N/A'}</TableCell>
                      <TableCell>{new Date(policy.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/admin/policies/${policy.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Policy
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {policies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-4 text-gray-500">
                        No policies found
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

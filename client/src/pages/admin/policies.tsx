import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminNav from "@/components/admin-nav";

const getAuthHeaders = () => ({
  Authorization: 'Basic ' + btoa('admin:password'),
});

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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy: any) => (
                    <TableRow key={policy.id}>
                      <TableCell>{policy.id}</TableCell>
                      <TableCell>{policy.leadId}</TableCell>
                      <TableCell>{policy.package || 'N/A'}</TableCell>
                      <TableCell>{new Date(policy.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {policies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-500">
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

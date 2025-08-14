import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminNav from "@/components/admin-nav";

const getAuthHeaders = () => ({
  Authorization: 'Basic ' + btoa('admin:password'),
});

export default function AdminClaims() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/claims'],
    queryFn: () =>
      fetch('/api/admin/claims', { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch claims');
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

  const claims = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Policy ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim: any) => (
                    <TableRow key={claim.id}>
                      <TableCell>{claim.id}</TableCell>
                      <TableCell>{claim.policyId}</TableCell>
                      <TableCell className="capitalize">{claim.status.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{new Date(claim.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {claims.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                        No claims found
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

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, Target, TrendingUp, Activity, Calendar } from "lucide-react";
import { Link } from "wouter";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { getAuthHeaders, hasCredentials } from "@/lib/auth";

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(hasCredentials());

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: () =>
      fetch('/api/admin/stats', {
        headers: getAuthHeaders()
      }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['/api/admin/leads'],
    queryFn: () =>
      fetch('/api/admin/leads', {
        headers: getAuthHeaders()
      }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch leads');
        return res.json();
      }),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statsData = stats?.data || {};
  const leads = recentLeads?.data?.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">BH Auto Protect - Admin Dashboard</h1>
              <p className="text-gray-600">Manage leads, quotes, and customer relationships</p>
            </div>
            <div className="flex space-x-4">
              <Button asChild>
                <Link href="/admin/leads">View All Leads</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Public Site</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalLeads || 0}</div>
              <p className="text-xs text-muted-foreground">All time leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.newLeads || 0}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quoted Leads</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.quotedLeads || 0}</div>
              <p className="text-xs text-muted-foreground">Quotes sent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.conversionRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Closed-won rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Leads
              </CardTitle>
              <CardDescription>Latest quote requests from customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leads.map((item: any) => (
                  <div key={item.lead.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.lead.firstName} {item.lead.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.vehicle?.year} {item.vehicle?.make} {item.vehicle?.model}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(item.lead.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{item.lead.status}</Badge>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/leads/${item.lead.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No leads found. New quote requests will appear here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lead Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Lead Pipeline
              </CardTitle>
              <CardDescription>Breakdown of leads by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statsData.leadsByStatus?.map((status: any) => (
                  <div key={status.status} className="flex items-center justify-between">
                    <span className="capitalize">{status.status.replace('-', ' ')}</span>
                    <Badge variant="outline">{status.count}</Badge>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No status data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="h-20 flex flex-col items-center justify-center" asChild>
                <Link href="/admin/leads">
                  <Users className="h-6 w-6 mb-2" />
                  Manage Leads
                </Link>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <FileText className="h-6 w-6 mb-2" />
                Generate Reports
              </Button>
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <Target className="h-6 w-6 mb-2" />
                Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
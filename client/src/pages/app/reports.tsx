import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Download, TrendingUp, Users, DollarSign, FileText, Calendar } from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Mock data for charts
const leadsData = [
  { name: 'Jan', leads: 120, conversions: 24 },
  { name: 'Feb', leads: 98, conversions: 19 },
  { name: 'Mar', leads: 156, conversions: 31 },
  { name: 'Apr', leads: 134, conversions: 27 },
  { name: 'May', leads: 189, conversions: 38 },
  { name: 'Jun', leads: 167, conversions: 33 },
];

const revenueData = [
  { name: 'Jan', revenue: 45000 },
  { name: 'Feb', revenue: 38000 },
  { name: 'Mar', revenue: 62000 },
  { name: 'Apr', revenue: 54000 },
  { name: 'May', revenue: 75000 },
  { name: 'Jun', revenue: 67000 },
];

const planDistribution = [
  { name: 'Powertrain', value: 35, count: 42 },
  { name: 'Gold', value: 45, count: 54 },
  { name: 'Platinum', value: 20, count: 24 },
];

const sourceData = [
  { name: 'Web', value: 60, count: 120 },
  { name: 'Partner', value: 25, count: 50 },
  { name: 'Referral', value: 15, count: 30 },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading, error } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated,
    retry: false,
  });

  if (isLoading || statsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
              <div className="flex space-x-3">
                <Select defaultValue="30days">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="1year">Last year</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Leads</p>
                    <p className="text-2xl font-bold text-gray-900">1,247</p>
                    <p className="text-sm text-green-600">+12% from last month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900">18.5%</p>
                    <p className="text-sm text-green-600">+2.3% from last month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">$67,000</p>
                    <p className="text-sm text-green-600">+8.2% from last month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <FileText className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Active Policies</p>
                    <p className="text-2xl font-bold text-gray-900">432</p>
                    <p className="text-sm text-green-600">+15 this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
              <TabsTrigger value="sales">Sales Performance</TabsTrigger>
              <TabsTrigger value="policies">Policy Management</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leads & Conversions Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Leads & Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leadsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="leads" fill="#2563EB" name="Leads" />
                        <Bar dataKey="conversions" fill="#10B981" name="Conversions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Revenue Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                        <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Plan Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coverage Plan Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={planDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name} (${value}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {planDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Lead Sources */}
                <Card>
                  <CardHeader>
                    <CardTitle>Lead Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={sourceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name} (${value}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="leads" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lead Quality Score */}
                <Card>
                  <CardHeader>
                    <CardTitle>Lead Quality Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">High Quality (80-100)</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 h-2 bg-gray-200 rounded">
                            <div className="w-8 h-2 bg-green-500 rounded"></div>
                          </div>
                          <span className="text-sm font-medium">25%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Medium Quality (50-79)</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 h-2 bg-gray-200 rounded">
                            <div className="w-20 h-2 bg-yellow-500 rounded"></div>
                          </div>
                          <span className="text-sm font-medium">45%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Low Quality (0-49)</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 h-2 bg-gray-200 rounded">
                            <div className="w-12 h-2 bg-red-500 rounded"></div>
                          </div>
                          <span className="text-sm font-medium">30%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Lead Stage Funnel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Funnel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                        <span className="font-medium">New Leads</span>
                        <Badge>1,247</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                        <span className="font-medium">Contacted</span>
                        <Badge>892 (71.5%)</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="font-medium">Qualified</span>
                        <Badge>534 (42.8%)</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="font-medium">Quoted</span>
                        <Badge>312 (25.0%)</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded">
                        <span className="font-medium">Closed</span>
                        <Badge>231 (18.5%)</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Performers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performers (This Month)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Sarah Johnson</p>
                          <p className="text-sm text-gray-500">Senior Agent</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">23 sales</p>
                          <p className="text-sm text-green-600">$29,700</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Mike Chen</p>
                          <p className="text-sm text-gray-500">Agent</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">19 sales</p>
                          <p className="text-sm text-green-600">$24,510</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Emily Davis</p>
                          <p className="text-sm text-gray-500">Agent</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">17 sales</p>
                          <p className="text-sm text-green-600">$21,930</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Average Deal Size */}
                <Card>
                  <CardHeader>
                    <CardTitle>Average Deal Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Average Deal Size</p>
                        <p className="text-2xl font-bold">$1,290</p>
                        <p className="text-sm text-green-600">+5.2% from last month</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Average Sales Cycle</p>
                        <p className="text-2xl font-bold">12 days</p>
                        <p className="text-sm text-red-600">+1 day from last month</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Close Rate</p>
                        <p className="text-2xl font-bold">18.5%</p>
                        <p className="text-sm text-green-600">+2.3% from last month</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Targets */}
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Targets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Sales Target</span>
                          <span className="text-sm">231/250</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '92.4%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Revenue Target</span>
                          <span className="text-sm">$67K/$75K</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '89.3%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">Lead Contact Target</span>
                          <span className="text-sm">892/1000</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '89.2%' }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="policies" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Policy Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Policy Status Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="font-medium">Active Policies</span>
                        <Badge className="bg-green-100 text-green-800">432</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                        <span className="font-medium">Pending</span>
                        <Badge className="bg-yellow-100 text-yellow-800">23</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                        <span className="font-medium">Cancelled</span>
                        <Badge className="bg-red-100 text-red-800">15</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium">Expired</span>
                        <Badge className="bg-gray-100 text-gray-800">8</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Claims Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Claims Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Claims This Month</p>
                        <p className="text-2xl font-bold">47</p>
                        <p className="text-sm text-green-600">-12% from last month</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Claims Approved</p>
                        <p className="text-2xl font-bold">42</p>
                        <p className="text-sm text-gray-600">89.4% approval rate</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Claims Paid</p>
                        <p className="text-2xl font-bold">$184,520</p>
                        <p className="text-sm text-gray-600">Average: $4,392 per claim</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

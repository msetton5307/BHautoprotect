import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Clock, DollarSign, Bell } from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import KanbanBoard from "@/components/kanban-board";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["/api/leads"],
  });

  if (statsLoading || leadsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-primary mr-8">BH Auto Protect CRM</h1>
                <nav className="flex space-x-6">
                  <a href="/app/leads" className="text-primary font-medium border-b-2 border-primary pb-2">Dashboard</a>
                  <a href="/app/leads" className="text-gray-600 hover:text-gray-900 pb-2">Leads</a>
                  <a href="/app/reports" className="text-gray-600 hover:text-gray-900 pb-2">Reports</a>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Bell className="w-6 h-6 text-gray-400" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
                </div>
                <div className="flex items-center space-x-2">
                  <img 
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" 
                    alt="Agent profile" 
                    className="w-8 h-8 rounded-full object-cover" 
                  />
                  <span className="text-sm font-medium">John Smith</span>
                </div>
                <Button variant="outline" size="sm">
                  <a href="/api/logout">Logout</a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="bg-gray-50 px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Today's Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.leadsToday || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Quotes Sent</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.quotesSent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Pending Tasks</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.pendingTasks || 0}</p>
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
                    <p className="text-sm text-gray-600">Revenue Today</p>
                    <p className="text-2xl font-bold text-gray-900">${stats?.revenueToday?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 py-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Lead Management</CardTitle>
                <div className="flex space-x-3">
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    New Lead
                  </Button>
                  <Button variant="outline">
                    Filter
                  </Button>
                  <Button variant="outline">
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <KanbanBoard leads={leadsData?.data || []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

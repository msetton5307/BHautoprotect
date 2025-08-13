import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Eye, 
  Key, 
  DollarSign, 
  Users, 
  FileText,
  MoreHorizontal,
  Copy
} from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface Partner {
  id: string;
  name: string;
  contactEmail: string;
  apiKey?: string;
  payoutPct: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PartnersPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [newPartner, setNewPartner] = useState({
    name: '',
    contactEmail: '',
    payoutPct: '10.00',
    address: '',
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: partnersData, isLoading: partnersLoading, error } = useQuery({
    queryKey: ["/api/partners"],
    enabled: isAuthenticated,
    retry: false,
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      return apiRequest("POST", "/api/partners", partnerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      setIsAddModalOpen(false);
      setNewPartner({
        name: '',
        contactEmail: '',
        payoutPct: '10.00',
        address: '',
      });
      toast({
        title: "Partner Created",
        description: "New partner has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || partnersLoading) {
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

  const partners = partnersData?.data || [];
  const filteredPartners = partners.filter((partner: Partner) =>
    partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast({
      title: "API Key Copied",
      description: "API key has been copied to clipboard.",
    });
  };

  const handleCreatePartner = () => {
    createPartnerMutation.mutate(newPartner);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Partner Management</h1>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Partner
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Partner</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Partner Name</Label>
                      <Input
                        id="name"
                        value={newPartner.name}
                        onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                        placeholder="Enter partner name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Contact Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newPartner.contactEmail}
                        onChange={(e) => setNewPartner({ ...newPartner, contactEmail: e.target.value })}
                        placeholder="Enter contact email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payout">Payout Percentage</Label>
                      <Input
                        id="payout"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newPartner.payoutPct}
                        onChange={(e) => setNewPartner({ ...newPartner, payoutPct: e.target.value })}
                        placeholder="10.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address (Optional)</Label>
                      <Textarea
                        id="address"
                        value={newPartner.address}
                        onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                        placeholder="Enter partner address"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreatePartner}
                        disabled={!newPartner.name || !newPartner.contactEmail || createPartnerMutation.isPending}
                      >
                        {createPartnerMutation.isPending ? "Creating..." : "Create Partner"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border-b p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="commissions">Commissions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Total Partners</p>
                        <p className="text-2xl font-bold text-gray-900">{partners.length}</p>
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
                        <p className="text-sm text-gray-600">Partner Leads</p>
                        <p className="text-2xl font-bold text-gray-900">342</p>
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
                        <p className="text-sm text-gray-600">Commissions Paid</p>
                        <p className="text-2xl font-bold text-gray-900">$12,450</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Key className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Active API Keys</p>
                        <p className="text-2xl font-bold text-gray-900">{partners.filter((p: Partner) => p.apiKey).length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Partners Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Partners</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner Name</TableHead>
                        <TableHead>Contact Email</TableHead>
                        <TableHead>Payout %</TableHead>
                        <TableHead>API Key</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPartners.map((partner: Partner) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">{partner.name}</TableCell>
                          <TableCell>{partner.contactEmail}</TableCell>
                          <TableCell>{partner.payoutPct}%</TableCell>
                          <TableCell>
                            {partner.apiKey ? (
                              <div className="flex items-center space-x-2">
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {partner.apiKey.slice(0, 8)}...
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyApiKey(partner.apiKey!)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline">No API Key</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(partner.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPartner(partner)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredPartners.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            {searchTerm ? 'No partners found matching your search.' : 'No partners yet. Add your first partner to get started.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader>
                  <CardTitle>Partner Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {partners.map((partner: Partner) => (
                      <div key={partner.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium">{partner.name}</h3>
                            <p className="text-sm text-gray-500">{partner.contactEmail}</p>
                          </div>
                          <Badge variant="outline">Active</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Leads Submitted</p>
                            <p className="font-medium">45</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Conversion Rate</p>
                            <p className="font-medium">22.3%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Commissions</p>
                            <p className="font-medium">$2,890</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {partners.length === 0 && (
                      <p className="text-gray-500 text-center py-8">No partners available for performance analysis.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions">
              <Card>
                <CardHeader>
                  <CardTitle>Commission Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Commission tracking will be displayed here.</p>
                      <p className="text-sm">No commission data available yet.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

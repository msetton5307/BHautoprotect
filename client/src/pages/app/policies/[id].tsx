import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, CreditCard, FileText, Download, Phone } from "lucide-react";
import CrmSidebar from "@/components/crm-sidebar";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

export default function PolicyDetailsPage() {
  const { id } = useParams<{ id: string }>();
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

  const { data: policyData, isLoading: policyLoading, error } = useQuery({
    queryKey: ["/api/policies", id],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  if (isLoading || policyLoading) {
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

  // Mock policy data since we don't have the backend endpoint yet
  const policy = {
    id: id,
    policyNumber: 'BH-2024-001234',
    status: 'active',
    startDate: new Date('2024-01-15'),
    endDate: new Date('2027-01-15'),
    customer: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '(555) 123-4567',
      address: '123 Main St, Anytown, CA 12345',
    },
    vehicle: {
      year: 2021,
      make: 'Toyota',
      model: 'Camry',
      trim: 'LE',
      vin: '1HGBH41JXMN109186',
      odometer: 35000,
    },
    coverage: {
      plan: 'gold',
      deductible: 250,
      monthlyPayment: 129,
      totalCost: 4644,
    },
    payments: [
      {
        id: '1',
        amount: 129,
        dueDate: new Date('2024-02-15'),
        paidAt: new Date('2024-02-14'),
        status: 'completed',
      },
      {
        id: '2',
        amount: 129,
        dueDate: new Date('2024-03-15'),
        paidAt: new Date('2024-03-14'),
        status: 'completed',
      },
      {
        id: '3',
        amount: 129,
        dueDate: new Date('2024-04-15'),
        paidAt: null,
        status: 'pending',
      },
    ],
    claims: [
      {
        id: '1',
        date: new Date('2024-03-20'),
        description: 'Transmission repair',
        amount: 2450,
        status: 'approved',
        facility: 'ABC Auto Repair',
      },
    ],
    documents: [
      {
        id: '1',
        name: 'Policy Contract',
        type: 'contract',
        uploadedAt: new Date('2024-01-15'),
        url: '#',
      },
      {
        id: '2',
        name: 'Vehicle Registration',
        type: 'registration',
        uploadedAt: new Date('2024-01-15'),
        url: '#',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CrmSidebar />
      
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  onClick={() => window.history.back()}
                  className="mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Policy {policy.policyNumber}
                  </h1>
                  <p className="text-gray-600">
                    {policy.customer.firstName} {policy.customer.lastName} - {policy.vehicle.year} {policy.vehicle.make} {policy.vehicle.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge 
                  variant={policy.status === 'active' ? 'default' : 'secondary'}
                >
                  {policy.status}
                </Badge>
                <Button variant="outline">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Customer
                </Button>
                <Button>
                  File Claim
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Policy Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        Policy Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">Policy Number</p>
                            <p className="font-medium">{policy.policyNumber}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Coverage Plan</p>
                            <p className="font-medium capitalize">{policy.coverage.plan}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Deductible</p>
                            <p className="font-medium">${policy.coverage.deductible}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">Start Date</p>
                            <p className="font-medium">{policy.startDate.toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">End Date</p>
                            <p className="font-medium">{policy.endDate.toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Monthly Payment</p>
                            <p className="font-medium">${policy.coverage.monthlyPayment}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Customer Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">Name</p>
                            <p className="font-medium">{policy.customer.firstName} {policy.customer.lastName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{policy.customer.email}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="font-medium">{policy.customer.phone}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Address</p>
                            <p className="font-medium">{policy.customer.address}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Vehicle Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Vehicle Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">Vehicle</p>
                            <p className="font-medium">
                              {policy.vehicle.year} {policy.vehicle.make} {policy.vehicle.model} {policy.vehicle.trim}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Mileage</p>
                            <p className="font-medium">{policy.vehicle.odometer.toLocaleString()} miles</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-500">VIN</p>
                            <p className="font-medium font-mono">{policy.vehicle.vin}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="w-5 h-5 mr-2" />
                        Payment History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {policy.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <p className="font-medium">${payment.amount}</p>
                              <p className="text-sm text-gray-500">
                                Due: {payment.dueDate.toLocaleDateString()}
                              </p>
                              {payment.paidAt && (
                                <p className="text-sm text-gray-500">
                                  Paid: {payment.paidAt.toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Badge 
                              variant={payment.status === 'completed' ? 'default' : 'secondary'}
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="claims" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Claims History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {policy.claims.map((claim) => (
                          <div key={claim.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-medium">{claim.description}</p>
                                <p className="text-sm text-gray-500">
                                  {claim.facility} • {claim.date.toLocaleDateString()}
                                </p>
                              </div>
                              <Badge 
                                variant={claim.status === 'approved' ? 'default' : 'secondary'}
                              >
                                {claim.status}
                              </Badge>
                            </div>
                            <p className="text-lg font-semibold text-green-600">
                              ${claim.amount.toLocaleString()} covered
                            </p>
                          </div>
                        ))}
                        {policy.claims.length === 0 && (
                          <p className="text-gray-500 text-center py-8">No claims filed</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="w-5 h-5 mr-2" />
                        Policy Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {policy.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center">
                              <FileText className="w-8 h-8 text-gray-400 mr-3" />
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-sm text-gray-500">
                                  Uploaded {formatDistanceToNow(doc.uploadedAt, { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Policy Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Policy Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status</span>
                      <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                        {policy.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Days Remaining</span>
                      <span className="font-medium">
                        {Math.ceil((policy.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Claims Used</span>
                      <span className="font-medium">{policy.claims.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Customer
                  </Button>
                  <Button className="w-full" variant="outline">
                    Send Policy Docs
                  </Button>
                  <Button className="w-full" variant="outline">
                    Process Payment
                  </Button>
                  <Button className="w-full">
                    File New Claim
                  </Button>
                  <Button className="w-full" variant="destructive">
                    Cancel Policy
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Paid</span>
                      <span className="font-medium">
                        ${policy.payments.filter(p => p.status === 'completed').length * policy.coverage.monthlyPayment}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Total Claims</span>
                      <span className="font-medium">
                        ${policy.claims.reduce((sum, claim) => sum + claim.amount, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <span className="text-sm font-medium">Net Value</span>
                      <span className="font-semibold text-green-600">
                        ${(policy.claims.reduce((sum, claim) => sum + claim.amount, 0) - 
                          (policy.payments.filter(p => p.status === 'completed').length * policy.coverage.monthlyPayment)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

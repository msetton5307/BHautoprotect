import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, User, Car, Activity, Phone, Mail, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { clearCredentials, fetchWithAuth, getAuthHeaders } from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";

// Helper to include JSON content type with auth header
const authJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export default function AdminLeadDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    plan: 'gold',
    deductible: 500,
    termMonths: 36,
    priceTotal: 299900, // $2999.00
    priceMonthly: 8331, // $83.31
  });
  const [policyForm, setPolicyForm] = useState({
    package: '',
    expirationMiles: '',
    expirationDate: '',
    deductible: '',
    totalPremium: '',
    downPayment: '',
    policyStartDate: '',
    monthlyPayment: '',
    totalPayments: '',
  });
  const [vehicleForm, setVehicleForm] = useState<any>({});
  const [newNote, setNewNote] = useState('');
  const [leadForm, setLeadForm] = useState<any>({});

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['/api/admin/leads', id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        headers: getAuthHeaders()
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch lead');
      return res.json();
    },
    enabled: authenticated && !!id,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: authJsonHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to update lead');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (quoteData: any) => {
      const res = await fetch(`/api/leads/${id}/coverage`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          plan: quoteData.plan,
          deductible: quoteData.deductible,
          termMonths: quoteData.termMonths,
          priceMonthly: quoteData.priceMonthly / 100,
        }),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to create quote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      setIsCreatingQuote(false);
      setQuoteForm({
        plan: 'gold',
        deductible: 500,
        termMonths: 36,
        priceTotal: 299900,
        priceMonthly: 8331,
      });
      toast({
        title: "Success",
        description: "Quote created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const convertLeadMutation = useMutation({
    mutationFn: async (policyData: any) => {
      const response = await fetchWithAuth(`/api/admin/leads/${id}/convert`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(policyData),
      });
      if (response.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.message ?? 'Failed to convert lead';
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/policies'] });
      toast({
        title: 'Success',
        description: 'Lead converted to policy',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to convert lead',
        variant: 'destructive',
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetchWithAuth(`/api/admin/leads/${id}/notes`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) {
        clearCredentials();
        markLoggedOut();
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to add note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      setNewNote('');
      toast({
        title: 'Success',
        description: 'Note added',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (leadData?.data?.lead) {
      setLeadForm(leadData.data.lead);
    }
    if (leadData?.data?.vehicle) {
      const v = leadData.data.vehicle;
      setVehicleForm({
        ...v,
        year: v.year?.toString(),
        odometer: v.odometer?.toString(),
      });
    }
    if (leadData?.data?.policy) {
      const p = leadData.data.policy;
      setPolicyForm({
        package: p.package || '',
        expirationMiles: p.expirationMiles?.toString() || '',
        expirationDate: p.expirationDate ? p.expirationDate.slice(0, 10) : '',
        deductible: p.deductible?.toString() || '',
        totalPremium: p.totalPremium?.toString() || '',
        downPayment: p.downPayment?.toString() || '',
        policyStartDate: p.policyStartDate ? p.policyStartDate.slice(0, 10) : '',
        monthlyPayment: p.monthlyPayment?.toString() || '',
        totalPayments: p.totalPayments?.toString() || '',
      });
    }
  }, [leadData]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!leadData?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead Not Found</h2>
          <Button asChild>
            <Link href="/admin/leads">Back to Leads</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { quotes, notes, policy: existingPolicy } = leadData.data;
  const hasPolicy = Boolean(existingPolicy);
  const convertButtonDisabled = convertLeadMutation.isPending || hasPolicy;
  const convertButtonLabel = hasPolicy
    ? 'Policy Created'
    : convertLeadMutation.isPending
      ? 'Converting...'
      : 'Convert to Policy';

  const handleConvert = () => {
    if (hasPolicy) return;
    convertLeadMutation.mutate(policyForm);
  };

  const handleCreateQuote = () => {
    createQuoteMutation.mutate(quoteForm);
  };

  const handleSave = () => {
    const { id: _id, ...leadUpdates } = leadForm;
    const vehiclePayload = { ...vehicleForm } as any;
    ['year', 'odometer'].forEach((key) => {
      if (vehiclePayload[key] === '' || vehiclePayload[key] === undefined) {
        delete vehiclePayload[key];
      } else {
        vehiclePayload[key] = Number(vehiclePayload[key]);
      }
    });

    const policyPayload = { ...policyForm } as any;
    ['expirationMiles','deductible','totalPremium','downPayment','monthlyPayment','totalPayments'].forEach((key) => {
      if (policyPayload[key] === '' || policyPayload[key] === undefined) {
        delete policyPayload[key];
      } else {
        policyPayload[key] = Number(policyPayload[key]);
      }
    });
    if (!policyPayload.expirationDate) delete policyPayload.expirationDate;
    if (!policyPayload.policyStartDate) delete policyPayload.policyStartDate;

    const payload: any = { ...leadUpdates };
    if (Object.keys(vehiclePayload).length > 0) payload.vehicle = vehiclePayload;
    if (Object.keys(policyPayload).length > 0) payload.policy = policyPayload;
    updateLeadMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="mr-4" asChild>
                <Link href="/admin/leads">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Leads
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {leadForm.firstName} {leadForm.lastName}
                </h1>
                <p className="text-gray-600">Lead Details & Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <a
                  href={`https://americancarprotect.com/vsp/send_quote_email_api.php?api_key=Kzy!MaaBCha4&leadid=${id}&uid=45`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send Quote
                </a>
              </Button>
              <Button
                size="sm"
                onClick={handleConvert}
                disabled={convertButtonDisabled}
              >
                {convertButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-end mb-4">
          <Button onClick={handleSave} disabled={updateLeadMutation.isPending}>
            {updateLeadMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({quotes?.length || 0})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Accordion type="single" collapsible defaultValue="lead">
                <AccordionItem value="lead">
                  <AccordionTrigger className="flex items-center">
                    <span className="mr-2"><User className="h-5 w-5" /></span>
                    Lead Information
                  </AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div>
                        <Label>ID</Label>
                        <Input value={leadForm.id || ''} readOnly />
                        <input type="hidden" value={leadForm.id} />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={leadForm.status}
                          onValueChange={(value) =>
                            setLeadForm({ ...leadForm, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="--- Please Select ---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="quoted">Quoted</SelectItem>
                            <SelectItem value="callback">Callback</SelectItem>
                            <SelectItem value="left-message">Left Message</SelectItem>
                            <SelectItem value="no-contact">No Contact</SelectItem>
                            <SelectItem value="wrong-number">Wrong Number</SelectItem>
                            <SelectItem value="fake-lead">Fake Lead</SelectItem>
                            <SelectItem value="not-interested">Not Interested</SelectItem>
                            <SelectItem value="duplicate-lead">Duplicate Lead</SelectItem>
                            <SelectItem value="dnc">DNC</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name</Label>
                          <Input
                            value={leadForm.firstName || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, firstName: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input
                            value={leadForm.lastName || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, lastName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          <Input
                            value={leadForm.email || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, email: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          <Input
                            value={leadForm.phone || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, phone: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone Type</Label>
                        <Input
                          value={leadForm.phoneType || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, phoneType: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Shipping Address (Line 1)</Label>
                        <Input
                          value={leadForm.shippingAddress || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, shippingAddress: e.target.value })
                          }
                        />
                        <input type="hidden" value={leadForm.shippingAddress2 || ''} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Shipping City</Label>
                          <Input
                            value={leadForm.shippingCity || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, shippingCity: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Shipping State</Label>
                          <Input
                            value={leadForm.shippingState || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, shippingState: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Shipping Zipcode</Label>
                          <Input
                            value={leadForm.shippingZip || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, shippingZip: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Billing Address (Line 1)</Label>
                        <Input
                          value={leadForm.billingAddress || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, billingAddress: e.target.value })
                          }
                        />
                        <input type="hidden" value={leadForm.billingAddress2 || ''} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Billing City</Label>
                          <Input
                            value={leadForm.billingCity || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, billingCity: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Billing State</Label>
                          <Input
                            value={leadForm.billingState || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, billingState: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Billing Zipcode</Label>
                          <Input
                            value={leadForm.billingZip || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, billingZip: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Newsletter</Label>
                        <Select
                          value={leadForm.newsletter ? 'Yes' : 'No'}
                          onValueChange={(value) =>
                            setLeadForm({ ...leadForm, newsletter: value === 'Yes' })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Referrer</Label>
                        <Input
                          value={leadForm.referrer || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, referrer: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>UID</Label>
                          <Input
                            value={leadForm.uid || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, uid: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>IP Address</Label>
                          <Input
                            value={leadForm.ipAddress || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, ipAddress: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Sales Person</Label>
                        <Input
                          value={leadForm.salespersonUserId || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, salespersonUserId: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Date Created</Label>
                          <Input
                            value={leadForm.dateCreated || leadForm.createdAt || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, dateCreated: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Last Updated</Label>
                          <Input
                            value={leadForm.lastUpdated || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, lastUpdated: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Sent to Vanillasoft</Label>
                        <Input
                          value={leadForm.sentToVanillasoft ? 'Yes' : 'No'}
                          onChange={(e) =>
                            setLeadForm({
                              ...leadForm,
                              sentToVanillasoft: e.target.value === 'Yes',
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>SID</Label>
                          <Input
                            value={leadForm.sid || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, sid: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>SID2</Label>
                          <Input
                            value={leadForm.sid2 || ''}
                            onChange={(e) =>
                              setLeadForm({ ...leadForm, sid2: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Converted By</Label>
                        <Input
                          value={leadForm.convertedBy || ''}
                          onChange={(e) =>
                            setLeadForm({ ...leadForm, convertedBy: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion type="multiple" className="space-y-4" defaultValue={["policy", "vehicle", "notes"]}>
                <AccordionItem value="policy">
                  <AccordionTrigger>Policy Information</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Package</Label>
                          <Select
                            value={policyForm.package}
                            onValueChange={(value) => setPolicyForm({ ...policyForm, package: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="--- Please Select ---" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="bronze">Bronze</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Expiration Miles</Label>
                          <Input
                            value={policyForm.expirationMiles}
                            onChange={(e) => setPolicyForm({ ...policyForm, expirationMiles: e.target.value })}
                            placeholder="Expiration Miles"
                          />
                        </div>
                        <div>
                          <Label>Expiration Date</Label>
                          <Input
                            type="date"
                            value={policyForm.expirationDate}
                            onChange={(e) => setPolicyForm({ ...policyForm, expirationDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Deductible</Label>
                          <Input
                            value={policyForm.deductible}
                            onChange={(e) => setPolicyForm({ ...policyForm, deductible: e.target.value })}
                            placeholder="Deductible"
                          />
                        </div>
                        <div>
                          <Label>Total Premium</Label>
                          <Input
                            value={policyForm.totalPremium}
                            onChange={(e) => setPolicyForm({ ...policyForm, totalPremium: e.target.value })}
                            placeholder="Total Premium"
                          />
                        </div>
                        <div>
                          <Label>Down Payment</Label>
                          <Input
                            value={policyForm.downPayment}
                            onChange={(e) => setPolicyForm({ ...policyForm, downPayment: e.target.value })}
                            placeholder="Down Payment"
                          />
                        </div>
                        <div>
                          <Label>Policy Start Date</Label>
                          <Input
                            type="date"
                            value={policyForm.policyStartDate}
                            onChange={(e) => setPolicyForm({ ...policyForm, policyStartDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Monthly Payment</Label>
                          <Input
                            value={policyForm.monthlyPayment}
                            onChange={(e) => setPolicyForm({ ...policyForm, monthlyPayment: e.target.value })}
                            placeholder="Monthly Payment"
                          />
                        </div>
                        <div>
                          <Label>Total Payments</Label>
                          <Input
                            value={policyForm.totalPayments}
                            onChange={(e) => setPolicyForm({ ...policyForm, totalPayments: e.target.value })}
                            placeholder="Total Payments"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleConvert}
                        disabled={convertButtonDisabled}
                      >
                        {convertButtonLabel}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="vehicle">
                  <AccordionTrigger>Vehicle Information</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    {Object.keys(vehicleForm).length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Year</Label>
                            <Input
                              value={vehicleForm.year || ''}
                              onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Make</Label>
                            <Input
                              value={vehicleForm.make || ''}
                              onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Model</Label>
                          <Input
                            value={vehicleForm.model || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Mileage</Label>
                          <Input
                            value={vehicleForm.odometer || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, odometer: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Vin</Label>
                          <Input
                            value={vehicleForm.vin || ''}
                            onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Registered State</Label>
                          <Input
                            value={leadForm.state || ''}
                            onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No vehicle information available</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="notes">
                  <AccordionTrigger>Notes</AccordionTrigger>
                  <AccordionContent className="overflow-visible">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {notes && notes.length > 0 ? (
                          notes.map((note: any) => (
                            <div key={note.id} className="border rounded p-2 text-sm">
                              {note.content}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No notes yet</div>
                        )}
                      </div>
                      <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a new note"
                      />
                      <Button
                        onClick={() => addNoteMutation.mutate(newNote)}
                        disabled={addNoteMutation.isPending || !newNote.trim()}
                      >
                        {addNoteMutation.isPending ? 'Saving...' : 'Add Note'}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

          </TabsContent>

          <TabsContent value="quotes" className="space-y-6">
            {/* Create Quote */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Create New Quote
                  </span>
                  <Button 
                    onClick={() => setIsCreatingQuote(!isCreatingQuote)}
                    variant={isCreatingQuote ? "outline" : "default"}
                  >
                    {isCreatingQuote ? 'Cancel' : 'New Quote'}
                  </Button>
                </CardTitle>
              </CardHeader>
              {isCreatingQuote && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Plan Type</Label>
                      <Select
                        value={quoteForm.plan}
                        onValueChange={(value) => setQuoteForm({...quoteForm, plan: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="bronze">Bronze</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Deductible</Label>
                      <Select
                        value={quoteForm.deductible.toString()}
                        onValueChange={(value) => setQuoteForm({...quoteForm, deductible: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="250">$250</SelectItem>
                          <SelectItem value="500">$500</SelectItem>
                          <SelectItem value="1000">$1,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Term (Months)</Label>
                      <Select
                        value={quoteForm.termMonths.toString()}
                        onValueChange={(value) => setQuoteForm({...quoteForm, termMonths: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 months</SelectItem>
                          <SelectItem value="36">36 months</SelectItem>
                          <SelectItem value="48">48 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Total Price ($)</Label>
                      <Input
                        type="number"
                        value={quoteForm.priceTotal / 100}
                        onChange={(e) => setQuoteForm({...quoteForm, priceTotal: Math.round(parseFloat(e.target.value) * 100)})}
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Monthly Price ($)</Label>
                      <Input
                        type="number"
                        value={quoteForm.priceMonthly / 100}
                        onChange={(e) => setQuoteForm({...quoteForm, priceMonthly: Math.round(parseFloat(e.target.value) * 100)})}
                        step="0.01"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateQuote}
                    disabled={createQuoteMutation.isPending}
                    className="w-full"
                  >
                    {createQuoteMutation.isPending ? 'Creating...' : 'Create Quote'}
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Existing Quotes */}
            <Card>
              <CardHeader>
                <CardTitle>Quote History</CardTitle>
                <CardDescription>All quotes for this lead</CardDescription>
              </CardHeader>
              <CardContent>
                {quotes && quotes.length > 0 ? (
                  <div className="space-y-4">
                    {quotes.map((quote: any) => (
                      <div key={quote.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium capitalize">{quote.plan} Plan</h4>
                            <p className="text-sm text-gray-500">
                              Created {new Date(quote.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline">{quote.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Total:</span> ${(quote.priceTotal / 100).toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Monthly:</span> ${(quote.priceMonthly / 100).toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">Deductible:</span> ${quote.deductible}
                          </div>
                          <div>
                            <span className="font-medium">Term:</span> {quote.termMonths} months
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No quotes created yet. Click "New Quote" to create the first quote.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Activity Timeline
                </CardTitle>
                <CardDescription>All activities and interactions for this lead</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Lead Created</p>
                      <p className="text-sm text-gray-500">
                        Lead submitted quote request • {new Date(leadForm.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {quotes?.map((quote: any) => (
                    <div key={quote.id} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium">Quote Created</p>
                        <p className="text-sm text-gray-500">
                          {quote.plan} plan quote for ${(quote.priceTotal / 100).toFixed(2)} • {new Date(quote.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
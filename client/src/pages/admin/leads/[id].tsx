import { useState } from "react";
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

// Helper function to set basic auth header
const getAuthHeaders = () => ({
  Authorization: 'Basic ' + btoa('admin:password'),
  'Content-Type': 'application/json',
});

export default function AdminLeadDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  const [newNote, setNewNote] = useState('');

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['/api/admin/leads', id],
    queryFn: () => 
      fetch(`/api/admin/leads/${id}`, { 
        headers: getAuthHeaders() 
      }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch lead');
        return res.json();
      }),
    enabled: !!id,
  });

  const updateLeadMutation = useMutation({
    mutationFn: (updates: any) =>
      fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update lead');
        return res.json();
      }),
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
    mutationFn: (quoteData: any) =>
      fetch(`/api/admin/leads/${id}/quotes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(quoteData),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to create quote');
        return res.json();
      }),
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
    mutationFn: (policyData: any) =>
      fetch(`/api/admin/leads/${id}/convert`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(policyData),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to convert lead');
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads', id] });
      toast({
        title: 'Success',
        description: 'Lead converted to policy',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to convert lead',
        variant: 'destructive',
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(`/api/admin/leads/${id}/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content }),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to add note');
        return res.json();
      }),
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

  const { lead, vehicle, quotes, notes } = leadData.data;

  const handleCreateQuote = () => {
    createQuoteMutation.mutate(quoteForm);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                  {lead.firstName} {lead.lastName}
                </h1>
                <p className="text-gray-600">Lead Details & Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={
                lead.stage === 'new' ? 'default' :
                lead.stage === 'contacted' ? 'secondary' :
                lead.stage === 'quoted' ? 'destructive' :
                'outline'
              }>
                {lead.stage}
              </Badge>
              <Badge variant={
                lead.priority === 'urgent' ? 'destructive' :
                lead.priority === 'high' ? 'default' :
                'outline'
              }>
                {lead.priority} priority
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({quotes?.length || 0})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input value={lead.firstName || ''} readOnly />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input value={lead.lastName || ''} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <Input value={lead.email || 'Not provided'} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <Input value={lead.phone || 'Not provided'} readOnly />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ZIP Code</Label>
                    <Input value={lead.zip || ''} readOnly />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={lead.state || ''} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Source</Label>
                  <Input value={lead.source || 'web'} readOnly />
                </div>
              </CardContent>
            </Card>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="policy">
                <AccordionTrigger>Policy Information</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Package</Label>
                        <Input
                          value={policyForm.package}
                          onChange={(e) => setPolicyForm({ ...policyForm, package: e.target.value })}
                          placeholder="--- Please Select ---"
                        />
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
                      onClick={() => convertLeadMutation.mutate(policyForm)}
                      disabled={convertLeadMutation.isPending}
                    >
                      {convertLeadMutation.isPending ? 'Converting...' : 'Convert to Policy'}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="vehicle">
                <AccordionTrigger>Vehicle Information</AccordionTrigger>
                <AccordionContent>
                  {vehicle ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Year</Label>
                          <Input value={vehicle.year} readOnly />
                        </div>
                        <div>
                          <Label>Make</Label>
                          <Input value={vehicle.make} readOnly />
                        </div>
                      </div>
                      <div>
                        <Label>Model</Label>
                        <Input value={vehicle.model} readOnly />
                      </div>
                      <div>
                        <Label>Mileage</Label>
                        <Input value={`${vehicle.odometer.toLocaleString()}`} readOnly />
                      </div>
                      {vehicle.vin && (
                        <div>
                          <Label>Vin</Label>
                          <Input value={vehicle.vin} readOnly />
                        </div>
                      )}
                      <div>
                        <Label>Registered State</Label>
                        <Input value={lead.state || ''} readOnly />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No vehicle information available</div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notes">
                <AccordionTrigger>Notes</AccordionTrigger>
                <AccordionContent>
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

            {/* Lead Management */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Management</CardTitle>
                <CardDescription>Update lead status</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Stage</Label>
                  <Select
                    value={lead.stage}
                    onValueChange={(value) => updateLeadMutation.mutate({ stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="closed-won">Closed Won</SelectItem>
                      <SelectItem value="closed-lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={lead.priority}
                    onValueChange={(value) => updateLeadMutation.mutate({ priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
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
                          <SelectItem value="powertrain">Powertrain</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="platinum">Platinum</SelectItem>
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
                        Lead submitted quote request • {new Date(lead.createdAt).toLocaleDateString()}
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
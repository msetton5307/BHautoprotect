import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AdminNav from "@/components/admin-nav";
import { getAuthHeaders } from "@/lib/auth";
import { Link } from "wouter";
import { Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPolicies() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/policies'],
    queryFn: () =>
      fetch('/api/admin/policies', { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch policies');
        return res.json();
      })
  });

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericValue);
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return 'TBD';
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? 'TBD' : parsed.toLocaleDateString();
  };

  const buildEmailTemplate = (policy: any) => {
    const name = getPolicyHolderName(policy);
    const displayName = name || 'there';
    const policyPackage = policy.package ? policy.package.charAt(0).toUpperCase() + policy.package.slice(1) : 'Vehicle Protection';
    const vehicleDescription = policy.vehicle
      ? `${policy.vehicle.year ?? ''} ${policy.vehicle.make ?? ''} ${policy.vehicle.model ?? ''}`.trim() || 'your vehicle'
      : 'your vehicle';

    const templateSubject = `Your ${policyPackage} Policy Details`;
    const templateBody = `Hi ${displayName},

Thank you for choosing BHAutoProtect. Here are the latest details for your policy:

Policy ID: ${policy.id}
Package: ${policyPackage}
Vehicle: ${vehicleDescription}
Policy Start Date: ${formatDate(policy.policyStartDate)}
Expiration Date: ${formatDate(policy.expirationDate)}
Expiration Miles: ${policy.expirationMiles ?? 'TBD'}
Deductible: ${formatCurrency(policy.deductible)}
Total Premium: ${formatCurrency(policy.totalPremium)}
Down Payment: ${formatCurrency(policy.downPayment)}
Monthly Payment: ${formatCurrency(policy.monthlyPayment)}
Total Payments: ${formatCurrency(policy.totalPayments)}

If anything looks incorrect or if you have questions, reply to this email or call us and we'll be happy to help.

Thank you,
BHAutoProtect Team`;

    return { subject: templateSubject, body: templateBody };
  };

  const openEmailDialog = (policy: any) => {
    setSelectedPolicy(policy);
    setEmailRecipient(policy.lead?.email || '');
    const template = buildEmailTemplate(policy);
    setEmailSubject(template.subject);
    setEmailBody(template.body);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedPolicy) {
      toast({
        title: 'No policy selected',
        description: 'Select a policy before sending an email.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedRecipient = emailRecipient.trim();
    if (!trimmedRecipient) {
      toast({
        title: 'Recipient required',
        description: 'Please provide an email address before sending.',
        variant: 'destructive',
      });
      return;
    }

    if (!emailSubject.trim()) {
      toast({
        title: 'Subject required',
        description: 'Please provide a subject before sending.',
        variant: 'destructive',
      });
      return;
    }

    if (!emailBody.trim()) {
      toast({
        title: 'Message required',
        description: 'Please provide a message before sending.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch(`/api/admin/policies/${selectedPolicy.id}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          to: trimmedRecipient,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      if (!response.ok) {
        let message = 'Failed to send email';
        try {
          const data = await response.json();
          if (typeof data?.message === 'string') {
            message = data.message;
          }
        } catch (error) {
          // no-op: fall back to default message
        }
        throw new Error(message);
      }

      toast({
        title: 'Email sent',
        description: 'The policy email has been sent to the recipient.',
      });
      setEmailDialogOpen(false);
      setSelectedPolicy(null);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to send email';
      toast({
        title: 'Email failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
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
                    <TableRow key={policy.id}>
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
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEmailDialog(policy)}>
                            Send Email
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/policies/${policy.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </div>
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
            <Dialog
              open={emailDialogOpen}
              onOpenChange={(open) => {
                setEmailDialogOpen(open);
                if (!open) {
                  setSelectedPolicy(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Policy Email</DialogTitle>
                  <DialogDescription>
                    Customize the template below before sending it to {selectedPolicy ? getPolicyHolderName(selectedPolicy) || 'the customer' : 'the customer'}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="policy-email-recipient">To</Label>
                    <Input
                      id="policy-email-recipient"
                      placeholder="customer@example.com"
                      value={emailRecipient}
                      onChange={(event) => setEmailRecipient(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="policy-email-subject">Subject</Label>
                    <Input
                      id="policy-email-subject"
                      value={emailSubject}
                      onChange={(event) => setEmailSubject(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="policy-email-body">Email Body</Label>
                    <Textarea
                      id="policy-email-body"
                      rows={10}
                      value={emailBody}
                      onChange={(event) => setEmailBody(event.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEmailDialogOpen(false);
                      setSelectedPolicy(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                    {isSendingEmail ? 'Sending...' : 'Send Email'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminNav from "@/components/admin-nav";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const CUSTOM_TEMPLATE_ID = "custom";

type EmailTemplateRecord = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

type TemplateOption = EmailTemplateRecord & { source: "default" | "saved" };

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "N/A";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "N/A";
  return parsed.toLocaleDateString();
};

const getPolicyHolderName = (policy: any): string => {
  if (!policy?.lead) return "";
  return `${policy.lead.firstName ?? ""} ${policy.lead.lastName ?? ""}`.trim();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeHtmlForPreview = (value: string): string =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .trim();

const buildDefaultEmailTemplate = (policy: any): EmailTemplateRecord => {
  const name = getPolicyHolderName(policy);
  const displayName = name || "there";
  const policyPackage = policy?.package
    ? `${policy.package.charAt(0).toUpperCase()}${policy.package.slice(1)}`
    : "Vehicle Protection";
  const subject = `Your ${policyPackage} Coverage Summary`;
  const vehicle = policy?.vehicle;
  const vehicleSummary = vehicle
    ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.replace(/\s+/g, " ").trim() ||
      "your vehicle"
    : "your vehicle";

  const coverageRows = [
    { label: "Policy ID", value: policy?.id ?? "N/A" },
    { label: "Coverage Package", value: policyPackage },
    { label: "Effective Date", value: formatDate(policy?.policyStartDate) },
    { label: "Expiration Date", value: formatDate(policy?.expirationDate) },
    { label: "Expiration Miles", value: policy?.expirationMiles != null ? String(policy.expirationMiles) : "N/A" },
    { label: "Deductible", value: formatCurrency(policy?.deductible) },
    { label: "Total Premium", value: formatCurrency(policy?.totalPremium) },
  ];

  const vehicleRows = [
    { label: "Vehicle", value: vehicleSummary },
    { label: "VIN", value: vehicle?.vin || "On file" },
    {
      label: "Odometer",
      value:
        vehicle?.odometer != null && !Number.isNaN(Number(vehicle.odometer))
          ? `${vehicle.odometer} miles`
          : "On file",
    },
  ];

  const paymentRows = [
    { label: "Down Payment", value: formatCurrency(policy?.downPayment) },
    { label: "Monthly Payment", value: formatCurrency(policy?.monthlyPayment) },
    { label: "Total Payments", value: formatCurrency(policy?.totalPayments) },
  ];

  const renderDetailRows = (rows: { label: string; value: string }[]) =>
    rows
      .map((row, index) => {
        const border = index === rows.length - 1 ? "" : "border-bottom:1px solid #e5e7eb;";
        return `
          <tr>
            <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1f2937;${border}">
              ${escapeHtml(row.label)}
            </td>
            <td style="padding:14px 20px;font-size:14px;color:#334155;text-align:right;${border}">
              ${escapeHtml(row.value)}
            </td>
          </tr>
        `;
      })
      .join("");

  const renderCompactRows = (rows: { label: string; value: string }[]) =>
    rows
      .map((row, index) => {
        const border = index === rows.length - 1 ? "" : "border-bottom:1px solid #e5e7eb;";
        return `
          <tr>
            <td style="padding:12px 18px;font-size:13px;font-weight:600;color:#1f2937;${border}">
              ${escapeHtml(row.label)}
            </td>
            <td style="padding:12px 18px;font-size:13px;color:#334155;text-align:right;${border}">
              ${escapeHtml(row.value)}
            </td>
          </tr>
        `;
      })
      .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <title>${escapeHtml(subject)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px;max-width:94%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BHAUTOPROTECT</div>
              <div style="font-size:24px;font-weight:700;margin-top:10px;">${escapeHtml(policyPackage)} Coverage Update</div>
              <div style="margin-top:12px;font-size:14px;opacity:0.85;">Policy ID • ${escapeHtml(policy?.id ?? "N/A")}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                Thank you for choosing <strong>BHAutoProtect</strong>. Below is a polished summary of your coverage so you always know exactly what is protected.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:12px;overflow:hidden;background-color:#f9fafb;border:1px solid #e5e7eb;margin-bottom:28px;">
                <tbody>
                  ${renderDetailRows(coverageRows)}
                </tbody>
              </table>
              <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background-color:#ffffff;min-width:240px;">
                  <tbody>
                    ${renderCompactRows(vehicleRows)}
                  </tbody>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background-color:#ffffff;min-width:240px;">
                  <tbody>
                    ${renderCompactRows(paymentRows)}
                  </tbody>
                </table>
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                Need to update something or start a claim? Reply to this email and our concierge team will jump in immediately to help.
              </p>
              <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
                <strong>Quick tip:</strong> Keep this message handy so your coverage information is always just a tap away.
              </div>
              <p style="margin:0;font-size:15px;line-height:1.7;">With gratitude,<br /><strong>The BHAutoProtect Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:22px 32px;color:#6b7280;font-size:12px;line-height:1.6;">
              You’re receiving this email because you are part of the BHAutoProtect family. If any detail looks off, reply to this message and we’ll make it right immediately.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { id: "default", name: "Standard Policy Update", subject, bodyHtml: html };
};
export default function AdminPolicyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ data: any }>({
    queryKey: ["/api/admin/policies", id],
    queryFn: () =>
      fetch(`/api/admin/policies/${id}`, { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error("Failed to fetch policy");
        return res.json();
      }),
    enabled: !!id,
  });

  const {
    data: templatesResponse,
    isFetching: isFetchingTemplates,
    refetch: refetchTemplates,
  } = useQuery<{ data: EmailTemplateRecord[] }>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: () =>
      fetch("/api/admin/email-templates", { headers: getAuthHeaders() }).then(res => {
        if (!res.ok) throw new Error("Failed to fetch email templates");
        return res.json();
      }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const policy = data?.data;

  if (!policy) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/admin/policies">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Policies
            </Link>
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Policy not found.</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const lead = policy.lead ?? {};
  const vehicle = policy.vehicle ?? {};
  const notes = policy.notes ?? [];
  const files = policy.files ?? [];

  const defaultTemplate = useMemo(() => buildDefaultEmailTemplate(policy), [policy]);
  const savedTemplates = templatesResponse?.data ?? [];

  const templateOptions = useMemo<TemplateOption[]>(() => {
    const options: TemplateOption[] = [];
    if (defaultTemplate) {
      options.push({ ...defaultTemplate, source: "default" });
    }
    for (const template of savedTemplates) {
      options.push({ ...template, source: "saved" });
    }
    return options;
  }, [defaultTemplate, savedTemplates]);

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<string>(lead.email || "");
  const [emailSubject, setEmailSubject] = useState<string>(defaultTemplate.subject);
  const [emailHtml, setEmailHtml] = useState<string>(defaultTemplate.bodyHtml);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate.id);
  const [isTemplateCustomized, setIsTemplateCustomized] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [previewTab, setPreviewTab] = useState<"preview" | "html">("preview");

  const policyHolderName = getPolicyHolderName(policy);

  const previewSource = useMemo(() => {
    const sanitized = sanitizeHtmlForPreview(emailHtml);
    if (sanitized) {
      return sanitized;
    }
    return `<html><body style="font-family:'Helvetica Neue',Arial,sans-serif;padding:24px;color:#1f2937;background:#f8fafc;">
      <h2 style="margin-top:0;font-size:18px;">Your email preview will appear here</h2>
      <p style="font-size:14px;line-height:1.6;">Select a template or start composing in the HTML tab to see a live preview.</p>
    </body></html>`;
  }, [emailHtml]);

  const handleOpenEmailDialog = () => {
    setEmailRecipient(lead.email || "");
    setNewTemplateName("");
    setPreviewTab("preview");

    const firstTemplate = templateOptions[0] ?? defaultTemplate;
    if (firstTemplate) {
      setSelectedTemplateId(firstTemplate.id);
      setEmailSubject(firstTemplate.subject);
      setEmailHtml(firstTemplate.bodyHtml);
      setIsTemplateCustomized(false);
    } else {
      const fallbackSubject = `Policy Update for ${policyHolderName || "you"}`;
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setEmailSubject(fallbackSubject);
      setEmailHtml("");
      setIsTemplateCustomized(true);
    }

    setIsEmailDialogOpen(true);
  };

  const markAsCustom = () => {
    if (!isTemplateCustomized) {
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setIsTemplateCustomized(true);
    }
  };

  const handleTemplateSelect = (value: string) => {
    if (value === CUSTOM_TEMPLATE_ID) {
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setIsTemplateCustomized(true);
      return;
    }
    const template = templateOptions.find(option => option.id === value);
    if (template) {
      setSelectedTemplateId(template.id);
      setEmailSubject(template.subject);
      setEmailHtml(template.bodyHtml);
      setIsTemplateCustomized(false);
    }
  };

  const handleSubjectChange = (value: string) => {
    setEmailSubject(value);
    markAsCustom();
  };

  const handleHtmlChange = (value: string) => {
    setEmailHtml(value);
    markAsCustom();
  };

  const handleSaveTemplate = async () => {
    const trimmedName = newTemplateName.trim();
    const trimmedSubject = emailSubject.trim();
    const trimmedHtml = emailHtml.trim();

    if (!trimmedName) {
      toast({
        title: "Template name required",
        description: "Give the template a friendly name so your team can find it later.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedSubject) {
      toast({
        title: "Subject required",
        description: "Add a subject line before saving your template.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedHtml) {
      toast({
        title: "Email body required",
        description: "Add some HTML content before saving your template.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const response = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: trimmedName, subject: trimmedSubject, bodyHtml: emailHtml }),
      });

      if (!response.ok) {
        let message = "Failed to save template";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const result = (await response.json()) as { data: EmailTemplateRecord };
      await refetchTemplates();

      setSelectedTemplateId(result.data.id);
      setEmailSubject(result.data.subject);
      setEmailHtml(result.data.bodyHtml);
      setIsTemplateCustomized(false);
      setNewTemplateName("");

      toast({
        title: "Template saved",
        description: "The email has been added to your shared template library.",
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to save template";
      toast({
        title: "Could not save template",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSendEmail = async () => {
    const recipients = emailRecipient
      .split(",")
      .map(entry => entry.trim())
      .filter(Boolean);
    const trimmedSubject = emailSubject.trim();
    const trimmedHtml = emailHtml.trim();

    if (recipients.length === 0) {
      toast({
        title: "Recipient required",
        description: "Add at least one email address before sending.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedSubject) {
      toast({
        title: "Subject required",
        description: "Please include a subject line before sending.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedHtml) {
      toast({
        title: "Email body required",
        description: "Add some HTML content before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch(`/api/admin/policies/${policy.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          to: recipients.join(", "),
          subject: trimmedSubject,
          bodyHtml: emailHtml,
        }),
      });

      if (!response.ok) {
        let message = "Failed to send email";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      toast({
        title: "Email sent",
        description: `Your update was sent to ${recipients.join(", ")}`,
      });
      setIsEmailDialogOpen(false);
      setIsTemplateCustomized(false);
      setNewTemplateName("");
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to send email";
      toast({
        title: "Email failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/policies">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Policies
          </Link>
        </Button>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Policy overview</h1>
            <p className="text-sm text-muted-foreground">
              Manage documents, notes, and send beautifully formatted updates in just a few clicks.
            </p>
          </div>
          <Button onClick={handleOpenEmailDialog}>Send policy email</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Policy Details</CardTitle>
            <CardDescription>ID: {policy.id}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div><span className="font-medium">Package:</span> {policy.package || "N/A"}</div>
            <div><span className="font-medium">Policy Start:</span> {policy.policyStartDate ? new Date(policy.policyStartDate).toLocaleDateString() : "N/A"}</div>
            <div><span className="font-medium">Expiration Date:</span> {policy.expirationDate ? new Date(policy.expirationDate).toLocaleDateString() : "N/A"}</div>
            <div><span className="font-medium">Expiration Miles:</span> {policy.expirationMiles ?? "N/A"}</div>
            <div><span className="font-medium">Deductible:</span> {policy.deductible != null ? `$${policy.deductible}` : "N/A"}</div>
            <div><span className="font-medium">Total Premium:</span> {policy.totalPremium != null ? `$${policy.totalPremium}` : "N/A"}</div>
            <div><span className="font-medium">Down Payment:</span> {policy.downPayment != null ? `$${policy.downPayment}` : "N/A"}</div>
            <div><span className="font-medium">Monthly Payment:</span> {policy.monthlyPayment != null ? `$${policy.monthlyPayment}` : "N/A"}</div>
            <div><span className="font-medium">Total Payments:</span> {policy.totalPayments != null ? `$${policy.totalPayments}` : "N/A"}</div>
            <div><span className="font-medium">Created:</span> {new Date(policy.createdAt).toLocaleDateString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div><span className="font-medium">Name:</span> {policyHolderName || "N/A"}</div>
            <div><span className="font-medium">Email:</span> {lead.email || "N/A"}</div>
            <div><span className="font-medium">Phone:</span> {lead.phone || "N/A"}</div>
            <div><span className="font-medium">State:</span> {lead.state || "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div><span className="font-medium">Year:</span> {vehicle.year || "N/A"}</div>
            <div><span className="font-medium">Make:</span> {vehicle.make || "N/A"}</div>
            <div><span className="font-medium">Model:</span> {vehicle.model || "N/A"}</div>
            <div><span className="font-medium">Trim:</span> {vehicle.trim || "N/A"}</div>
            <div><span className="font-medium">VIN:</span> {vehicle.vin || "N/A"}</div>
            <div><span className="font-medium">Odometer:</span> {vehicle.odometer != null ? vehicle.odometer : "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async event => {
                event.preventDefault();
                const form = event.currentTarget;
                const textarea = form.elements.namedItem("note") as HTMLTextAreaElement;
                if (!textarea.value.trim()) {
                  toast({
                    title: "Note required",
                    description: "Write a quick note before saving.",
                    variant: "destructive",
                  });
                  return;
                }
                await fetch(`/api/admin/policies/${policy.id}/notes`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({ content: textarea.value }),
                });
                textarea.value = "";
                queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
              }}
              className="space-y-2"
            >
              <Textarea name="note" className="w-full" placeholder="Add a note" />
              <Button type="submit">Add Note</Button>
            </form>
            <ul className="mt-4 space-y-2">
              {notes.map((note: any) => (
                <li key={note.id} className="border-b pb-2 text-sm">
                  <div>{note.content}</div>
                  <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget as HTMLFormElement);
                const file = formData.get("file") as File | null;
                if (file) {
                  await fetch(`/api/admin/policies/${policy.id}/files`, {
                    method: "POST",
                    headers: { "x-filename": file.name, ...getAuthHeaders() },
                    body: file,
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
                }
                (event.currentTarget as HTMLFormElement).reset();
              }}
              className="space-y-2"
            >
              <Input type="file" name="file" />
              <Button type="submit">Upload File</Button>
            </form>
            <ul className="mt-4 space-y-2">
              {files.map((file: any) => (
                <li key={file.id}>
                  <a className="text-primary underline" href={`/${file.filePath}`} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          setIsEmailDialogOpen(open);
          if (!open) {
            setIsTemplateCustomized(false);
            setNewTemplateName("");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send policy email</DialogTitle>
            <DialogDescription>
              Craft a polished update for {policyHolderName || "the customer"} using the template tools below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="policy-email-recipient">Recipient</Label>
              <Input
                id="policy-email-recipient"
                placeholder="customer@example.com"
                value={emailRecipient}
                onChange={event => setEmailRecipient(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="policy-email-template">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger id="policy-email-template">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                      {option.source === "default" ? " (auto)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_TEMPLATE_ID}>Custom draft</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isFetchingTemplates
                  ? "Loading saved templates..."
                  : "Switch templates to reuse team-approved messaging or choose \"Custom draft\" to write something unique."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="policy-email-subject">Subject</Label>
              <Input
                id="policy-email-subject"
                value={emailSubject}
                onChange={event => handleSubjectChange(event.target.value)}
              />
            </div>
            <div className="grid gap-3">
              <Label>Message</Label>
              <Tabs value={previewTab} onValueChange={value => setPreviewTab(value as "preview" | "html")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="html">HTML source</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  <div className="rounded-md border bg-muted/40">
                    <iframe
                      title="Email preview"
                      sandbox=""
                      srcDoc={previewSource}
                      className="h-[420px] w-full border-0 bg-white"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="html">
                  <Textarea
                    id="policy-email-body"
                    value={emailHtml}
                    onChange={event => handleHtmlChange(event.target.value)}
                    rows={14}
                    className="font-mono text-sm"
                    spellCheck={false}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="policy-email-template-name">Save as template</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="policy-email-template-name"
                  placeholder="Give this template a friendly name"
                  value={newTemplateName}
                  onChange={event => setNewTemplateName(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveTemplate}
                  disabled={
                    isSavingTemplate ||
                    !newTemplateName.trim() ||
                    !emailSubject.trim() ||
                    !emailHtml.trim()
                  }
                >
                  {isSavingTemplate ? "Saving..." : "Save template"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saved templates are shared with your team and appear in the template picker above.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEmailDialogOpen(false);
                setIsTemplateCustomized(false);
                setNewTemplateName("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
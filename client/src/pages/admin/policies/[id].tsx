import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import AdminLogin from "@/components/admin-login";
import { fetchWithAuth, getAuthHeaders, clearCredentials } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import PolicyDocumentRequests from "@/components/admin-policy-document-requests";
import { ArrowLeft } from "lucide-react";

const CUSTOM_TEMPLATE_ID = "custom";

type EmailTemplateRecord = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

type TemplateOption = EmailTemplateRecord & { source: "default" | "saved" };

type PolicyPaymentProfileRecord = {
  id: string;
  paymentMethod: string | null;
  accountName: string | null;
  accountIdentifier: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  billingZip: string | null;
  autopayEnabled: boolean;
  notes: string | null;
  updatedAt?: string | null;
  customer?: { id: string; email: string; displayName?: string | null } | null;
};

type PolicyChargeRecord = {
  id: string;
  policyId: string;
  description: string;
  amountCents: number;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  chargedAt: string;
  notes: string | null;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
};

const formatChargeAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return formatCurrency(value / 100);
};

const formatChargeDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatCardExpiry = (month: number | null | undefined, year: number | null | undefined): string => {
  if (month == null || year == null) return "—";
  const safeMonth = String(month).padStart(2, "0");
  return `${safeMonth}/${year}`;
};

const chargeStatusStyles: Record<PolicyChargeRecord["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  processing: { label: "Processing", className: "border-blue-200 bg-blue-50 text-blue-700" },
  paid: { label: "Paid", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-700" },
  refunded: { label: "Refunded", className: "border-slate-200 bg-slate-100 text-slate-700" },
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

type DetailRow = { label: string; value: string };

const renderDetailRows = (rows: DetailRow[]) =>
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

const renderCompactRows = (rows: DetailRow[]) =>
  rows
    .map((row, index) => {
      const border = index === rows.length - 1 ? "" : "border-bottom:1px solid #e5e7eb;";
      return `
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;${border}">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1f2937;text-align:right;${border}">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `;
    })
    .join("");

const buildEmailLayout = ({
  subject,
  heroTitle,
  heroSubtitle,
  bodyContent,
}: {
  subject: string;
  heroTitle: string;
  heroSubtitle: string;
  bodyContent: string;
}): string => `<!DOCTYPE html>
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
              <div style="font-size:24px;font-weight:700;margin-top:10px;">${escapeHtml(heroTitle)}</div>
              <div style="margin-top:12px;font-size:14px;opacity:0.85;">${escapeHtml(heroSubtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
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

const buildDefaultEmailTemplates = (policy: any): EmailTemplateRecord[] => {
  const name = getPolicyHolderName(policy);
  const displayName = name || "there";
  const policyPackage = policy?.package
    ? `${policy.package.charAt(0).toUpperCase()}${policy.package.slice(1)}`
    : "Vehicle Protection";
  const policyId = policy?.id ?? "N/A";
  const heroSubtitle = `Policy ID • ${policyId}`;
  const vehicle = policy?.vehicle;
  const vehicleSummary = vehicle
    ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.replace(/\s+/g, " ").trim() ||
      "your vehicle"
    : "your vehicle";

  const coverageRows: DetailRow[] = [
    { label: "Policy ID", value: policyId },
    { label: "Coverage Package", value: policyPackage },
    { label: "Effective Date", value: formatDate(policy?.policyStartDate) },
    { label: "Expiration Date", value: formatDate(policy?.expirationDate) },
    { label: "Expiration Miles", value: policy?.expirationMiles != null ? String(policy.expirationMiles) : "N/A" },
    { label: "Deductible", value: formatCurrency(policy?.deductible) },
    { label: "Total Premium", value: formatCurrency(policy?.totalPremium) },
  ];

  const vehicleRows: DetailRow[] = [
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

  const paymentRows: DetailRow[] = [
    { label: "Down Payment", value: formatCurrency(policy?.downPayment) },
    { label: "Monthly Payment", value: formatCurrency(policy?.monthlyPayment) },
    { label: "Total Payments", value: formatCurrency(policy?.totalPayments) },
  ];

  const coverageTables = `
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
  `;

  const templates: EmailTemplateRecord[] = [];

  const policyActivatedSubject = `Your ${policyPackage} Coverage is Activated`;
  const policyActivatedBody = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
      Great news—your <strong>${escapeHtml(policyPackage)}</strong> protection is now active. Here's a quick summary so you can reference your coverage anytime.
    </p>
    ${coverageTables}
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
      Keep this email for your records. If you ever need help, just reply and our concierge team will jump in immediately.
    </p>
    <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
      <strong>Pro tip:</strong> Save our number so support is only a tap away when you need it.
    </div>
    <p style="margin:0;font-size:15px;line-height:1.7;">We're glad to have you with us,<br /><strong>The BHAutoProtect Team</strong></p>
  `;

  templates.push({
    id: "policy-activated",
    name: "Policy activated",
    subject: policyActivatedSubject,
    bodyHtml: buildEmailLayout({
      subject: policyActivatedSubject,
      heroTitle: `${policyPackage} Coverage Activated`,
      heroSubtitle,
      bodyContent: policyActivatedBody,
    }),
  });

  const monthlyPayment = policy?.monthlyPayment != null ? formatCurrency(policy.monthlyPayment) : null;
  const pastDueSubject = "Action Required: Account Past Due";
  const pastDueBody = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
      We noticed the account for your policy ${escapeHtml(policyId)} is past due. ${
        monthlyPayment
          ? `Your regular payment of ${escapeHtml(monthlyPayment)} is still pending.`
          : "A payment on your account still needs attention."
      }
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">To keep every benefit active, please take one of these quick steps:</p>
    <ul style="margin:0 0 20px 20px;padding:0;font-size:15px;line-height:1.7;color:#334155;">
      <li style="margin-bottom:8px;">Reply to this email and let us know the best time to connect.</li>
      <li style="margin-bottom:8px;">Give our concierge team a call so we can walk through payment options together.</li>
      <li>Update your preferred payment method if anything has recently changed.</li>
    </ul>
    <div style="background:linear-gradient(135deg,#dc2626,#f97316);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
      We're ready to help right away—once we hear from you, we'll confirm next steps and send a receipt for your records.
    </div>
    <p style="margin:0;font-size:15px;line-height:1.7;">Thank you for the quick attention,<br /><strong>The BHAutoProtect Team</strong></p>
  `;

  templates.push({
    id: "account-past-due",
    name: "Account past due",
    subject: pastDueSubject,
    bodyHtml: buildEmailLayout({
      subject: pastDueSubject,
      heroTitle: "Account Past Due Notice",
      heroSubtitle,
      bodyContent: pastDueBody,
    }),
  });

  const rimTireSubject = "Rim & Tire Voucher – Up to $150 Toward Repairs";
  const rimTireBody = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
      We’ve set aside up to ${escapeHtml(formatCurrency(150))} to help with rim or tire repairs on your vehicle. Handle the repair wherever you feel most comfortable—we’ll back you up.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">When you’re ready, simply:</p>
    <ul style="margin:0 0 20px 20px;padding:0;font-size:15px;line-height:1.7;color:#334155;">
      <li style="margin-bottom:8px;">Take care of the repair at your preferred shop.</li>
      <li style="margin-bottom:8px;">Hang on to the itemized receipt and a quick note about what was repaired.</li>
      <li>Send the documents back to us so we can confirm reimbursement eligibility right away.</li>
    </ul>
    <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
      Reply to this email with your paperwork whenever you’re ready and we’ll guide you through the final steps.
    </div>
    <p style="margin:0;font-size:15px;line-height:1.7;">We’re standing by to assist,<br /><strong>The BHAutoProtect Team</strong></p>
  `;

  templates.push({
    id: "rim-tire-voucher",
    name: "Rim and tire voucher $150",
    subject: rimTireSubject,
    bodyHtml: buildEmailLayout({
      subject: rimTireSubject,
      heroTitle: "Rim & Tire Voucher Available",
      heroSubtitle,
      bodyContent: rimTireBody,
    }),
  });

  const maintenanceSubject = "Maintenance Voucher – $200 Toward Service";
  const maintenanceBody = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
      A maintenance voucher worth ${escapeHtml(formatCurrency(200))} is now available for routine service like oil changes or inspections. Use it wherever you already trust your vehicle.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">To make everything smooth:</p>
    <ul style="margin:0 0 20px 20px;padding:0;font-size:15px;line-height:1.7;color:#334155;">
      <li style="margin-bottom:8px;">Schedule service with any licensed repair facility.</li>
      <li style="margin-bottom:8px;">Keep the detailed invoice that shows what was completed.</li>
      <li>Share the paperwork with us so we can wrap up the reimbursement quickly.</li>
    </ul>
    <div style="background:linear-gradient(135deg,#16a34a,#22c55e);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
      Send everything over by replying to this message—our team will take it from there.
    </div>
    <p style="margin:0;font-size:15px;line-height:1.7;">Talk soon,<br /><strong>The BHAutoProtect Team</strong></p>
  `;

  templates.push({
    id: "maintenance-voucher",
    name: "Maintenance voucher $200",
    subject: maintenanceSubject,
    bodyHtml: buildEmailLayout({
      subject: maintenanceSubject,
      heroTitle: "Maintenance Voucher Ready",
      heroSubtitle,
      bodyContent: maintenanceBody,
    }),
  });

  return templates;
};
export default function AdminPolicyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticated, checking, markAuthenticated, markLoggedOut } = useAdminAuth();
  const baseQueriesEnabled = authenticated && !checking;
  const policyQueriesEnabled = baseQueriesEnabled && !!id;

  const ensureAuthorized = (res: Response) => {
    if (res.status === 401) {
      clearCredentials();
      markLoggedOut();
      throw new Error("Your session has expired. Please sign in again.");
    }
  };

  const { data, isLoading } = useQuery<{ data: any }>({
    queryKey: ["/api/admin/policies", id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/policies/${id}`, { headers: getAuthHeaders() });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("Failed to fetch policy");
      return res.json();
    },
    enabled: policyQueriesEnabled,
  });

  const { data: paymentProfilesResponse, isLoading: isLoadingPaymentProfiles } = useQuery<{
    data?: { paymentProfiles?: PolicyPaymentProfileRecord[] };
  }>({
    queryKey: ["/api/admin/policies", id, "payment-profiles"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/policies/${id}/payment-profiles`, { headers: getAuthHeaders() });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("Failed to fetch payment profiles");
      return res.json();
    },
    enabled: policyQueriesEnabled,
  });

  const { data: chargesResponse, isLoading: isLoadingCharges } = useQuery<{
    data?: { charges?: PolicyChargeRecord[] };
  }>({
    queryKey: ["/api/admin/policies", id, "charges"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/policies/${id}/charges`, { headers: getAuthHeaders() });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("Failed to fetch policy charges");
      return res.json();
    },
    enabled: policyQueriesEnabled,
  });

  const {
    data: templatesResponse,
    isFetching: isFetchingTemplates,
    refetch: refetchTemplates,
  } = useQuery<{ data: EmailTemplateRecord[] }>({
    queryKey: ["/api/admin/email-templates"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/email-templates", { headers: getAuthHeaders() });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("Failed to fetch email templates");
      return res.json();
    },
    enabled: baseQueriesEnabled,
  });

  const policy = data?.data ?? null;
  const lead = policy?.lead ?? {};
  const leadEmail = typeof lead.email === "string" ? lead.email : "";
  const vehicle = policy?.vehicle ?? {};
  const notes = policy?.notes ?? [];
  const files = policy?.files ?? [];
  const paymentProfiles = useMemo(() => {
    const records = paymentProfilesResponse?.data?.paymentProfiles ?? [];
    return [...records].sort((a, b) => {
      const left = a.updatedAt ? new Date(a.updatedAt).valueOf() : 0;
      const right = b.updatedAt ? new Date(b.updatedAt).valueOf() : 0;
      return right - left;
    });
  }, [paymentProfilesResponse]);
  const charges = useMemo(() => {
    const records = chargesResponse?.data?.charges ?? [];
    return [...records].sort((a, b) => new Date(b.chargedAt).valueOf() - new Date(a.chargedAt).valueOf());
  }, [chargesResponse]);

  const policyHolderName = getPolicyHolderName(policy);
  const defaultTemplates = useMemo(() => buildDefaultEmailTemplates(policy), [policy]);
  const savedTemplates = templatesResponse?.data ?? [];

  const templateOptions = useMemo<TemplateOption[]>(() => {
    const options: TemplateOption[] = [];
    for (const template of defaultTemplates) {
      options.push({ ...template, source: "default" });
    }
    for (const template of savedTemplates) {
      options.push({ ...template, source: "saved" });
    }
    return options;
  }, [defaultTemplates, savedTemplates]);

  const fallbackSubject = `Policy Update for ${policyHolderName || "you"}`;
  const initialTemplate = defaultTemplates[0] ?? {
    id: CUSTOM_TEMPLATE_ID,
    name: "Custom draft",
    subject: fallbackSubject,
    bodyHtml: "",
  };

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<string>(leadEmail);
  const [emailSubject, setEmailSubject] = useState<string>(initialTemplate.subject);
  const [emailHtml, setEmailHtml] = useState<string>(initialTemplate.bodyHtml);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplate.id);
  const [isTemplateCustomized, setIsTemplateCustomized] = useState(initialTemplate.id === CUSTOM_TEMPLATE_ID);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [previewTab, setPreviewTab] = useState<"preview" | "html">("preview");

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

  useEffect(() => {
    if (!policy) {
      return;
    }

    setEmailRecipient(leadEmail);
    const firstOption = templateOptions[0];
    if (firstOption) {
      setSelectedTemplateId(firstOption.id);
      setEmailSubject(firstOption.subject);
      setEmailHtml(firstOption.bodyHtml);
      setIsTemplateCustomized(false);
    } else {
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setEmailSubject(fallbackSubject);
      setEmailHtml("");
      setIsTemplateCustomized(true);
    }
    setNewTemplateName("");
    setPreviewTab("preview");
  }, [policy?.id, leadEmail, templateOptions, fallbackSubject]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={markAuthenticated} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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

  const handleOpenEmailDialog = (templateId?: string) => {
    setEmailRecipient(leadEmail);
    setNewTemplateName("");
    setPreviewTab("preview");

    if (templateId === CUSTOM_TEMPLATE_ID) {
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setEmailSubject(fallbackSubject);
      setEmailHtml("");
      setIsTemplateCustomized(true);
    } else {
      let template = templateId
        ? templateOptions.find(option => option.id === templateId)
        : templateOptions[0];
      if (template) {
        setSelectedTemplateId(template.id);
        setEmailSubject(template.subject);
        setEmailHtml(template.bodyHtml);
        setIsTemplateCustomized(false);
      } else {
        setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
        setEmailSubject(fallbackSubject);
        setEmailHtml("");
        setIsTemplateCustomized(true);
      }
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
      const response = await fetchWithAuth("/api/admin/email-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: trimmedName, subject: trimmedSubject, bodyHtml: emailHtml }),
      });

      ensureAuthorized(response);
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
      const response = await fetchWithAuth(`/api/admin/policies/${policy.id}/email`, {
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

      ensureAuthorized(response);
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
          <div className="flex flex-wrap gap-2 justify-end">
            {defaultTemplates.map(template => (
              <Button
                key={template.id}
                variant="secondary"
                onClick={() => handleOpenEmailDialog(template.id)}
              >
                {template.name}
              </Button>
            ))}
            <Button variant="outline" onClick={() => handleOpenEmailDialog(CUSTOM_TEMPLATE_ID)}>
              Custom email
            </Button>
            <Button onClick={() => handleOpenEmailDialog()}>Open composer</Button>
          </div>
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
            <div><span className="font-medium">Email:</span> {leadEmail || "N/A"}</div>
            <div><span className="font-medium">Phone:</span> {lead.phone || "N/A"}</div>
            <div><span className="font-medium">State:</span> {lead.state || "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing &amp; Payments</CardTitle>
            <CardDescription>Latest details synced from the customer portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Saved payment methods</h3>
              {isLoadingPaymentProfiles ? (
                <p className="mt-2 text-xs text-muted-foreground">Loading payment methods…</p>
              ) : paymentProfiles.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No payment details have been submitted yet.</p>
              ) : (
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {paymentProfiles.map(profile => (
                    <div key={profile.id} className="rounded-lg border border-slate-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {profile.cardBrand || profile.paymentMethod || "Payment method"}
                            {profile.cardLastFour ? ` · ••••${profile.cardLastFour}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profile.accountName || "No cardholder name on file"}
                          </p>
                          {profile.customer ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Portal account: {profile.customer.displayName || profile.customer.email}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            profile.autopayEnabled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }
                        >
                          {profile.autopayEnabled ? "Autopay on" : "Autopay off"}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs uppercase text-slate-500">
                        <div>
                          <dt>Last four</dt>
                          <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                            {profile.cardLastFour || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Expiry</dt>
                          <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                            {formatCardExpiry(profile.cardExpiryMonth, profile.cardExpiryYear)}
                          </dd>
                        </div>
                        <div>
                          <dt>Billing zip</dt>
                          <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                            {profile.billingZip || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Internal ref</dt>
                          <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                            {profile.accountIdentifier || "—"}
                          </dd>
                        </div>
                      </dl>
                      {profile.notes ? (
                        <p className="mt-3 text-xs text-slate-500">Notes: {profile.notes}</p>
                      ) : null}
                      {profile.updatedAt ? (
                        <p className="mt-3 text-xs text-slate-400">
                          Updated {new Date(profile.updatedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Charge history</h3>
              {isLoadingCharges ? (
                <p className="mt-2 text-xs text-muted-foreground">Loading charges…</p>
              ) : charges.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No charges logged for this policy.</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {charges.map(charge => {
                        const status = chargeStatusStyles[charge.status];
                        return (
                          <tr key={charge.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{charge.description}</div>
                              {charge.notes ? <div className="text-xs text-slate-500">{charge.notes}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatChargeDate(charge.chargedAt)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={status.className}>
                                {status.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatChargeAmount(charge.amountCents)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                try {
                  const response = await fetchWithAuth(`/api/admin/policies/${policy.id}/notes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({ content: textarea.value }),
                  });
                  ensureAuthorized(response);
                  if (!response.ok) {
                    throw new Error("Failed to save note");
                  }
                  textarea.value = "";
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
                } catch (error) {
                  toast({
                    title: "Could not save note",
                    description: error instanceof Error ? error.message : "Failed to save note",
                    variant: "destructive",
                  });
                }
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
                const formElement = event.currentTarget as HTMLFormElement;
                const formData = new FormData(formElement);
                const file = formData.get("file") as File | null;
                if (!file) {
                  toast({
                    title: "File required",
                    description: "Choose a file before uploading.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const response = await fetchWithAuth(`/api/admin/policies/${policy.id}/files`, {
                    method: "POST",
                    headers: { "x-filename": file.name, ...getAuthHeaders() },
                    body: file,
                  });
                  ensureAuthorized(response);
                  if (!response.ok) {
                    throw new Error("Failed to upload file");
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
                  formElement.reset();
                } catch (error) {
                  toast({
                    title: "Upload failed",
                    description: error instanceof Error ? error.message : "Failed to upload file",
                    variant: "destructive",
                  });
                }
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

        <PolicyDocumentRequests policyId={policy.id} customers={policy.customers ?? []} />
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                      className="h-[60vh] max-h-[420px] w-full border-0 bg-white"
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
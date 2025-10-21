import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { fetchWithAuth, getAuthHeaders, clearCredentials } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import PolicyDocumentRequests from "@/components/admin-policy-document-requests";
import { ArrowLeft, ChevronDown, Eye, Mail, Paperclip, PencilLine, Sparkles, ExternalLink } from "lucide-react";

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

const formatCurrencyFromCents = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "N/A";
  return formatCurrency(numeric / 100);
};

const formatDollarInput = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return "";
  }
  return numeric.toFixed(2);
};

const parseDollarInput = (value: string): number | null => {
  const normalized = value.replace(/[$,]/g, "").trim();
  if (!normalized) {
    return null;
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.round(numeric);
};

const formatChargeAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "—";
  return formatCurrency(numeric / 100);
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

const formatMaskedCardNumber = (lastFour: string | null | undefined): string => {
  if (!lastFour || lastFour.trim().length === 0) {
    return "—";
  }
  return `•••• •••• •••• ${lastFour.trim()}`;
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

const EMAIL_BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMjAgMTIwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNjAlIiBzdG9wLWNvbG9yPSIjMWQ0ZWQ4IiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9InVybCgjZykiIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik0yMCA3MGMyOC0yOCA4OC00OCAxNDAtNDhzMTEyIDIwIDE0MCA0OCIvPgogICAgPHBhdGggZD0iTTI4IDU4YzE4LTIyIDc4LTQwIDEzMi00MHMxMTQgMTggMTMyIDQwIiBvcGFjaXR5PSIwLjU1Ii8+CiAgPC9nPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIxMCA0OCkiPgogICAgPHBhdGggZD0iTTM2IDQgMTgtNCAwIDR2MzJjMCAxOCA4IDM0IDE4IDQyIDEwLTggMTgtMjQgMTgtNDJWNFoiIGZpbGw9IiMwZjE3MmEiIG9wYWNpdHk9IjAuMTIiLz4KICAgIDxwYXRoIGQ9Ik0zNiAwIDE4LTggMCAwdjMyYzAgMTggOCAzNCAxOCA0MiAxMC04IDE4LTI0IDE4LTQyVjBaIiBmaWxsPSIjMGIxZjRlIi8+CiAgICA8cGF0aCBkPSJNOSAxOCAxOCAyOGwxNS0xOCIgc3Ryb2tlPSIjZTBmMmZlIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDwvZz4KPC9zdmc+";

const convertPlainTextToHtml = (value: string): string => {
  const paragraphs = value
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map(paragraph => {
      const lines = paragraph
        .split(/\n+/)
        .map(line => escapeHtml(line.trim()))
        .filter(Boolean)
        .join("<br />");
      return `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">${lines}</p>`;
    })
    .join("\n");
};

const stripHtmlToPlainText = (value: string): string => {
  if (!value) return "";
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const formatDateInputValue = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatCurrencyInput = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return "";
  }
  return (numeric / 100).toFixed(2);
};

const formatPolicyName = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const parseCurrencyInput = (value: string): number | null => {
  const normalized = value.replace(/[$,]/g, "").trim();
  if (!normalized) {
    return null;
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.round(numeric * 100);
};

const formatPaymentCount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "N/A";
  }
  const rounded = Math.round(numeric);
  const label = rounded === 1 ? "payment" : "payments";
  return `${rounded} ${label}`;
};

const createPolicyFormState = (policy: any) => ({
  package: policy?.package ?? "",
  policyStartDate: formatDateInputValue(policy?.policyStartDate),
  expirationDate: formatDateInputValue(policy?.expirationDate),
  expirationMiles:
    policy?.expirationMiles != null && !Number.isNaN(Number(policy.expirationMiles))
      ? String(policy.expirationMiles)
      : "",
  deductible: formatDollarInput(policy?.deductible),
  totalPremium: formatCurrencyInput(policy?.totalPremium),
  downPayment: formatCurrencyInput(policy?.downPayment),
  monthlyPayment: formatCurrencyInput(policy?.monthlyPayment),
  totalPayments:
    policy?.totalPayments != null && !Number.isNaN(Number(policy.totalPayments))
      ? String(policy.totalPayments)
      : "",
  leadFirstName: policy?.lead?.firstName ?? "",
  leadLastName: policy?.lead?.lastName ?? "",
  leadEmail: policy?.lead?.email ?? "",
  leadPhone: policy?.lead?.phone ?? "",
  leadState: policy?.lead?.state ?? "",
  leadZip: policy?.lead?.zip ?? "",
  vehicleYear:
    policy?.vehicle?.year != null && !Number.isNaN(Number(policy.vehicle.year))
      ? String(policy.vehicle.year)
      : "",
  vehicleMake: policy?.vehicle?.make ?? "",
  vehicleModel: policy?.vehicle?.model ?? "",
  vehicleTrim: policy?.vehicle?.trim ?? "",
  vehicleVin: policy?.vehicle?.vin ?? "",
  vehicleOdometer:
    policy?.vehicle?.odometer != null && !Number.isNaN(Number(policy.vehicle.odometer))
      ? String(policy.vehicle.odometer)
      : "",
  vehicleUsage: policy?.vehicle?.usage ?? "",
  vehicleIsEv: policy?.vehicle?.ev ? "true" : "false",
});

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
              <div style="display:flex;align-items:center;gap:18px;">
                <img
                  src="${EMAIL_BRAND_LOGO}"
                  alt="BHAutoProtect logo"
                  style="width:96px;height:auto;display:block;filter:drop-shadow(0 8px 18px rgba(15,23,42,0.35));"
                />
                <div>
                  <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BHAUTOPROTECT</div>
                  <div style="font-size:24px;font-weight:700;margin-top:6px;">${escapeHtml(heroTitle)}</div>
                </div>
              </div>
              <div style="margin-top:16px;font-size:14px;opacity:0.88;">${escapeHtml(heroSubtitle)}</div>
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

const buildBrandedEmailFromPlainText = ({
  subject,
  message,
  policy,
}: {
  subject: string;
  message: string;
  policy: any;
}): string => {
  const policyPackage = formatPolicyName(policy?.package) || "Vehicle Protection";
  const heroTitle = `${policyPackage} Update`;
  const heroSubtitle = `Policy ${policy?.id ?? "Details"}`;
  const bodyContent = convertPlainTextToHtml(message || "");
  const finalBody = bodyContent
    ? bodyContent
    : `<p style="margin:0;font-size:15px;line-height:1.7;color:#334155;">Your message will appear here once added.</p>`;
  return buildEmailLayout({
    subject,
    heroTitle,
    heroSubtitle,
    bodyContent: finalBody,
  });
};

const buildDefaultEmailTemplates = (policy: any): EmailTemplateRecord[] => {
  const name = getPolicyHolderName(policy);
  const displayName = name || "there";
  const policyPackage = formatPolicyName(policy?.package) || "Vehicle Protection";
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
    { label: "Total Premium", value: formatCurrencyFromCents(policy?.totalPremium) },
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
    { label: "Down Payment", value: formatCurrencyFromCents(policy?.downPayment) },
    { label: "Monthly Payment", value: formatCurrencyFromCents(policy?.monthlyPayment) },
    {
      label: "Total Payments",
      value: policy?.totalPayments != null ? formatPaymentCount(policy.totalPayments) : "N/A",
    },
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

  const monthlyPayment = policy?.monthlyPayment != null ? formatCurrencyFromCents(policy.monthlyPayment) : null;
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
  const [, navigate] = useLocation();
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

  const primaryPaymentProfile = paymentProfiles[0] ?? null;
  const hasPaymentProfile = !!primaryPaymentProfile;
  const autopayEnabled = primaryPaymentProfile?.autopayEnabled ?? false;
  const autopayLabel = hasPaymentProfile
    ? autopayEnabled
      ? "Autopay active"
      : "Manual payments"
    : "No payment method";
  const autopayBadgeClass = autopayEnabled
    ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-700"
    : "border-slate-200 bg-white/70 text-slate-600";
  const autopayHeroBadgeClass = autopayEnabled
    ? "border-emerald-200/70 bg-emerald-400/30 text-emerald-50"
    : "border-white/30 bg-white/20 text-white";
  const monthlyPaymentDisplay = formatCurrencyFromCents(policy?.monthlyPayment);
  const totalPremiumDisplay = formatCurrencyFromCents(policy?.totalPremium);
  const downPaymentDisplay = formatCurrencyFromCents(policy?.downPayment);
  const deductibleDisplay = formatCurrency(policy?.deductible);
  const coverageStartDisplay = formatDate(policy?.policyStartDate);
  const coverageEndDisplay = formatDate(policy?.expirationDate);
  const expirationMilesDisplay =
    policy?.expirationMiles != null ? `${Number(policy.expirationMiles).toLocaleString()} mi` : "N/A";
  const policyCreatedDisplay = formatDate(policy?.createdAt);

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
  const [plainMessage, setPlainMessage] = useState<string>(stripHtmlToPlainText(initialTemplate.bodyHtml));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplate.id);
  const [isTemplateCustomized, setIsTemplateCustomized] = useState(initialTemplate.id === CUSTOM_TEMPLATE_ID);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [isEditPolicyOpen, setIsEditPolicyOpen] = useState(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState(() => createPolicyFormState(policy));

  useEffect(() => {
    setPolicyForm(createPolicyFormState(policy));
  }, [policy]);

  const buildCustomEmail = (message: string, subjectOverride?: string) =>
    buildBrandedEmailFromPlainText({ subject: subjectOverride ?? emailSubject, message, policy });

  const syncPlainMessageFromHtml = (html: string) => {
    const stripped = stripHtmlToPlainText(html);
    setPlainMessage(stripped);
  };

  const previewSource = useMemo(() => {
    const sanitized = sanitizeHtmlForPreview(emailHtml);
    if (sanitized) {
      return sanitized;
    }
    return `<html><body style="font-family:'Helvetica Neue',Arial,sans-serif;padding:24px;color:#1f2937;background:#f8fafc;">
      <h2 style="margin-top:0;font-size:18px;">Your email preview will appear here</h2>
      <p style="font-size:14px;line-height:1.6;">Select a template or start writing a message to generate the preview.</p>
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
    setIsPreviewDialogOpen(false);
    setShowSourceEditor(false);

    if (templateId === CUSTOM_TEMPLATE_ID) {
      setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
      setEmailSubject(fallbackSubject);
      setEmailHtml("");
      setPlainMessage("");
      setIsTemplateCustomized(true);
    } else {
      let template = templateId
        ? templateOptions.find(option => option.id === templateId)
        : templateOptions[0];
      if (template) {
        setSelectedTemplateId(template.id);
        setEmailSubject(template.subject);
        setEmailHtml(template.bodyHtml);
        syncPlainMessageFromHtml(template.bodyHtml);
        setIsTemplateCustomized(false);
      } else {
        setSelectedTemplateId(CUSTOM_TEMPLATE_ID);
        setEmailSubject(fallbackSubject);
        setEmailHtml("");
        setPlainMessage("");
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
      syncPlainMessageFromHtml(template.bodyHtml);
      setIsTemplateCustomized(false);
    }
  };

  const handleSubjectChange = (value: string) => {
    setEmailSubject(value);
    markAsCustom();
    if (selectedTemplateId === CUSTOM_TEMPLATE_ID || isTemplateCustomized) {
      setEmailHtml(buildCustomEmail(plainMessage, value));
    }
  };

  const handlePlainMessageChange = (value: string) => {
    setPlainMessage(value);
    markAsCustom();
    setEmailHtml(buildCustomEmail(value));
  };

  const handleHtmlChange = (value: string) => {
    setEmailHtml(value);
    syncPlainMessageFromHtml(value);
    markAsCustom();
  };

  const handlePolicyFieldChange = (field: keyof ReturnType<typeof createPolicyFormState>, value: string) => {
    setPolicyForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePolicyUpdate = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const sanitizeNullableString = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const sanitizeState = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed.toUpperCase() : null;
    };

    const payload: Record<string, unknown> = {
      package: policyForm.package.trim() || null,
      policyStartDate: policyForm.policyStartDate ? new Date(policyForm.policyStartDate).toISOString() : null,
      expirationDate: policyForm.expirationDate ? new Date(policyForm.expirationDate).toISOString() : null,
      expirationMiles:
        policyForm.expirationMiles.trim() && !Number.isNaN(Number(policyForm.expirationMiles))
          ? Number(policyForm.expirationMiles)
          : null,
      deductible: parseDollarInput(policyForm.deductible),
      totalPremium: parseCurrencyInput(policyForm.totalPremium),
      downPayment: parseCurrencyInput(policyForm.downPayment),
      monthlyPayment: parseCurrencyInput(policyForm.monthlyPayment),
      totalPayments: null,
    };

    const totalPaymentsValue = policyForm.totalPayments.trim();
    if (totalPaymentsValue.length > 0) {
      const parsed = Number.parseInt(totalPaymentsValue, 10);
      if (!Number.isNaN(parsed)) {
        payload.totalPayments = parsed;
      }
    }

    const emailValue = sanitizeNullableString(policyForm.leadEmail);
    const leadPayload: Record<string, string | null> = {
      firstName: sanitizeNullableString(policyForm.leadFirstName),
      lastName: sanitizeNullableString(policyForm.leadLastName),
      email: emailValue ? emailValue.toLowerCase() : null,
      phone: sanitizeNullableString(policyForm.leadPhone),
      state: sanitizeState(policyForm.leadState),
      zip: sanitizeNullableString(policyForm.leadZip),
    };

    payload.lead = leadPayload;

    const trimmedYear = policyForm.vehicleYear.trim();
    const trimmedMake = policyForm.vehicleMake.trim();
    const trimmedModel = policyForm.vehicleModel.trim();
    const trimmedTrim = policyForm.vehicleTrim.trim();
    const trimmedVin = policyForm.vehicleVin.trim();
    const trimmedOdometer = policyForm.vehicleOdometer.trim();
    const trimmedUsage = policyForm.vehicleUsage.trim();

    const shouldSendVehicle =
      Boolean(
        trimmedYear ||
          trimmedMake ||
          trimmedModel ||
          trimmedTrim ||
          trimmedVin ||
          trimmedOdometer ||
          trimmedUsage
      ) || Boolean(policy?.vehicle);

    if (shouldSendVehicle) {
      const vehiclePayload: Record<string, unknown> = {};

      if (trimmedYear) {
        const numericYear = Number.parseInt(trimmedYear, 10);
        if (!Number.isNaN(numericYear)) {
          vehiclePayload.year = numericYear;
        }
      }

      if (trimmedMake) {
        vehiclePayload.make = trimmedMake;
      }

      if (trimmedModel) {
        vehiclePayload.model = trimmedModel;
      }

      if (trimmedOdometer) {
        const numericOdometer = Number.parseInt(trimmedOdometer, 10);
        if (!Number.isNaN(numericOdometer)) {
          vehiclePayload.odometer = numericOdometer;
        }
      }

      if (trimmedTrim) {
        vehiclePayload.trim = trimmedTrim;
      } else if (policy?.vehicle?.trim) {
        vehiclePayload.trim = null;
      }

      if (trimmedVin) {
        vehiclePayload.vin = trimmedVin.toUpperCase();
      } else if (policy?.vehicle?.vin) {
        vehiclePayload.vin = null;
      }

      if (trimmedUsage) {
        vehiclePayload.usage = trimmedUsage;
      } else if (policy?.vehicle?.usage) {
        vehiclePayload.usage = null;
      }

      const evValue = policyForm.vehicleIsEv === "true";
      if (!policy?.vehicle || policy.vehicle.ev !== evValue) {
        vehiclePayload.ev = evValue;
      } else if (policy?.vehicle) {
        vehiclePayload.ev = evValue;
      }

      if (Object.keys(vehiclePayload).length > 0) {
        payload.vehicle = vehiclePayload;
      }
    }

    setIsUpdatingPolicy(true);
    try {
      const response = await fetchWithAuth(`/api/admin/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      ensureAuthorized(response);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : "Failed to update policy";
        throw new Error(message);
      }

      toast({
        title: "Policy updated",
        description: "The latest changes are now saved for this policy.",
      });
      setIsEditPolicyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
    } catch (error) {
      toast({
        title: "Could not update policy",
        description: error instanceof Error ? error.message : "Failed to update policy",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!policy) {
      return;
    }

    setIsDeletingPolicy(true);
    try {
      const response = await fetchWithAuth(`/api/admin/policies/${policy.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      ensureAuthorized(response);
      if (!response.ok) {
        let message = "Failed to delete policy";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore parsing errors
        }
        throw new Error(message);
      }

      toast({
        title: "Policy deleted",
        description: "The policy record and its related data have been removed.",
      });

      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies"] });
      queryClient.removeQueries({ queryKey: ["/api/admin/policies", policy.id] });
      navigate("/admin/policies");
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to delete policy";
      toast({
        title: "Could not delete policy",
        description,
        variant: "destructive",
      });
    } finally {
      setIsDeletingPolicy(false);
    }
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
      syncPlainMessageFromHtml(result.data.bodyHtml);
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
    const trimmedMessage = plainMessage.trim();
    const htmlToSend =
      selectedTemplateId === CUSTOM_TEMPLATE_ID || isTemplateCustomized
        ? buildCustomEmail(plainMessage, trimmedSubject)
        : emailHtml;
    const trimmedHtml = htmlToSend.trim();

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
        description: "Add a message before sending your email.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedMessage && (selectedTemplateId === CUSTOM_TEMPLATE_ID || isTemplateCustomized)) {
      toast({
        title: "Message required",
        description: "Write a quick note in the composer before sending.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplateId === CUSTOM_TEMPLATE_ID || isTemplateCustomized) {
      setEmailHtml(htmlToSend);
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
          bodyHtml: htmlToSend,
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
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            asChild
            className="w-fit rounded-full border border-transparent bg-white/80 px-4 py-2 text-slate-700 shadow-sm transition hover:border-slate-200 hover:bg-white"
          >
            <Link href="/admin/policies">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Policies
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Policy workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Policy overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Manage documents, notes, and send beautifully formatted updates in just a few clicks.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr] xl:gap-8">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-700 px-6 py-6 text-white sm:px-8 sm:py-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Policy holder</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                      {policyHolderName || "Policyholder"}
                    </h2>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-200/90">
                      <span className="font-mono text-xs uppercase tracking-[0.35em] text-slate-200/80">{policy.id}</span>
                      {policy.package ? (
                        <span className="text-slate-200/80">• {formatPolicyName(policy.package)} coverage</span>
                      ) : null}
                    </p>
                  </div>
                <div className="flex flex-col items-start gap-3 text-xs text-slate-200/80 sm:flex-row sm:items-center sm:gap-4">
                  <Badge
                    variant="outline"
                    className={`rounded-full border bg-transparent px-3 py-1 text-xs font-medium backdrop-blur ${autopayHeroBadgeClass}`}
                  >
                    {autopayLabel}
                  </Badge>
                  <span>Created {policyCreatedDisplay}</span>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-white/20"
                      onClick={() => setIsEditPolicyOpen(true)}
                    >
                      Edit policy
                    </Button>
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                          disabled={isDeletingPolicy}
                        >
                          Delete policy
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this policy?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Deleting the policy removes its notes, files,
                            customer links, and billing records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeletingPolicy}>Cancel</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              onClick={handleDeletePolicy}
                              disabled={isDeletingPolicy}
                            >
                              {isDeletingPolicy ? "Deleting..." : "Delete"}
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
              <div className="grid gap-4 border-t border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coverage window</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {coverageStartDisplay} → {coverageEndDisplay}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{monthlyPaymentDisplay}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total premium</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{totalPremiumDisplay}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Deductible</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{deductibleDisplay}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Expiration mileage</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{expirationMilesDisplay}</p>
                </div>
              </div>
            </section>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Customer email tools</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Send polished policy updates with saved templates or a custom note.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="self-start rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {defaultTemplates.length + savedTemplates.length} templates ready
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick templates</p>
                  {defaultTemplates.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {defaultTemplates.map(template => (
                        <Button
                          key={template.id}
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleOpenEmailDialog(template.id)}
                        >
                          <Sparkles className="h-4 w-4" />
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No suggested templates yet—jump into the composer to craft your own.
                    </p>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Emails go to {leadEmail ? <span className="font-medium text-slate-700">{leadEmail}</span> : "the policyholder"}.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-2" onClick={() => handleOpenEmailDialog()}>
                      <Mail className="h-4 w-4" />
                      Open composer
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleOpenEmailDialog(CUSTOM_TEMPLATE_ID)}
                    >
                      <PencilLine className="h-4 w-4" />
                      Start from scratch
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Coverage &amp; terms</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Reference the contract and premium details for this policy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Package</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{formatPolicyName(policy.package) || "N/A"}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Policy start</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{coverageStartDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Expiration date</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{coverageEndDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Expiration mileage</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{expirationMilesDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Deductible</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{deductibleDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Total premium</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{totalPremiumDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Down payment</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{downPaymentDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{monthlyPaymentDisplay}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Total payments</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">
                      {policy.totalPayments != null ? formatPaymentCount(policy.totalPayments) : "N/A"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-900">{policyCreatedDisplay}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Policy documents</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Upload supporting paperwork and keep it handy for the team.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="self-start rounded-full border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {files.length} {files.length === 1 ? "file" : "files"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Add a new document</p>
                      <p className="text-xs text-muted-foreground">Accepted formats up to 10 MB.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input type="file" name="file" className="max-w-xs" />
                      <Button type="submit" className="sm:self-start">
                        Upload file
                      </Button>
                    </div>
                  </div>
                </form>

                {files.length > 0 ? (
                  <div className="space-y-3">
                    {files.map((file: any) => (
                      <div
                        key={file.id}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Paperclip className="h-4 w-4" />
                          </span>
                          <div>
                            <a
                              className="font-medium text-slate-900 hover:text-primary hover:underline"
                              href={`/${file.filePath}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {file.fileName}
                            </a>
                            <p className="text-xs text-muted-foreground">Uploaded {formatDate(file.createdAt)}</p>
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="gap-2 text-primary">
                          <a href={`/${file.filePath}`} target="_blank" rel="noreferrer">
                            View document
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    <Paperclip className="h-5 w-5 text-slate-400" />
                    No documents uploaded yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <PolicyDocumentRequests policyId={policy.id} customers={policy.customers ?? []} />

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Notes</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Capture quick updates for teammates and future reference.
                </CardDescription>
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
                  className="space-y-3"
                >
                  <Textarea name="note" className="w-full" placeholder="Add a note" />
                  <Button type="submit" className="self-end">
                    Add Note
                  </Button>
                </form>
                <ul className="mt-4 space-y-3">
                  {notes.map((note: any) => (
                    <li key={note.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
                      <div className="text-slate-800">{note.content}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Customer snapshot</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Quick contact and vehicle reference details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-sm text-slate-600">
                <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
                  <dl className="mt-3 space-y-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
                      <dd className="mt-1 font-medium text-slate-900">{policyHolderName || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
                      <dd className="mt-1 font-medium text-slate-900 break-words">{leadEmail || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt>
                      <dd className="mt-1 font-medium text-slate-900">{lead.phone || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">State</dt>
                      <dd className="mt-1 font-medium text-slate-900">{lead.state || "N/A"}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</h3>
                  <dl className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Year</dt>
                      <dd className="mt-1 font-medium text-slate-900">{vehicle.year || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Make</dt>
                      <dd className="mt-1 font-medium text-slate-900">{vehicle.make || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Model</dt>
                      <dd className="mt-1 font-medium text-slate-900">{vehicle.model || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Trim</dt>
                      <dd className="mt-1 font-medium text-slate-900">{vehicle.trim || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">VIN</dt>
                      <dd className="mt-1 font-medium text-slate-900 break-all">{vehicle.vin || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Odometer</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {vehicle.odometer != null ? `${vehicle.odometer} miles` : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </section>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Billing &amp; payments</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Latest details synced from the customer portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Payment status</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Badge variant="outline" className={`rounded-full px-3 py-1 text-xs font-medium ${autopayBadgeClass}`}>
                      {autopayLabel}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {hasPaymentProfile
                        ? primaryPaymentProfile?.cardBrand || primaryPaymentProfile?.paymentMethod || "Payment method"
                        : "Awaiting saved payment details"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{monthlyPaymentDisplay}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Down payment</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{downPaymentDisplay}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Saved payment methods</h3>
                  {isLoadingPaymentProfiles ? (
                    <p className="mt-2 text-xs text-muted-foreground">Loading payment methods…</p>
                  ) : paymentProfiles.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No payment details have been submitted yet.</p>
                  ) : (
                    <div className="mt-3 grid gap-4">
                      {paymentProfiles.map(profile => (
                        <div key={profile.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {profile.cardBrand || profile.paymentMethod || "Payment method"}
                              </p>
                              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.4em] text-slate-500">
                                {formatMaskedCardNumber(profile.cardLastFour)}
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
                                  ? "rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                                  : "rounded-full border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                              }
                            >
                              {profile.autopayEnabled ? "Autopay on" : "Autopay off"}
                            </Badge>
                          </div>
                          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs uppercase tracking-wide text-slate-500">
                            <div>
                              <dt>Card number</dt>
                              <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                                {formatMaskedCardNumber(profile.cardLastFour)}
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
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
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
          </div>
        </div>
      </div>
      <Dialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          setIsEmailDialogOpen(open);
          if (!open) {
            setIsTemplateCustomized(false);
            setNewTemplateName("");
            setIsPreviewDialogOpen(false);
            setShowSourceEditor(false);
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
            <section className="grid gap-2">
              <Label htmlFor="policy-email-recipient">Recipient</Label>
              <Input
                id="policy-email-recipient"
                placeholder="customer@example.com"
                value={emailRecipient}
                onChange={event => setEmailRecipient(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
            </section>
            <Separator />
            <section className="grid gap-2">
              <Label htmlFor="policy-email-template">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger id="policy-email-template">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900">
                  {templateOptions.map(option => (
                    <SelectItem key={option.id} value={option.id} className="text-slate-800">
                      {option.name}
                      {option.source === "default" ? " (auto)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_TEMPLATE_ID} className="text-slate-800">
                    Custom draft
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isFetchingTemplates
                  ? "Loading saved templates..."
                  : "Switch templates to reuse team-approved messaging or choose \"Custom draft\" to write something unique."}
              </p>
            </section>
            <Separator />
            <section className="grid gap-2">
              <Label htmlFor="policy-email-subject">Subject</Label>
              <Input
                id="policy-email-subject"
                value={emailSubject}
                onChange={event => handleSubjectChange(event.target.value)}
              />
            </section>
            <Separator />
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label htmlFor="policy-email-body" className="text-sm font-medium text-slate-700">
                    Message
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    We’ll wrap this note in a polished template with the BH Auto Protect logo at the top.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsPreviewDialogOpen(true)}
                >
                  <Eye className="h-4 w-4" /> Preview email
                </Button>
              </div>
              <Textarea
                id="policy-email-body"
                value={plainMessage}
                onChange={event => handlePlainMessageChange(event.target.value)}
                rows={8}
                className="rounded-xl border border-slate-200 bg-slate-50/80 text-base leading-relaxed text-slate-800 shadow-sm focus-visible:ring-primary"
                placeholder="Write a friendly update for the customer. Press Enter to start a new paragraph."
              />
              <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
                Your note is converted to on-brand HTML automatically—no coding needed.
              </div>
              <Collapsible open={showSourceEditor} onOpenChange={setShowSourceEditor}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-slate-600 hover:text-slate-900"
                  >
                    Advanced HTML editor
                    <ChevronDown className={`h-4 w-4 transition-transform ${showSourceEditor ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-3">
                  <Textarea
                    value={emailHtml}
                    onChange={event => handleHtmlChange(event.target.value)}
                    rows={12}
                    className="rounded-lg border border-slate-200 bg-slate-950/5 font-mono text-sm text-slate-800"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Need pixel-perfect control? Edit the generated HTML here and preview before sending.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </section>
            <Separator />
            <section className="grid gap-2">
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
            </section>
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
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              This is exactly how the message will appear in your customer’s inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner">
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={previewSource}
              className="h-[70vh] w-full border-0 bg-white"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isEditPolicyOpen}
        onOpenChange={open => {
          setIsEditPolicyOpen(open);
          if (!open) {
            setPolicyForm(createPolicyFormState(policy));
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit policy details</DialogTitle>
            <DialogDescription>
              Adjust coverage, customer contact information, and vehicle specs. Changes sync instantly for your team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePolicyUpdate} className="space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Customer details</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-first-name">First name</Label>
                  <Input
                    id="edit-policy-first-name"
                    value={policyForm.leadFirstName}
                    onChange={event => handlePolicyFieldChange("leadFirstName", event.target.value)}
                    placeholder="Jordan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-last-name">Last name</Label>
                  <Input
                    id="edit-policy-last-name"
                    value={policyForm.leadLastName}
                    onChange={event => handlePolicyFieldChange("leadLastName", event.target.value)}
                    placeholder="Rivera"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-policy-email">Email</Label>
                  <Input
                    id="edit-policy-email"
                    type="email"
                    value={policyForm.leadEmail}
                    onChange={event => handlePolicyFieldChange("leadEmail", event.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-phone">Phone</Label>
                  <Input
                    id="edit-policy-phone"
                    value={policyForm.leadPhone}
                    onChange={event => handlePolicyFieldChange("leadPhone", event.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-state">State</Label>
                  <Input
                    id="edit-policy-state"
                    value={policyForm.leadState}
                    onChange={event => handlePolicyFieldChange("leadState", event.target.value)}
                    placeholder="NY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-zip">ZIP code</Label>
                  <Input
                    id="edit-policy-zip"
                    value={policyForm.leadZip}
                    onChange={event => handlePolicyFieldChange("leadZip", event.target.value)}
                    placeholder="10001"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Vehicle information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-year">Year</Label>
                  <Input
                    id="edit-vehicle-year"
                    type="number"
                    value={policyForm.vehicleYear}
                    onChange={event => handlePolicyFieldChange("vehicleYear", event.target.value)}
                    placeholder="2019"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-make">Make</Label>
                  <Input
                    id="edit-vehicle-make"
                    value={policyForm.vehicleMake}
                    onChange={event => handlePolicyFieldChange("vehicleMake", event.target.value)}
                    placeholder="Toyota"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-model">Model</Label>
                  <Input
                    id="edit-vehicle-model"
                    value={policyForm.vehicleModel}
                    onChange={event => handlePolicyFieldChange("vehicleModel", event.target.value)}
                    placeholder="Camry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-trim">Trim</Label>
                  <Input
                    id="edit-vehicle-trim"
                    value={policyForm.vehicleTrim}
                    onChange={event => handlePolicyFieldChange("vehicleTrim", event.target.value)}
                    placeholder="XSE"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-vehicle-vin">VIN</Label>
                  <Input
                    id="edit-vehicle-vin"
                    value={policyForm.vehicleVin}
                    onChange={event => handlePolicyFieldChange("vehicleVin", event.target.value)}
                    placeholder="17-character VIN"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-odometer">Odometer</Label>
                  <Input
                    id="edit-vehicle-odometer"
                    type="number"
                    value={policyForm.vehicleOdometer}
                    onChange={event => handlePolicyFieldChange("vehicleOdometer", event.target.value)}
                    placeholder="45000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-usage">Usage</Label>
                  <Input
                    id="edit-vehicle-usage"
                    value={policyForm.vehicleUsage}
                    onChange={event => handlePolicyFieldChange("vehicleUsage", event.target.value)}
                    placeholder="Personal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicle-ev">Electric vehicle</Label>
                  <Select value={policyForm.vehicleIsEv} onValueChange={value => handlePolicyFieldChange("vehicleIsEv", value)}>
                    <SelectTrigger id="edit-vehicle-ev">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Coverage &amp; billing</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-package">Package</Label>
                  <Input
                    id="edit-policy-package"
                    value={policyForm.package}
                    onChange={event => handlePolicyFieldChange("package", event.target.value)}
                    placeholder="Basic"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-expiration-miles">Expiration mileage</Label>
                  <Input
                    id="edit-policy-expiration-miles"
                    type="number"
                    value={policyForm.expirationMiles}
                    onChange={event => handlePolicyFieldChange("expirationMiles", event.target.value)}
                    placeholder="75000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-start">Policy start date</Label>
                  <Input
                    id="edit-policy-start"
                    type="date"
                    value={policyForm.policyStartDate}
                    onChange={event => handlePolicyFieldChange("policyStartDate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-expiration-date">Expiration date</Label>
                  <Input
                    id="edit-policy-expiration-date"
                    type="date"
                    value={policyForm.expirationDate}
                    onChange={event => handlePolicyFieldChange("expirationDate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-deductible">Deductible</Label>
                  <Input
                    id="edit-policy-deductible"
                    type="number"
                    value={policyForm.deductible}
                    onChange={event => handlePolicyFieldChange("deductible", event.target.value)}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-total-premium">Total premium</Label>
                  <Input
                    id="edit-policy-total-premium"
                    type="number"
                    value={policyForm.totalPremium}
                    onChange={event => handlePolicyFieldChange("totalPremium", event.target.value)}
                    placeholder="299900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-down-payment">Down payment</Label>
                  <Input
                    id="edit-policy-down-payment"
                    type="number"
                    value={policyForm.downPayment}
                    onChange={event => handlePolicyFieldChange("downPayment", event.target.value)}
                    placeholder="49900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-policy-monthly-payment">Monthly payment</Label>
                  <Input
                    id="edit-policy-monthly-payment"
                    type="number"
                    value={policyForm.monthlyPayment}
                    onChange={event => handlePolicyFieldChange("monthlyPayment", event.target.value)}
                    placeholder="15900"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-policy-total-payments">Total payments</Label>
                  <Input
                    id="edit-policy-total-payments"
                    type="number"
                    value={policyForm.totalPayments}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={event => handlePolicyFieldChange("totalPayments", event.target.value)}
                    placeholder="899900"
                  />
                </div>
              </div>
            </section>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditPolicyOpen(false)} disabled={isUpdatingPolicy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingPolicy}>
                {isUpdatingPolicy ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
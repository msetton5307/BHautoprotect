import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AdminNav from "@/components/admin-nav";
import AdminLogin from "@/components/admin-login";
import { fetchWithAuth, getAuthHeaders, clearCredentials } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useBranding } from "@/hooks/use-branding";
import PolicyDocumentRequests from "@/components/admin-policy-document-requests";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  Download,
  FileSignature,
  Mail,
  Paperclip,
  PencilLine,
  Sparkles,
  ExternalLink,
} from "lucide-react";

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
  customerId: string;
  paymentMethod: string | null;
  accountName: string | null;
  accountIdentifier: string | null;
  cardBrand: string | null;
  cardNumber: string | null;
  cardLastFour: string | null;
  cardCvv: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  billingZip: string | null;
  autopayEnabled: boolean;
  notes: string | null;
  updatedAt?: string | null;
  customer?: { id: string; email: string; displayName?: string | null } | null;
};

type PaymentProfileFormState = {
  paymentMethod: string;
  accountName: string;
  accountIdentifier: string;
  cardBrand: string;
  cardNumber: string;
  cardLastFour: string;
  cardCvv: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  billingZip: string;
  autopayEnabled: boolean;
  notes: string;
};

type BillingFormState = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

const createEmptyPaymentProfileForm = (): PaymentProfileFormState => ({
  paymentMethod: "",
  accountName: "",
  accountIdentifier: "",
  cardBrand: "",
  cardNumber: "",
  cardLastFour: "",
  cardCvv: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  billingZip: "",
  autopayEnabled: false,
  notes: "",
});

const createEmptyBillingForm = (): BillingFormState => ({
  address: "",
  city: "",
  state: "",
  zip: "",
});

type PolicyChargeRecord = {
  id: string;
  policyId: string;
  description: string;
  amountCents: number;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  chargedAt: string | null;
  notes: string | null;
  reference: string | null;
  invoiceFileName: string | null;
  invoiceFilePath: string | null;
  invoiceFileType: string | null;
  invoiceFileSize: number | null;
};

type PolicyDocuSignEnvelopeRecord = {
  id: string;
  policyId: string;
  leadId: string;
  envelopeId: string;
  status: string | null;
  lastEvent: string | null;
  completedAt: string | null;
  documentsDownloadedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ChargeFormState = {
  description: string;
  amount: string;
  chargedAt: string;
  status: PolicyChargeRecord["status"];
  reference: string;
  notes: string;
  invoiceFile: File | null;
  removeStoredInvoice: boolean;
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

const getFileNameFromDisposition = (headerValue: string | null): string | null => {
  if (!headerValue) {
    return null;
  }
  const match = /filename\*?=([^;]+)/i.exec(headerValue);
  if (match && match[1]) {
    const value = match[1].trim().replace(/^UTF-8''/i, '').replace(/"/g, '');
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

const MAX_CHARGE_INVOICE_BYTES = 10 * 1024 * 1024;
const MAX_POLICY_FILE_BYTES = 10 * 1024 * 1024;

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const [, base64 = result] = result.split(",");
        resolve(base64.replace(/\s+/g, ""));
      } else {
        reject(new Error("Unable to read file"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read file"));
    };
    reader.readAsDataURL(file);
  });

const formatCardExpiry = (month: number | null | undefined, year: number | null | undefined): string => {
  if (month == null || year == null) return "—";
  const safeMonth = String(month).padStart(2, "0");
  return `${safeMonth}/${year}`;
};

const formatCardDigits = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length >= 4) {
    const grouped = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    if (grouped.length > 0) {
      return grouped;
    }
  }

  return trimmed;
};

const buildPaymentProfileCardNumber = (
  profile: Pick<PolicyPaymentProfileRecord, "accountIdentifier" | "cardNumber" | "cardLastFour">,
  fallbackCardNumber?: string | null,
): { display: string; usedAccountIdentifier: boolean } => {
  const identifier = typeof profile.accountIdentifier === "string" ? profile.accountIdentifier.trim() : "";
  if (identifier.length > 0) {
    const formatted = formatCardDigits(identifier);
    return { display: formatted || identifier, usedAccountIdentifier: true };
  }

  const storedNumber = typeof profile.cardNumber === "string" ? profile.cardNumber.trim() : "";
  if (storedNumber.length > 0) {
    const formatted = formatCardDigits(storedNumber);
    return { display: formatted || storedNumber, usedAccountIdentifier: false };
  }

  const fallback = typeof fallbackCardNumber === "string" ? fallbackCardNumber.trim() : "";
  if (fallback.length > 0) {
    const formatted = formatCardDigits(fallback);
    return { display: formatted || fallback, usedAccountIdentifier: false };
  }

  const lastFour = typeof profile.cardLastFour === "string" ? profile.cardLastFour.trim() : "";
  if (lastFour.length > 0) {
    return { display: `•••• ${lastFour}`, usedAccountIdentifier: false };
  }

  return { display: "—", usedAccountIdentifier: false };
};

const formatAddressForDisplay = (
  line1: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  postalCode: string | null | undefined,
): string | null => {
  const parts: string[] = [];
  if (typeof line1 === "string" && line1.trim().length > 0) {
    parts.push(line1.trim());
  }
  const locality: string[] = [];
  if (typeof city === "string" && city.trim().length > 0) {
    locality.push(city.trim());
  }
  if (typeof state === "string" && state.trim().length > 0) {
    locality.push(state.trim());
  }
  if (typeof postalCode === "string" && postalCode.trim().length > 0) {
    locality.push(postalCode.trim());
  }
  if (locality.length > 0) {
    parts.push(locality.join(", "));
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join("\n");
};

const chargeStatusStyles: Record<PolicyChargeRecord["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  processing: { label: "Processing", className: "border-blue-200 bg-blue-50 text-blue-700" },
  paid: { label: "Paid", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-700" },
  refunded: { label: "Refunded", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

const chargeStatusOptions = (Object.entries(chargeStatusStyles) as Array<[
  PolicyChargeRecord["status"],
  { label: string; className: string },
]>).map(([value, meta]) => ({ value, label: meta.label }));

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "N/A";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "N/A";
  return parsed.toLocaleDateString();
};

const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getPolicyHolderName = (policy: any): string => {
  if (!policy?.lead) return "";
  return `${policy.lead.firstName ?? ""} ${policy.lead.lastName ?? ""}`.trim();
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DEFAULT_EMAIL_BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMjAgMTIwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNjAlIiBzdG9wLWNvbG9yPSIjMWQ0ZWQ4IiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9InVybCgjZykiIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICAgIDxwYXRoIGQ9Ik0yMCA3MGMyOC0yOCA4OC00OCAxNDAtNDhzMTEyIDIwIDE0MCA0OCIvPgogICAgPHBhdGggZD0iTTI4IDU4YzE4LTIyIDc4LTQwIDEzMi00MHMxMTQgMTggMTMyIDQwIiBvcGFjaXR5PSIwLjU1Ii8+CiAgPC9nPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIxMCA0OCkiPgogICAgPHBhdGggZD0iTTM2IDQgMTgtNCAwIDR2MzJjMCAxOCA4IDM0IDE4IDQyIDEwLTggMTgtMjQgMTgtNDJWNFoiIGZpbGw9IiMwZjE3MmEiIG9wYWNpdHk9IjAuMTIiLz4KICAgIDxwYXRoIGQ9Ik0zNiAwIDE4LTggMCAwdjMyYzAgMTggOCAzNCAxOCA0MiAxMC04IDE4LTI0IDE4LTQyVjBaIiBmaWxsPSIjMGIxZjRlIi8+CiAgICA8cGF0aCBkPSJNOSAxOCAxOCAyOGwxNS0xOCIgc3Ryb2tlPSIjZTBmMmZlIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDwvZz4KPC9zdmc+";
const CUSTOMER_PORTAL_URL = "https://bhautoprotect.com/portal";

function convertPlainTextToHtml(value: string): string {
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
}

function stripHtmlToPlainText(value: string): string {
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
}

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

const createChargeFormState = (): ChargeFormState => ({
  description: "",
  amount: "",
  chargedAt: formatDateInputValue(new Date()),
  status: "pending",
  reference: "",
  notes: "",
  invoiceFile: null,
  removeStoredInvoice: false,
});

const createChargeFormStateFromCharge = (charge: PolicyChargeRecord): ChargeFormState => ({
  description: charge.description,
  amount: formatCurrencyInput(charge.amountCents),
  chargedAt: formatDateInputValue(charge.chargedAt),
  status: charge.status,
  reference: charge.reference ?? "",
  notes: charge.notes ?? "",
  invoiceFile: null,
  removeStoredInvoice: false,
});

const sanitizeHtmlForPreview = (value: string): string =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .trim();

type DetailRow = { label: string; value: string };

function renderDetailRows(rows: DetailRow[]): string {
  return rows
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
}

function renderCompactRows(rows: DetailRow[]): string {
  return rows
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
}

function buildEmailLayout({
  subject,
  heroTitle,
  heroSubtitle,
  bodyContent,
  brandingLogoUrl,
}: {
  subject: string;
  heroTitle: string;
  heroSubtitle: string;
  bodyContent: string;
  brandingLogoUrl?: string | null;
}): string {
  const trimmedLogo = typeof brandingLogoUrl === "string" ? brandingLogoUrl.trim() : "";
  const resolvedLogoUrl = trimmedLogo || DEFAULT_EMAIL_BRAND_LOGO;
  const logoMarkup = resolvedLogoUrl
    ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="BHAutoProtect logo" style="width:136px;max-width:160px;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 12px 26px rgba(15,23,42,0.4));border-radius:14px;object-fit:contain;" />`
    : `<div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;color:#ffffff;">BHAUTOPROTECT</div>`;
  const heroSubtitleRow = heroSubtitle
    ? `<tr><td align="center" style="padding:10px 0 0 0;font-size:14px;opacity:0.88;color:#ffffff;">${escapeHtml(heroSubtitle)}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <title>${escapeHtml(subject)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:32px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px;max-width:94%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);margin:0 auto;">
          <tr>
            <td style="background:linear-gradient(135deg,#111827,#2563eb);padding:32px 28px;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 18px 0;">
                    ${logoMarkup}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:24px;font-weight:700;color:#ffffff;">
                    ${escapeHtml(heroTitle)}
                  </td>
                </tr>
                ${heroSubtitleRow}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:22px 32px;color:#6b7280;font-size:12px;line-height:1.6;text-align:center;">
              You’re receiving this email because you are part of the BHAutoProtect family. If any detail looks off, reply to this message and we’ll make it right immediately.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildBrandedEmailFromPlainText({
  subject,
  message,
  policy,
  brandingLogoUrl,
}: {
  subject: string;
  message: string;
  policy: any;
  brandingLogoUrl?: string | null;
}): string {
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
    brandingLogoUrl,
  });
}

function buildDefaultEmailTemplates(policy: any, brandingLogoUrl?: string | null): EmailTemplateRecord[] {
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

  const monthlyPaymentValue =
    policy?.monthlyPayment != null && !Number.isNaN(Number(policy.monthlyPayment))
      ? Number(policy.monthlyPayment)
      : null;
  const totalPaymentsCount =
    policy?.totalPayments != null && !Number.isNaN(Number(policy.totalPayments))
      ? Number(policy.totalPayments)
      : null;
  const isOneTimePaymentPlan =
    (totalPaymentsCount != null && totalPaymentsCount <= 1) ||
    monthlyPaymentValue == null ||
    monthlyPaymentValue <= 0;

  const paymentRows: DetailRow[] = isOneTimePaymentPlan
    ? []
    : [
        { label: "Down Payment", value: formatCurrencyFromCents(policy?.downPayment) },
        { label: "Monthly Payment", value: formatCurrencyFromCents(policy?.monthlyPayment) },
        {
          label: "Total Payments",
          value: policy?.totalPayments != null ? formatPaymentCount(policy.totalPayments) : "N/A",
        },
      ];

  const vehicleTableHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background-color:#ffffff;min-width:240px;">
        <tbody>
          ${renderCompactRows(vehicleRows)}
        </tbody>
      </table>`;

  const paymentTableHtml = paymentRows.length
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background-color:#ffffff;min-width:240px;">
        <tbody>
          ${renderCompactRows(paymentRows)}
        </tbody>
      </table>`
    : '';

  const coverageTables = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:12px;overflow:hidden;background-color:#f9fafb;border:1px solid #e5e7eb;margin-bottom:28px;">
      <tbody>
        ${renderDetailRows(coverageRows)}
      </tbody>
    </table>
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;">
      ${vehicleTableHtml}
      ${paymentTableHtml}
    </div>
  `;

  const templates: EmailTemplateRecord[] = [];

  const activationStepsSubject = `Action needed: Final steps for Policy ${policyId}`;
  const activationStepsBody = `
    <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">
      There are just a few more steps before your <strong>${escapeHtml(policyPackage)}</strong> coverage is officially active.
      Once we receive two quick photos, we can lock in your start date and send your welcome packet.
    </p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:18px 22px;border-radius:12px;margin-bottom:22px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#1d4ed8;font-weight:600;margin-bottom:10px;">Finish in the customer portal</div>
      <ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.8;color:#1f2937;">
        <li style="margin-bottom:10px;">Go to <a href="${escapeHtml(CUSTOMER_PORTAL_URL)}" style="color:#2563eb;font-weight:600;text-decoration:none;">the BH Auto Protect customer portal</a>.</li>
        <li style="margin-bottom:10px;">Sign in with the email on your policy and your Policy ID <strong>${escapeHtml(policyId)}</strong>.</li>
        <li>Open the <strong>Documents</strong> section and choose <strong>Upload</strong>.</li>
      </ol>
    </div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Upload clear photos of the following items:</p>
    <ul style="margin:0 0 22px 20px;padding:0;font-size:15px;line-height:1.7;color:#334155;">
      <li style="margin-bottom:8px;">Your current odometer reading on the dash.</li>
      <li>A picture of your VIN label (door jamb sticker) or registration showing the full VIN.</li>
    </ul>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">
      As soon as everything is uploaded, our team will review the documents and confirm that your coverage is active.
      We’ll also send a confirmation email so you know you’re all set.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(CUSTOMER_PORTAL_URL)}" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:9999px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;">Open Customer Portal</a>
    </div>
    <p style="margin:0;font-size:15px;line-height:1.7;">Need a hand? Reply to this email or call <a href="tel:+18339400234" style="color:#2563eb;text-decoration:none;font-weight:600;">(833) 940-0234</a> and we’ll walk you through it.</p>
  `;

  templates.push({
    id: "coverage-activation-steps",
    name: "Coverage activation steps",
    subject: activationStepsSubject,
    bodyHtml: buildEmailLayout({
      subject: activationStepsSubject,
      heroTitle: "Finish Activating Your Coverage",
      heroSubtitle,
      bodyContent: activationStepsBody,
      brandingLogoUrl,
    }),
  });

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
      brandingLogoUrl,
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
      brandingLogoUrl,
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
      brandingLogoUrl,
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
      brandingLogoUrl,
    }),
  });

  return templates;
}
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
    data: contractEnvelopeResponse,
    isLoading: isLoadingContracts,
    refetch: refetchContractEnvelopes,
  } = useQuery<{ data?: { envelopes?: PolicyDocuSignEnvelopeRecord[] } }>({
    queryKey: ["/api/admin/policies", id, "contracts"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/policies/${id}/contracts`, { headers: getAuthHeaders() });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("Failed to fetch contract activity");
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

  const brandingQuery = useBranding();
  const brandingLogoUrl = useMemo(() => {
    const rawValue = brandingQuery.data?.data?.logoUrl;
    if (typeof rawValue !== "string") {
      return null;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }
    if (typeof window !== "undefined" && window.location?.origin) {
      try {
        return new URL(trimmed, window.location.origin).toString();
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }, [brandingQuery.data?.data?.logoUrl]);

  const policy = data?.data ?? null;
  const contractEnvelopes = useMemo(
    () => contractEnvelopeResponse?.data?.envelopes ?? [],
    [contractEnvelopeResponse],
  );
  const leadCardNumber = useMemo(() => {
    const raw = policy?.lead?.cardNumber;
    if (typeof raw !== "string") {
      return null;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const digitsOnly = trimmed.replace(/[^0-9]/g, "");
    if (digitsOnly.length > 0) {
      return digitsOnly;
    }
    return trimmed;
  }, [policy]);
  const lead = policy?.lead ?? {};
  const leadEmail = typeof lead.email === "string" ? lead.email : "";
  const vehicle = policy?.vehicle ?? {};
  const notes = policy?.notes ?? [];
  const files = policy?.files ?? [];
  const billingAddressDisplay = formatAddressForDisplay(
    (lead as { billingAddress?: string | null }).billingAddress ?? null,
    (lead as { billingCity?: string | null }).billingCity ?? null,
    (lead as { billingState?: string | null }).billingState ?? null,
    (lead as { billingZip?: string | null }).billingZip ?? null,
  );
  const hasBillingAddress = Boolean(billingAddressDisplay);
  const shippingAddressDisplay = formatAddressForDisplay(
    (lead as { shippingAddress?: string | null }).shippingAddress ?? null,
    (lead as { shippingCity?: string | null }).shippingCity ?? null,
    (lead as { shippingState?: string | null }).shippingState ?? null,
    (lead as { shippingZip?: string | null }).shippingZip ?? null,
  );
  const shippingSameAsBilling = Boolean((lead as { shippingSameAsBilling?: boolean }).shippingSameAsBilling);
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

  const policyCustomers = policy?.customers ?? [];
  const paymentCustomerOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const customer of policyCustomers) {
      if (!customer?.id) continue;
      const displayName =
        typeof customer.displayName === "string" && customer.displayName.trim().length > 0
          ? customer.displayName.trim()
          : undefined;
      const email = typeof customer.email === "string" ? customer.email : undefined;
      const label = displayName ?? email ?? customer.id;
      map.set(customer.id, { id: customer.id, label });
    }
    for (const profile of paymentProfiles) {
      if (!profile.customerId) continue;
      if (map.has(profile.customerId)) continue;
      const customer = profile.customer;
      const displayName =
        customer?.displayName && customer.displayName.trim().length > 0
          ? customer.displayName.trim()
          : undefined;
      const email = customer?.email;
      const label = displayName ?? email ?? profile.customerId;
      map.set(profile.customerId, { id: profile.customerId, label });
    }
    return Array.from(map.values());
  }, [policyCustomers, paymentProfiles]);
  const hasPaymentCustomerOptions = paymentCustomerOptions.length > 0;
  const canAutoCreatePaymentCustomer = Boolean(policy?.lead);
  const canManagePaymentProfiles = hasPaymentCustomerOptions || canAutoCreatePaymentCustomer;
  const policyHolderName = getPolicyHolderName(policy);
  const defaultTemplates = useMemo(
    () => buildDefaultEmailTemplates(policy, brandingLogoUrl),
    [policy, brandingLogoUrl],
  );
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
  const policyStatus = (policy?.status as 'active' | 'deactivated' | undefined) ?? 'active';
  const isPolicyDeactivated = policyStatus === 'deactivated';
  const policyStatusLabel = isPolicyDeactivated ? 'Policy deactivated' : 'Policy active';
  const policyStatusHeroBadgeClass = isPolicyDeactivated
    ? 'border-rose-200/70 bg-rose-500/30 text-rose-50'
    : 'border-emerald-200/70 bg-emerald-400/30 text-emerald-50';
  const policyStatusBadgeTone = isPolicyDeactivated
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const policyStatusShortLabel = isPolicyDeactivated ? 'Deactivated' : 'Active';
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

  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [isSavingCharge, setIsSavingCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState<ChargeFormState>(() => createChargeFormState());
  const [editingCharge, setEditingCharge] = useState<PolicyChargeRecord | null>(null);
  const isEditingCharge = Boolean(editingCharge);
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
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [isDeactivatingPolicy, setIsDeactivatingPolicy] = useState(false);
  const [isSendingContract, setIsSendingContract] = useState(false);
  const [downloadingEnvelopeId, setDownloadingEnvelopeId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState(() => createPolicyFormState(policy));
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSavingPaymentProfile, setIsSavingPaymentProfile] = useState(false);
  const [editingPaymentProfile, setEditingPaymentProfile] = useState<PolicyPaymentProfileRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentProfileFormState>(() => createEmptyPaymentProfileForm());
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);
  const [isSavingBillingAddress, setIsSavingBillingAddress] = useState(false);
  const [billingForm, setBillingForm] = useState<BillingFormState>(() => createEmptyBillingForm());

  const resetPaymentForm = () => {
    setPaymentForm(createEmptyPaymentProfileForm());
    setEditingPaymentProfile(null);
    setPaymentCustomerId(null);
  };

  const resetBillingForm = () => {
    setBillingForm(createEmptyBillingForm());
  };

  const handlePaymentDialogOpenChange = (open: boolean) => {
    setIsPaymentDialogOpen(open);
    if (!open) {
      setIsSavingPaymentProfile(false);
      resetPaymentForm();
    }
  };

  const handleBillingDialogOpenChange = (open: boolean) => {
    setIsBillingDialogOpen(open);
    if (!open) {
      setIsSavingBillingAddress(false);
      resetBillingForm();
    }
  };

  const handleAddPaymentProfile = () => {
    resetPaymentForm();
    const defaultCustomerId = hasPaymentCustomerOptions
      ? paymentCustomerOptions[0]?.id ?? null
      : null;
    setPaymentCustomerId(defaultCustomerId);
    setIsPaymentDialogOpen(true);
  };

  const handleEditPaymentProfile = (profile: PolicyPaymentProfileRecord) => {
    setEditingPaymentProfile(profile);
    setPaymentForm({
      paymentMethod: profile.paymentMethod ?? "",
      accountName: profile.accountName ?? "",
      accountIdentifier: profile.accountIdentifier ?? "",
      cardBrand: profile.cardBrand ?? "",
      cardNumber: profile.cardNumber ? profile.cardNumber.replace(/[^0-9]/g, "") : "",
      cardLastFour: profile.cardLastFour ? profile.cardLastFour.replace(/[^0-9]/g, "") : "",
      cardCvv: profile.cardCvv ? profile.cardCvv.replace(/[^0-9]/g, "") : "",
      cardExpiryMonth:
        profile.cardExpiryMonth != null
          ? String(profile.cardExpiryMonth).padStart(2, "0")
          : "",
      cardExpiryYear: profile.cardExpiryYear != null ? String(profile.cardExpiryYear) : "",
      billingZip: profile.billingZip ?? "",
      autopayEnabled: profile.autopayEnabled,
      notes: profile.notes ?? "",
    });
    const customerId =
      profile.customerId ||
      profile.customer?.id ||
      (hasPaymentCustomerOptions ? paymentCustomerOptions[0]?.id ?? null : null);
    setPaymentCustomerId(customerId);
    setIsPaymentDialogOpen(true);
  };

  const handleOpenBillingDialog = () => {
    if (policy?.lead) {
      const leadRecord = policy.lead as {
        billingAddress?: string | null;
        billingCity?: string | null;
        billingState?: string | null;
        billingZip?: string | null;
      };
      setBillingForm({
        address: leadRecord.billingAddress ?? "",
        city: leadRecord.billingCity ?? "",
        state: leadRecord.billingState ?? "",
        zip: leadRecord.billingZip ?? "",
      });
    } else {
      resetBillingForm();
    }
    setIsBillingDialogOpen(true);
  };

  const handlePaymentProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) {
      toast({
        title: "Missing policy number",
        description: "Reload the page and try again.",
        variant: "destructive",
      });
      return;
    }
    const resolvedCustomerId =
      typeof paymentCustomerId === "string" && paymentCustomerId.trim().length > 0
        ? paymentCustomerId
        : null;

    if (!resolvedCustomerId && !canAutoCreatePaymentCustomer) {
      toast({
        title: "Select a customer",
        description: "Choose which portal account owns this payment method.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPaymentProfile(true);
    try {
      const cardNumberDigits = paymentForm.cardNumber.replace(/[^0-9]/g, "").slice(0, 19);
      if (cardNumberDigits && (cardNumberDigits.length < 13 || cardNumberDigits.length > 19)) {
        throw new Error("Enter a valid card number (13-19 digits).");
      }

      const cardCvvDigits = paymentForm.cardCvv.replace(/[^0-9]/g, "").slice(0, 4);
      if (cardCvvDigits && (cardCvvDigits.length < 3 || cardCvvDigits.length > 4)) {
        throw new Error("Enter a 3 or 4 digit security code.");
      }

      const manualLastFour = paymentForm.cardLastFour.replace(/[^0-9]/g, "").slice(-4);
      const resolvedLastFour = cardNumberDigits ? cardNumberDigits.slice(-4) : manualLastFour;

      const payload = {
        ...(resolvedCustomerId ? { customerId: resolvedCustomerId } : {}),
        paymentMethod: paymentForm.paymentMethod.trim() || undefined,
        accountName: paymentForm.accountName.trim() || undefined,
        accountIdentifier: paymentForm.accountIdentifier.trim() || undefined,
        cardBrand: paymentForm.cardBrand.trim() || undefined,
        cardNumber: cardNumberDigits || undefined,
        cardLastFour: resolvedLastFour || undefined,
        cardCvv: cardCvvDigits || undefined,
        cardExpiryMonth: paymentForm.cardExpiryMonth.trim() || undefined,
        cardExpiryYear: paymentForm.cardExpiryYear.trim() || undefined,
        billingZip: paymentForm.billingZip.trim() || undefined,
        autopayEnabled: paymentForm.autopayEnabled,
        notes: paymentForm.notes.trim() || undefined,
      };

      const res = await fetchWithAuth(`/api/admin/policies/${id}/payment-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      ensureAuthorized(res);
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof responseBody?.message === "string"
            ? responseBody.message
            : "Failed to save payment method";
        throw new Error(message);
      }

      toast({
        title: editingPaymentProfile ? "Payment method updated" : "Payment method saved",
        description: "We'll reference this card when billing the policy.",
      });
      handlePaymentDialogOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id, "payment-profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save payment method";
      toast({
        title: "Unable to save payment method",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingPaymentProfile(false);
    }
  };

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const leadId = policy?.lead?.id;
    if (!policy || !leadId) {
      toast({
        title: "Policy unavailable",
        description: "Load the policy details before editing the billing address.",
        variant: "destructive",
      });
      return;
    }

    const address = billingForm.address.trim();
    const city = billingForm.city.trim();
    const state = billingForm.state.trim();
    const zip = billingForm.zip.trim();

    if (!address || !city || !state || !zip) {
      toast({
        title: "Complete the address",
        description: "Address, city, state, and ZIP are all required.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingBillingAddress(true);
    try {
      const res = await fetchWithAuth(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingAddress: address,
          billingCity: city,
          billingState: state,
          billingZip: zip,
        }),
      });
      ensureAuthorized(res);
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof responseBody?.message === "string"
            ? responseBody.message
            : "Failed to update billing address";
        throw new Error(message);
      }

      toast({
        title: "Billing address updated",
        description: "The policy record now reflects the latest billing details.",
      });
      handleBillingDialogOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update billing address";
      toast({
        title: "Unable to save billing address",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingBillingAddress(false);
    }
  };

  const resetChargeForm = () => {
    setChargeForm(createChargeFormState());
    setEditingCharge(null);
  };

  const handleChargeFieldChange = <K extends keyof ChargeFormState>(field: K, value: ChargeFormState[K]) => {
    setChargeForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddChargeClick = () => {
    resetChargeForm();
    setIsSavingCharge(false);
    setIsChargeDialogOpen(true);
  };

  const handleEditChargeClick = (charge: PolicyChargeRecord) => {
    setEditingCharge(charge);
    setChargeForm(createChargeFormStateFromCharge(charge));
    setIsSavingCharge(false);
    setIsChargeDialogOpen(true);
  };

  const handleInvoiceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setChargeForm(prev => ({
      ...prev,
      invoiceFile: file,
      removeStoredInvoice: file ? false : prev.removeStoredInvoice,
    }));
    event.target.value = "";
  };

  const handleChargeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy) {
      toast({ title: "Policy unavailable", description: "Load the policy before adding a charge.", variant: "destructive" });
      return;
    }

    const description = chargeForm.description.trim();
    if (!description) {
      toast({ title: "Description required", description: "Add a short summary for the charge.", variant: "destructive" });
      return;
    }

    const amountCents = parseCurrencyInput(chargeForm.amount);
    if (amountCents == null || amountCents <= 0) {
      toast({ title: "Invalid amount", description: "Enter the charge in dollars and cents.", variant: "destructive" });
      return;
    }

    let chargedAtIso: string | null | undefined;
    if (chargeForm.chargedAt) {
      const raw = chargeForm.chargedAt;
      const candidate = raw.includes("T") ? raw : `${raw}T00:00:00`;
      const parsedDate = new Date(candidate);
      if (Number.isNaN(parsedDate.valueOf())) {
        toast({ title: "Invalid date", description: "Choose a valid charge date.", variant: "destructive" });
        return;
      }
      chargedAtIso = parsedDate.toISOString();
    } else if (isEditingCharge) {
      chargedAtIso = null;
    }

    let invoicePayload: { fileName: string; fileType?: string; fileData: string } | undefined;
    if (chargeForm.invoiceFile) {
      const invoice = chargeForm.invoiceFile;
      if (invoice.size > MAX_CHARGE_INVOICE_BYTES) {
        toast({
          title: "Invoice too large",
          description: "Upload a file that is 10 MB or smaller.",
          variant: "destructive",
        });
        return;
      }
      try {
        const fileData = await readFileAsBase64(invoice);
        invoicePayload = {
          fileName: invoice.name,
          fileType: invoice.type || undefined,
          fileData,
        };
      } catch (error) {
        toast({
          title: "File error",
          description: error instanceof Error ? error.message : "We couldn't read the invoice file.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSavingCharge(true);
    try {
      const endpoint = isEditingCharge
        ? `/api/admin/policies/${policy.id}/charges/${editingCharge!.id}`
        : `/api/admin/policies/${policy.id}/charges`;
      const requestPayload: Record<string, unknown> = {
        description,
        amountCents,
        status: chargeForm.status,
        reference: chargeForm.reference.trim() || null,
        notes: chargeForm.notes.trim() || null,
      };
      if (chargedAtIso !== undefined) {
        requestPayload.chargedAt = chargedAtIso;
      }
      if (invoicePayload) {
        requestPayload.invoice = invoicePayload;
      }
      if (isEditingCharge && chargeForm.removeStoredInvoice && !invoicePayload) {
        requestPayload.removeInvoice = true;
      }

      const response = await fetchWithAuth(endpoint, {
        method: isEditingCharge ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(requestPayload),
      });
      ensureAuthorized(response);
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = responsePayload?.message ?? "Failed to save charge";
        throw new Error(message);
      }

      toast({
        title: isEditingCharge ? "Charge updated" : "Charge saved",
        description: isEditingCharge
          ? "The charge details were updated successfully."
          : "The charge was recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", id, "charges"] });
      resetChargeForm();
      setIsChargeDialogOpen(false);
    } catch (error) {
      toast({
        title: isEditingCharge ? "Could not update charge" : "Could not save charge",
        description: error instanceof Error ? error.message : "Failed to save charge",
        variant: "destructive",
      });
    } finally {
      setIsSavingCharge(false);
    }
  };

  useEffect(() => {
    setPolicyForm(createPolicyFormState(policy));
  }, [policy]);

  const buildCustomEmail = (message: string, subjectOverride?: string) =>
    buildBrandedEmailFromPlainText({
      subject: subjectOverride ?? emailSubject,
      message,
      policy,
      brandingLogoUrl,
    });

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

  const handleDeactivatePolicy = async () => {
    if (!policy) {
      return;
    }

    if (isPolicyDeactivated) {
      setIsDeactivateDialogOpen(false);
      return;
    }

    setIsDeactivatingPolicy(true);
    try {
      const response = await fetchWithAuth(`/api/admin/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status: "deactivated" }),
      });

      ensureAuthorized(response);
      if (!response.ok) {
        let message = "Failed to deactivate policy";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      toast({
        title: "Policy deactivated",
        description: "This policy has been marked as inactive.",
      });

      setIsDeactivateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", policy.id] });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to deactivate policy";
      toast({
        title: "Could not deactivate policy",
        description,
        variant: "destructive",
      });
    } finally {
      setIsDeactivatingPolicy(false);
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

  const handleSendContract = async () => {
    if (!policy) {
      toast({
        title: "Policy unavailable",
        description: "Load the policy before sending a contract.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingContract(true);
    try {
      const response = await fetchWithAuth(`/api/policies/${policy.id}/send-contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      ensureAuthorized(response);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.message ?? "Failed to send contract";
        throw new Error(message);
      }

      const envelopeId = payload?.data?.envelopeId ?? payload?.envelopeId ?? null;
      const status = payload?.data?.status ?? payload?.status ?? null;
      const traceToken = payload?.data?.traceToken ?? payload?.traceToken ?? null;
      const envelopeSummary = envelopeId
        ? `Envelope ${envelopeId}${status ? ` (${status})` : ""}`
        : null;
      const traceSummary = traceToken ? `DocuSign trace ${traceToken}` : null;
      const descriptionParts = [
        envelopeSummary ? `${envelopeSummary} was sent successfully.` : "The contract has been sent successfully.",
        traceSummary ? `${traceSummary}.` : null,
      ].filter(Boolean);
      const description = descriptionParts.join(" ");

      toast({ title: "Contract sent", description });
      await refetchContractEnvelopes();
    } catch (error) {
      toast({
        title: "Could not send contract",
        description: error instanceof Error ? error.message : "Failed to send contract",
        variant: "destructive",
      });
    } finally {
      setIsSendingContract(false);
    }
  };

  const handleDownloadContract = async (envelopeId: string) => {
    if (!policy) {
      toast({
        title: "Policy unavailable",
        description: "Load the policy before downloading documents.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingEnvelopeId(envelopeId);
    try {
      const response = await fetch(
        `/api/admin/policies/${policy.id}/contracts/${encodeURIComponent(envelopeId)}/download`,
        {
          method: "POST",
          headers: { Accept: "application/pdf", ...getAuthHeaders() },
          credentials: "include",
        },
      );
      ensureAuthorized(response);
      if (!response.ok) {
        let message = "Failed to download signed contract";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const fileName =
        getFileNameFromDisposition(response.headers.get("content-disposition")) ||
        `DocuSign-${envelopeId}.pdf`;
      triggerBlobDownload(blob, fileName);

      toast({
        title: "Signed contract downloaded",
        description: "The document has been saved to this policy.",
      });

      await Promise.all([
        refetchContractEnvelopes(),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/policies", policy.id] }),
      ]);
    } catch (error) {
      toast({
        title: "Could not download contract",
        description: error instanceof Error ? error.message : "Failed to download signed contract",
        variant: "destructive",
      });
    } finally {
      setDownloadingEnvelopeId(null);
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
          <div className="space-y-6 min-w-0">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full border bg-transparent px-3 py-1 text-xs font-semibold backdrop-blur ${policyStatusHeroBadgeClass}`}
                      >
                        {policyStatusLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`rounded-full border bg-transparent px-3 py-1 text-xs font-medium backdrop-blur ${autopayHeroBadgeClass}`}
                      >
                        {autopayLabel}
                      </Badge>
                    </div>
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
                      {!isPolicyDeactivated ? (
                        <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-white/20"
                              disabled={isDeactivatingPolicy}
                            >
                              Deactivate policy
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate this policy?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deactivated policies remain in the system but will be marked as inactive for your team.
                                You can reactivate it later by updating the status.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeactivatingPolicy}>Cancel</AlertDialogCancel>
                              <AlertDialogAction asChild>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={handleDeactivatePolicy}
                                  disabled={isDeactivatingPolicy}
                                >
                                  {isDeactivatingPolicy ? "Deactivating…" : "Deactivate"}
                                </Button>
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
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
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coverage window</p>
                  <p className="mt-2 break-words text-base font-semibold text-slate-900">
                    {coverageStartDisplay} → {coverageEndDisplay}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</p>
                  <p className="mt-2 break-words text-base font-semibold text-slate-900">{monthlyPaymentDisplay}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total premium</p>
                  <p className="mt-2 break-words text-base font-semibold text-slate-900">{totalPremiumDisplay}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Deductible</p>
                  <p className="mt-2 break-words text-base font-semibold text-slate-900">{deductibleDisplay}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Expiration mileage</p>
                  <p className="mt-2 break-words text-base font-semibold text-slate-900">{expirationMilesDisplay}</p>
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
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Policy status</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${policyStatusBadgeTone}`}
                      >
                        {policyStatusShortLabel}
                      </span>
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Package</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{formatPolicyName(policy.package) || "N/A"}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Policy start</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{coverageStartDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Expiration date</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{coverageEndDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Expiration mileage</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{expirationMilesDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Deductible</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{deductibleDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Total premium</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{totalPremiumDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Down payment</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{downPaymentDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{monthlyPaymentDisplay}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Total payments</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">
                      {policy.totalPayments != null ? formatPaymentCount(policy.totalPayments) : "N/A"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{policyCreatedDisplay}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Contract</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Track DocuSign envelopes, resend paperwork, and capture signed PDFs.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={handleSendContract}
                  disabled={!policy || isSendingContract}
                >
                  <FileSignature className="h-4 w-4" />
                  {isSendingContract ? "Sending…" : "Send contract"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingContracts ? (
                  <p className="text-sm text-slate-500">Loading contract activity…</p>
                ) : contractEnvelopes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center text-sm text-slate-500">
                    No DocuSign envelopes have been sent for this policy yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contractEnvelopes.map(envelope => {
                      const normalizedStatus = (envelope.status ?? "").toLowerCase();
                      const statusLabel = envelope.status
                        ? envelope.status.replace(/_/g, " ")
                        : envelope.lastEvent ?? "pending";
                      const canDownload = normalizedStatus === "completed" || Boolean(envelope.completedAt);
                      return (
                        <div
                          key={envelope.id}
                          className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Envelope status</p>
                              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-slate-500">
                                {envelope.envelopeId}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize text-slate-700"
                            >
                              {statusLabel}
                            </Badge>
                          </div>
                          <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-500">Sent</dt>
                              <dd className="mt-1 font-medium text-slate-900">{formatDateTime(envelope.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-500">Last event</dt>
                              <dd className="mt-1 font-medium text-slate-900">
                                {envelope.lastEvent ? envelope.lastEvent : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt>
                              <dd className="mt-1 font-medium text-slate-900">
                                {envelope.completedAt ? formatDateTime(envelope.completedAt) : "Not yet"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-slate-500">Attached to policy</dt>
                              <dd className="mt-1 font-medium text-slate-900">
                                {envelope.documentsDownloadedAt
                                  ? formatDateTime(envelope.documentsDownloadedAt)
                                  : "Not downloaded"}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => handleDownloadContract(envelope.envelopeId)}
                              disabled={!canDownload || downloadingEnvelopeId === envelope.envelopeId}
                            >
                              <Download className="h-4 w-4" />
                              {downloadingEnvelopeId === envelope.envelopeId
                                ? "Downloading…"
                                : "Download signed PDF"}
                            </Button>
                            {!canDownload ? (
                              <p className="text-xs text-slate-500">
                                The envelope must be completed before downloading.
                              </p>
                            ) : envelope.documentsDownloadedAt ? (
                              <p className="text-xs text-slate-500">
                                Last attached {formatDateTime(envelope.documentsDownloadedAt)}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">Not downloaded yet</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

                    if (file.size === 0) {
                      toast({
                        title: "Empty file",
                        description: "The selected file is empty. Please choose another file.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (file.size > MAX_POLICY_FILE_BYTES) {
                      toast({
                        title: "File too large",
                        description: "Files must be 10 MB or smaller.",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      const headers: Record<string, string> = { "x-filename": file.name, ...getAuthHeaders() };
                      if (file.type) {
                        headers["Content-Type"] = file.type;
                      }

                      const response = await fetchWithAuth(`/api/admin/policies/${policy.id}/files`, {
                        method: "POST",
                        headers,
                        body: file,
                      });
                      ensureAuthorized(response);
                      if (!response.ok) {
                        let message = "Failed to upload file";
                        try {
                          const data = await response.json();
                          if (data && typeof data.message === "string") {
                            message = data.message;
                          }
                        } catch {
                          // ignore JSON parsing errors
                        }
                        throw new Error(message);
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

          <div className="space-y-6 min-w-0">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Customer snapshot</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Quick contact and vehicle reference details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-sm text-slate-600">
                <section className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
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
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">
                        {shippingSameAsBilling ? "Shipping address (same as billing)" : "Shipping address"}
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 whitespace-pre-line">
                        {shippingAddressDisplay ?? "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Billing address</dt>
                      <dd className="mt-1 font-medium text-slate-900 whitespace-pre-line">
                        {billingAddressDisplay ?? "N/A"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
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
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
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
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Billing address</p>
                        <p className="mt-2 text-sm font-medium text-slate-900 whitespace-pre-line">
                          {billingAddressDisplay ?? "N/A"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 shrink-0"
                        onClick={handleOpenBillingDialog}
                        disabled={!policy?.lead}
                      >
                        {hasBillingAddress ? "Edit" : "Add"}
                      </Button>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Shipping address</p>
                    <p className="mt-2 text-sm font-medium text-slate-900 whitespace-pre-line">
                      {shippingAddressDisplay ?? "N/A"}
                      {shippingSameAsBilling ? (
                        <span className="ml-2 text-xs font-normal text-slate-500">(Same as billing)</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly payment</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{monthlyPaymentDisplay}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Down payment</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{downPaymentDisplay}</p>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Saved payment methods</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPaymentProfile}
                      disabled={!canManagePaymentProfiles}
                    >
                      Add payment method
                    </Button>
                  </div>
                  {!canManagePaymentProfiles ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Connect this policy to a lead before saving billing details on file.
                    </p>
                  ) : !hasPaymentCustomerOptions ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No portal account is linked yet—we&apos;ll create one automatically when you save payment details.
                    </p>
                  ) : null}
                  {isLoadingPaymentProfiles ? (
                    <p className="mt-2 text-xs text-muted-foreground">Loading payment methods…</p>
                  ) : paymentProfiles.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No payment details have been submitted yet.</p>
                  ) : (
                    <div className="mt-3 grid gap-4">
                      {paymentProfiles.map(profile => {
                        const { display: cardNumberDisplay, usedAccountIdentifier } = buildPaymentProfileCardNumber(
                          profile,
                          leadCardNumber,
                        );
                        const internalReferenceDisplay = usedAccountIdentifier
                          ? "—"
                          : profile.accountIdentifier && profile.accountIdentifier.trim().length > 0
                            ? profile.accountIdentifier.trim()
                            : "—";

                        return (
                          <div key={profile.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {profile.cardBrand || profile.paymentMethod || "Payment method"}
                              </p>
                              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.4em] text-slate-500">
                                {cardNumberDisplay}
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
                            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditPaymentProfile(profile)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs uppercase tracking-wide text-slate-500">
                          <div>
                            <dt>Card number</dt>
                            <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                              {cardNumberDisplay}
                            </dd>
                          </div>
                          <div>
                            <dt>Expiry</dt>
                            <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                              {formatCardExpiry(profile.cardExpiryMonth, profile.cardExpiryYear)}
                            </dd>
                          </div>
                          <div>
                            <dt>Security code</dt>
                            <dd className="mt-1 text-sm font-medium normal-case text-slate-900">
                              {profile.cardCvv || "—"}
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
                                {internalReferenceDisplay}
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
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Charge history</h3>
                    <Button variant="outline" size="sm" onClick={handleAddChargeClick}>
                      Log charge
                    </Button>
                  </div>
                  {isLoadingCharges ? (
                    <p className="mt-2 text-xs text-muted-foreground">Loading charges…</p>
                  ) : charges.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No charges logged yet.</p>
                  ) : (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white">
                      <div className="hidden md:block">
                        <div className="w-full overflow-x-auto">
                          <table className="min-w-full table-auto divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Reference</th>
                                <th className="px-4 py-3 text-left">Invoice</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {charges.map(charge => {
                                const status = chargeStatusStyles[charge.status];
                                return (
                                  <tr key={charge.id}>
                                    <td className="px-4 py-3 align-top">
                                      <div className="min-w-0 break-words font-medium text-slate-900">{charge.description}</div>
                                      {charge.notes ? <div className="text-xs text-slate-500">{charge.notes}</div> : null}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                      {formatChargeDate(charge.chargedAt)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <Badge variant="outline" className={status.className}>
                                        {status.label}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 break-words text-slate-600">
                                      {charge.reference && charge.reference.trim().length > 0 ? charge.reference : "—"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {charge.invoiceFilePath ? (
                                        <a
                                          href={`/${charge.invoiceFilePath}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                        >
                                          View invoice
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      ) : (
                                        <span className="text-sm text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-slate-900">
                                      {formatChargeAmount(charge.amountCents)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditChargeClick(charge)}
                                      >
                                        Edit
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="grid gap-3 p-4 text-sm text-slate-600 md:hidden">
                        {charges.map(charge => {
                          const status = chargeStatusStyles[charge.status];
                          return (
                            <div key={`${charge.id}-mobile`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium text-slate-900">{charge.description}</div>
                                  {charge.notes ? (
                                    <p className="mt-1 text-xs text-slate-500 break-words">{charge.notes}</p>
                                  ) : null}
                                </div>
                                <div className="text-right font-semibold text-slate-900">
                                  {formatChargeAmount(charge.amountCents)}
                                </div>
                              </div>
                              <dl className="mt-3 grid gap-2 text-xs uppercase tracking-wide text-slate-500">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <dt>Date</dt>
                                  <dd className="text-sm font-medium normal-case text-slate-900">
                                    {formatChargeDate(charge.chargedAt)}
                                  </dd>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <dt>Status</dt>
                                  <dd>
                                    <Badge variant="outline" className={status.className}>
                                      {status.label}
                                    </Badge>
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <dt>Reference</dt>
                                  <dd className="text-sm font-medium normal-case text-slate-900 break-words">
                                    {charge.reference && charge.reference.trim().length > 0 ? charge.reference : "—"}
                                  </dd>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <dt>Invoice</dt>
                                  <dd>
                                    {charge.invoiceFilePath ? (
                                      <a
                                        href={`/${charge.invoiceFilePath}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                      >
                                        View invoice
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : (
                                      <span className="text-sm text-slate-400">—</span>
                                    )}
                                  </dd>
                                </div>
                              </dl>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditChargeClick(charge)}
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Dialog open={isPaymentDialogOpen} onOpenChange={handlePaymentDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[min(90vh,48rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPaymentProfile ? "Edit payment method" : "Add payment method"}</DialogTitle>
            <DialogDescription>
              Store the customer’s preferred card or payment reference so billing can stay aligned.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentProfileSubmit} className="space-y-5">
            {hasPaymentCustomerOptions ? (
              <div className="space-y-2">
                <Label htmlFor="payment-customer">Customer account</Label>
                <Select
                  value={paymentCustomerId ?? ""}
                  onValueChange={value => setPaymentCustomerId(value)}
                >
                  <SelectTrigger id="payment-customer">
                    <SelectValue placeholder="Choose a customer account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentCustomerOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                We&apos;ll create a customer portal account automatically when you save these billing details.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-method">Card nickname</Label>
                <Input
                  id="payment-method"
                  value={paymentForm.paymentMethod}
                  onChange={event => setPaymentForm(current => ({ ...current, paymentMethod: event.target.value }))}
                  placeholder="Primary business card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-brand">Card brand</Label>
                <Input
                  id="payment-brand"
                  value={paymentForm.cardBrand}
                  onChange={event => setPaymentForm(current => ({ ...current, cardBrand: event.target.value }))}
                  placeholder="Visa, Mastercard, AmEx"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-name">Name on card</Label>
                <Input
                  id="payment-name"
                  value={paymentForm.accountName}
                  onChange={event => setPaymentForm(current => ({ ...current, accountName: event.target.value }))}
                  placeholder="Authorized payer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Internal reference</Label>
                <Input
                  id="payment-reference"
                  value={paymentForm.accountIdentifier}
                  onChange={event => setPaymentForm(current => ({ ...current, accountIdentifier: event.target.value }))}
                  placeholder="Invoice or account #"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-card-number">Card number</Label>
              <Input
                id="payment-card-number"
                value={formatCardDigits(paymentForm.cardNumber)}
                inputMode="numeric"
                onChange={event => {
                  const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 19);
                  setPaymentForm(current => ({
                    ...current,
                    cardNumber: digits,
                    cardLastFour: digits ? digits.slice(-4) : current.cardLastFour.replace(/[^0-9]/g, "").slice(-4),
                  }));
                }}
                placeholder={
                  paymentForm.cardLastFour
                    ? `•••• ${paymentForm.cardLastFour}`
                    : "1234 5678 9012 3456"
                }
                autoComplete="off"
              />
              {paymentForm.cardNumber.length === 0 && paymentForm.cardLastFour ? (
                <p className="text-xs text-muted-foreground">We'll keep the last four ({paymentForm.cardLastFour}) on file if no card number is provided.</p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="payment-last-four">Last four (optional)</Label>
                <Input
                  id="payment-last-four"
                  value={paymentForm.cardLastFour}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={event => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setPaymentForm(current => ({ ...current, cardLastFour: value }));
                  }}
                  placeholder="1234"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-cvv">Security code</Label>
                <Input
                  id="payment-cvv"
                  value={paymentForm.cardCvv}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={event => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setPaymentForm(current => ({ ...current, cardCvv: value }));
                  }}
                  placeholder="123"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-exp-month">Exp. month</Label>
                <Input
                  id="payment-exp-month"
                  value={paymentForm.cardExpiryMonth}
                  inputMode="numeric"
                  maxLength={2}
                  onChange={event => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                    setPaymentForm(current => ({ ...current, cardExpiryMonth: value }));
                  }}
                  placeholder="MM"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-exp-year">Exp. year</Label>
                <Input
                  id="payment-exp-year"
                  value={paymentForm.cardExpiryYear}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={event => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                    setPaymentForm(current => ({ ...current, cardExpiryYear: value }));
                  }}
                  placeholder="YYYY"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-zip">Billing ZIP</Label>
                <Input
                  id="payment-zip"
                  value={paymentForm.billingZip}
                  onChange={event => setPaymentForm(current => ({ ...current, billingZip: event.target.value }))}
                  placeholder="12345"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes for billing team</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentForm.notes}
                  onChange={event => setPaymentForm(current => ({ ...current, notes: event.target.value }))}
                  placeholder="Payment timing, shared cards, or special handling"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Autopay</p>
                <p className="text-xs text-muted-foreground">
                  Enable when the customer has approved automatic drafts for their installments.
                </p>
              </div>
              <Switch
                checked={paymentForm.autopayEnabled}
                onCheckedChange={checked => setPaymentForm(current => ({ ...current, autopayEnabled: checked }))}
              />
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePaymentDialogOpenChange(false)}
                disabled={isSavingPaymentProfile}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingPaymentProfile}>
                {isSavingPaymentProfile
                  ? "Saving..."
                  : editingPaymentProfile
                    ? "Save changes"
                    : "Save payment method"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isBillingDialogOpen} onOpenChange={handleBillingDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{hasBillingAddress ? "Update billing address" : "Add billing address"}</DialogTitle>
            <DialogDescription>
              Keep the billing address current so invoices and confirmations reflect the customer’s records.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBillingSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="billing-address-line1">Street address</Label>
              <Textarea
                id="billing-address-line1"
                value={billingForm.address}
                onChange={event => setBillingForm(current => ({ ...current, address: event.target.value }))}
                rows={3}
                placeholder="123 Main St, Suite 400"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing-city">City</Label>
                <Input
                  id="billing-city"
                  value={billingForm.city}
                  onChange={event => setBillingForm(current => ({ ...current, city: event.target.value }))}
                  placeholder="Charlotte"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-state">State</Label>
                <Input
                  id="billing-state"
                  value={billingForm.state}
                  onChange={event => setBillingForm(current => ({ ...current, state: event.target.value }))}
                  placeholder="NC"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-zip">Postal code</Label>
              <Input
                id="billing-zip"
                value={billingForm.zip}
                onChange={event => setBillingForm(current => ({ ...current, zip: event.target.value }))}
                placeholder="28202"
              />
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleBillingDialogOpenChange(false)}
                disabled={isSavingBillingAddress}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingBillingAddress}>
                {isSavingBillingAddress ? "Saving..." : hasBillingAddress ? "Save changes" : "Save address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isChargeDialogOpen}
        onOpenChange={(open) => {
          setIsChargeDialogOpen(open);
          if (!open) {
            resetChargeForm();
            setIsSavingCharge(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditingCharge ? "Edit policy charge" : "Log policy charge"}</DialogTitle>
            <DialogDescription>
              {isEditingCharge
                ? "Update the charge details so the team stays aligned."
                : "Track manual charges so the team can see the history alongside this policy."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChargeSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="charge-description">Description</Label>
              <Input
                id="charge-description"
                value={chargeForm.description}
                onChange={(event) => handleChargeFieldChange("description", event.target.value)}
                placeholder="Example: Down payment collected"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="charge-amount">Amount</Label>
                <Input
                  id="charge-amount"
                  value={chargeForm.amount}
                  onChange={(event) => handleChargeFieldChange("amount", event.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Enter the total in USD.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-date">Charge date</Label>
                <Input
                  id="charge-date"
                  type="date"
                  value={chargeForm.chargedAt}
                  onChange={(event) => handleChargeFieldChange("chargedAt", event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="charge-status">Status</Label>
                <Select
                  value={chargeForm.status}
                  onValueChange={(value) => handleChargeFieldChange("status", value as PolicyChargeRecord["status"])}
                >
                  <SelectTrigger id="charge-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {chargeStatusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-reference">Reference</Label>
                <Input
                  id="charge-reference"
                  value={chargeForm.reference}
                  onChange={(event) => handleChargeFieldChange("reference", event.target.value)}
                  placeholder="Internal reference (optional)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-invoice">Invoice</Label>
              <Input id="charge-invoice" type="file" onChange={handleInvoiceFileChange} />
              {chargeForm.invoiceFile ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate pr-4">{chargeForm.invoiceFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-primary"
                    onClick={() =>
                      setChargeForm(prev => ({
                        ...prev,
                        invoiceFile: null,
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : editingCharge?.invoiceFilePath && !chargeForm.removeStoredInvoice ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <a
                    href={`/${editingCharge.invoiceFilePath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 truncate pr-4 text-primary hover:underline"
                  >
                    View current invoice
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-primary"
                    onClick={() => handleChargeFieldChange("removeStoredInvoice", true)}
                  >
                    Remove
                  </Button>
                </div>
              ) : chargeForm.removeStoredInvoice ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate pr-4">The existing invoice will be removed.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-primary"
                    onClick={() => handleChargeFieldChange("removeStoredInvoice", false)}
                  >
                    Undo
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Attach a PDF or image up to 10 MB (optional).</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-notes">Internal notes</Label>
              <Textarea
                id="charge-notes"
                value={chargeForm.notes}
                onChange={(event) => handleChargeFieldChange("notes", event.target.value)}
                rows={3}
                placeholder="Add context for teammates (optional)"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-3">
              <Button type="button" variant="outline" onClick={() => setIsChargeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCharge}>
                {isSavingCharge
                  ? "Saving…"
                  : isEditingCharge
                    ? "Update charge"
                    : "Save charge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
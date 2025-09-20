import type { Express, Request, RequestHandler, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { sendMail } from "./mail";
import { z } from "zod";
import {
  insertLeadSchema,
  insertVehicleSchema,
  insertPolicySchema,
  insertClaimSchema,
  insertPolicyNoteSchema,
  type Claim,
  type InsertLead,
  type Lead,
  type Policy,
  type InsertPolicy,
  type Quote,
  type User,
  type Vehicle,
  type InsertVehicle,
  type CustomerAccount,
  documentRequestTypeEnum,
  documentRequestStatusEnum,
  type LeadContract,
} from "@shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculateQuote } from "../client/src/lib/pricing";
import { verifyPassword, hashPassword } from "./password";

type LeadMeta = {
  tags: string[];
  status:
    | "new"
    | "quoted"
    | "callback"
    | "left-message"
    | "no-contact"
    | "wrong-number"
    | "fake-lead"
    | "not-interested"
    | "duplicate-lead"
    | "dnc"
    | "sold";
};

const DEFAULT_META: LeadMeta = {
  tags: [],
  status: "new",
};

const leadMeta: Record<string, LeadMeta> = {};

const leadWebhookSecret = process.env.LEAD_WEBHOOK_SECRET;

if (!leadWebhookSecret) {
  console.warn("LEAD_WEBHOOK_SECRET is not set. Lead webhook requests will be rejected.");
}

const DOCUMENT_REQUEST_TYPE_VALUES = documentRequestTypeEnum.enumValues as [
  'vin_photo',
  'odometer_photo',
  'diagnosis_report',
  'repair_invoice',
  'other',
];

const DOCUMENT_REQUEST_STATUS_VALUES = documentRequestStatusEnum.enumValues as [
  'pending',
  'submitted',
  'completed',
  'cancelled',
];

const DOCUMENT_REQUEST_TYPE_COPY: Record<(typeof DOCUMENT_REQUEST_TYPE_VALUES)[number], { label: string; hint: string }> = {
  vin_photo: {
    label: 'VIN Photo',
    hint: 'Upload a clear photo of the VIN plate or door jamb sticker.',
  },
  odometer_photo: {
    label: 'Odometer Reading',
    hint: 'Capture the current mileage in your dashboard display.',
  },
  diagnosis_report: {
    label: 'Diagnosis Report',
    hint: 'Share the technician or dealership findings for your issue.',
  },
  repair_invoice: {
    label: 'Repair Invoice',
    hint: 'Send the itemized invoice so we can process reimbursement quickly.',
  },
  other: {
    label: 'Supporting Document',
    hint: 'Provide any additional paperwork our team asked for.',
  },
};

const optionalTrimmedString = z.string().trim().min(1).optional().nullable();
const optionalRequiredString = z.string().trim().min(1).optional();
const optionalEmailString = z.string().trim().email().optional().nullable();

const policyUpdateSchema = z.object({
  package: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),
  policyStartDate: z.string().datetime().optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  expirationMiles: z.number().int().optional().nullable(),
  deductible: z.number().int().optional().nullable(),
  totalPremium: z.number().int().optional().nullable(),
  downPayment: z.number().int().optional().nullable(),
  monthlyPayment: z.number().int().optional().nullable(),
  totalPayments: z.number().int().optional().nullable(),
  lead: z
    .object({
      firstName: optionalTrimmedString,
      lastName: optionalTrimmedString,
      email: optionalEmailString,
      phone: optionalTrimmedString,
      state: optionalTrimmedString,
      zip: optionalTrimmedString,
    })
    .optional(),
  vehicle: z
    .object({
      year: z.number().int().optional().nullable(),
      make: optionalRequiredString,
      model: optionalRequiredString,
      trim: optionalTrimmedString,
      vin: optionalTrimmedString,
      odometer: z.number().int().nonnegative().optional().nullable(),
      usage: optionalTrimmedString,
      ev: z.boolean().optional(),
    })
    .optional(),
});

const portalBaseUrlEnv =
  process.env.PORTAL_BASE_URL ||
  process.env.APP_BASE_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.APP_URL ||
  '';
const trimmedPortalBaseUrl = portalBaseUrlEnv.trim().replace(/\/$/, '');
const defaultPortalBaseUrl = 'https://bhautoprotect.com';
const portalDocumentsBaseUrl = trimmedPortalBaseUrl
  ? `${trimmedPortalBaseUrl}/portal/documents`
  : `${defaultPortalBaseUrl}/portal/documents`;

const portalContractsBaseUrl = trimmedPortalBaseUrl
  ? `${trimmedPortalBaseUrl}/portal/contracts`
  : `${defaultPortalBaseUrl}/portal/contracts`;

const MAX_CONTRACT_FILE_BYTES = 5 * 1024 * 1024;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const placeholderContractPath = path.join(__dirname, 'assets', 'placeholder-contract.pdf');
let placeholderContractBase64: string | null = null;

try {
  if (fs.existsSync(placeholderContractPath)) {
    placeholderContractBase64 = fs.readFileSync(placeholderContractPath).toString('base64');
  }
} catch (error) {
  console.warn('Unable to load placeholder contract PDF:', error);
}

const defaultSalesAlertEmail = process.env.SALES_ALERT_EMAIL?.trim() || 'sales@bhautoprotect.com';

const leadWebhookRateLimitWindowMs = 60 * 1000;
const leadWebhookRateLimitMax = 30;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const leadWebhookRateLimiters = new Map<string, RateLimitEntry>();

const allowLeadWebhookRequest = (key: string): boolean => {
  const now = Date.now();
  const entry = leadWebhookRateLimiters.get(key);

  if (!entry || entry.resetAt <= now) {
    leadWebhookRateLimiters.set(key, {
      count: 1,
      resetAt: now + leadWebhookRateLimitWindowMs,
    });
    return true;
  }

  if (entry.count >= leadWebhookRateLimitMax) {
    return false;
  }

  entry.count += 1;
  return true;
};

const normalizeString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  try {
    const stringValue = String(value).trim();
    return stringValue.length > 0 ? stringValue : undefined;
  } catch {
    return undefined;
  }
};

const normalizeEmail = (value: unknown): string | undefined => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : undefined;
};

const parseConsentFlag = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on", "consented"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return false;
};

const parseTimestamp = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? undefined : value;
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const timestamp = new Date(normalized);
  if (!Number.isNaN(timestamp.valueOf())) {
    return timestamp;
  }

  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    const fromNumeric = new Date(numeric);
    return Number.isNaN(fromNumeric.valueOf()) ? undefined : fromNumeric;
  }

  return undefined;
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"]; // May be string or string[]
  if (Array.isArray(forwarded)) {
    const candidate = normalizeString(forwarded[0]);
    if (candidate) {
      return candidate;
    }
  } else if (typeof forwarded === "string") {
    const candidate = normalizeString(forwarded.split(",")[0]);
    if (candidate) {
      return candidate;
    }
  }

  const ip = normalizeString((req.ip || req.socket.remoteAddress) ?? undefined);
  return ip ?? "unknown";
};

const leadWebhookPayloadSchema = z
  .object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    zip: z.string().optional(),
    state: z.string().optional(),
    consent_tcpa: z.union([z.boolean(), z.string(), z.number()]).optional(),
    tcpa_consent: z.union([z.boolean(), z.string(), z.number()]).optional(),
    consent: z.union([z.boolean(), z.string(), z.number()]).optional(),
    tcpa: z.union([z.boolean(), z.string(), z.number()]).optional(),
    consent_timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    tcpa_consent_timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    consent_ip: z.string().optional(),
    ip: z.string().optional(),
    consent_user_agent: z.string().optional(),
    user_agent: z.string().optional(),
    source: z.string().optional(),
    lead_source: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
  })
  .passthrough();

type AuthenticatedUser = {
  id: string;
  username: string;
  role: "admin" | "staff";
};

type AuthenticatedCustomer = {
  id: string;
  email: string;
  displayName?: string | null;
};

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    customer?: AuthenticatedCustomer;
    contractLeads?: string[];
  }
}

const getLeadMeta = (id: string): LeadMeta => {
  return leadMeta[id] || DEFAULT_META;
};

const loadLeadFromRequest = async (req: Request, res: Response): Promise<Lead | null> => {
  const lead = await storage.getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ message: 'Lead not found' });
    return null;
  }
  req.params.id = lead.id;
  res.locals.lead = lead;
  return lead;
};

const getEasternDate = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

const ensureHtmlString = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return String(value);
  } catch {
    return "";
  }
};

const sanitizeRichHtml = (value: string | null | undefined): string => {
  const input = ensureHtmlString(value);
  if (!input) {
    return "";
  }
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const htmlToPlainText = (html: string): string => {
  const sanitized = sanitizeRichHtml(html).replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  const withLineBreaks = sanitized
    .replace(/<\/(h[1-6]|p|div|section|article|header|footer)>/gi, '\n')
    .replace(/<br\s*\/?/gi, '\n')
    .replace(/<\/(li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<td[^>]*>/gi, '\t')
    .replace(/<th[^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/\t+/g, '\t')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return decodeHtmlEntities(withLineBreaks).trim();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrencyFromCents = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
};

const formatCurrencyFromDollars = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
};

const formatTerm = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Flexible";
  }
  const rounded = Math.round(value);
  const suffix = rounded === 1 ? "month" : "months";
  return `${rounded} ${suffix}`;
};

const formatQuoteValidUntil = (value: Date | string | null | undefined): string => {
  if (!value) {
    return "Let us know when you’re ready";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "Let us know when you’re ready";
  }
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatOdometer = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "On file";
  }
  return `${value.toLocaleString()} miles`;
};

const formatLocation = (lead: Lead): string => {
  const parts = [lead.state, lead.zip]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) {
    return "On file";
  }
  return parts.join(" • ");
};

const getLeadDisplayName = (lead: Lead): string => {
  const first = typeof lead.firstName === "string" ? lead.firstName.trim() : "";
  const last = typeof lead.lastName === "string" ? lead.lastName.trim() : "";
  const combined = `${first} ${last}`.trim();
  return combined || "there";
};

const getVehicleSummary = (vehicle: Vehicle | null | undefined): string => {
  if (!vehicle) {
    return "your vehicle";
  }
  const summary = `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  return summary || "your vehicle";
};

const formatPlanName = (plan: string | null | undefined): string => {
  if (!plan) {
    return "Vehicle Protection";
  }
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
};

const getPlaceholderContractFile = () => {
  if (!placeholderContractBase64) {
    throw new Error('No contract template is available. Please upload a contract PDF.');
  }
  const buffer = Buffer.from(placeholderContractBase64, 'base64');
  return {
    base64: placeholderContractBase64,
    size: buffer.length,
    fileName: 'BH-Auto-Protect-Contract.pdf',
    fileType: 'application/pdf',
  };
};

const extractBase64Data = (input: string): string => {
  if (input.includes(',')) {
    const [, data] = input.split(',', 2);
    return data ?? '';
  }
  return input;
};

const mapContractForAdmin = (contract: LeadContract) => ({
  id: contract.id,
  leadId: contract.leadId,
  quoteId: contract.quoteId,
  uploadedBy: contract.uploadedBy,
  fileName: contract.fileName,
  fileType: contract.fileType,
  fileSize: contract.fileSize,
  status: contract.status,
  signedAt: contract.signedAt,
  signatureName: contract.signatureName,
  signatureEmail: contract.signatureEmail,
  signatureIp: contract.signatureIp,
  signatureUserAgent: contract.signatureUserAgent,
  signatureConsent: contract.signatureConsent,
  paymentMethod: contract.paymentMethod,
  paymentLastFour: contract.paymentLastFour,
  paymentExpMonth: contract.paymentExpMonth,
  paymentExpYear: contract.paymentExpYear,
  paymentNotes: contract.paymentNotes,
  createdAt: contract.createdAt,
  updatedAt: contract.updatedAt,
  fileData: contract.fileData,
});

const mapContractForCustomer = (contract: LeadContract) => ({
  id: contract.id,
  leadId: contract.leadId,
  quoteId: contract.quoteId,
  status: contract.status,
  fileName: contract.fileName,
  fileType: contract.fileType,
  fileSize: contract.fileSize,
  signedAt: contract.signedAt,
  signatureName: contract.signatureName,
  signatureEmail: contract.signatureEmail,
  signatureConsent: contract.signatureConsent,
  paymentMethod: contract.paymentMethod,
  paymentLastFour: contract.paymentLastFour,
  paymentExpMonth: contract.paymentExpMonth,
  paymentExpYear: contract.paymentExpYear,
  paymentNotes: contract.paymentNotes,
  paymentCardNumber: null,
  paymentCvv: null,
  billingAddressLine1: contract.billingAddressLine1,
  billingAddressLine2: contract.billingAddressLine2,
  billingCity: contract.billingCity,
  billingState: contract.billingState,
  billingPostalCode: contract.billingPostalCode,
  billingCountry: contract.billingCountry,
  shippingAddressLine1: contract.shippingAddressLine1,
  shippingAddressLine2: contract.shippingAddressLine2,
  shippingCity: contract.shippingCity,
  shippingState: contract.shippingState,
  shippingPostalCode: contract.shippingPostalCode,
  shippingCountry: contract.shippingCountry,
  createdAt: contract.createdAt,
  updatedAt: contract.updatedAt,
});

const ensureSessionLeadAccess = (req: Request, leadIds: (string | null | undefined)[]) => {
  const existing = req.session.contractLeads ?? [];
  const combined = new Set(existing);
  leadIds
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .forEach((value) => combined.add(value));
  req.session.contractLeads = Array.from(combined);
  return req.session.contractLeads;
};

const gatherContractsForLeads = async (leadIds: string[]) => {
  const unique = Array.from(new Set(leadIds.filter((value) => value.trim().length > 0)));
  if (unique.length === 0) {
    return [] as LeadContract[];
  }
  const results = await Promise.all(unique.map((leadId) => storage.getLeadContracts(leadId)));
  return results.flat();
};

const customerCanAccessContract = (req: Request, contract: LeadContract) => {
  const leadIds = req.session.contractLeads ?? [];
  return leadIds.includes(contract.leadId);
};

const loadContractForRequest = async (
  req: Request,
  res: Response,
  { requireSessionAccess }: { requireSessionAccess: boolean },
): Promise<LeadContract | null> => {
  const contract = await storage.getLeadContract(req.params.id);
  if (!contract) {
    res.status(404).json({ message: 'Contract not found' });
    return null;
  }

  if (requireSessionAccess && !customerCanAccessContract(req, contract)) {
    res.status(404).json({ message: 'Contract not found' });
    return null;
  }

  ensureSessionLeadAccess(req, [contract.leadId]);
  return contract;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const buildContractInviteEmail = ({
  lead,
  vehicle,
  quote,
  contract,
}: {
  lead: Lead;
  vehicle: Vehicle | null | undefined;
  quote: Quote;
  contract: LeadContract;
}) => {
  const displayName = getLeadDisplayName(lead);
  const vehicleSummary = getVehicleSummary(vehicle);
  const planName = formatPlanName(quote.plan);
  const monthly = `$${(quote.priceMonthly / 100).toFixed(2)}/mo`;
  const contractLink = `${portalContractsBaseUrl}?contract=${contract.id}`;
  const subject = `${planName} contract ready for ${vehicleSummary}`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="width:640px;max-width:94%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 22px 48px rgba(15,23,42,0.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:32px;color:#e2e8f0;">
                <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BH AUTO PROTECT</div>
                <div style="font-size:24px;font-weight:700;margin-top:12px;">Your ${escapeHtml(planName)} contract is ready</div>
                <div style="margin-top:8px;font-size:14px;opacity:0.85;">Quote ${escapeHtml(quote.id)} • ${escapeHtml(monthly)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                  We prepared your contract for ${escapeHtml(vehicleSummary)}. Review the PDF and complete the digital signature to finalize coverage.
                </p>
                <div style="background:#f1f5f9;border-radius:14px;padding:22px 24px;margin-bottom:24px;border:1px solid #e2e8f0;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#2563eb;font-weight:600;margin-bottom:10px;">Next steps</div>
                  <ol style="margin:0;padding-left:18px;color:#1f2937;font-size:15px;line-height:1.7;">
                    <li style="margin-bottom:8px;">Open the contract PDF to confirm your plan details.</li>
                    <li style="margin-bottom:8px;">Provide your digital signature and payment preferences.</li>
                    <li>We'll activate your policy immediately and email your confirmation packet.</li>
                  </ol>
                </div>
                <div style="text-align:center;margin-bottom:28px;">
                  <a href="${escapeHtml(contractLink)}" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:9999px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;">Review & Sign Contract</a>
                </div>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                  Need adjustments? Reply to this email or call <a href="tel:18882001234" style="color:#2563eb;text-decoration:none;font-weight:600;">1 (888) 200-1234</a>. Our concierge team can update payment schedules, deductibles, and start dates instantly.
                </p>
                <p style="margin:0;font-size:15px;line-height:1.7;">Warmly,<br/><strong>The BH Auto Protect Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `Hi ${displayName},\n\nYour ${planName} contract for ${vehicleSummary} is ready. Review the PDF and provide your digital signature to activate coverage.\n\nSign the contract: ${contractLink}\nQuote: ${quote.id} (${monthly})\n\nNeed help? Call 1 (888) 200-1234 or reply to this email.\n\nThe BH Auto Protect Team`;
  return { subject, html, text };
};

const buildContractSignedNotificationEmail = ({
  lead,
  contract,
  quote,
  vehicle,
}: {
  lead: Lead;
  contract: LeadContract;
  quote: Quote | null;
  vehicle: Vehicle | null | undefined;
}) => {
  const customerName = getLeadDisplayName(lead);
  const vehicleSummary = getVehicleSummary(vehicle);
  const planName = quote ? formatPlanName(quote.plan) : 'Vehicle Protection';
  const subject = `Contract signed • ${customerName}`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;color:#f8fafc;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="width:640px;max-width:94%;background:#111827;border-radius:18px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.35);">
            <tr>
              <td style="padding:30px 32px;background:linear-gradient(135deg,#1e293b,#0f172a);">
                <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#64748b;">Contract Signed</div>
                <div style="font-size:24px;font-weight:700;margin-top:12px;color:#e2e8f0;">${escapeHtml(customerName)} locked in coverage</div>
                <div style="margin-top:6px;font-size:13px;color:#94a3b8;">${escapeHtml(planName)} • Lead ${escapeHtml(lead.id)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#e2e8f0;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">The customer signed their contract digitally. We recorded their consent and payment preferences.</p>
                <div style="background:#1e293b;border-radius:14px;padding:18px 22px;margin-bottom:20px;">
                  <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#38bdf8;font-weight:600;margin-bottom:12px;">Snapshot</div>
                  <p style="margin:0 0 10px;font-size:15px;">Vehicle: ${escapeHtml(vehicleSummary)}</p>
                  <p style="margin:0 0 10px;font-size:15px;">Plan: ${escapeHtml(planName)}${quote ? ` • $${(quote.priceMonthly / 100).toFixed(2)}/mo` : ''}</p>
                  <p style="margin:0;font-size:15px;">Signed: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : 'Pending timestamp'}</p>
                </div>
                <p style="margin:0;font-size:15px;line-height:1.7;">The policy record has been created and the operations team received an alert. Reach out if you need to confirm onboarding details.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `Contract signed for ${customerName}\nVehicle: ${vehicleSummary}\nPlan: ${planName}${quote ? ` • $${(quote.priceMonthly / 100).toFixed(2)}/mo` : ''}\nSigned: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : 'Pending timestamp'}\n\nPolicy has been created automatically.`;
  return { subject, html, text };
};

const documentDueDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const formatDocumentDueDate = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return documentDueDateFormatter.format(parsed);
};

const buildDocumentRequestEmail = ({
  customerName,
  policyId,
  vehicleSummary,
  requestTitle,
  requestLabel,
  instructions,
  dueDate,
  requestLink,
}: {
  customerName: string;
  policyId: string;
  vehicleSummary: string;
  requestTitle: string;
  requestLabel: string;
  instructions: string;
  dueDate: Date | string | null | undefined;
  requestLink: string;
}): { subject: string; html: string } => {
  const subject = `Document request: ${requestTitle}`;
  const greetingName = customerName.trim() || 'there';
  const dueDateCopy = formatDocumentDueDate(dueDate);
  const instructionLines = instructions
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const instructionsHtml = instructionLines.length
    ? instructionLines
        .map(
          (line) =>
            `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#1f2937;">${escapeHtml(line)}</p>`,
        )
        .join('')
    : `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#1f2937;">${escapeHtml(instructions)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px;max-width:94%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 24px 48px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#111827,#1d4ed8);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BHAUTOPROTECT</div>
                <div style="margin-top:10px;font-size:22px;font-weight:600;">We need ${escapeHtml(requestLabel)}</div>
                <div style="margin-top:6px;font-size:13px;opacity:0.8;">Policy ${escapeHtml(policyId)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(greetingName)},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                  We’re requesting <strong>${escapeHtml(requestTitle)}</strong> for ${escapeHtml(vehicleSummary)} so we can keep everything on track.
                </p>
                ${
                  dueDateCopy
                    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#b91c1c;"><strong>Due:</strong> ${escapeHtml(dueDateCopy)}</p>`
                    : ''
                }
                <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;background-color:#f8fafc;margin-bottom:24px;">
                  <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.18em;color:#2563eb;margin-bottom:12px;">What to upload</div>
                  ${instructionsHtml}
                </div>
                <div style="text-align:center;margin-bottom:28px;">
                  <a
                    href="${escapeHtml(requestLink)}"
                    style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;text-decoration:none;font-weight:600;"
                  >Upload document</a>
                </div>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
                  If the button doesn’t work, copy and paste this link into your browser:<br />
                  <span style="word-break:break-all;color:#2563eb;">${escapeHtml(requestLink)}</span>
                </p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#475569;">
                  Need a hand? Reply to this email or call <strong>1 (888) 200-1234</strong> and our team will help.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
};

const renderDetailRows = (rows: { label: string; value: string }[]): string =>
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

const renderCompactRows = (rows: { label: string; value: string }[]): string =>
  rows
    .map((row, index) => {
      const border = index === rows.length - 1 ? "" : "border-bottom:1px solid #e5e7eb;";
      return `
        <tr>
          <td style="padding:12px 18px;font-size:13px;font-weight:600;color:#1f2937;${border}">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:12px 18px;font-size:13px;color:#475569;text-align:right;${border}">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `;
    })
    .join("");

const buildQuoteEmail = ({
  lead,
  vehicle,
  quote,
}: {
  lead: Lead;
  vehicle: Vehicle | null | undefined;
  quote: Quote;
}): { subject: string; html: string } => {
  const planName = formatPlanName(quote.plan);
  const subject = `Your ${planName} Coverage Quote is Ready`;
  const displayName = getLeadDisplayName(lead);
  const vehicleSummary = getVehicleSummary(vehicle);
  const quoteId = quote.id ?? "Pending";
  const monthly = formatCurrencyFromCents(quote.priceMonthly);
  const total = formatCurrencyFromCents(quote.priceTotal);
  const deductible = formatCurrencyFromDollars(quote.deductible);
  const term = formatTerm(quote.termMonths);
  const validUntil = formatQuoteValidUntil(quote.validUntil ?? undefined);

  const summaryRows = [
    { label: "Quote ID", value: quoteId },
    { label: "Coverage Plan", value: planName },
    { label: "Monthly Investment", value: monthly },
    { label: "Total Coverage Amount", value: total },
    { label: "Deductible", value: deductible },
    { label: "Coverage Term", value: term },
    { label: "Quote Valid Through", value: validUntil },
  ];

  const vehicleRows = [
    { label: "Vehicle", value: vehicleSummary },
    { label: "VIN", value: vehicle?.vin ? vehicle.vin : "On file" },
    { label: "Odometer", value: formatOdometer(vehicle?.odometer) },
    { label: "Location", value: formatLocation(lead) },
  ];

  const supportRows = [
    { label: "Next Step", value: "Reply with a good time to activate your coverage." },
    {
      label: "Concierge Support",
      value: "We’ll walk you through the final paperwork in minutes.",
    },
    {
      label: "Need adjustments?",
      value: "Let us know and we’ll tailor the plan to fit your driving.",
    },
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px;max-width:94%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BHAUTOPROTECT</div>
              <div style="font-size:24px;font-weight:700;margin-top:10px;">Your ${escapeHtml(planName)} Quote is Ready</div>
              <div style="margin-top:12px;font-size:14px;opacity:0.85;">Quote • ${escapeHtml(quoteId)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                Thanks for connecting with <strong>BHAutoProtect</strong>. Here’s the personalized coverage quote we created for ${escapeHtml(vehicleSummary)}.
              </p>
              <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:22px;border-radius:16px;margin-bottom:28px;text-align:center;">
                <div style="font-size:13px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.8;">Monthly Investment</div>
                <div style="font-size:32px;font-weight:700;margin-top:6px;">${escapeHtml(monthly)}</div>
                <div style="font-size:14px;margin-top:6px;opacity:0.9;">${escapeHtml(planName)} coverage for ${escapeHtml(term)}</div>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:12px;overflow:hidden;background-color:#f9fafb;border:1px solid #e5e7eb;margin-bottom:28px;">
                <tbody>
                  ${renderDetailRows(summaryRows)}
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
                    ${renderCompactRows(supportRows)}
                  </tbody>
                </table>
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                Ready to lock in this rate or curious about coverage details? Reply to this email and our concierge team will take care of everything for you.
              </p>
              <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#ffffff;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
                <strong>Pro tip:</strong> We’ll hold this quote through ${escapeHtml(validUntil)}. Let us know if you need any tweaks—adjusting mileage, deductible, or payment options is easy.
              </div>
              <p style="margin:0;font-size:15px;line-height:1.7;">With gratitude,<br /><strong>The BHAutoProtect Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:22px 32px;color:#6b7280;font-size:12px;line-height:1.6;">
              You’re receiving this email because you requested coverage details from BHAutoProtect. Reply to this message if anything looks off and we’ll make it right immediately.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
};

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.ensureNumericIdSequences();
  await storage.ensureCustomerPaymentProfileCardFields();
  await storage.ensureDefaultAdminUser();
  await storage.ensureDefaultEmailTemplates();

  const uploadsDir = path.resolve("uploads");
  const brandingUploadsDir = path.join(uploadsDir, "branding");
  await fs.promises.mkdir(brandingUploadsDir, { recursive: true });

  const BRANDING_LOGO_SETTING_KEY = "branding.logoUrl";
  const PUBLIC_BRANDING_PATH = "/uploads/branding";

  const MAX_LOGO_BYTES = 2 * 1024 * 1024;
  const MAX_DOCUMENT_UPLOAD_BYTES = 5 * 1024 * 1024;

  const toIsoString = (value: Date | string | null | undefined): string | null => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
      return null;
    }
    return parsed.toISOString();
  };

  const mapUploadMetadata = (upload: any) => ({
    id: upload.id,
    fileName: upload.fileName,
    fileType: upload.fileType ?? null,
    fileSize: upload.fileSize ?? null,
    createdAt: toIsoString(upload.createdAt ?? null),
  });

  const mapDocumentRequestForAdmin = (request: any) => ({
    id: request.id,
    policyId: request.policyId,
    customerId: request.customerId,
    type: request.type,
    title: request.title,
    instructions: request.instructions ?? null,
    status: request.status,
    dueDate: toIsoString(request.dueDate ?? null),
    requestedBy: request.requestedBy ?? null,
    createdAt: toIsoString(request.createdAt ?? null),
    updatedAt: toIsoString(request.updatedAt ?? null),
    customer: request.customer
      ? {
          id: request.customer.id,
          email: request.customer.email,
          displayName: request.customer.displayName ?? null,
        }
      : null,
    uploads: Array.isArray(request.uploads) ? request.uploads.map(mapUploadMetadata) : [],
  });

  const mapDocumentRequestForCustomer = (request: any) => ({
    id: request.id,
    policyId: request.policyId,
    type: request.type,
    title: request.title,
    instructions: request.instructions ?? null,
    status: request.status,
    dueDate: toIsoString(request.dueDate ?? null),
    requestedBy: request.requestedBy ?? null,
    createdAt: toIsoString(request.createdAt ?? null),
    updatedAt: toIsoString(request.updatedAt ?? null),
    policy: request.policy
      ? {
          id: request.policy.id,
          package: request.policy.package,
          policyStartDate: toIsoString(request.policy.policyStartDate ?? null),
          expirationDate: toIsoString(request.policy.expirationDate ?? null),
          lead: request.policy.lead
            ? {
                firstName: request.policy.lead.firstName ?? null,
                lastName: request.policy.lead.lastName ?? null,
              }
            : null,
          vehicle: request.policy.vehicle
            ? {
                year: request.policy.vehicle.year ?? null,
                make: request.policy.vehicle.make ?? null,
                model: request.policy.vehicle.model ?? null,
                vin: request.policy.vehicle.vin ?? null,
              }
            : null,
        }
      : null,
    uploads: Array.isArray(request.uploads) ? request.uploads.map(mapUploadMetadata) : [],
  });

  const MemoryStore = createMemoryStore(session);
  const secureCookie = process.env.NODE_ENV === "production";
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_LIFETIME_MS = Math.min(THIRTY_DAYS_MS, 2_147_483_647);
  const sessionStore = new MemoryStore({ checkPeriod: SESSION_LIFETIME_MS, ttl: SESSION_LIFETIME_MS });

  app.set("trust proxy", 1);
  app.use(
    session({
      name: "bh_session",
      secret: process.env.SESSION_SECRET ?? "change-me",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: SESSION_LIFETIME_MS,
      },
    })
  );

  app.use("/uploads", express.static("uploads"));

  const buildBrandingResponse = async () => {
    const setting = await storage.getSiteSetting(BRANDING_LOGO_SETTING_KEY);
    return { logoUrl: setting?.value ?? null };
  };

  app.get("/api/branding", async (_req, res) => {
    try {
      const data = await buildBrandingResponse();
      res.json({ data, message: "Branding retrieved successfully" });
    } catch (error) {
      console.error("Error fetching branding:", error);
      res.status(500).json({ message: "Failed to load branding" });
    }
  });

  const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ message: "Invalid username or password" });
        return;
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            reject(err);
            return;
          }
          req.session.user = authenticatedUser;
          resolve();
        });
      });

      res.json({
        data: authenticatedUser,
        message: "Login successful",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid login payload", errors: error.errors });
        return;
      }
      console.error("Error during login:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    const clear = () => {
      res.clearCookie("bh_session", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        path: "/",
      });
      res.json({ message: "Logged out" });
    };

    if (!req.session) {
      clear();
      return;
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        res.status(500).json({ message: "Failed to log out" });
        return;
      }
      clear();
    });
  });

  const adminAuth: RequestHandler = async (req, res, next) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const user = await storage.getUser(sessionUser.id);
      if (!user) {
        req.session.user = undefined;
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };

      req.session.user = authenticatedUser;
      res.locals.user = authenticatedUser;
      next();
    } catch (error) {
      console.error("Error verifying session:", error);
      res.status(500).json({ message: "Failed to authenticate" });
    }
  };

  const ensureAdminUser = (res: Response): AuthenticatedUser | null => {
    const user = res.locals.user as AuthenticatedUser | undefined;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden' });
      return null;
    }
    return user;
  };

  const sanitizeUser = ({ passwordHash: _passwordHash, ...user }: User) => user;
  const sanitizeCustomerAccount = ({ passwordHash: _passwordHash, ...account }: CustomerAccount) => account;

  const toAuthenticatedCustomer = (account: CustomerAccount): AuthenticatedCustomer => ({
    id: account.id,
    email: account.email,
    displayName: account.displayName ?? null,
  });

  const customerAuth: RequestHandler = async (req, res, next) => {
    try {
      const sessionCustomer = req.session.customer;
      if (!sessionCustomer) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const account = await storage.getCustomerAccount(sessionCustomer.id);
      if (!account) {
        req.session.customer = undefined;
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      await storage.syncCustomerPoliciesByEmail(account.id, account.email);
      const policies = await storage.getCustomerPolicies(account.id);
      res.locals.customerPolicies = policies;
      ensureSessionLeadAccess(
        req,
        policies.map((policy) => policy.leadId),
      );
      req.session.customer = toAuthenticatedCustomer(account);
      res.locals.customerAccount = account;
      next();
    } catch (error) {
      console.error('Error verifying customer session:', error);
      res.status(500).json({ message: 'Failed to authenticate' });
    }
  };

  const customerRegistrationSchema = z.object({
    email: z.string().trim().email('A valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    policyId: z.string().min(1, 'Policy number is required'),
    displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(120).optional(),
  });

  const customerLoginSchema = z.object({
    email: z.string().trim().email('A valid email is required'),
    policyId: z.string().trim().min(1, 'Policy number is required'),
  });

  const customerClaimPayloadSchema = z.object({
    policyId: z.string().min(1, 'Policy is required'),
    message: z.string().trim().min(1, 'Message is required').max(4000),
    claimReason: z.string().trim().max(2000).optional(),
    currentOdometer: z.number().int().min(0).max(2000000).optional(),
    previousNotes: z.string().trim().max(2000).optional(),
    preferredPhone: z.string().trim().min(7).max(40).optional(),
  });

  const currentYear = new Date().getFullYear();
  const maxCardExpiryYear = currentYear + 20;

  const customerPaymentProfileSchema = z.object({
    paymentMethod: z.string().trim().max(120).optional(),
    accountName: z.string().trim().max(120).optional(),
    accountIdentifier: z.string().trim().max(120).optional(),
    cardBrand: z.string().trim().max(40).optional(),
    cardLastFour: z
      .string()
      .trim()
      .regex(/^[0-9]{2,4}$/, 'Enter the last 2-4 digits on the card')
      .optional(),
    cardExpiryMonth: z.coerce.number().int().min(1).max(12).optional(),
    cardExpiryYear: z.coerce
      .number()
      .int()
      .min(currentYear)
      .max(maxCardExpiryYear)
      .optional(),
    billingZip: z.string().trim().min(3).max(16).optional(),
    autopayEnabled: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
  });
  const customerPolicyRequestSchema = z.object({
    message: z.string().trim().min(1, 'Please include a short note so our team knows how to help').max(2000),
    phone: z.string().trim().min(7).max(40).optional(),
    vehicle: z
      .object({
        year: z.number().int().min(1900).max(currentYear + 2).optional(),
        make: z.string().trim().max(120).optional(),
        model: z.string().trim().max(120).optional(),
        trim: z.string().trim().max(120).optional(),
        vin: z.string().trim().max(64).optional(),
        odometer: z.number().int().min(0).max(2000000).optional(),
      })
      .optional(),
  });

  const documentRequestCreateSchema = z.object({
    customerId: z.string().min(1, 'Customer is required'),
    type: z.enum(DOCUMENT_REQUEST_TYPE_VALUES),
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(160, 'Title is too long'),
    instructions: z
      .string()
      .trim()
      .max(2000, 'Instructions are too long')
      .optional(),
    dueDate: z.coerce.date().optional(),
    sendEmail: z.boolean().optional(),
  });

  const documentRequestStatusUpdateSchema = z.object({
    status: z.enum(DOCUMENT_REQUEST_STATUS_VALUES),
  });

  const contractCreateSchema = z.object({
    quoteId: z.string().trim().min(1, 'Quote is required'),
    fileName: z.string().trim().min(1).max(255).optional(),
    fileType: z.string().trim().max(120).optional(),
    fileData: z.string().trim().optional(),
    salespersonEmail: z.string().trim().email('Enter a valid salesperson email').optional(),
    usePlaceholder: z.boolean().optional(),
  });

  const contractSignSchema = z.object({
    signatureName: z.string().trim().min(2, 'Signature is required').max(160),
    signatureEmail: z.string().trim().email('Enter a valid email').optional(),
    consent: z.boolean(),
    paymentMethod: z.string().trim().max(120).optional(),
    paymentCardNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{13,19}$/)
      .transform((value) => value.trim()),
    paymentCvv: z
      .string()
      .trim()
      .regex(/^[0-9]{3,4}$/)
      .transform((value) => value.trim()),
    paymentExpMonth: z.coerce.number().int().min(1).max(12).optional(),
    paymentExpYear: z.coerce
      .number()
      .int()
      .min(currentYear)
      .max(maxCardExpiryYear)
      .optional(),
    paymentNotes: z.string().trim().max(2000).optional(),
    billingAddressLine1: z.string().trim().min(1, 'Billing address is required').max(255),
    billingAddressLine2: z.string().trim().max(255).optional(),
    billingCity: z.string().trim().min(1, 'Billing city is required').max(120),
    billingState: z.string().trim().min(1, 'Billing state is required').max(120),
    billingPostalCode: z.string().trim().min(3, 'Billing postal code is required').max(32),
    billingCountry: z.string().trim().min(2, 'Billing country is required').max(120),
    shippingAddressLine1: z.string().trim().min(1, 'Shipping address is required').max(255),
    shippingAddressLine2: z.string().trim().max(255).optional(),
    shippingCity: z.string().trim().min(1, 'Shipping city is required').max(120),
    shippingState: z.string().trim().min(1, 'Shipping state is required').max(120),
    shippingPostalCode: z.string().trim().min(3, 'Shipping postal code is required').max(32),
    shippingCountry: z.string().trim().min(2, 'Shipping country is required').max(120),
  });

  const signContractForLead = async (
    req: Request,
    contract: LeadContract,
    payload: z.infer<typeof contractSignSchema>,
    account?: CustomerAccount | null,
  ) => {
    const lead = await storage.getLead(contract.leadId);
    if (!lead) {
      throw new HttpError(404, 'Lead not found');
    }

    const quote = contract.quoteId ? (await storage.getQuote(contract.quoteId)) ?? null : null;
    const vehicle = await storage.getVehicleByLeadId(contract.leadId);
    const signedAt = getEasternDate();
    const signatureEmail =
      normalizeEmail(payload.signatureEmail) || (account ? account.email : undefined) || normalizeEmail(lead.email);

    if (!signatureEmail) {
      throw new HttpError(400, 'A contact email is required to sign this contract.');
    }

    const signatureIp = typeof req.ip === 'string' ? req.ip.slice(0, 64) : null;
    const userAgentRaw = req.headers['user-agent'];
    const signatureUserAgent = typeof userAgentRaw === 'string' ? userAgentRaw : null;

    const paymentMethod = normalizeString(payload.paymentMethod) ?? null;
    const paymentNotes = normalizeString(payload.paymentNotes) ?? null;
    const billingAddressLine2 = normalizeString(payload.billingAddressLine2) ?? null;
    const shippingAddressLine2 = normalizeString(payload.shippingAddressLine2) ?? null;
    const paymentCardNumber = payload.paymentCardNumber.trim();
    const paymentCvv = payload.paymentCvv.trim();
    const paymentLastFour = paymentCardNumber.slice(-4);
    const paymentExpMonth = payload.paymentExpMonth ?? null;
    const paymentExpYear = payload.paymentExpYear ?? null;

    const updatedContract = await storage.updateLeadContract(contract.id, {
      signatureName: payload.signatureName,
      signatureEmail,
      signatureConsent: payload.consent,
      signatureIp,
      signatureUserAgent,
      signedAt,
      paymentMethod,
      paymentCardNumber,
      paymentCvv,
      paymentLastFour,
      paymentExpMonth,
      paymentExpYear,
      paymentNotes,
      billingAddressLine1: payload.billingAddressLine1.trim(),
      billingAddressLine2,
      billingCity: payload.billingCity.trim(),
      billingState: payload.billingState.trim(),
      billingPostalCode: payload.billingPostalCode.trim(),
      billingCountry: payload.billingCountry.trim(),
      shippingAddressLine1: payload.shippingAddressLine1.trim(),
      shippingAddressLine2,
      shippingCity: payload.shippingCity.trim(),
      shippingState: payload.shippingState.trim(),
      shippingPostalCode: payload.shippingPostalCode.trim(),
      shippingCountry: payload.shippingCountry.trim(),
      status: 'signed',
    });

    const policyData: Partial<InsertPolicy> = {
      policyStartDate: signedAt,
    };

    if (quote) {
      policyData.package = quote.plan;
      if (quote.deductible != null) {
        policyData.deductible = quote.deductible;
      }
      policyData.totalPremium = quote.priceTotal;
      policyData.monthlyPayment = quote.priceMonthly;
      const termMonths = quote.termMonths ?? 0;
      policyData.totalPayments = quote.priceMonthly * termMonths;
      policyData.downPayment = quote.priceMonthly;
    }

    let policy = await storage.getPolicyByLeadId(contract.leadId);
    if (policy) {
      await storage.updatePolicy(contract.leadId, policyData);
      policy = await storage.getPolicyByLeadId(contract.leadId);
    } else {
      policy = await storage.createPolicy({ leadId: contract.leadId, ...policyData });
    }

    ensureSessionLeadAccess(req, [contract.leadId]);

    if (account) {
      await storage.linkCustomerToPolicy(account.id, contract.leadId);
      await storage.syncCustomerPoliciesByEmail(account.id, account.email);
    }

    const currentMeta = getLeadMeta(contract.leadId);
    leadMeta[contract.leadId] = { ...currentMeta, status: 'sold' };

    const salesRecipient =
      typeof lead.salespersonEmail === 'string' && lead.salespersonEmail.includes('@')
        ? lead.salespersonEmail
        : defaultSalesAlertEmail;

    if (salesRecipient) {
      const notification = buildContractSignedNotificationEmail({
        lead,
        contract: updatedContract,
        quote,
        vehicle,
      });
      try {
        await sendMail({
          to: salesRecipient,
          subject: notification.subject,
          html: notification.html,
          text: notification.text,
        });
      } catch (error) {
        console.error('Error sending contract signed notification:', error);
      }
    }

    return { contract: updatedContract, policy };
  };

  const documentUploadSchema = z.object({
    fileName: z
      .string()
      .trim()
      .min(1, 'File name is required')
      .max(240, 'File name is too long'),
    fileType: z
      .string()
      .trim()
      .max(120, 'File type is invalid')
      .optional(),
    fileSize: z.number().int().min(1, 'File size is required').max(MAX_DOCUMENT_UPLOAD_BYTES).optional(),
    data: z.string().min(1, 'File data is required'),
  });

  app.post('/api/customer/register', async (req, res) => {
    try {
      const { email, password, policyId, displayName } = customerRegistrationSchema.parse(req.body);
      const normalizedEmail = email.trim().toLowerCase();

      const policy = await storage.getPolicy(policyId);
      if (!policy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const leadEmail = policy.lead?.email?.trim().toLowerCase();
      if (!leadEmail || leadEmail !== normalizedEmail) {
        res.status(403).json({ message: 'We could not match that policy with the provided email address.' });
        return;
      }

      const existingAccount = await storage.getCustomerAccountByEmail(normalizedEmail);
      if (existingAccount) {
        await storage.linkCustomerToPolicy(existingAccount.id, policyId);
        await storage.syncCustomerPoliciesByEmail(existingAccount.id, normalizedEmail);
        res.status(409).json({ message: 'An account already exists for this email. Please log in instead.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const account = await storage.createCustomerAccount({
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() ?? null,
      });

      await storage.linkCustomerToPolicy(account.id, policyId);
      await storage.syncCustomerPoliciesByEmail(account.id, normalizedEmail);
      const policies = await storage.getCustomerPolicies(account.id);

      const authenticatedCustomer = toAuthenticatedCustomer(account);
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            reject(err);
            return;
          }
          req.session.customer = authenticatedCustomer;
          resolve();
        });
      });

      res.json({
        data: {
          customer: sanitizeCustomerAccount(account),
          policies,
        },
        message: 'Registration successful',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid registration details', errors: error.errors });
        return;
      }
      console.error('Error registering customer:', error);
      res.status(500).json({ message: 'Failed to create account' });
    }
  });

  app.post('/api/customer/login', async (req, res) => {
    try {
      const { email, policyId } = customerLoginSchema.parse(req.body);
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedId = policyId.trim();

      const accountDisplayNameParts: string[] = [];
      let account = await storage.getCustomerAccountByEmail(normalizedEmail);
      let policies = [] as Awaited<ReturnType<typeof storage.getCustomerPolicies>>;
      let contracts: LeadContract[] = [];
      const leadIdsForSession: string[] = [];

      const policy = await storage.getPolicy(normalizedId);
      if (policy) {
        const policyEmail = policy.lead?.email?.trim().toLowerCase();
        if (!policyEmail || policyEmail !== normalizedEmail) {
          res
            .status(403)
            .json({ message: 'We could not match that policy with the provided email address.' });
          return;
        }

        accountDisplayNameParts.push(
          typeof policy.lead?.firstName === 'string' ? policy.lead.firstName.trim() : '',
        );
        accountDisplayNameParts.push(
          typeof policy.lead?.lastName === 'string' ? policy.lead.lastName.trim() : '',
        );

        if (!account) {
          account = await storage.createCustomerAccount({
            email: normalizedEmail,
            passwordHash: hashPassword(normalizedId),
            displayName: accountDisplayNameParts.join(' ').trim() || null,
          });
        }

        await storage.linkCustomerToPolicy(account.id, normalizedId);
        await storage.syncCustomerPoliciesByEmail(account.id, normalizedEmail);
        policies = await storage.getCustomerPolicies(account.id);
        policies.forEach((policyRecord) => {
          if (policyRecord.leadId) {
            leadIdsForSession.push(policyRecord.leadId);
          }
        });
        contracts = await gatherContractsForLeads(leadIdsForSession);
      } else {
        const lead = await storage.getLead(normalizedId);
        if (!lead) {
          res.status(404).json({ message: 'We could not find a matching policy or contract.' });
          return;
        }

        const leadEmail = lead.email?.trim().toLowerCase();
        if (!leadEmail || leadEmail !== normalizedEmail) {
          res
            .status(403)
            .json({ message: 'We could not match that lead with the provided email address.' });
          return;
        }

        accountDisplayNameParts.push(
          typeof lead.firstName === 'string' ? lead.firstName.trim() : '',
        );
        accountDisplayNameParts.push(
          typeof lead.lastName === 'string' ? lead.lastName.trim() : '',
        );

        if (!account) {
          account = await storage.createCustomerAccount({
            email: normalizedEmail,
            passwordHash: hashPassword(normalizedId),
            displayName: accountDisplayNameParts.join(' ').trim() || null,
          });
        }

        await storage.syncCustomerPoliciesByEmail(account.id, normalizedEmail);
        policies = await storage.getCustomerPolicies(account.id);
        leadIdsForSession.push(lead.id);
        policies.forEach((policyRecord) => {
          if (policyRecord.leadId) {
            leadIdsForSession.push(policyRecord.leadId);
          }
        });
        contracts = await storage.getLeadContracts(lead.id);
        if (contracts.length === 0) {
          res.status(404).json({ message: 'No contracts are ready for this account yet.' });
          return;
        }
      }

      if (!account) {
        res.status(500).json({ message: 'Unable to create customer account' });
        return;
      }

      const inferredDisplayName = accountDisplayNameParts.filter(Boolean).join(' ').trim();
      const accountUpdates: { lastLoginAt: Date; displayName?: string | null } = {
        lastLoginAt: getEasternDate(),
      };

      if ((!account.displayName || account.displayName.trim().length === 0) && inferredDisplayName) {
        accountUpdates.displayName = inferredDisplayName;
      }

      const updatedAccount = await storage.updateCustomerAccount(account.id, accountUpdates);
      const authenticatedCustomer = toAuthenticatedCustomer(updatedAccount);

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            reject(err);
            return;
          }
          req.session.customer = authenticatedCustomer;
          ensureSessionLeadAccess(req, leadIdsForSession);
          resolve();
        });
      });

      res.json({
        data: {
          customer: sanitizeCustomerAccount(updatedAccount),
          policies,
          contracts: contracts.map(mapContractForCustomer),
        },
        message: 'Login successful',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid login details', errors: error.errors });
        return;
      }
      console.error('Error logging in customer:', error);
      res.status(500).json({ message: 'Failed to login' });
    }
  });

  app.post('/api/customer/logout', (req, res) => {
    if (req.session) {
      req.session.customer = undefined;
    }
    res.json({ message: 'Logged out' });
  });

  app.get('/api/customer/session', async (req, res) => {
    try {
      const sessionCustomer = req.session.customer;
      if (!sessionCustomer) {
        res.json({ data: { authenticated: false } });
        return;
      }

      const account = await storage.getCustomerAccount(sessionCustomer.id);
      if (!account) {
        req.session.customer = undefined;
        res.json({ data: { authenticated: false } });
        return;
      }

      await storage.syncCustomerPoliciesByEmail(account.id, account.email);
      const policies = await storage.getCustomerPolicies(account.id);
      const sessionLeads = ensureSessionLeadAccess(
        req,
        policies.map((policy) => policy.leadId),
      );
      const contracts = await gatherContractsForLeads(sessionLeads ?? []);
      req.session.customer = toAuthenticatedCustomer(account);

      res.json({
        data: {
          authenticated: true,
          customer: sanitizeCustomerAccount(account),
          policies,
          contracts: contracts.map(mapContractForCustomer),
        },
        message: 'Session verified',
      });
    } catch (error) {
      console.error('Error verifying customer session:', error);
      res.status(500).json({ message: 'Failed to verify session' });
    }
  });

  app.get('/api/contracts/:id', async (req, res) => {
    try {
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: false });
      if (!contract) {
        return;
      }

      res.json({
        data: { contract: mapContractForCustomer(contract) },
        message: 'Contract retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving contract for guest:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to load contract' });
      }
    }
  });

  app.get('/api/contracts/:id/pdf', async (req, res) => {
    try {
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: false });
      if (!contract) {
        return;
      }

      const mime = contract.fileType ?? 'application/pdf';
      const dataUrl = `data:${mime};base64,${contract.fileData}`;

      res.json({
        data: {
          fileName: contract.fileName,
          fileType: mime,
          fileSize: contract.fileSize,
          dataUrl,
        },
        message: 'Contract file retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving contract PDF for guest:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to load contract file' });
      }
    }
  });

  app.post('/api/contracts/:id/sign', async (req, res) => {
    try {
      const payload = contractSignSchema.parse(req.body ?? {});
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: false });
      if (!contract) {
        return;
      }

      if (contract.status === 'signed') {
        res.status(400).json({ message: 'This contract has already been signed.' });
        return;
      }

      const result = await signContractForLead(req, contract, payload, null);

      res.json({
        data: {
          contract: mapContractForCustomer(result.contract),
          policy: result.policy,
        },
        message: 'Contract signed successfully',
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        const message =
          error.issues.at(0)?.message ?? 'Please double-check the signature details and try again.';
        res.status(400).json({ message });
        return;
      }
      console.error('Error signing contract (guest):', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to sign contract' });
      }
    }
  });

  app.get('/api/customer/contracts', customerAuth, async (req, res) => {
    try {
      const sessionLeads = req.session.contractLeads ?? [];
      const contracts = await gatherContractsForLeads(sessionLeads);
      res.json({
        data: contracts.map(mapContractForCustomer),
        message: 'Contracts retrieved successfully',
      });
    } catch (error) {
      console.error('Error loading contracts for customer:', error);
      res.status(500).json({ message: 'Failed to load contracts' });
    }
  });

  app.get('/api/customer/contracts/:id', customerAuth, async (req, res) => {
    try {
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: true });
      if (!contract) {
        return;
      }
      res.json({
        data: mapContractForCustomer(contract),
        message: 'Contract retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving contract for customer:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to load contract' });
      }
    }
  });

  app.get('/api/customer/contracts/:id/pdf', customerAuth, async (req, res) => {
    try {
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: true });
      if (!contract) {
        return;
      }

      const mime = contract.fileType ?? 'application/pdf';
      const dataUrl = `data:${mime};base64,${contract.fileData}`;

      res.json({
        data: {
          fileName: contract.fileName,
          fileType: mime,
          fileSize: contract.fileSize,
          dataUrl,
        },
        message: 'Contract file retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving contract PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to load contract file' });
      }
    }
  });

  app.post('/api/customer/contracts/:id/sign', customerAuth, async (req, res) => {
    try {
      const payload = contractSignSchema.parse(req.body ?? {});
      const contract = await loadContractForRequest(req, res, { requireSessionAccess: true });
      if (!contract) {
        return;
      }

      if (contract.status === 'signed') {
        res.status(400).json({ message: 'This contract has already been signed.' });
        return;
      }

      const account = res.locals.customerAccount as CustomerAccount;
      const result = await signContractForLead(req, contract, payload, account);

      res.json({
        data: {
          contract: mapContractForCustomer(result.contract),
          policy: result.policy,
        },
        message: 'Contract signed successfully',
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Please double-check the signature details and try again.';
        res.status(400).json({ message });
        return;
      }
      console.error('Error signing contract:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to sign contract' });
      }
    }
  });

  app.get('/api/customer/policies', customerAuth, async (_req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const policies = await storage.getCustomerPolicies(account.id);
      res.json({ data: { policies }, message: 'Policies retrieved successfully' });
    } catch (error) {
      console.error('Error fetching customer policies:', error);
      res.status(500).json({ message: 'Failed to load policies' });
    }
  });

  app.get('/api/customer/claims', customerAuth, async (_req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const claims = await storage.getCustomerClaims(account.id);
      res.json({ data: { claims }, message: 'Claims retrieved successfully' });
    } catch (error) {
      console.error('Error loading customer claims:', error);
      res.status(500).json({ message: 'Failed to load claims' });
    }
  });

  app.post('/api/customer/claims', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const payload = customerClaimPayloadSchema.parse(req.body);

      const policies = await storage.getCustomerPolicies(account.id);
      const policy = policies.find((item) => item.id === payload.policyId);
      if (!policy) {
        res.status(403).json({ message: 'You do not have access to that policy' });
        return;
      }

      const lead = policy.lead;
      const vehicle = policy.vehicle;
      const nameBasis = (account.displayName ?? account.email).trim();
      const nameParts = nameBasis.split(/\s+/).filter(Boolean);
      const firstName = lead?.firstName?.trim() || nameParts[0] || 'Customer';
      const lastName = lead?.lastName?.trim() || nameParts.slice(1).join(' ') || 'Account';
      const phone = payload.preferredPhone?.trim() || lead?.phone?.trim();
      if (!phone) {
        res.status(400).json({ message: 'A phone number is required so we can reach you.' });
        return;
      }

      const email = lead?.email?.trim() || account.email;
      if (!email) {
        res.status(400).json({ message: 'A contact email is required.' });
        return;
      }

      const claim = await storage.createClaim({
        policyId: policy.id,
        firstName,
        lastName,
        email,
        phone,
        message: payload.message.trim(),
        claimReason: payload.claimReason?.trim(),
        currentOdometer: payload.currentOdometer ?? undefined,
        previousNotes: payload.previousNotes?.trim(),
        year: vehicle?.year ?? undefined,
        make: vehicle?.make ?? undefined,
        model: vehicle?.model ?? undefined,
        trim: vehicle?.trim ?? undefined,
        vin: vehicle?.vin ?? undefined,
        odometer: vehicle?.odometer ?? undefined,
      });

      res.json({ data: claim, message: 'Claim submitted successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid claim details', errors: error.errors });
        return;
      }
      console.error('Error submitting customer claim:', error);
      res.status(500).json({ message: 'Failed to submit claim' });
    }
  });

  app.get('/api/customer/payment-profiles', customerAuth, async (_req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const paymentProfiles = await storage.getCustomerPaymentProfiles(account.id);
      res.json({ data: { paymentProfiles }, message: 'Payment details retrieved successfully' });
    } catch (error) {
      console.error('Error loading customer payment profiles:', error);
      res.status(500).json({ message: 'Failed to load payment details' });
    }
  });

  app.get('/api/customer/policies/:id/payment-profile', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const policyId = req.params.id;
      const policies = await storage.getCustomerPolicies(account.id);
      const policy = policies.find((item) => item.id === policyId);
      if (!policy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const profile = await storage.getCustomerPaymentProfile(account.id, policyId);
      res.json({ data: { paymentProfile: profile ?? null }, message: 'Payment details retrieved successfully' });
    } catch (error) {
      console.error('Error fetching payment profile:', error);
      res.status(500).json({ message: 'Failed to load payment information' });
    }
  });

  app.put('/api/customer/policies/:id/payment-profile', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const policyId = req.params.id;
      const update = customerPaymentProfileSchema.parse(req.body);

      const policies = await storage.getCustomerPolicies(account.id);
      const policy = policies.find((item) => item.id === policyId);
      if (!policy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const profile = await storage.upsertCustomerPaymentProfile({
        customerId: account.id,
        policyId,
        paymentMethod: update.paymentMethod?.trim() || undefined,
        accountName: update.accountName?.trim() || undefined,
        accountIdentifier: update.accountIdentifier?.trim() || undefined,
        cardBrand: update.cardBrand?.trim() || undefined,
        cardLastFour: update.cardLastFour?.trim() || undefined,
        cardExpiryMonth: update.cardExpiryMonth ?? undefined,
        cardExpiryYear: update.cardExpiryYear ?? undefined,
        billingZip: update.billingZip?.trim() || undefined,
        autopayEnabled: update.autopayEnabled ?? false,
        notes: update.notes?.trim() || undefined,
      });

      res.json({ data: profile, message: 'Payment information saved' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid payment information', errors: error.errors });
        return;
      }
      console.error('Error updating payment profile:', error);
      res.status(500).json({ message: 'Failed to save payment information' });
    }
  });

  app.get('/api/customer/payment-charges', customerAuth, async (_req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const charges = await storage.listCustomerCharges(account.id);
      res.json({ data: { charges }, message: 'Charges retrieved successfully' });
    } catch (error) {
      console.error('Error loading customer charges:', error);
      res.status(500).json({ message: 'Failed to load charges' });
    }
  });

  app.get('/api/customer/policies/:id/charges', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const policyId = req.params.id;
      const policies = await storage.getCustomerPolicies(account.id);
      const hasPolicy = policies.some((policy) => policy.id === policyId);
      if (!hasPolicy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const charges = await storage.listPolicyCharges(policyId);
      res.json({ data: { charges }, message: 'Charges retrieved successfully' });
    } catch (error) {
      console.error('Error loading policy charges for customer:', error);
      res.status(500).json({ message: 'Failed to load charges' });
    }
  });

  app.post('/api/customer/policies/request', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const payload = customerPolicyRequestSchema.parse(req.body);

      const policies = await storage.getCustomerPolicies(account.id);
      const sourceLead = policies.find((policy) => policy.lead)?.lead ?? null;
      const nameBasis = (account.displayName ?? account.email).trim();
      const nameParts = nameBasis.split(/\s+/).filter(Boolean);
      const firstName = sourceLead?.firstName ?? nameParts[0] ?? 'Customer';
      const lastName = (sourceLead?.lastName ?? nameParts.slice(1).join(' ')) || 'Account';

      const leadData: InsertLead = {
        firstName,
        lastName,
        email: account.email,
        phone: payload.phone?.trim() || sourceLead?.phone || undefined,
        state: sourceLead?.state || undefined,
        zip: sourceLead?.zip || undefined,
        consentTCPA: true,
        consentTimestamp: getEasternDate(),
        source: 'customer-portal',
      };

      const newLead = await storage.createLead(leadData);

      const vehicle = payload.vehicle;
      if (
        vehicle &&
        typeof vehicle.year === 'number' &&
        typeof vehicle.make === 'string' &&
        typeof vehicle.model === 'string' &&
        typeof vehicle.odometer === 'number'
      ) {
        await storage.createVehicle({
          leadId: newLead.id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim ?? undefined,
          vin: vehicle.vin ?? undefined,
          odometer: vehicle.odometer,
          usage: 'personal',
        });
      }

      await storage.createNote({
        leadId: newLead.id,
        content: `Customer portal request from ${account.email}:\n${payload.message.trim()}`,
      });

      res.json({
        data: { leadId: newLead.id },
        message: 'Request received. Our team will reach out shortly.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid request details', errors: error.errors });
        return;
      }
      console.error('Error submitting policy request:', error);
      res.status(500).json({ message: 'Failed to submit request' });
    }
  });

  app.get('/api/customer/document-requests', customerAuth, async (_req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const requests = await storage.getCustomerDocumentRequests(account.id);
      res.json({
        data: { requests: requests.map(mapDocumentRequestForCustomer) },
        message: 'Document requests retrieved successfully',
      });
    } catch (error) {
      console.error('Error loading customer document requests:', error);
      res.status(500).json({ message: 'Failed to load document requests' });
    }
  });

  app.post('/api/customer/document-requests/:id/upload', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const payload = documentUploadSchema.parse(req.body ?? {});
      const requestRecord = await storage.getCustomerDocumentRequestForCustomer(req.params.id, account.id);
      if (!requestRecord) {
        res.status(404).json({ message: 'Document request not found' });
        return;
      }

      if (requestRecord.status === 'cancelled') {
        res.status(400).json({ message: 'This request has been cancelled by our team.' });
        return;
      }

      if (requestRecord.status === 'completed') {
        res.status(400).json({ message: 'This request has already been completed.' });
        return;
      }

      if (payload.fileType) {
        const normalizedType = payload.fileType.toLowerCase();
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif', 'application/pdf'];
        if (!allowedMimeTypes.includes(normalizedType)) {
          res.status(400).json({ message: 'Please upload a photo (JPG, PNG, HEIC) or a PDF document.' });
          return;
        }
      }

      const base64Data = payload.data.includes(',') ? payload.data.split(',').pop() ?? '' : payload.data;
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch {
        res.status(400).json({ message: 'We could not read that file. Please try again.' });
        return;
      }

      if (buffer.length === 0) {
        res.status(400).json({ message: 'The uploaded file is empty.' });
        return;
      }

      if (buffer.length > MAX_DOCUMENT_UPLOAD_BYTES) {
        res.status(400).json({ message: 'Files must be 5MB or smaller.' });
        return;
      }

      if (payload.fileSize && payload.fileSize > MAX_DOCUMENT_UPLOAD_BYTES) {
        res.status(400).json({ message: 'Files must be 5MB or smaller.' });
        return;
      }

      const upload = await storage.createCustomerDocumentUpload({
        requestId: requestRecord.id,
        customerId: account.id,
        policyId: requestRecord.policyId,
        fileName: payload.fileName,
        fileType: payload.fileType ?? null,
        fileSize: buffer.length,
        fileData: base64Data,
      });

      await storage.updateCustomerDocumentRequest(requestRecord.id, { status: 'submitted' });

      const requests = await storage.getCustomerDocumentRequests(account.id);
      const updated = requests.find((item) => item.id === requestRecord.id);

      res.status(201).json({
        data: {
          request: updated
            ? mapDocumentRequestForCustomer(updated)
            : mapDocumentRequestForCustomer({ ...requestRecord, policy: null, uploads: [upload] }),
          upload: mapUploadMetadata(upload),
        },
        message: 'File uploaded successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Please double-check the file details and try again.';
        res.status(400).json({ message });
        return;
      }
      console.error('Error uploading customer document:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  app.get('/api/customer/document-uploads/:id', customerAuth, async (req, res) => {
    try {
      const account = res.locals.customerAccount as CustomerAccount;
      const upload = await storage.getCustomerDocumentUploadForCustomer(req.params.id, account.id);
      if (!upload) {
        res.status(404).json({ message: 'Document upload not found' });
        return;
      }

      const mimeType = upload.fileType ?? 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${upload.fileData}`;

      res.json({
        data: {
          id: upload.id,
          fileName: upload.fileName,
          fileType: upload.fileType ?? null,
          fileSize: upload.fileSize ?? null,
          createdAt: toIsoString(upload.createdAt ?? null),
          dataUrl,
        },
        message: 'Document retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving customer document upload:', error);
      res.status(500).json({ message: 'Failed to retrieve document' });
    }
  });

  const emailTemplatePayloadSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Template name is required')
      .max(120, 'Template name is too long'),
    subject: z.string().trim().min(1, 'Subject is required'),
    bodyHtml: z.string().trim().min(1, 'Template body is required'),
  });

  app.use('/api/admin', adminAuth);

  app.get('/api/admin/branding', async (_req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const data = await buildBrandingResponse();
      res.json({ data, message: 'Branding retrieved successfully' });
    } catch (error) {
      console.error('Error fetching branding for admin:', error);
      res.status(500).json({ message: 'Failed to load branding' });
    }
  });

  app.post('/api/admin/branding/logo', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    const payloadSchema = z.object({
      data: z.string().min(1, 'Logo data is required'),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
    });

    try {
      const payload = payloadSchema.parse(req.body ?? {});
      const base64Content = payload.data.includes(',') ? payload.data.split(',').pop() ?? '' : payload.data;

      if (!base64Content) {
        res.status(400).json({ message: 'Logo data is invalid' });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Content, 'base64');
      } catch {
        res.status(400).json({ message: 'Logo data is invalid' });
        return;
      }

      if (buffer.length === 0) {
        res.status(400).json({ message: 'Logo data is empty' });
        return;
      }

      if (buffer.length > MAX_LOGO_BYTES) {
        res.status(400).json({ message: 'Logo must be 2MB or smaller.' });
        return;
      }

      const normalizedMime = payload.mimeType?.toLowerCase();
      const allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/jpg', 'image/png', 'image/x-png'];
      if (normalizedMime && !allowedMimes.includes(normalizedMime)) {
        res.status(400).json({ message: 'Only JPG or PNG images are allowed' });
        return;
      }

      const isLikelyJpeg =
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[buffer.length - 2] === 0xff &&
        buffer[buffer.length - 1] === 0xd9;

      const isLikelyPng =
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;

      let detectedExtension: 'jpg' | 'png' | null = null;
      if (isLikelyPng) {
        detectedExtension = 'png';
      } else if (isLikelyJpeg) {
        detectedExtension = 'jpg';
      }

      if (!detectedExtension) {
        res.status(400).json({ message: 'The uploaded file is not a valid JPG or PNG image.' });
        return;
      }

      if (normalizedMime?.includes('png') && detectedExtension !== 'png') {
        res.status(400).json({ message: 'The uploaded file does not match the expected PNG format.' });
        return;
      }

      if (normalizedMime?.includes('jpg') || normalizedMime?.includes('jpeg') || normalizedMime?.includes('pjpeg')) {
        if (detectedExtension !== 'jpg') {
          res.status(400).json({ message: 'The uploaded file does not match the expected JPG format.' });
          return;
        }
      }

      const fileName = `logo-${Date.now()}.${detectedExtension}`;
      const absolutePath = path.join(brandingUploadsDir, fileName);
      await fs.promises.writeFile(absolutePath, buffer);

      const publicPath = `${PUBLIC_BRANDING_PATH}/${fileName}`;
      const previous = await storage.getSiteSetting(BRANDING_LOGO_SETTING_KEY);
      await storage.upsertSiteSetting({ key: BRANDING_LOGO_SETTING_KEY, value: publicPath });

      if (previous?.value && previous.value !== publicPath) {
        const relativePrevious = previous.value.replace(/^\/?uploads\/?/, '');
        if (relativePrevious) {
          const absolutePrevious = path.resolve(uploadsDir, relativePrevious);
          if (absolutePrevious.startsWith(uploadsDir)) {
            await fs.promises.unlink(absolutePrevious).catch(() => undefined);
          }
        }
      }

      const data = await buildBrandingResponse();
      res.json({ data, message: 'Logo updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid logo payload', errors: error.errors });
        return;
      }
      console.error('Error saving uploaded logo:', error);
      res.status(500).json({ message: 'Failed to update logo' });
    }
  });

  // Public quote estimation endpoint
  app.post('/api/quote/estimate', async (req, res) => {
    try {
      const schema = z.object({
        vehicle: z.object({
          year: z.number(),
          make: z.string(),
          model: z.string(),
          odometer: z.number(),
        }),
        coverage: z.object({
          plan: z.enum(['basic', 'silver', 'gold']),
          deductible: z.number(),
        }),
        location: z.object({
          zip: z.string(),
          state: z.string(),
        }),
      });
      
      const data = schema.parse(req.body);
      const estimate = calculateQuote(data.vehicle, data.coverage, data.location);
      
      res.json({
        data: estimate,
        message: "Quote calculated successfully"
      });
    } catch (error) {
      console.error("Error calculating quote:", error);
      res.status(400).json({ message: "Invalid quote data" });
    }
  });

  app.post("/webhooks/leads", async (req, res) => {
    if (!leadWebhookSecret) {
      console.error("Lead webhook received but LEAD_WEBHOOK_SECRET is not configured.");
      return res.status(503).json({ ok: false, error: "lead webhook not configured" });
    }

    const providedSecret = req.get("X-Lead-Secret");
    if (providedSecret !== leadWebhookSecret) {
      return res.status(401).send("Unauthorized.");
    }

    const clientIp = getClientIp(req);
    if (!allowLeadWebhookRequest(clientIp)) {
      return res.status(429).json({ ok: false, error: "Too many requests" });
    }

    try {
      const payload = leadWebhookPayloadSchema.parse(req.body ?? {});

      const email = normalizeEmail(payload.email);
      const phone = normalizeString(payload.phone);
      if (!email && !phone) {
        console.error("Lead webhook rejected: email or phone required.");
        return res.status(400).json({ ok: false, error: "email or phone required" });
      }

      const consentFlagSource =
        payload.consent_tcpa ??
        payload.tcpa_consent ??
        payload.consent ??
        payload.tcpa;
      const consentTCPA = parseConsentFlag(consentFlagSource);

      const consentTimestamp =
        parseTimestamp(
          payload.consent_timestamp ??
            payload.tcpa_consent_timestamp ??
            payload.timestamp,
        ) ?? (consentTCPA ? getEasternDate() : undefined);

      const fallbackIp = clientIp === "unknown" ? undefined : clientIp;
      const consentIP =
        normalizeString(payload.consent_ip ?? payload.ip) ?? fallbackIp;
      const consentUserAgent =
        normalizeString(payload.consent_user_agent ?? payload.user_agent) ??
        normalizeString(req.get("User-Agent"));

      const leadInput = {
        firstName: normalizeString(payload.first_name),
        lastName: normalizeString(payload.last_name),
        email,
        phone,
        zip: normalizeString(payload.zip),
        state: normalizeString(payload.state),
        consentTCPA,
        consentTimestamp,
        consentIP,
        consentUserAgent,
        source: normalizeString(payload.source ?? payload.lead_source),
        utmSource: normalizeString(payload.utm_source),
        utmMedium: normalizeString(payload.utm_medium),
        utmCampaign: normalizeString(payload.utm_campaign),
      } satisfies Partial<InsertLead>;

      const leadData = insertLeadSchema.parse(leadInput);
      const lead = await storage.createLead(leadData);

      leadMeta[lead.id] = leadMeta[lead.id] ?? DEFAULT_META;

      res.status(201).json({ ok: true, id: lead.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Lead webhook validation error:", error);
        const message = error.issues.at(0)?.message ?? "Invalid webhook payload";
        return res.status(400).json({ ok: false, error: message });
      }

      console.error("Lead webhook processing error:", error);
      return res.status(500).json({ ok: false, error: "Failed to record lead" });
    }
  });

  // Public lead submission endpoint (for quote flow)
  app.post('/api/leads', async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body.lead);
      // The client doesn't include a leadId when submitting vehicle info.
      // We validate the vehicle data without the leadId and add it after
      // creating the lead.
      const vehicleData = insertVehicleSchema
        .omit({ leadId: true })
        .parse(req.body.vehicle);
      
      // Create lead
      const lead = await storage.createLead({
        ...leadData,
        consentTimestamp: getEasternDate(),
        consentUserAgent: req.get('User-Agent') || '',
      });
      
      // Create vehicle
        await storage.createVehicle({
          ...vehicleData,
          leadId: lead.id,
        });

        // Initialize metadata so newly created leads are visible in admin views
        leadMeta[lead.id] = DEFAULT_META;

        res.status(201).json({
          data: lead,
          message: "Lead created successfully"
        });
      } catch (error) {
        console.error("Error creating lead:", error);
        res.status(400).json({ message: "Invalid lead data" });
      }
    });

  // Get leads (for future admin use)
  app.get('/api/leads', async (req, res) => {
    try {
      const leads = await storage.getLeads({});
      res.json({
        data: leads,
        message: "Leads retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Admin dashboard route - React handles rendering and login
  app.get('/admin', (_req, _res, next) => {
    // pass through to Vite's middleware which will serve the SPA
    next();
  });

  // Retrieve basic metadata for a lead
  app.get('/api/leads/:id/meta', async (req, res) => {
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const meta = getLeadMeta(lead.id);
      res.json({ data: meta, message: 'Lead metadata retrieved successfully' });
    } catch (error) {
      console.error('Error fetching lead metadata:', error);
      res.status(500).json({ message: 'Failed to fetch lead metadata' });
    }
  });

  // Retrieve vehicle information for a lead
  app.get('/api/leads/:id/vehicle', async (req, res) => {
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const vehicle = await storage.getVehicleByLeadId(lead.id);
      res.json({ data: vehicle, message: 'Vehicle retrieved successfully' });
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ message: 'Failed to fetch vehicle' });
    }
  });

  // Retrieve quotes for a lead
  app.get('/api/leads/:id/quotes', async (req, res) => {
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const quotes = await storage.getQuotesByLeadId(lead.id);
      res.json({ data: quotes, message: 'Quotes retrieved successfully' });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: 'Failed to fetch quotes' });
    }
  });

  // Update basic lead metadata such as tags
  app.post('/api/leads/:id/meta', async (req, res) => {
    const schema = z.object({ tags: z.string().optional() });
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const data = schema.parse(req.body);
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const current = getLeadMeta(lead.id);
      leadMeta[lead.id] = { ...current, tags };
      res.redirect('/admin');
    } catch (error) {
      console.error('Error saving meta:', error);
      res.status(400).send('Invalid meta data');
    }
  });

  // Assign coverage plan to a lead
  app.post('/api/leads/:id/coverage', async (req, res) => {
    const schema = z.object({
      plan: z.enum(['basic', 'silver', 'gold']),
      deductible: z.coerce.number(),
      termMonths: z.coerce.number().default(36),
      priceMonthly: z.coerce.number(),
    });

    try {
      const data = schema.parse(req.body);

      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }

      const leadId = lead.id;
      const recipient = typeof lead.email === 'string' ? lead.email.trim() : '';
      if (!recipient) {
        return res.status(400).json({ message: 'Lead must have an email address before sending a quote' });
      }

      const vehicle = await storage.getVehicleByLeadId(leadId);

      const priceMonthlyCents = Math.round(data.priceMonthly * 100);
      const priceTotalCents = priceMonthlyCents * data.termMonths;
      const createdAt = getEasternDate();
      const validUntil = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);

      const quote = await storage.createQuote({
        leadId,
        plan: data.plan,
        deductible: data.deductible,
        termMonths: data.termMonths,
        priceMonthly: priceMonthlyCents,
        priceTotal: priceTotalCents,
        status: 'sent',
        validUntil,
      });

      const currentMeta = getLeadMeta(leadId);
      leadMeta[leadId] = { ...currentMeta, status: 'quoted' };

      const { subject, html } = buildQuoteEmail({ lead, vehicle, quote });
      const text = htmlToPlainText(html) || subject;

      await sendMail({
        to: recipient,
        subject,
        html,
        text,
      });

      res.status(201).json({
        data: quote,
        message: 'Quote created and email sent successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid coverage data';
        return res.status(400).json({ message });
      }
      console.error('Error creating quote:', error);
      const message = error instanceof Error ? error.message : 'Failed to create quote';
      res.status(500).json({ message });
    }
  });

  app.post('/api/admin/leads/:id/contracts', async (req, res) => {
    try {
      const payload = contractCreateSchema.parse(req.body ?? {});

      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const leadId = lead.id;

      const quote = await storage.getQuote(payload.quoteId);
      if (!quote || quote.leadId !== leadId) {
        res.status(404).json({ message: 'Quote not found for this lead' });
        return;
      }

      const recipient = typeof lead.email === 'string' ? lead.email.trim() : '';
      if (!recipient) {
        res.status(400).json({ message: 'Lead must have an email address before sending a contract' });
        return;
      }

      let fileName = payload.fileName?.trim();
      let fileType = payload.fileType?.trim().toLowerCase();
      let fileSize: number;
      let base64Data: string;

      if (payload.fileData && payload.fileData.trim().length > 0) {
        const raw = extractBase64Data(payload.fileData.trim());
        let buffer: Buffer;
        try {
          buffer = Buffer.from(raw, 'base64');
        } catch {
          res.status(400).json({ message: 'We could not read that file. Please upload a valid PDF.' });
          return;
        }

        if (buffer.length === 0) {
          res.status(400).json({ message: 'The uploaded file is empty.' });
          return;
        }

        if (buffer.length > MAX_CONTRACT_FILE_BYTES) {
          res.status(400).json({ message: 'Contract files must be 5MB or smaller.' });
          return;
        }

        base64Data = raw;
        fileSize = buffer.length;
        fileType = fileType || 'application/pdf';
        fileName = fileName || `${lead.id}-contract.pdf`;
      } else {
        if (!placeholderContractBase64) {
          res.status(400).json({ message: 'Please upload a PDF of the contract to continue.' });
          return;
        }
        const placeholder = getPlaceholderContractFile();
        base64Data = placeholder.base64;
        fileSize = placeholder.size;
        fileType = fileType || placeholder.fileType;
        fileName = fileName || placeholder.fileName;
      }

      if (!fileType || !fileType.includes('pdf')) {
        res.status(400).json({ message: 'Contracts must be uploaded as PDF files.' });
        return;
      }

      if (!fileName) {
        fileName = `${lead.id}-contract.pdf`;
      }

      if (payload.salespersonEmail && payload.salespersonEmail !== lead.salespersonEmail) {
        await storage.updateLead(leadId, { salespersonEmail: payload.salespersonEmail });
        lead.salespersonEmail = payload.salespersonEmail;
      }

      const authenticatedUser = res.locals.user as AuthenticatedUser | undefined;

      const contract = await storage.createLeadContract({
        leadId,
        quoteId: quote.id,
        uploadedBy: authenticatedUser?.id ?? null,
        fileName,
        fileType,
        fileSize,
        fileData: base64Data,
        status: 'sent',
      });

      const vehicle = await storage.getVehicleByLeadId(leadId);
      const { subject, html, text } = buildContractInviteEmail({ lead, vehicle, quote, contract });

      await sendMail({ to: recipient, subject, html, text });

      res.status(201).json({
        data: mapContractForAdmin(contract),
        message: 'Contract prepared and sent to the customer',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid contract details';
        res.status(400).json({ message });
        return;
      }
      console.error('Error creating contract:', error);
      res.status(500).json({ message: 'Failed to create contract' });
    }
  });

  app.get('/api/admin/me', (_req, res) => {
    const user = res.locals.user as AuthenticatedUser;
    res.json({
      data: user,
      message: 'Authenticated user retrieved successfully',
    });
  });

  app.get('/api/admin/users', async (_req, res) => {
    if (!ensureAdminUser(res)) return;

    try {
      const users = await storage.listUsers();
      res.json({
        data: users.map(sanitizeUser),
        message: 'Users retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/admin/users', async (req, res) => {
    if (!ensureAdminUser(res)) return;

    const schema = z.object({
      username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters long')
        .max(64, 'Username must be at most 64 characters long')
        .regex(/^[^\s:]+$/, 'Username cannot contain spaces or colons'),
      password: z.string().min(8, 'Password must be at least 8 characters long'),
      role: z.enum(['admin', 'staff']).default('staff'),
    });

    try {
      const data = schema.parse(req.body);
      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        res.status(409).json({ message: 'Username already exists' });
        return;
      }

      const user = await storage.createUser({
        username: data.username,
        passwordHash: hashPassword(data.password),
        role: data.role,
      });

      res.status(201).json({
        data: sanitizeUser(user),
        message: 'User created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid user data', errors: error.errors });
        return;
      }
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    const currentUser = ensureAdminUser(res);
    if (!currentUser) return;

    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      if (user.id === currentUser.id) {
        res.status(400).json({ message: 'You cannot delete your own account' });
        return;
      }

      if (user.role === 'admin') {
        const adminCount = await storage.countAdmins();
        if (adminCount <= 1) {
          res.status(400).json({ message: 'Cannot delete the last admin user' });
          return;
        }
      }

      await storage.deleteUser(req.params.id);

      res.json({
        data: sanitizeUser(user),
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Admin: dashboard statistics
  app.get('/api/admin/stats', async (_req, res) => {
    try {
      const leads = await storage.getLeads({});
      const now = Date.now();
      const statusCounts: Record<string, number> = {};
      let quotedLeads = 0;
      let soldLeads = 0;
      await Promise.all(
        leads.map(async (lead) => {
          const meta = getLeadMeta(lead.id);
          statusCounts[meta.status] = (statusCounts[meta.status] || 0) + 1;
          if (meta.status === 'sold') soldLeads++;
          const quotes = await storage.getQuotesByLeadId(lead.id);
          if (quotes.length > 0) quotedLeads++;
        })
      );
      const totalLeads = leads.length;
      const newLeads = leads.filter(
        (l) => l.createdAt && l.createdAt.getTime() > now - 30 * 24 * 60 * 60 * 1000
      ).length;
      const conversionRate =
        totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0;
      const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));
      res.json({
        data: { totalLeads, newLeads, quotedLeads, conversionRate, leadsByStatus },
        message: 'Stats retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Admin: create lead
  app.post('/api/admin/leads', async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body.lead);
      const vehicleData = insertVehicleSchema
        .omit({ leadId: true })
        .parse(req.body.vehicle);

      const lead = await storage.createLead(leadData);
      const vehicle = await storage.createVehicle({
        ...vehicleData,
        leadId: lead.id,
      });

      // Ensure newly created leads are tracked for admin views
      leadMeta[lead.id] = DEFAULT_META;

      res.status(201).json({
        data: { lead, vehicle },
        message: 'Lead created successfully',
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(400).json({ message: 'Invalid lead data' });
    }
  });

  // Admin: list leads with associated data
  app.get('/api/admin/leads', async (_req, res) => {
    try {
      const leads = await storage.getLeads({});
      const data = await Promise.all(
        leads.map(async (lead) => {
          const vehicle = await storage.getVehicleByLeadId(lead.id);
          const quotes = await storage.getQuotesByLeadId(lead.id);
          const meta = getLeadMeta(lead.id);
          return {
            lead: { ...lead, status: meta.status },
            vehicle,
            quoteCount: quotes.length,
          };
        })
      );
      res.json({ data, message: 'Leads retrieved successfully' });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  });

  // Admin: get single lead with associated data
  app.get('/api/admin/leads/:id', async (req, res) => {
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const leadId = lead.id;
      const vehicle = await storage.getVehicleByLeadId(leadId);
      const quotes = await storage.getQuotesByLeadId(leadId);
      const notes = await storage.getNotesByLeadId(leadId);
      const policy = await storage.getPolicyByLeadId(leadId);
      const contracts = await storage.getLeadContracts(leadId);
      const meta = getLeadMeta(leadId);
      res.json({
        data: {
          lead: { ...lead, status: meta.status },
          vehicle,
          quotes,
          notes,
          policy,
          contracts: contracts.map(mapContractForAdmin),
        },
        message: 'Lead retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({ message: 'Failed to fetch lead' });
    }
  });

  // Admin: add note to lead
  app.post('/api/admin/leads/:id/notes', async (req, res) => {
    const schema = z.object({ content: z.string().min(1) });
    try {
      const data = schema.parse(req.body);
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const note = await storage.createNote({ leadId: lead.id, content: data.content });
      res.json({ data: note, message: 'Note created successfully' });
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(400).json({ message: 'Invalid note data' });
    }
  });

  // Admin: convert lead to policy
  app.post('/api/admin/leads/:id/convert', async (req, res) => {
    const schema = z.object({
      package: z.string().optional(),
      expirationMiles: z.coerce.number().optional(),
      expirationDate: z.coerce.date().optional(),
      deductible: z.coerce.number().optional(),
      totalPremium: z.coerce.number().optional(),
      downPayment: z.coerce.number().optional(),
      policyStartDate: z.coerce.date().optional(),
      monthlyPayment: z.coerce.number().optional(),
      totalPayments: z.coerce.number().optional(),
    });
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }
      const leadId = lead.id;
      const existingPolicy = await storage.getPolicyByLeadId(leadId);
      if (existingPolicy) {
        return res.status(409).json({
          data: existingPolicy,
          message: 'Lead has already been converted to a policy',
        });
      }
      const data = schema.parse(req.body);
      const policy = await storage.createPolicy({ leadId, ...data });
      const current = getLeadMeta(leadId);
      leadMeta[leadId] = { ...current, status: 'sold' };
      res.json({ data: policy, message: 'Policy created successfully' });
    } catch (error) {
      console.error('Error converting lead:', error);
      res.status(400).json({ message: 'Invalid policy data' });
    }
  });

  // Admin: update lead data
  app.patch('/api/admin/leads/:id', async (req, res) => {
    const leadSchema = insertLeadSchema
      .extend({ consentTimestamp: z.coerce.date().optional() })
      .partial()
      .extend({
        status: z
          .enum([
            'new',
            'quoted',
            'callback',
            'left-message',
            'no-contact',
            'wrong-number',
            'fake-lead',
            'not-interested',
            'duplicate-lead',
            'dnc',
            'sold',
          ])
          .optional(),
        vehicle: insertVehicleSchema.partial().optional(),
        policy: insertPolicySchema.partial().optional(),
      });
    try {
      const data = leadSchema.parse(req.body);
      const { status, consentTimestamp, vehicle, policy, ...updates } = data as any;
      const existingLead = await loadLeadFromRequest(req, res);
      if (!existingLead) {
        return;
      }
      const leadId = existingLead.id;
      const leadUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => {
          const current = (existingLead as any)[key];
          if (value instanceof Date && current instanceof Date) {
            return value.getTime() !== current.getTime();
          }
          return value !== current;
        })
      ) as Partial<InsertLead>;
      if (Object.keys(leadUpdates).length > 0) {
        await storage.updateLead(leadId, leadUpdates);
      }
      if (vehicle) {
        const existingVehicle = await storage.getVehicleByLeadId(leadId);
        if (existingVehicle) {
          await storage.updateVehicle(leadId, vehicle);
        } else {
          await storage.createVehicle({ ...vehicle, leadId });
        }
      }
      if (policy) {
        await storage.updatePolicy(leadId, policy);
      }
      if (status) {
        const current = getLeadMeta(leadId);
        leadMeta[leadId] = { ...current, status };
      }
      const updatedLead = await storage.getLead(leadId);
      const updatedVehicle = await storage.getVehicleByLeadId(leadId);
      const updatedPolicy = await storage.getPolicyByLeadId(leadId);
      res.json({
        data: {
          lead: updatedLead,
          vehicle: updatedVehicle,
          policy: updatedPolicy,
          status: getLeadMeta(leadId).status,
        },
        message: 'Lead updated successfully',
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(400).json({ message: 'Invalid lead data' });
    }
  });

  // Public claim submission endpoint
  app.post('/api/claims', async (req, res) => {
    try {
      const claimData = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(claimData);
      res.json({ data: claim, message: 'Claim submitted successfully' });
    } catch (error) {
      console.error('Error submitting claim:', error);
      res.status(400).json({ message: 'Invalid claim data' });
    }
  });

  // Admin: list policies
  app.get('/api/admin/policies', async (_req, res) => {
    try {
      const policies = await storage.getPolicies();
      res.json({ data: policies, message: 'Policies retrieved successfully' });
    } catch (error) {
      console.error('Error fetching policies:', error);
      res.status(500).json({ message: 'Failed to fetch policies' });
    }
  });

  // Admin: get policy by id
  app.get('/api/admin/policies/:id', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const policy = await storage.getPolicy(req.params.id);
      if (!policy) {
        return res.status(404).json({ message: 'Policy not found' });
      }
      res.json({ data: policy, message: 'Policy retrieved successfully' });
    } catch (error) {
      console.error('Error fetching policy:', error);
      res.status(500).json({ message: 'Failed to fetch policy' });
    }
  });

  app.put('/api/admin/policies/:id', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const existingPolicy = await storage.getPolicy(req.params.id);
      if (!existingPolicy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const parsed = policyUpdateSchema.parse(req.body ?? {});
      const updates: Partial<InsertPolicy> = {};

      if (Object.prototype.hasOwnProperty.call(parsed, 'package')) {
        updates.package = parsed.package ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'policyStartDate')) {
        updates.policyStartDate = parsed.policyStartDate ? new Date(parsed.policyStartDate) : null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'expirationDate')) {
        updates.expirationDate = parsed.expirationDate ? new Date(parsed.expirationDate) : null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'expirationMiles')) {
        updates.expirationMiles = parsed.expirationMiles ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'deductible')) {
        updates.deductible = parsed.deductible ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'totalPremium')) {
        updates.totalPremium = parsed.totalPremium ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'downPayment')) {
        updates.downPayment = parsed.downPayment ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'monthlyPayment')) {
        updates.monthlyPayment = parsed.monthlyPayment ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'totalPayments')) {
        updates.totalPayments = parsed.totalPayments ?? null;
      }

      if (Object.keys(updates).length > 0) {
        await storage.updatePolicyById(req.params.id, updates);
      }

      if (parsed.lead) {
        const leadUpdates: Partial<InsertLead> = {};

        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'firstName')) {
          leadUpdates.firstName = parsed.lead.firstName ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'lastName')) {
          leadUpdates.lastName = parsed.lead.lastName ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'email')) {
          leadUpdates.email = parsed.lead.email ? parsed.lead.email.toLowerCase() : null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'phone')) {
          leadUpdates.phone = parsed.lead.phone ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'state')) {
          const stateValue = parsed.lead.state;
          leadUpdates.state = stateValue ? stateValue.toUpperCase() : null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.lead, 'zip')) {
          leadUpdates.zip = parsed.lead.zip ?? null;
        }

        if (Object.keys(leadUpdates).length > 0) {
          await storage.updateLead(existingPolicy.leadId, leadUpdates);
        }
      }

      if (parsed.vehicle) {
        const vehicleUpdates: Partial<InsertVehicle> = {};

        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'year')) {
          if (parsed.vehicle.year != null) {
            vehicleUpdates.year = parsed.vehicle.year;
          }
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'make') && parsed.vehicle.make !== undefined) {
          vehicleUpdates.make = parsed.vehicle.make;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'model') && parsed.vehicle.model !== undefined) {
          vehicleUpdates.model = parsed.vehicle.model;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'odometer')) {
          if (parsed.vehicle.odometer != null) {
            vehicleUpdates.odometer = parsed.vehicle.odometer;
          }
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'trim')) {
          vehicleUpdates.trim = parsed.vehicle.trim ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'vin')) {
          vehicleUpdates.vin = parsed.vehicle.vin ? parsed.vehicle.vin.toUpperCase() : null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'usage')) {
          vehicleUpdates.usage = parsed.vehicle.usage ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed.vehicle, 'ev')) {
          vehicleUpdates.ev = parsed.vehicle.ev ?? false;
        }

        if (Object.keys(vehicleUpdates).length > 0) {
          if (existingPolicy.vehicle) {
            await storage.updateVehicle(existingPolicy.leadId, vehicleUpdates);
          } else if (
            parsed.vehicle.year != null &&
            parsed.vehicle.make &&
            parsed.vehicle.model &&
            parsed.vehicle.odometer != null
          ) {
            const newVehicle: InsertVehicle = {
              leadId: existingPolicy.leadId,
              year: parsed.vehicle.year,
              make: parsed.vehicle.make,
              model: parsed.vehicle.model,
              odometer: parsed.vehicle.odometer,
              trim: parsed.vehicle.trim ?? null,
              vin: parsed.vehicle.vin ? parsed.vehicle.vin.toUpperCase() : null,
              usage: parsed.vehicle.usage ?? null,
              ev: parsed.vehicle.ev ?? false,
            };
            await storage.createVehicle(newVehicle);
          }
        }
      }

      const policy = await storage.getPolicy(req.params.id);
      res.json({ data: policy, message: 'Policy updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid policy payload' });
        return;
      }
      console.error('Error updating policy:', error);
      res.status(500).json({ message: 'Failed to update policy' });
    }
  });

  app.get('/api/admin/policies/:id/payment-profiles', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const paymentProfiles = await storage.getPaymentProfilesForPolicy(req.params.id);
      res.json({
        data: { paymentProfiles },
        message: 'Payment profiles retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching payment profiles for policy:', error);
      res.status(500).json({ message: 'Failed to load payment profiles' });
    }
  });

  app.get('/api/admin/policies/:id/charges', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const charges = await storage.listPolicyCharges(req.params.id);
      res.json({ data: { charges }, message: 'Charges retrieved successfully' });
    } catch (error) {
      console.error('Error fetching policy charges:', error);
      res.status(500).json({ message: 'Failed to load charges' });
    }
  });

  app.get('/api/admin/policies/:id/document-requests', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const requests = await storage.listDocumentRequestsForPolicy(req.params.id);
      res.json({
        data: { requests: requests.map(mapDocumentRequestForAdmin) },
        message: 'Document requests retrieved successfully',
      });
    } catch (error) {
      console.error('Error loading document requests:', error);
      res.status(500).json({ message: 'Failed to load document requests' });
    }
  });

  app.post('/api/admin/policies/:id/document-requests', async (req, res) => {
    const currentUser = ensureAdminUser(res);
    if (!currentUser) {
      return;
    }

    try {
      const payload = documentRequestCreateSchema.parse(req.body ?? {});
      const policy = await storage.getPolicy(req.params.id);
      if (!policy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      const customer = policy.customers?.find((account: CustomerAccount) => account.id === payload.customerId);
      if (!customer) {
        res.status(400).json({ message: 'Selected customer is not linked to this policy' });
        return;
      }

      const record = await storage.createCustomerDocumentRequest({
        policyId: req.params.id,
        customerId: payload.customerId,
        type: payload.type,
        title: payload.title,
        instructions: payload.instructions ?? null,
        dueDate: payload.dueDate ?? null,
        requestedBy: currentUser.id,
      });

      const instructionsCopy = payload.instructions?.trim() || DOCUMENT_REQUEST_TYPE_COPY[payload.type].hint;
      let emailSent = false;

      if (payload.sendEmail) {
        try {
          const requestLink = `${portalDocumentsBaseUrl}?request=${record.id}`;
          const { subject, html } = buildDocumentRequestEmail({
            customerName: customer.displayName?.trim() || customer.email,
            policyId: policy.id,
            vehicleSummary: getVehicleSummary(policy.vehicle ?? null),
            requestTitle: payload.title,
            requestLabel: DOCUMENT_REQUEST_TYPE_COPY[payload.type].label,
            instructions: instructionsCopy,
            dueDate: payload.dueDate ?? null,
            requestLink,
          });
          const text = htmlToPlainText(html) || subject;
          await sendMail({
            to: customer.email,
            subject,
            html,
            text,
          });
          emailSent = true;
        } catch (error) {
          console.error('Error sending document request email:', error);
          res.status(500).json({ message: 'Document request saved but email could not be sent. Please try again.' });
          return;
        }
      }

      const responseData = mapDocumentRequestForAdmin({
        ...record,
        customer,
        uploads: [],
      });

      res.status(201).json({
        data: responseData,
        message: 'Document request created successfully',
        meta: { emailSent },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid document request payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error creating document request:', error);
      res.status(500).json({ message: 'Failed to create document request' });
    }
  });

  app.post('/api/admin/document-requests/:id/status', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const payload = documentRequestStatusUpdateSchema.parse(req.body ?? {});
      const existing = await storage.getCustomerDocumentRequest(req.params.id);
      if (!existing) {
        res.status(404).json({ message: 'Document request not found' });
        return;
      }

      await storage.updateCustomerDocumentRequest(existing.id, { status: payload.status });
      const requests = await storage.listDocumentRequestsForPolicy(existing.policyId);
      const enriched = requests.find((request) => request.id === existing.id);

      if (!enriched) {
        res.json({
          data: mapDocumentRequestForAdmin({ ...existing, customer: null, uploads: [] }),
          message: 'Document request updated',
        });
        return;
      }

      res.json({
        data: mapDocumentRequestForAdmin(enriched),
        message: 'Document request updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid update payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error updating document request:', error);
      res.status(500).json({ message: 'Failed to update document request' });
    }
  });

  app.get('/api/admin/document-uploads/:id', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const upload = await storage.getCustomerDocumentUpload(req.params.id);
      if (!upload) {
        res.status(404).json({ message: 'Document upload not found' });
        return;
      }

      const requests = await storage.listDocumentRequestsForPolicy(upload.request.policyId);
      const enriched = requests.find((request) => request.id === upload.request.id);
      const requestData = enriched
        ? mapDocumentRequestForAdmin(enriched)
        : mapDocumentRequestForAdmin({ ...upload.request, customer: null, uploads: [upload] });

      const mimeType = upload.fileType ?? 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${upload.fileData}`;

      res.json({
        data: {
          id: upload.id,
          fileName: upload.fileName,
          fileType: upload.fileType ?? null,
          fileSize: upload.fileSize ?? null,
          createdAt: toIsoString(upload.createdAt ?? null),
          dataUrl,
          request: requestData,
        },
        message: 'Document retrieved successfully',
      });
    } catch (error) {
      console.error('Error retrieving document upload:', error);
      res.status(500).json({ message: 'Failed to load document upload' });
    }
  });

  // Admin: add note to policy
  app.post('/api/admin/policies/:id/notes', async (req, res) => {
    try {
      const data = insertPolicyNoteSchema.pick({ content: true }).parse(req.body);
      const note = await storage.createPolicyNote({ policyId: req.params.id, content: data.content });
      res.json({ data: note, message: 'Note added successfully' });
    } catch (error) {
      console.error('Error adding policy note:', error);
      res.status(400).json({ message: 'Invalid note data' });
    }
  });

  // Admin: upload file to policy
  app.post('/api/admin/policies/:id/files', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
      const filename = req.header('x-filename');
      if (!filename || !req.body || !(req.body instanceof Buffer)) {
        return res.status(400).json({ message: 'File data missing' });
      }
      fs.mkdirSync('uploads', { recursive: true });
      const filePath = path.join('uploads', `${Date.now()}-${filename}`);
      fs.writeFileSync(filePath, req.body);
      const file = await storage.createPolicyFile({ policyId: req.params.id, fileName: filename, filePath });
      res.json({ data: file, message: 'File uploaded successfully' });
    } catch (error) {
      console.error('Error uploading policy file:', error);
      res.status(400).json({ message: 'Invalid file data' });
    }
  });

  // Admin: email templates
  app.get('/api/admin/email-templates', async (_req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      const sanitized = templates.map((template) => ({
        ...template,
        bodyHtml: sanitizeRichHtml(template.bodyHtml),
      }));
      res.json({ data: sanitized, message: 'Templates retrieved successfully' });
    } catch (error) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({ message: 'Failed to fetch email templates' });
    }
  });

  app.post('/api/admin/email-templates', async (req, res) => {
    try {
      const payload = emailTemplatePayloadSchema.parse(req.body);
      const sanitizedHtml = sanitizeRichHtml(payload.bodyHtml);
      const template = await storage.createEmailTemplate({
        name: payload.name,
        subject: payload.subject,
        bodyHtml: sanitizedHtml,
      });
      res.status(201).json({
        data: { ...template, bodyHtml: sanitizedHtml },
        message: 'Template saved successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid template data';
        return res.status(400).json({ message });
      }
      console.error('Error saving email template:', error);
      res.status(500).json({ message: 'Failed to save email template' });
    }
  });

  app.post('/api/admin/policies/:id/email', async (req, res) => {
    const emailListSchema = z
      .string()
      .min(1, 'Recipient is required')
      .transform((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean))
      .refine((emails) => emails.length > 0, { message: 'Recipient is required' })
      .refine(
        (emails) =>
          emails.every((email) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
          ),
        { message: 'Invalid email address' },
      );

    const schema = z.object({
      to: emailListSchema,
      subject: z.string().min(1, 'Subject is required'),
      bodyHtml: z.string().min(1, 'Body is required'),
    });

    try {
      const { to, subject, bodyHtml } = schema.parse(req.body);
      const policy = await storage.getPolicy(req.params.id);
      if (!policy) {
        return res.status(404).json({ message: 'Policy not found' });
      }

      const sanitizedHtml = sanitizeRichHtml(bodyHtml);
      const plainText = htmlToPlainText(sanitizedHtml) || subject;

      await sendMail({
        to,
        subject,
        text: plainText,
        html: sanitizedHtml,
      });

      res.json({ message: 'Email sent successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid email payload';
        return res.status(400).json({ message });
      }
      console.error('Error sending policy email:', error);
      const message = error instanceof Error ? error.message : 'Failed to send email';
      res.status(500).json({ message });
    }
  });

  // Admin: create claim
  app.post('/api/admin/claims', async (req, res) => {
    try {
      const claimData = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(claimData);
      res.json({ data: claim, message: 'Claim created successfully' });
    } catch (error) {
      console.error('Error creating claim:', error);
      res.status(400).json({ message: 'Invalid claim data' });
    }
  });

  // Admin: list claims
  app.get('/api/admin/claims', async (_req, res) => {
    try {
      const claims = await storage.getClaims();
      res.json({ data: claims, message: 'Claims retrieved successfully' });
    } catch (error) {
      console.error('Error fetching claims:', error);
      res.status(500).json({ message: 'Failed to fetch claims' });
    }
  });

  // Admin: get claim by id
  app.get('/api/admin/claims/:id', async (req, res) => {
    try {
      const claim = await storage.getClaim(req.params.id);
      if (!claim) {
        return res.status(404).json({ message: 'Claim not found' });
      }
      res.json({ data: claim, message: 'Claim retrieved successfully' });
    } catch (error) {
      console.error('Error fetching claim:', error);
      res.status(500).json({ message: 'Failed to fetch claim' });
    }
  });

  // Admin: update claim
  app.patch('/api/admin/claims/:id', async (req, res) => {
    const schema = insertClaimSchema.partial();
    try {
      const data = schema.parse(req.body);
      const claim = await storage.updateClaim(req.params.id, data);
      res.json({ data: claim, message: 'Claim updated successfully' });
    } catch (error) {
      console.error('Error updating claim:', error);
      res.status(400).json({ message: 'Invalid claim data' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
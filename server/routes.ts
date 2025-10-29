import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { sendMail, type MailRequest } from "./mail";
import { z } from "zod";
import {
  insertLeadSchema,
  insertVehicleSchema,
  insertPolicySchema,
  insertClaimSchema,
  insertPolicyNoteSchema,
  leadStatusEnum,
  policyChargeStatusEnum,
  type Claim,
  type InsertLead,
  type Lead,
  type LeadStatus,
  type Policy,
  type InsertPolicy,
  type Quote,
  type User,
  type InsertUser,
  type Vehicle,
  type InsertVehicle,
  type CustomerAccount,
  documentRequestTypeEnum,
  documentRequestStatusEnum,
  type LeadContract,
} from "@shared/schema";
import {
  getCoveragePlanDefinition,
  type CoveragePlanDefinition,
} from "@shared/coverage-plans";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculateQuote } from "../client/src/lib/pricing";
import { verifyPassword, hashPassword } from "./password";
import {
  getEmailBrandingAttachments,
  getEmailLogoUrl,
  hasEmailLogoAsset,
  renderEmailLogo,
} from "./emailBranding";

const LEAD_STATUS_VALUES = leadStatusEnum.enumValues as [
  LeadStatus,
  ...LeadStatus[],
];

type LeadMeta = {
  tags: string[];
  status: LeadStatus;
};

const leadMeta: Record<string, LeadMeta> = {};

const createDefaultLeadMeta = (): LeadMeta => ({
  tags: [],
  status: 'new',
});

const getLeadMeta = (id: string): LeadMeta => {
  return leadMeta[id] ?? createDefaultLeadMeta();
};

const syncLeadMetaWithLead = (lead: Lead): LeadMeta => {
  const status = (lead.status ?? 'new') as LeadStatus;
  const current = getLeadMeta(lead.id);
  const next: LeadMeta = { ...current, status };
  leadMeta[lead.id] = next;
  return next;
};

const updateLeadStatus = async (
  leadId: string,
  status: LeadStatus,
): Promise<Lead> => {
  const updatedLead = await storage.updateLead(leadId, { status });
  syncLeadMetaWithLead(updatedLead);
  return updatedLead;
};

const withEmailBranding = (request: MailRequest): MailRequest => {
  const brandingAttachments = getEmailBrandingAttachments();
  if (brandingAttachments.length === 0) {
    return request;
  }
  const existing = request.attachments ?? [];
  return {
    ...request,
    attachments: [...existing, ...brandingAttachments],
  };
};

const sendBrandedMail = async (request: MailRequest): Promise<void> => {
  await sendMail(withEmailBranding(request));
};

const leadWebhookSecret = process.env.LEAD_WEBHOOK_SECRET;

const QUOTE_DEFAULT_CONTRACT_SETTING_KEY = 'quote_default_contract';
const PUBLIC_SAMPLE_CONTRACT_SETTING_KEY = 'public_sample_contract';
const QUOTE_EMAIL_INSTRUCTIONS_SETTING_KEY = 'quote_email_instructions';
const DEFAULT_QUOTE_EMAIL_INSTRUCTIONS =
  'Ready to move forward? Click the contract button in your quote to review, complete your details, and sign to activate coverage.';

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

const POLICY_CHARGE_STATUS_VALUES = policyChargeStatusEnum.enumValues as [
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
];

const MAX_INVOICE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_POLICY_FILE_BYTES = 10 * 1024 * 1024;

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

const sanitizeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const parseChargeDateInput = (value: string | null | undefined): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error('Invalid charge date');
  }
  return parsed;
};

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

const policyChargeInvoiceSchema = z.object({
  fileName: z.string().trim().min(1, 'Invoice file name is required'),
  fileType: z.string().trim().max(120).optional().nullable(),
  fileData: z.string().min(1, 'Invoice file data is required'),
});

const policyChargeCreateSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  amountCents: z.number().int().min(1, 'Amount must be at least $0.01'),
  chargedAt: z.string().trim().optional().nullable(),
  status: z.enum(POLICY_CHARGE_STATUS_VALUES).optional().default('pending'),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  invoice: policyChargeInvoiceSchema.optional(),
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

const portalLoginBaseUrl = trimmedPortalBaseUrl
  ? `${trimmedPortalBaseUrl}/portal`
  : `${defaultPortalBaseUrl}/portal`;

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

const RECAPTCHA_VERIFY_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";
const recaptchaSecretKey =
  process.env.RECAPTCHA_SECRET_KEY ??
  process.env.RECAPTCHA_SECRET ??
  "6LdzavUrAAAAAL08Q7i0Ej7ztIds_EyMXqPByL8p";

class RecaptchaVerificationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RecaptchaVerificationError";
    this.status = status;
  }
}

type RecaptchaVerificationResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const verifyRecaptchaToken = async (
  token: unknown,
  remoteIp: string,
): Promise<void> => {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    throw new RecaptchaVerificationError("Missing reCAPTCHA token");
  }

  if (!recaptchaSecretKey) {
    throw new RecaptchaVerificationError(
      "reCAPTCHA secret key is not configured",
      500,
    );
  }

  const params = new URLSearchParams();
  params.append("secret", recaptchaSecretKey);
  params.append("response", normalizedToken);
  if (remoteIp && remoteIp !== "unknown") {
    params.append("remoteip", remoteIp);
  }

  let verification: RecaptchaVerificationResponse;
  try {
    const response = await fetch(RECAPTCHA_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Verification responded with status ${response.status}`);
    }

    verification = (await response.json()) as RecaptchaVerificationResponse;
  } catch (error) {
    throw new RecaptchaVerificationError(
      error instanceof Error ? error.message : "Failed to verify reCAPTCHA",
      502,
    );
  }

  if (!verification.success) {
    const codes = verification["error-codes"]?.join(", ") ?? "verification failed";
    throw new RecaptchaVerificationError(`reCAPTCHA verification failed: ${codes}`);
  }
};

const leadWebhookPayloadSchema = z
  .object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    year: z.union([z.string(), z.number()]).optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    mileage: z.union([z.string(), z.number()]).optional(),
    state: z.string().optional(),
    preferred_company: z.string().optional(),
    referrer: z.string().optional(),
    sub_id: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    page_url: z.string().optional(),
    timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
    form_version: z.string().optional(),
    vin: z.string().optional(),
    zipcode: z.string().optional(),
    coverage_type: z.string().optional(),
    budget_range: z.string().optional(),
    comments: z.string().optional(),
    zip: z.string().optional(),
    consent_tcpa: z.union([z.boolean(), z.string(), z.number()]).optional(),
    tcpa_consent: z.union([z.boolean(), z.string(), z.number()]).optional(),
    consent: z.union([z.boolean(), z.string(), z.number()]).optional(),
    tcpa: z.union([z.boolean(), z.string(), z.number()]).optional(),
    consent_timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    tcpa_consent_timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
    consent_ip: z.string().optional(),
    ip: z.string().optional(),
    consent_user_agent: z.string().optional(),
    source: z.string().optional(),
    lead_source: z.string().optional(),
  })
  .passthrough();

type AuthenticatedUser = {
  id: string;
  username: string;
  role: "admin" | "staff";
  fullName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
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

const loadLeadFromRequest = async (req: Request, res: Response): Promise<Lead | null> => {
  const lead = await storage.getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ message: 'Lead not found' });
    return null;
  }
  req.params.id = lead.id;
  res.locals.lead = lead;
  syncLeadMetaWithLead(lead);
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
  if (rounded <= 0) {
    return "Flexible";
  }
  if (rounded % 12 === 0) {
    const years = rounded / 12;
    const suffix = years === 1 ? "year" : "years";
    return `${years} ${suffix}`;
  }
  const suffix = rounded === 1 ? "month" : "months";
  return `${rounded} ${suffix}`;
};

const calculateCoverageMonths = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) {
    return null;
  }
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return null;
  }

  const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
  const endMonthIndex = end.getFullYear() * 12 + end.getMonth();
  let months = endMonthIndex - startMonthIndex;

  if (end.getDate() < start.getDate()) {
    const dayDifference = start.getDate() - end.getDate();
    if (dayDifference > 1) {
      months -= 1;
    }
  }

  return months > 0 ? months : null;
};

const formatCoverageRange = (start: Date | null, end: Date | null): string | null => {
  if (!start || !end) {
    return null;
  }
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return null;
  }

  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
};

const formatCoverageDuration = (months: number | null): string | null => {
  if (months === null || months === undefined || Number.isNaN(months)) {
    return null;
  }

  const totalMonths = Math.round(months);
  if (totalMonths <= 0) {
    return null;
  }

  if (totalMonths % 12 === 0) {
    const years = totalMonths / 12;
    return `${years} ${years === 1 ? "year" : "years"}`;
  }

  return `${totalMonths} ${totalMonths === 1 ? "month" : "months"}`;
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

const formatOptionalString = (value: unknown, fallback = "Not provided"): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return fallback;
    }
    return value.toString();
  }

  try {
    const stringValue = String(value).trim();
    return stringValue.length > 0 ? stringValue : fallback;
  } catch {
    return fallback;
  }
};

const formatPhoneNumberDisplay = (value: string | null | undefined): string => {
  if (!value) {
    return "Not provided";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Not provided";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
};

const formatDateTimeEastern = (
  value: Date | string | number | null | undefined,
  fallback = "Not recorded",
): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return fallback;
  }

  return (
    parsed.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET"
  );
};

const formatLeadSourceDisplay = (value: string | null | undefined): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return "Website";
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const formatVehicleUsageDisplay = (value: string | null | undefined): string | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "personal":
      return "Personal use";
    case "commercial":
      return "Commercial use";
    case "rideshare":
      return "Rideshare use";
    default:
      return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }
};

const truncateDisplayValue = (value: string, maxLength = 240): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const buildAdminLeadUrl = (leadId: string): string => {
  const explicitBase = process.env.ADMIN_LEAD_URL_BASE?.trim();
  if (explicitBase) {
    const normalized = explicitBase.replace(/\/$/, "");
    return `${normalized}/${leadId}`;
  }

  const baseCandidate =
    process.env.ADMIN_DASHBOARD_BASE_URL ||
    process.env.ADMIN_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "";

  const trimmed = baseCandidate.trim().replace(/\/$/, "");
  if (!trimmed) {
    return `https://bhautoprotect.com/admin/leads/${leadId}`;
  }

  if (trimmed.endsWith("/admin/leads")) {
    return `${trimmed}/${leadId}`;
  }

  if (trimmed.endsWith("/admin")) {
    return `${trimmed}/leads/${leadId}`;
  }

  return `${trimmed}/admin/leads/${leadId}`;
};

const buildLeadNotificationEmail = ({
  lead,
  vehicle,
  adminLeadUrl,
}: {
  lead: Lead;
  vehicle: Vehicle | null | undefined;
  adminLeadUrl: string;
}) => {
  const displayName = getLeadDisplayName(lead);
  const hasName = displayName !== "there";
  const leadName = hasName ? displayName : "New lead";
  const headerTitle = hasName
    ? `${leadName} requested coverage`
    : "New lead captured";
  const vehicleSummaryRaw = getVehicleSummary(vehicle);
  const vehicleSummary =
    vehicleSummaryRaw === "your vehicle"
      ? "Vehicle details pending"
      : vehicleSummaryRaw;
  const subjectVehicleSegment =
    vehicleSummary === "Vehicle details pending" ? "" : ` (${vehicleSummary})`;
  const subject = `New lead • ${leadName}${subjectVehicleSegment}`;
  const submittedAtDisplay = formatDateTimeEastern(lead.createdAt, "Not recorded");
  const locationDisplay = formatLocation(lead);
  const sourceDisplay = formatLeadSourceDisplay(lead.source);
  const emailDisplay = formatOptionalString(lead.email, "Not provided");
  const phoneDisplay = formatPhoneNumberDisplay(
    typeof lead.phone === "string" ? lead.phone : undefined,
  );
  const consentTimestampDisplay = lead.consentTimestamp
    ? formatDateTimeEastern(lead.consentTimestamp, "Not recorded")
    : "Not recorded";
  const consentIpDisplay = formatOptionalString(lead.consentIP, "Not captured");
  const userAgentDisplay = lead.consentUserAgent
    ? truncateDisplayValue(lead.consentUserAgent, 220)
    : "Not captured";

  const utmTags: string[] = [];
  if (lead.utmSource) utmTags.push(`utm_source=${lead.utmSource}`);
  if (lead.utmMedium) utmTags.push(`utm_medium=${lead.utmMedium}`);
  if (lead.utmCampaign) utmTags.push(`utm_campaign=${lead.utmCampaign}`);

  const overviewRows = [
    { label: "Lead ID", value: lead.id },
    { label: "Submitted", value: submittedAtDisplay },
    { label: "Source", value: sourceDisplay },
    { label: "Location", value: locationDisplay },
    { label: "Vehicle", value: vehicleSummary },
  ];

  const contactRows = [
    { label: "Name", value: hasName ? leadName : "Not provided" },
    { label: "Email", value: emailDisplay },
    { label: "Phone", value: phoneDisplay },
  ];

  const vehicleRows: { label: string; value: string }[] = [];
  if (vehicle) {
    if (typeof vehicle.year === "number" && !Number.isNaN(vehicle.year)) {
      vehicleRows.push({ label: "Year", value: vehicle.year.toString() });
    }
    const makeDisplay = formatOptionalString(vehicle.make, "");
    if (makeDisplay) {
      vehicleRows.push({ label: "Make", value: makeDisplay });
    }
    const modelDisplay = formatOptionalString(vehicle.model, "");
    if (modelDisplay) {
      vehicleRows.push({ label: "Model", value: modelDisplay });
    }
    const trimDisplay = formatOptionalString(vehicle.trim, "");
    if (trimDisplay) {
      vehicleRows.push({ label: "Trim", value: trimDisplay });
    }
    const vinDisplay = formatOptionalString(vehicle.vin, "");
    if (vinDisplay) {
      vehicleRows.push({ label: "VIN", value: vinDisplay });
    }
    if (typeof vehicle.odometer === "number" && !Number.isNaN(vehicle.odometer)) {
      vehicleRows.push({ label: "Odometer", value: formatOdometer(vehicle.odometer) });
    }
    const usageDisplay = formatVehicleUsageDisplay(vehicle.usage);
    if (usageDisplay) {
      vehicleRows.push({ label: "Usage", value: usageDisplay });
    }
  }

  const complianceRows = [
    { label: "TCPA Consent", value: lead.consentTCPA ? "Yes" : "No" },
    { label: "Consent Timestamp", value: consentTimestampDisplay },
    { label: "Consent IP", value: consentIpDisplay },
    { label: "User Agent", value: userAgentDisplay },
  ];

  const renderRows = (rows: { label: string; value: string }[]): string => {
    return rows
      .filter((row) => row.value && row.value.trim().length > 0)
      .map(
        (row) => `
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:14px;">${escapeHtml(row.label)}</td>
            <td style="padding:6px 0;color:#0f172a;font-weight:600;font-size:14px;text-align:right;max-width:320px;word-break:break-word;">${escapeHtml(row.value).replace(/\n/g, '<br />')}</td>
          </tr>`,
      )
      .join("");
  };

  const renderInfoCard = (
    title: string,
    rows: { label: string; value: string }[],
    extraContent = "",
  ): string => {
    const rowsHtml = renderRows(rows);
    if (!rowsHtml && !extraContent) {
      return "";
    }
    return `
      <div style="background:#ffffff;border-radius:16px;padding:22px 24px;border:1px solid #e2e8f0;margin-bottom:20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#2563eb;font-weight:600;margin-bottom:12px;">${escapeHtml(title)}</div>
        ${rowsHtml
          ? `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%;"><tbody>${rowsHtml}</tbody></table>`
          : ""}
        ${extraContent}
      </div>
    `;
  };

  const utmHtml = utmTags.length
    ? `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
        ${utmTags
          .map(
            (tag) =>
              `<span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:9999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:600;">${escapeHtml(tag)}</span>`,
          )
          .join("")}
      </div>`
    : "";

  const vehicleCard = renderInfoCard("Vehicle details", vehicleRows);
  const complianceCard = renderInfoCard("Consent & tracking", complianceRows, utmHtml);

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
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="width:640px;max-width:94%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 22px 48px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#1e40af);padding:32px;color:#e2e8f0;">
                ${renderEmailLogo({ textColor: '#bae6fd' })}
                <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#38bdf8;">New lead</div>
                <div style="font-size:26px;font-weight:700;margin-top:12px;color:#f8fafc;">${escapeHtml(headerTitle)}</div>
                <div style="margin-top:6px;font-size:14px;color:#bae6fd;">Lead ${escapeHtml(lead.id)} • ${escapeHtml(vehicleSummary)}</div>
                <div style="margin-top:6px;font-size:13px;color:#94a3b8;">Submitted ${escapeHtml(submittedAtDisplay)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                ${renderInfoCard("Lead snapshot", overviewRows)}
                ${renderInfoCard("Contact details", contactRows)}
                ${vehicleCard}
                ${complianceCard}
                <div style="text-align:center;margin-top:28px;">
                  <a href="${escapeHtml(adminLeadUrl)}" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:9999px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;">Open lead in dashboard</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: string[] = [
    `${headerTitle}${subjectVehicleSegment}`,
    `Lead ID: ${lead.id}`,
    `Submitted: ${submittedAtDisplay}`,
    `Source: ${sourceDisplay}`,
    `Location: ${locationDisplay}`,
    `Vehicle: ${vehicleSummary}`,
    "",
    "Contact",
    `  Name: ${hasName ? leadName : "Not provided"}`,
    `  Email: ${emailDisplay}`,
    `  Phone: ${phoneDisplay}`,
  ];

  if (vehicleRows.length > 0) {
    textLines.push("", "Vehicle details");
    for (const row of vehicleRows) {
      textLines.push(`  ${row.label}: ${row.value}`);
    }
  }

  textLines.push(
    "",
    "Consent & tracking",
    `  TCPA consent: ${lead.consentTCPA ? "Yes" : "No"}`,
    `  Consent timestamp: ${consentTimestampDisplay}`,
    `  Consent IP: ${consentIpDisplay}`,
    `  User agent: ${userAgentDisplay}`,
  );

  if (utmTags.length > 0) {
    textLines.push("", "UTM tags");
    for (const tag of utmTags) {
      textLines.push(`  ${tag}`);
    }
  }

  textLines.push("", `Open lead: ${adminLeadUrl}`);

  const text = textLines.join("\n");

  return { subject, html, text };
};

const sendNewLeadNotification = async ({
  lead,
  vehicle,
}: {
  lead: Lead;
  vehicle?: Vehicle | null;
}): Promise<void> => {
  const recipientsEnv =
    process.env.NEW_LEAD_NOTIFICATION_TO ||
    process.env.LEAD_ALERT_EMAIL ||
    "admin@bhautoprotect.com";

  const recipients = recipientsEnv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn("No recipients configured for new lead notifications");
    return;
  }

  const uniqueRecipients = Array.from(new Set(recipients));

  const fromAddress =
    process.env.NEW_LEAD_NOTIFICATION_FROM?.trim() || "info@bhautoprotect.com";

  const adminLeadUrl = buildAdminLeadUrl(lead.id);
  const message = buildLeadNotificationEmail({
    lead,
    vehicle: vehicle ?? null,
    adminLeadUrl,
  });

  try {
    await sendBrandedMail({
      from: fromAddress,
      to: uniqueRecipients,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    console.error("Error sending new lead notification email:", error);
  }
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

const formatCurrencyCentsOrFallback = (value: number | null | undefined, fallback: string): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return formatCurrencyFromCents(value);
};

const formatCurrencyDollarsOrFallback = (value: number | null | undefined, fallback: string): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return formatCurrencyFromDollars(value);
};

const formatPolicyDateDisplay = (
  value: Date | string | null | undefined,
  fallback: string,
): string => {
  if (!value) {
    return fallback;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return fallback;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatPolicyMileageLimit = (value: number | null | undefined, fallback: string): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${value.toLocaleString()} miles`;
};

type StoredContractSetting = {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileData?: string;
};

const parseStoredContractSetting = (
  value: string | null | undefined,
): StoredContractSetting | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredContractSetting;
    }
  } catch (error) {
    console.warn('Unable to parse stored contract setting:', error);
  }
  return null;
};

type ContractTemplateFile = {
  base64: string;
  size: number;
  fileName: string;
  fileType: string;
};

const getStoredDefaultContractTemplate = async (): Promise<ContractTemplateFile | null> => {
  const setting = await storage.getSiteSetting(QUOTE_DEFAULT_CONTRACT_SETTING_KEY);
  if (!setting) {
    return null;
  }

  const parsed = parseStoredContractSetting(setting.value);
  if (!parsed || typeof parsed.fileData !== 'string') {
    return null;
  }

  const base64 = parsed.fileData.trim();
  if (!base64) {
    return null;
  }

  let size =
    typeof parsed.fileSize === 'number' && Number.isFinite(parsed.fileSize) ? parsed.fileSize : undefined;
  if (!size || size <= 0) {
    try {
      size = Buffer.from(base64, 'base64').length;
    } catch (error) {
      console.warn('Unable to calculate default contract size:', error);
      size = undefined;
    }
  }

  if (!size || size <= 0) {
    return null;
  }

  const fileName =
    typeof parsed.fileName === 'string' && parsed.fileName.trim().length > 0
      ? parsed.fileName.trim()
      : 'BH-Auto-Protect-Contract.pdf';
  const fileType =
    typeof parsed.fileType === 'string' && parsed.fileType.trim().length > 0
      ? parsed.fileType.trim()
      : 'application/pdf';

  return { base64, size, fileName, fileType };
};

const buildDefaultContractMetadata = async (): Promise<
  | {
      fileName: string;
      fileType: string;
      fileSize: number;
      updatedAt: string | null;
    }
  | null
> => {
  const setting = await storage.getSiteSetting(QUOTE_DEFAULT_CONTRACT_SETTING_KEY);
  if (!setting) {
    return null;
  }

  const parsed = parseStoredContractSetting(setting.value);
  if (!parsed || typeof parsed.fileData !== 'string') {
    return null;
  }

  const base64 = parsed.fileData.trim();
  if (!base64) {
    return null;
  }

  let size =
    typeof parsed.fileSize === 'number' && Number.isFinite(parsed.fileSize) ? parsed.fileSize : undefined;
  if (!size || size <= 0) {
    try {
      size = Buffer.from(base64, 'base64').length;
    } catch (error) {
      console.warn('Unable to calculate default contract size:', error);
      size = undefined;
    }
  }

  if (!size || size <= 0) {
    return null;
  }

  const fileName =
    typeof parsed.fileName === 'string' && parsed.fileName.trim().length > 0
      ? parsed.fileName.trim()
      : 'BH-Auto-Protect-Contract.pdf';
  const fileType =
    typeof parsed.fileType === 'string' && parsed.fileType.trim().length > 0
      ? parsed.fileType.trim()
      : 'application/pdf';

  return {
    fileName,
    fileType,
    fileSize: size,
    updatedAt: toIsoString(setting.updatedAt ?? null),
  };
};

const getStoredSampleContractTemplate = async (): Promise<ContractTemplateFile | null> => {
  const setting = await storage.getSiteSetting(PUBLIC_SAMPLE_CONTRACT_SETTING_KEY);
  if (!setting) {
    return null;
  }

  const parsed = parseStoredContractSetting(setting.value);
  if (!parsed || typeof parsed.fileData !== 'string') {
    return null;
  }

  const base64 = parsed.fileData.trim();
  if (!base64) {
    return null;
  }

  let size =
    typeof parsed.fileSize === 'number' && Number.isFinite(parsed.fileSize) ? parsed.fileSize : undefined;
  if (!size || size <= 0) {
    try {
      size = Buffer.from(base64, 'base64').length;
    } catch (error) {
      console.warn('Unable to calculate sample contract size:', error);
      size = undefined;
    }
  }

  if (!size || size <= 0) {
    return null;
  }

  const fileName =
    typeof parsed.fileName === 'string' && parsed.fileName.trim().length > 0
      ? parsed.fileName.trim()
      : 'BH-Auto-Protect-Sample-Contract.pdf';
  const fileType =
    typeof parsed.fileType === 'string' && parsed.fileType.trim().length > 0
      ? parsed.fileType.trim()
      : 'application/pdf';

  return { base64, size, fileName, fileType };
};

const buildSampleContractMetadata = async (): Promise<
  | {
      fileName: string;
      fileType: string;
      fileSize: number;
      updatedAt: string | null;
      isPlaceholder: boolean;
    }
  | null
> => {
  const setting = await storage.getSiteSetting(PUBLIC_SAMPLE_CONTRACT_SETTING_KEY);
  if (setting) {
    const parsed = parseStoredContractSetting(setting.value);
    if (parsed && typeof parsed.fileData === 'string' && parsed.fileData.trim().length > 0) {
      const base64 = parsed.fileData.trim();
      let size =
        typeof parsed.fileSize === 'number' && Number.isFinite(parsed.fileSize) ? parsed.fileSize : undefined;
      if (!size || size <= 0) {
        try {
          size = Buffer.from(base64, 'base64').length;
        } catch (error) {
          console.warn('Unable to calculate sample contract size:', error);
          size = undefined;
        }
      }

      if (size && size > 0) {
        const fileName =
          typeof parsed.fileName === 'string' && parsed.fileName.trim().length > 0
            ? parsed.fileName.trim()
            : 'BH-Auto-Protect-Sample-Contract.pdf';
        const fileType =
          typeof parsed.fileType === 'string' && parsed.fileType.trim().length > 0
            ? parsed.fileType.trim()
            : 'application/pdf';

        return {
          fileName,
          fileType,
          fileSize: size,
          updatedAt: toIsoString(setting.updatedAt ?? null),
          isPlaceholder: false,
        };
      }
    }
  }

  if (!placeholderContractBase64) {
    return null;
  }

  let placeholderSize = 0;
  try {
    placeholderSize = Buffer.from(placeholderContractBase64, 'base64').length;
  } catch (error) {
    console.warn('Unable to calculate placeholder contract size:', error);
    placeholderSize = 0;
  }

  if (placeholderSize <= 0) {
    return null;
  }

  return {
    fileName: 'BH-Auto-Protect-Sample-Contract.pdf',
    fileType: 'application/pdf',
    fileSize: placeholderSize,
    updatedAt: null,
    isPlaceholder: true,
  };
};

const getSampleContractFile = async (): Promise<ContractTemplateFile | null> => {
  const stored = await getStoredSampleContractTemplate();
  if (stored) {
    return stored;
  }

  if (!placeholderContractBase64) {
    return null;
  }

  let size = 0;
  try {
    size = Buffer.from(placeholderContractBase64, 'base64').length;
  } catch (error) {
    console.warn('Unable to calculate placeholder contract size:', error);
    return null;
  }

  if (size <= 0) {
    return null;
  }

  return {
    base64: placeholderContractBase64,
    size,
    fileName: 'BH-Auto-Protect-Sample-Contract.pdf',
    fileType: 'application/pdf',
  };
};

const loadQuoteEmailInstructionsSetting = async (): Promise<{
  value: string;
  updatedAt: string | null;
}> => {
  const setting = await storage.getSiteSetting(QUOTE_EMAIL_INSTRUCTIONS_SETTING_KEY);
  if (!setting) {
    return { value: DEFAULT_QUOTE_EMAIL_INSTRUCTIONS, updatedAt: null };
  }

  const rawValue = typeof setting.value === 'string' ? setting.value.trim() : '';
  const value = rawValue.length > 0 ? rawValue : DEFAULT_QUOTE_EMAIL_INSTRUCTIONS;
  return {
    value,
    updatedAt: toIsoString(setting.updatedAt ?? null),
  };
};

const resolveQuoteEmailInstructions = async (): Promise<string> => {
  const setting = await loadQuoteEmailInstructionsSetting();
  return setting.value;
};

const renderQuoteInstructionsBlock = (instructions: string | null | undefined): string => {
  if (!instructions) {
    return '';
  }

  const trimmed = instructions.trim();
  if (!trimmed) {
    return '';
  }

  const paragraphs = trimmed
    .split(/\r?\n\r?\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return '';
  }

  return paragraphs
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/\r?\n/g, '<br />');
      return `<p class="email-paragraph" style="margin:0 0 18px;font-size:15px;line-height:1.7;background:#ffffff;color:#0f172a;">${html}</p>`;
    })
    .join('');
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
                ${renderEmailLogo({ textColor: '#e2e8f0' })}
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
                  Need adjustments? Reply to this email or call <a href="tel:+13024068053" style="color:#2563eb;text-decoration:none;font-weight:600;">(302) 406-8053</a>. Our concierge team can update payment schedules, deductibles, and start dates instantly.
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
  const text = `Hi ${displayName},\n\nYour ${planName} contract for ${vehicleSummary} is ready. Review the PDF and provide your digital signature to activate coverage.\n\nSign the contract: ${contractLink}\nQuote: ${quote.id} (${monthly})\n\nNeed help? Call (302) 406-8053 or reply to this email.\n\nThe BH Auto Protect Team`;
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
                ${renderEmailLogo({ textColor: '#64748b' })}
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

const buildPolicyActivationEmail = ({
  lead,
  policy,
  vehicle,
}: {
  lead: Lead;
  policy: Policy;
  vehicle: Vehicle | null | undefined;
}) => {
  const customerName = getLeadDisplayName(lead);
  const vehicleSummary = getVehicleSummary(vehicle);
  const planName = formatPlanName(policy.package);
  const policyNumber = policy.id;
  const loginEmail = typeof lead.email === 'string' ? lead.email.trim() : '';
  const loginEmailInstruction = loginEmail ? loginEmail : 'the email on your policy';
  const startDateDisplay = formatPolicyDateDisplay(
    policy.policyStartDate,
    'We will confirm your start date together',
  );
  const expirationDateDisplay = formatPolicyDateDisplay(
    policy.expirationDate,
    'See your contract for the expiration date',
  );
  const mileageLimitDisplay = formatPolicyMileageLimit(
    policy.expirationMiles,
    'See your contract for mileage limits',
  );
  const deductibleDisplay = formatCurrencyDollarsOrFallback(
    policy.deductible,
    'As listed on your contract',
  );
  const monthlyPaymentValue =
    typeof policy.monthlyPayment === 'number' && Number.isFinite(policy.monthlyPayment)
      ? policy.monthlyPayment
      : null;
  const totalPaymentsCountRaw =
    typeof policy.totalPayments === 'number' && Number.isFinite(policy.totalPayments)
      ? Math.round(policy.totalPayments)
      : null;
  const isOneTimePaymentPlan =
    (totalPaymentsCountRaw !== null && totalPaymentsCountRaw <= 1) ||
    monthlyPaymentValue === null ||
    monthlyPaymentValue <= 0;
  const downPaymentDisplay = formatCurrencyCentsOrFallback(
    policy.downPayment,
    'To be confirmed with your advisor',
  );
  const monthlyPaymentDisplay = formatCurrencyCentsOrFallback(
    policy.monthlyPayment,
    'To be confirmed with your advisor',
  );
  const totalPremiumDisplay = formatCurrencyCentsOrFallback(
    policy.totalPremium,
    'See your contract for the full amount',
  );
  const contractBalanceDisplay = totalPremiumDisplay;
  const paymentCountDisplay =
    totalPaymentsCountRaw !== null && totalPaymentsCountRaw > 0
      ? `${totalPaymentsCountRaw} ${totalPaymentsCountRaw === 1 ? 'payment' : 'payments'}`
      : 'See your contract for payment count';
  const paymentSectionHtml = isOneTimePaymentPlan
    ? `<div style="background:#0f172a;border-radius:16px;padding:24px;color:#e2e8f0;margin-bottom:26px;text-align:center;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#38bdf8;font-weight:600;margin-bottom:12px;text-align:center;">Payment summary</div>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.8;text-align:center;">Your coverage was set up as a pay-in-full policy.</p>
        <ul style="margin:0;padding:0;font-size:15px;line-height:1.8;color:#e2e8f0;list-style-position:inside;text-align:center;">
          <li style="margin:0;text-align:center;">Pay-in-full amount: <strong>${escapeHtml(contractBalanceDisplay)}</strong></li>
        </ul>
        <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;text-align:center;">Need a copy of your receipt or help arranging financing later? Reply to this email and we’ll take care of it right away.</p>
      </div>`
    : `<div style="background:#0f172a;border-radius:16px;padding:24px;color:#e2e8f0;margin-bottom:26px;text-align:center;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#38bdf8;font-weight:600;margin-bottom:12px;text-align:center;">Payment schedule</div>
        <ul style="margin:0;padding:0;font-size:15px;line-height:1.8;color:#e2e8f0;list-style-position:inside;text-align:center;">
          <li style="margin-bottom:8px;text-align:center;">Down payment: <strong>${escapeHtml(downPaymentDisplay)}</strong></li>
          <li style="margin-bottom:8px;text-align:center;">Monthly payment: <strong>${escapeHtml(monthlyPaymentDisplay)}</strong></li>
          <li style="margin-bottom:8px;text-align:center;">Payments scheduled: <strong>${escapeHtml(paymentCountDisplay)}</strong></li>
          <li style="margin:0;text-align:center;">Contract balance: <strong>${escapeHtml(contractBalanceDisplay)}</strong></li>
        </ul>
        <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;text-align:center;">We'll send reminders before each charge. Reach out if you'd like to adjust billing dates or methods.</p>
      </div>`;

  const subject = `Welcome to BH Auto Protect • Policy ${policyNumber}`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;text-align:center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;text-align:center;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="width:640px;max-width:94%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 22px 48px rgba(15,23,42,0.12);margin:0 auto;text-align:center;">
            <tr>
              <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px;color:#e2e8f0;text-align:center;">
                ${renderEmailLogo({
                  textColor: '#0f172a',
                  align: 'center',
                  backgroundColor: '#ffffff',
                  padding: 18,
                  borderRadius: 20,
                })}
                <div style="font-size:24px;font-weight:700;margin-top:12px;text-align:center;">Your coverage is active</div>
                <div style="margin-top:8px;font-size:13px;opacity:0.85;text-align:center;">Policy ${escapeHtml(policyNumber)} • ${escapeHtml(planName)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:center;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.7;text-align:center;">Hi ${escapeHtml(customerName)},</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;text-align:center;">
                  Welcome to BH Auto Protect! Your protection plan for ${escapeHtml(vehicleSummary)} is now active. Save this message for your records—we've highlighted the details you need most often below.
                </p>
                <div style="background:#f8fafc;border-radius:16px;padding:24px;border:1px solid #e2e8f0;margin-bottom:24px;text-align:center;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#2563eb;font-weight:600;margin-bottom:12px;text-align:center;">Policy snapshot</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;color:#1f2937;margin:0 auto;text-align:center;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Policy number</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(policyNumber)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Plan</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(planName)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Vehicle</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(vehicleSummary)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Effective start</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(startDateDisplay)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Coverage through</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(expirationDateDisplay)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Mileage limit</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(mileageLimitDisplay)}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;text-align:center;">Deductible</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(deductibleDisplay)}</td>
                    </tr>
                  </table>
                </div>
                ${paymentSectionHtml}
                <div style="background:#f8fafc;border-radius:16px;padding:24px;border:1px solid #e2e8f0;margin-bottom:28px;text-align:center;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#2563eb;font-weight:600;margin-bottom:12px;text-align:center;">Access your customer portal</div>
                  <p style="margin:0 0 14px;font-size:15px;line-height:1.7;text-align:center;">
                    Download your documents, update payments, or file a claim anytime in the BH Auto Protect portal.
                  </p>
                  <ol style="margin:0 0 16px;padding:0;font-size:15px;line-height:1.8;color:#1f2937;list-style-position:inside;text-align:center;">
                    <li style="margin-bottom:6px;text-align:center;">Visit the portal using the button below.</li>
                    <li style="margin-bottom:6px;text-align:center;">Sign in with ${escapeHtml(loginEmailInstruction)} and your policy ID ${escapeHtml(policyNumber)}.</li>
                    <li style="margin:0;text-align:center;">Bookmark the page so it's handy when you need us.</li>
                  </ol>
                  <div style="text-align:center;margin-top:18px;">
                    <a href="${escapeHtml(portalLoginBaseUrl)}" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:9999px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;">Open Customer Portal</a>
                  </div>
                </div>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;text-align:center;">
                  Need help or have questions? Call <a href="tel:+13024068053" style="color:#2563eb;text-decoration:none;font-weight:600;">(302) 406-8053</a> or reply to this email. Our concierge team is ready to help with claims, maintenance advice, or billing adjustments.
                </p>
                <p style="margin:0;font-size:15px;line-height:1.7;text-align:center;">Warmly,<br/><strong>The BH Auto Protect Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: string[] = [
    `Hi ${customerName},`,
    '',
    `Welcome to BH Auto Protect! Your ${planName} protection for ${vehicleSummary} is now active.`,
    '',
    `Policy number: ${policyNumber}`,
    `Effective start: ${startDateDisplay}`,
    `Coverage through: ${expirationDateDisplay}`,
    `Mileage limit: ${mileageLimitDisplay}`,
    `Deductible: ${deductibleDisplay}`,
  ];

  if (isOneTimePaymentPlan) {
    textLines.push(
      '',
      'Payment summary',
      `- Pay-in-full amount: ${contractBalanceDisplay}`,
    );
  } else {
    textLines.push(
      '',
      'Payment schedule',
      `- Down payment: ${downPaymentDisplay}`,
      `- Monthly payment: ${monthlyPaymentDisplay}`,
      `- Payments scheduled: ${paymentCountDisplay}`,
      `- Contract balance: ${contractBalanceDisplay}`,
    );
  }

  textLines.push(
    '',
    `Access your portal: ${portalLoginBaseUrl}`,
    `Sign in with ${loginEmailInstruction} and your policy ID ${policyNumber}.`,
    '',
    'Need help? Call (302) 406-8053 or reply to this email.',
    '',
    'The BH Auto Protect Team',
  );

  const text = textLines.join('\n');

  return { subject, html, text };
};

const sendPolicyActivationEmail = async ({
  lead,
  policy,
  vehicle,
  recipients,
}: {
  lead: Lead;
  policy: Policy;
  vehicle: Vehicle | null | undefined;
  recipients?: (string | null | undefined)[];
}) => {
  const recipientSet = new Set<string>();
  const candidateEmails = [...(recipients ?? []), lead.email];

  for (const candidate of candidateEmails) {
    const normalized = normalizeEmail(candidate);
    if (normalized) {
      recipientSet.add(normalized);
    }
  }

  if (recipientSet.size === 0) {
    console.warn('No valid email recipient found for policy activation email', {
      leadId: lead.id,
    });
    return;
  }

  const recipientList = Array.from(recipientSet);
  const message = buildPolicyActivationEmail({ lead, policy, vehicle });
  try {
    await sendBrandedMail({
      to: recipientList,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    console.error('Error sending policy activation email:', error);
  }
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
                ${renderEmailLogo({ textColor: '#ffffff' })}
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
                  Need a hand? Reply to this email or call <strong>(302) 406-8053</strong> and our team will help.
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
          <td bgcolor="#f9fafb" style="padding:14px 20px;font-size:14px;font-weight:600;background:#f9fafb;color:#1f2937;${border}">
            ${escapeHtml(row.label)}
          </td>
          <td bgcolor="#f9fafb" style="padding:14px 20px;font-size:14px;background:#f9fafb;color:#334155;text-align:right;${border}">
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
          <td bgcolor="#ffffff" style="padding:12px 18px;font-size:13px;font-weight:600;background:#ffffff;color:#1f2937;${border}">
            ${escapeHtml(row.label)}
          </td>
          <td bgcolor="#ffffff" style="padding:12px 18px;font-size:13px;background:#ffffff;color:#475569;text-align:right;${border}">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `;
    })
    .join("");

const renderPlanCoverageBlock = (plan: CoveragePlanDefinition | null): string => {
  if (!plan || plan.features.length === 0) {
    return "";
  }

  const descriptionHtml = plan.description
    ? `<p class="coverage-card-text" style="margin:0 0 16px;font-size:14px;line-height:1.6;background:transparent;color:#475569;text-align:center;">${escapeHtml(plan.description)}</p>`
    : "";

  const featureRows = plan.features
    .map((feature, index) => {
      const isLast = index === plan.features.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid #e2e8f0;";
      return `
        <tr class="coverage-feature-row">
          <td class="feature-icon-cell" bgcolor="#ffffff" style="padding:10px 0 10px 4px;width:32px;vertical-align:top;background:#ffffff;color:#2563eb;${border}">
            <span class="feature-icon"
              style="
                display:inline-block;
                width:22px;
                height:22px;
                border-radius:9999px;
                background:linear-gradient(135deg,#1d4ed8,#2563eb);
                color:#ffffff;
                font-size:12px;
                line-height:22px;
                text-align:center;
                font-weight:700;
                box-shadow:0 6px 14px rgba(37,99,235,0.25);
              "
            >
              ✓
            </span>
          </td>
          <td class="coverage-feature-text" bgcolor="#ffffff" style="padding:10px 0;font-size:14px;line-height:1.6;background:#ffffff;color:#1f2937;font-weight:500;${border}">
            ${escapeHtml(feature)}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="coverage-card" style="margin-bottom:24px;padding:22px;border-radius:16px;border:1px solid #e0e7ff;background:linear-gradient(180deg,#eef2ff 0%,#ffffff 100%);color:#0f172a;text-align:center;">
      <div class="coverage-card-label" style="font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#6366f1;margin-bottom:8px;background:transparent;text-align:center;">
        Coverage highlights
      </div>
      <div class="coverage-card-title" style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:10px;background:transparent;text-align:center;">${escapeHtml(plan.name)} protection at a glance</div>
      ${descriptionHtml}
      <table role="presentation" cellpadding="0" cellspacing="0" class="coverage-card-table" bgcolor="#ffffff" style="border-collapse:separate;margin:0 auto;padding:0;background:#ffffff;color:#1f2937;text-align:left;">
        ${featureRows}
      </table>
    </div>
  `;
};

type QuoteSalesRepContact = {
  displayName: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
};

const toTelHref = (phone: string): string | null => {
  const cleaned = phone.replace(/[^+\d]/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
};

const renderSalesRepBlock = (salesRep: QuoteSalesRepContact | null | undefined): string => {
  if (!salesRep) {
    return "";
  }

  const name = salesRep.displayName?.trim();
  const title = salesRep.title?.trim();
  const email = salesRep.email?.trim();
  const phone = salesRep.phone?.trim();

  if (!name && !email && !phone && !title) {
    return "";
  }

  const contactItems: string[] = [];
  if (email) {
    const safeEmail = escapeHtml(email);
    contactItems.push(
      `<div style='margin-bottom:6px;'><strong style='color:#0f172a;'>Email:</strong> ` +
        `<a href='mailto:${safeEmail}' style='color:#2563eb;text-decoration:none;'>${safeEmail}</a></div>`,
    );
  }

  if (phone) {
    const telHref = toTelHref(phone);
    const safePhone = escapeHtml(phone);
    const phoneLink = telHref
      ? `<a href='tel:${escapeHtml(telHref)}' style='color:#2563eb;text-decoration:none;'>${safePhone}</a>`
      : safePhone;
    contactItems.push(
      `<div style='margin-bottom:6px;'><strong style='color:#0f172a;'>Call/Text:</strong> ${phoneLink}</div>`,
    );
  }

  const contactDetails =
    contactItems.length > 0
      ? `<div style="margin-top:14px;font-size:14px;line-height:1.6;color:#1f2937;">${contactItems.join('')}</div>`
      : `<div style="margin-top:14px;font-size:14px;line-height:1.6;color:#1f2937;">Reply to this email and I’ll take care of the next steps with you personally.</div>`;

  const titleLine = title
    ? `<div style="font-size:14px;color:#475569;margin-top:2px;">${escapeHtml(title)}</div>`
    : "";

  return `
    <div class="sales-rep-card" style="margin-bottom:28px;padding:24px;border-radius:16px;border:1px solid #bfdbfe;background:linear-gradient(180deg,#eff6ff 0%,#ffffff 100%);color:#0f172a;">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">Your personal sales rep</div>
      <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(name || 'Your BH Auto Protect rep')}</div>
      ${titleLine}
      ${contactDetails}
    </div>
  `;
};

const buildQuoteEmail = ({
  lead,
  vehicle,
  quote,
  policy,
  expirationMilesOverride,
  instructions,
  salesRep,
}: {
  lead: Lead;
  vehicle: Vehicle | null | undefined;
  quote: Quote;
  policy?: Policy | null;
  expirationMilesOverride?: number | null;
  instructions?: string | null;
  salesRep?: QuoteSalesRepContact | null;
}): { subject: string; html: string } => {
  const planName = formatPlanName(quote.plan);
  const subject = `BH Auto Protect | Your ${planName} Coverage Quote is Ready`;
  const displayName = getLeadDisplayName(lead);
  const vehicleSummary = getVehicleSummary(vehicle);
  const quoteId = quote.id ?? "Pending";
  const hasMonthlyPayment =
    typeof quote.priceMonthly === "number" && quote.priceMonthly > 0;
  const hasPayInFullAmount =
    typeof quote.priceTotal === "number" && quote.priceTotal > 0;
  const monthly = hasMonthlyPayment
    ? formatCurrencyFromCents(quote.priceMonthly)
    : null;
  const total = hasPayInFullAmount
    ? formatCurrencyFromCents(quote.priceTotal)
    : null;
  const deductible = formatCurrencyFromDollars(quote.deductible);
  const validUntil = formatQuoteValidUntil(quote.validUntil ?? undefined);
  const currentMiles = formatOdometer(vehicle?.odometer);
  const expirationMilesValue =
    expirationMilesOverride ?? (policy?.expirationMiles ?? null);
  const expirationMiles = formatPolicyMileageLimit(
    expirationMilesValue,
    'We\'ll confirm mileage limits together',
  );
  const instructionsBlock = renderQuoteInstructionsBlock(
    instructions ?? DEFAULT_QUOTE_EMAIL_INSTRUCTIONS,
  );
  const coveragePlan = getCoveragePlanDefinition(quote.plan);
  const coverageBlock = renderPlanCoverageBlock(coveragePlan);
  const salesRepBlock = renderSalesRepBlock(salesRep ?? null);

  const breakdown = (quote.breakdown ?? null) as Record<string, unknown> | null;
  const paymentOptionRaw =
    breakdown && Object.prototype.hasOwnProperty.call(breakdown, 'paymentOption')
      ? (breakdown as Record<string, unknown>).paymentOption
      : null;
  const paymentPreference: 'monthly' | 'one-time' =
    paymentOptionRaw === 'monthly' ? 'monthly' : 'one-time';

  const policyStart = policy?.policyStartDate ? new Date(policy.policyStartDate) : null;
  const policyEnd = policy?.expirationDate ? new Date(policy.expirationDate) : null;
  const coverageMonthsFromPolicy = calculateCoverageMonths(policyStart, policyEnd);
  const rawTermMonths =
    typeof quote.termMonths === 'number' && Number.isFinite(quote.termMonths)
      ? Math.round(quote.termMonths)
      : null;
  const defaultCoverageMonths = 60;
  const termMonthsForDisplay =
    paymentPreference === 'one-time'
      ? rawTermMonths && rawTermMonths > 0
        ? rawTermMonths
        : defaultCoverageMonths
      : rawTermMonths;
  const term = formatTerm(termMonthsForDisplay);
  const coverageMonths =
    coverageMonthsFromPolicy ??
    (paymentPreference === 'monthly'
      ? rawTermMonths
      : rawTermMonths && rawTermMonths > 1
        ? rawTermMonths
        : defaultCoverageMonths);
  const coverageRange = formatCoverageRange(policyStart, policyEnd);
  const coverageDuration = formatCoverageDuration(coverageMonths);
  const defaultCoverageDuration =
    formatCoverageDuration(defaultCoverageMonths) ??
    formatTerm(defaultCoverageMonths) ??
    '60 months';
  const coverageLengthValue = (() => {
    if (coverageRange && coverageDuration) {
      return `${coverageRange} (${coverageDuration})`;
    }
    if (coverageRange) {
      return coverageRange;
    }
    if (coverageDuration) {
      return coverageDuration;
    }
    return paymentPreference === 'one-time' ? defaultCoverageDuration : term;
  })();
  const coverageDurationForHighlight =
    coverageDuration ??
    (paymentPreference === 'one-time'
      ? defaultCoverageDuration
      : term !== 'Flexible'
        ? term
        : null);

  const ratePlaceholder = 'We’ll finalize your rate together.';
  const highlightLabel =
    paymentPreference === "monthly"
      ? "Monthly Investment"
      : "Pay-in-Full Investment";
  const highlightValue =
    paymentPreference === "monthly"
      ? monthly ?? ratePlaceholder
      : total ?? ratePlaceholder;
  const highlightSupporting =
    paymentPreference === "monthly"
      ? total
        ? `Total of ${total} across ${term}.`
        : "Want the pay-in-full total as well? Reply and we’ll prepare it instantly."
      : coverageDurationForHighlight
        ? `${coverageDurationForHighlight} of protection with a single payment.`
        : "Flexible coverage length with a single payment.";

  const paymentRows =
    paymentPreference === "monthly"
      ? [
          ...(monthly ? [{ label: "Monthly Investment", value: monthly }] : []),
          ...(total ? [{ label: "One-Time Total", value: total }] : []),
        ]
      : [
          {
            label: "Pay-in-Full Investment",
            value: total ?? ratePlaceholder,
          },
        ];

  const summaryRows = [
    { label: 'Quote ID', value: quoteId },
    ...paymentRows,
    { label: 'Coverage Plan', value: planName },
    {
      label: paymentPreference === 'one-time' ? 'Coverage Length' : 'Coverage Term',
      value: coverageLengthValue,
    },
    { label: 'Deductible', value: deductible },
    { label: 'Quote Valid Through', value: validUntil },
  ];

  const vehicleRows = [
    { label: "Vehicle", value: vehicleSummary },
    { label: "VIN", value: vehicle?.vin ? vehicle.vin : "On file" },
    { label: "Current Miles", value: currentMiles },
    { label: "Expiration Miles", value: expirationMiles },
    { label: "Location", value: formatLocation(lead) },
  ];

  const supportRows = [
    {
      label: 'Next Step',
      value:
        paymentPreference === 'monthly'
          ? 'Reply with your preferred start date and we’ll finalize the monthly plan.'
          : 'Reply to confirm and we’ll send a quick checkout link to activate coverage.',
    },
    {
      label: 'Support',
      value:
        paymentPreference === 'monthly'
          ? 'Questions or need tweaks? Reply anytime and our team will tailor the coverage for you.'
          : 'Questions or need tweaks? Reply anytime and our team will handle the paperwork in minutes.',
    },
  ];

  const logoAvailable = hasEmailLogoAsset();
  const logoUrl = getEmailLogoUrl();
  const logoBadgeStyle =
    "display:inline-flex;align-items:center;justify-content:center;padding:18px;border-radius:18px;background-color:#ffffff !important;box-shadow:0 16px 40px rgba(15,23,42,0.2);";
  const logoImageStyle =
    "height:44px;max-width:200px;width:auto;object-fit:contain;";
  const logoTextStyle =
    "font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#0f172a;";
  const logoMarkup = logoAvailable && logoUrl
    ? `<div class="email-logo-wrapper" style="margin-bottom:16px;text-align:center;">
        <div class="email-logo-badge" style="${logoBadgeStyle}">
          <img src="${logoUrl}" alt="BH Auto Protect" class="email-logo-light" style="display:block;${logoImageStyle}" />
          <img src="${logoUrl}" alt="BH Auto Protect" class="email-logo-dark" style="display:none;${logoImageStyle}" />
        </div>
      </div>`
    : `<div class="email-logo-wrapper" style="margin-bottom:16px;text-align:center;">
        <div class="email-logo-badge" style="${logoBadgeStyle}">
          <span class="email-logo-light email-logo-text" style="display:inline-block;${logoTextStyle}">BH AUTO PROTECT</span>
          <span class="email-logo-dark email-logo-text" style="display:none;${logoTextStyle}">BH AUTO PROTECT</span>
        </div>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(subject)}</title>
    <style>
      :root {
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }
      .email-logo-dark {
        display: none;
      }
      .email-header-title,
      .email-header-subtitle {
        color: #ffffff !important;
      }
      .email-logo-text {
        color: #0f172a !important;
      }
      @media (prefers-color-scheme: dark) {
        body.email-body {
          background-color: #020617 !important;
          color: #f8fafc !important;
        }
        table.email-wrapper {
          background-color: #020617 !important;
        }
        table.email-container {
          background-color: #0b1220 !important;
          color: #f8fafc !important;
        }
        .email-header {
          background: linear-gradient(135deg, #0b1220, #1e3a8a) !important;
          color: #f8fafc !important;
        }
        .email-header-title,
        .email-header-subtitle {
          background: transparent !important;
          color: #ffffff !important;
        }
        .email-logo-text {
          color: #0f172a !important;
        }
        .email-logo-badge {
          background-color: #ffffff !important;
        }
        .email-content {
          background-color: #0b1220 !important;
          color: #f8fafc !important;
        }
        .email-content p {
          background-color: #0b1220 !important;
          color: #f8fafc !important;
        }
        .email-highlight {
          background-color: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }
        .email-highlight-label {
          color: #60a5fa !important;
          background-color: #1e293b !important;
        }
        .email-highlight-value {
          color: #f8fafc !important;
          background-color: #1e293b !important;
        }
        .email-highlight-supporting {
          color: #cbd5f5 !important;
          background-color: #1e293b !important;
        }
        table.summary-table {
          background-color: #111827 !important;
          border-color: #1f2937 !important;
        }
        table.summary-table td {
          background-color: #111827 !important;
          color: #e2e8f0 !important;
          border-color: #1f2937 !important;
        }
        table.info-table {
          background-color: #111827 !important;
          border-color: #1f2937 !important;
        }
        table.info-table td {
          background-color: #111827 !important;
          color: #cbd5f5 !important;
          border-color: #1f2937 !important;
        }
        .email-callout--guarantee {
          background-color: #1e293b !important;
          color: #fef3c7 !important;
        }
        .email-callout--reminder {
          background-color: #1e3a8a !important;
          color: #bfdbfe !important;
        }
        .email-footer {
          background-color: #111827 !important;
          color: #94a3b8 !important;
        }
        .email-footer a {
          color: #bfdbfe !important;
          background-color: transparent !important;
        }
        a.email-button {
          background-color: #3b82f6 !important;
          color: #f8fafc !important;
        }
        a.email-link {
          color: #93c5fd !important;
          background-color: transparent !important;
        }
        .email-logo-light {
          display: none !important;
        }
        .email-logo-dark {
          display: inline-block !important;
        }
      }
      body[data-ogsc].email-body,
      body[data-ogsb].email-body,
      [data-ogsc] body.email-body,
      [data-ogsb] body.email-body {
        background-color: #020617 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] table.email-wrapper,
      [data-ogsb] table.email-wrapper {
        background-color: #020617 !important;
      }
      [data-ogsc] table.email-container,
      [data-ogsb] table.email-container {
        background-color: #0b1220 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] .email-header,
      [data-ogsb] .email-header {
        background: linear-gradient(135deg, #0b1220, #1e3a8a) !important;
        color: #f8fafc !important;
      }
      [data-ogsc] .email-header-title,
      [data-ogsb] .email-header-title,
      [data-ogsc] .email-header-subtitle,
      [data-ogsb] .email-header-subtitle {
        background: transparent !important;
        color: #ffffff !important;
      }
      [data-ogsc] .email-logo-text,
      [data-ogsb] .email-logo-text {
        color: #0f172a !important;
      }
      [data-ogsc] .email-logo-badge,
      [data-ogsb] .email-logo-badge {
        background-color: #ffffff !important;
      }
      [data-ogsc] .email-content,
      [data-ogsb] .email-content {
        background-color: #0b1220 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] .email-content p,
      [data-ogsb] .email-content p {
        background-color: #0b1220 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] .email-highlight,
      [data-ogsb] .email-highlight {
        background-color: #1e293b !important;
        border-color: #334155 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] .email-highlight-label,
      [data-ogsb] .email-highlight-label {
        color: #60a5fa !important;
        background-color: #1e293b !important;
      }
      [data-ogsc] .email-highlight-value,
      [data-ogsb] .email-highlight-value {
        color: #f8fafc !important;
        background-color: #1e293b !important;
      }
      [data-ogsc] .email-highlight-supporting,
      [data-ogsb] .email-highlight-supporting {
        color: #cbd5f5 !important;
        background-color: #1e293b !important;
      }
      [data-ogsc] table.summary-table,
      [data-ogsb] table.summary-table {
        background-color: #111827 !important;
        border-color: #1f2937 !important;
      }
      [data-ogsc] table.summary-table td,
      [data-ogsb] table.summary-table td {
        background-color: #111827 !important;
        color: #e2e8f0 !important;
        border-color: #1f2937 !important;
      }
      [data-ogsc] table.info-table,
      [data-ogsb] table.info-table {
        background-color: #111827 !important;
        border-color: #1f2937 !important;
      }
      [data-ogsc] table.info-table td,
      [data-ogsb] table.info-table td {
        background-color: #111827 !important;
        color: #cbd5f5 !important;
        border-color: #1f2937 !important;
      }
      [data-ogsc] .email-callout--guarantee,
      [data-ogsb] .email-callout--guarantee {
        background-color: #1e293b !important;
        color: #fef3c7 !important;
      }
      [data-ogsc] .email-callout--reminder,
      [data-ogsb] .email-callout--reminder {
        background-color: #1e3a8a !important;
        color: #bfdbfe !important;
      }
      [data-ogsc] .email-footer,
      [data-ogsb] .email-footer {
        background-color: #111827 !important;
        color: #94a3b8 !important;
      }
      [data-ogsc] .email-footer a,
      [data-ogsb] .email-footer a {
        color: #bfdbfe !important;
        background-color: transparent !important;
      }
      [data-ogsc] a.email-button,
      [data-ogsb] a.email-button {
        background-color: #3b82f6 !important;
        color: #f8fafc !important;
      }
      [data-ogsc] a.email-link,
      [data-ogsb] a.email-link {
        color: #93c5fd !important;
        background-color: transparent !important;
      }
      [data-ogsc] .email-logo-light,
      [data-ogsb] .email-logo-light {
        display: none !important;
      }
      [data-ogsc] .email-logo-dark,
      [data-ogsb] .email-logo-dark {
        display: inline-block !important;
      }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" bgcolor="#f1f5f9" style="width:100%;margin:0;padding:32px 0;background:#f1f5f9;color:#0f172a;">
      <tr>
        <td align="center" bgcolor="#f1f5f9" style="background:#f1f5f9;color:#0f172a;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" class="email-container" bgcolor="#ffffff" style="width:640px;max-width:94%;background:#ffffff;color:#0f172a;border-radius:18px;overflow:hidden;box-shadow:0 22px 48px rgba(15,23,42,0.1);">
            <tr>
              <td class="email-header" bgcolor="#111827" style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff;text-align:center;">
                ${logoMarkup}
                <div class="email-header-title" style="font-size:24px;font-weight:700;margin-top:10px;background:transparent;color:#ffffff;">Your ${escapeHtml(planName)} Quote is Ready</div>
                <div class="email-header-subtitle" style="margin-top:12px;font-size:14px;opacity:0.85;background:transparent;color:#ffffff;">Quote • ${escapeHtml(quoteId)}</div>
              </td>
            </tr>
            <tr>
              <td class="email-content" bgcolor="#ffffff" style="padding:32px;background:#ffffff;color:#0f172a;">
                <p class="email-paragraph" style="margin:0 0 18px;font-size:16px;line-height:1.7;background:#ffffff;color:#0f172a;">Hi ${escapeHtml(displayName)},</p>
                <p class="email-paragraph" style="margin:0 0 24px;font-size:15px;line-height:1.7;background:#ffffff;color:#0f172a;">
                  Thanks for connecting with <strong>BHAutoProtect</strong>. Here’s the personalized coverage quote we created for ${escapeHtml(vehicleSummary)}. Choose the payment approach that fits best and we’ll handle the rest.
                </p>
                <div class="email-highlight" style="padding:20px;border-radius:12px;border:1px solid #bfdbfe;background:#f8fafc;color:#0f172a;margin-bottom:28px;">
                  <div class="email-highlight-label" style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;background:#f8fafc;color:#2563eb;margin-bottom:6px;">${escapeHtml(highlightLabel)}</div>
                  <div class="email-highlight-value" style="font-size:30px;font-weight:700;background:#f8fafc;color:#0f172a;">${escapeHtml(highlightValue)}</div>
                  <div class="email-highlight-supporting" style="margin-top:6px;font-size:14px;background:#f8fafc;color:#475569;">${escapeHtml(highlightSupporting)}</div>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="summary-table" bgcolor="#f9fafb" style="border-collapse:collapse;border-radius:12px;overflow:hidden;background:#f9fafb;color:#0f172a;border:1px solid #e5e7eb;margin-bottom:28px;">
                  <tbody>
                    ${renderDetailRows(summaryRows)}
                  </tbody>
                </table>
                ${instructionsBlock}
                ${salesRepBlock}
                ${coverageBlock}
                <div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:28px;background:#ffffff;color:#0f172a;">
                  <table role="presentation" cellpadding="0" cellspacing="0" class="info-table" bgcolor="#ffffff" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;color:#0f172a;min-width:240px;">
                    <tbody>
                      ${renderCompactRows(vehicleRows)}
                    </tbody>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" class="info-table" bgcolor="#ffffff" style="flex:1 1 260px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;color:#0f172a;min-width:240px;">
                    <tbody>
                      ${renderCompactRows(supportRows)}
                    </tbody>
                  </table>
                </div>
                <p class="email-paragraph" style="margin:0 0 18px;font-size:15px;line-height:1.7;background:#ffffff;color:#0f172a;">
                  Ready to lock in this rate or curious about coverage details? Reply to this email and our team will take care of everything for you.
                </p>
                <div class="email-callout email-callout--guarantee" style="background-color:#0f172a;color:#f8fafc;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
                  <strong>Our Promise:</strong> Enjoy our 30-Day Price Match Promise and 30-Day full money-back guarantee. If you find a better qualifying rate or change your mind within 30 days, we’ll make it right—no risk, no hassle.
                </div>
                <div class="email-callout email-callout--reminder" style="background-color:#eff6ff;color:#1e3a8a;padding:18px 24px;border-radius:12px;margin-bottom:24px;font-size:15px;line-height:1.6;">
                  <strong>Reminder:</strong> We’ll hold this quote through ${escapeHtml(validUntil)}. Ready sooner or want to adjust the payment structure? Reply and we’ll update it together.
                </div>
                <p class="email-paragraph" style="margin:0;font-size:15px;line-height:1.7;background:#ffffff;color:#0f172a;">With gratitude,<br /><strong>The BHAutoProtect Team</strong></p>
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#f9fafb" style="background:#f9fafb;color:#6b7280;padding:22px 32px;font-size:12px;line-height:1.6;">
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

  app.get('/api/site/sample-contract', async (_req, res) => {
    try {
      const metadata = await buildSampleContractMetadata();
      res.json({
        data: {
          contract: metadata
            ? { ...metadata, downloadUrl: '/api/site/sample-contract/pdf' }
            : null,
        },
        message: metadata ? 'Sample contract retrieved successfully' : 'Sample contract not available',
      });
    } catch (error) {
      console.error('Error loading sample contract metadata:', error);
      res.status(500).json({ message: 'Failed to load sample contract metadata' });
    }
  });

  app.get('/api/site/sample-contract/pdf', async (_req, res) => {
    try {
      const file = await getSampleContractFile();
      if (!file) {
        res.status(404).json({ message: 'Sample contract not available' });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(file.base64, 'base64');
      } catch (error) {
        console.error('Unable to decode sample contract file:', error);
        res.status(500).json({ message: 'Failed to load sample contract file' });
        return;
      }

      const safeFileName = file.fileName.replace(/["\r\n]/g, '');
      res.setHeader('Content-Type', file.fileType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Error retrieving sample contract file:', error);
      res.status(500).json({ message: 'Failed to load sample contract file' });
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
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        title: user.title ?? null,
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
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        title: user.title ?? null,
      };

      req.session.user = authenticatedUser;
      res.locals.user = authenticatedUser;
      next();
    } catch (error) {
      console.error("Error verifying session:", error);
      res.status(500).json({ message: "Failed to authenticate" });
    }
  };

  const ensureAdminOrStaffUser = (res: Response): AuthenticatedUser | null => {
    const user = res.locals.user as AuthenticatedUser | undefined;
    if (!user) {
      res.status(403).json({ message: 'Forbidden' });
      return null;
    }
    return user;
  };

  const ensureAdminUser = (res: Response): AuthenticatedUser | null => {
    const user = ensureAdminOrStaffUser(res);
    if (!user) {
      return null;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden' });
      return null;
    }
    return user;
  };

  const sanitizeUser = ({ passwordHash: _passwordHash, ...user }: User) => user;
  const sanitizeCustomerAccount = ({ passwordHash: _passwordHash, ...account }: CustomerAccount) => account;

  const normalizeOptionalContactField = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess(
      (value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed.length === 0 ? null : trimmed;
        }
        return value;
      },
      schema.nullable().optional(),
    );

  const userContactFieldsSchema = z
    .object({
      fullName: normalizeOptionalContactField(
        z
          .string()
          .min(2, 'Full name must be at least 2 characters long')
          .max(160, 'Full name must be at most 160 characters long'),
      ),
      email: normalizeOptionalContactField(
        z
          .string()
          .trim()
          .email('Please provide a valid email address')
          .max(160, 'Email must be at most 160 characters long'),
      ),
      phone: normalizeOptionalContactField(
        z
          .string()
          .min(7, 'Phone number must be at least 7 characters long')
          .max(32, 'Phone number must be at most 32 characters long'),
      ),
      title: normalizeOptionalContactField(
        z
          .string()
          .min(2, 'Title must be at least 2 characters long')
          .max(120, 'Title must be at most 120 characters long'),
      ),
    })
    .partial();

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
      policyData.totalPayments = termMonths > 0 ? termMonths : null;
      policyData.downPayment = quote.priceMonthly;
    }

    let policy = await storage.getPolicyByLeadId(contract.leadId);
    const policyPreviouslyExisted = Boolean(policy);
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

    await updateLeadStatus(contract.leadId, 'sold');

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
        await sendBrandedMail({
          to: salesRecipient,
          subject: notification.subject,
          html: notification.html,
          text: notification.text,
        });
      } catch (error) {
        console.error('Error sending contract signed notification:', error);
      }
    }

    if (!policyPreviouslyExisted && policy) {
      await sendPolicyActivationEmail({
        lead,
        policy,
        vehicle,
        recipients: [signatureEmail, account?.email],
      });
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

      const newLead = await storage.createLead(leadData, {
        originalPayload: req.body,
      });

      const vehicle = payload.vehicle;
      let createdVehicle: Vehicle | null = null;
      if (
        vehicle &&
        typeof vehicle.year === 'number' &&
        typeof vehicle.make === 'string' &&
        typeof vehicle.model === 'string' &&
        typeof vehicle.odometer === 'number'
      ) {
        createdVehicle = await storage.createVehicle({
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

      void sendNewLeadNotification({ lead: newLead, vehicle: createdVehicle });

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

  app.get('/api/admin/quote-preferences', async (_req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const [contractMetadata, instructionsSetting] = await Promise.all([
        buildDefaultContractMetadata(),
        loadQuoteEmailInstructionsSetting(),
      ]);

      res.json({
        data: {
          defaultContract: contractMetadata,
          emailInstructions: instructionsSetting.value,
          emailInstructionsUpdatedAt: instructionsSetting.updatedAt,
        },
        message: 'Quote preferences retrieved successfully',
      });
    } catch (error) {
      console.error('Error loading quote preferences:', error);
      res.status(500).json({ message: 'Failed to load quote preferences' });
    }
  });

  app.get('/api/admin/sample-contract', async (_req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const metadata = await buildSampleContractMetadata();
      res.json({
        data: {
          contract: metadata
            ? { ...metadata, downloadUrl: '/api/site/sample-contract/pdf' }
            : null,
        },
        message: metadata ? 'Sample contract retrieved successfully' : 'Sample contract not configured',
      });
    } catch (error) {
      console.error('Error loading sample contract metadata:', error);
      res.status(500).json({ message: 'Failed to load sample contract metadata' });
    }
  });

  app.post('/api/admin/quote-preferences/default-contract', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    const payloadSchema = z.object({
      fileName: z.string().trim().min(1, 'Contract file name is required'),
      fileType: z.string().trim().optional(),
      fileData: z.string().min(1, 'Contract data is required'),
    });

    try {
      const payload = payloadSchema.parse(req.body ?? {});
      const base64Content = extractBase64Data(payload.fileData);
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Content, 'base64');
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

      const normalizedType = (payload.fileType ?? 'application/pdf').trim().toLowerCase() || 'application/pdf';
      if (!normalizedType.includes('pdf')) {
        res.status(400).json({ message: 'Default contracts must be uploaded as PDF files.' });
        return;
      }

      const fileName = payload.fileName.trim();
      const saved = await storage.upsertSiteSetting({
        key: QUOTE_DEFAULT_CONTRACT_SETTING_KEY,
        value: JSON.stringify({
          fileName,
          fileType: normalizedType,
          fileSize: buffer.length,
          fileData: base64Content,
        }),
      });

      res.json({
        data: {
          defaultContract: {
            fileName,
            fileType: normalizedType,
            fileSize: buffer.length,
            updatedAt: toIsoString(saved.updatedAt ?? null),
          },
        },
        message: 'Default contract updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid contract payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error saving default contract:', error);
      res.status(500).json({ message: 'Failed to save default contract' });
    }
  });

  app.post('/api/admin/sample-contract', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    const payloadSchema = z.object({
      fileName: z.string().trim().min(1, 'Contract file name is required'),
      fileType: z.string().trim().optional(),
      fileData: z.string().min(1, 'Contract data is required'),
    });

    try {
      const payload = payloadSchema.parse(req.body ?? {});
      const base64Content = extractBase64Data(payload.fileData);
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Content, 'base64');
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

      const normalizedType = (payload.fileType ?? 'application/pdf').trim().toLowerCase() || 'application/pdf';
      if (!normalizedType.includes('pdf')) {
        res.status(400).json({ message: 'Contracts must be uploaded as PDF files.' });
        return;
      }

      const fileName = payload.fileName.trim();
      const saved = await storage.upsertSiteSetting({
        key: PUBLIC_SAMPLE_CONTRACT_SETTING_KEY,
        value: JSON.stringify({
          fileName,
          fileType: normalizedType,
          fileSize: buffer.length,
          fileData: base64Content,
        }),
      });

      res.json({
        data: {
          contract: {
            fileName,
            fileType: normalizedType,
            fileSize: buffer.length,
            updatedAt: toIsoString(saved.updatedAt ?? null),
            isPlaceholder: false,
            downloadUrl: '/api/site/sample-contract/pdf',
          },
        },
        message: 'Sample contract updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid contract payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error saving sample contract:', error);
      res.status(500).json({ message: 'Failed to save sample contract' });
    }
  });

  app.post('/api/admin/quote-preferences/email-instructions', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    const payloadSchema = z.object({
      instructions: z
        .string()
        .max(5000, 'Instructions must be 5,000 characters or fewer')
        .optional()
        .nullable(),
    });

    try {
      const payload = payloadSchema.parse(req.body ?? {});
      const trimmed = payload.instructions?.trim() ?? '';
      const saved = await storage.upsertSiteSetting({
        key: QUOTE_EMAIL_INSTRUCTIONS_SETTING_KEY,
        value: trimmed,
      });

      const resolved = trimmed.length > 0 ? trimmed : DEFAULT_QUOTE_EMAIL_INSTRUCTIONS;
      res.json({
        data: {
          emailInstructions: resolved,
          emailInstructionsUpdatedAt: toIsoString(saved.updatedAt ?? null),
        },
        message: 'Quote email instructions updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid instructions payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error updating quote email instructions:', error);
      res.status(500).json({ message: 'Failed to update quote email instructions' });
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
      const lead = await storage.createLead(leadData, {
        originalPayload: req.body,
      });

      syncLeadMetaWithLead(lead);

      void sendNewLeadNotification({ lead });

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
      const clientIp = getClientIp(req);
      try {
        await verifyRecaptchaToken(req.body?.recaptchaToken, clientIp);
      } catch (error) {
        const status =
          error instanceof RecaptchaVerificationError ? error.status : 400;
        const message =
          error instanceof RecaptchaVerificationError
            ? error.message
            : 'reCAPTCHA verification failed';
        console.error('reCAPTCHA verification failed:', error);
        return res.status(status).json({ message });
      }

      const leadData = insertLeadSchema.parse(req.body.lead);
      // The client doesn't include a leadId when submitting vehicle info.
      // We validate the vehicle data without the leadId and add it after
      // creating the lead.
      const vehicleData = insertVehicleSchema
        .omit({ leadId: true })
        .parse(req.body.vehicle);

      let sanitizedPayload: Record<string, unknown> | undefined;
      if (req.body && typeof req.body === 'object') {
        sanitizedPayload = { ...req.body } as Record<string, unknown>;
        delete sanitizedPayload.recaptchaToken;
      }

      // Create lead
      const lead = await storage.createLead(
        {
          ...leadData,
          consentTimestamp: getEasternDate(),
          consentUserAgent: req.get('User-Agent') || '',
          consentIP: clientIp,
        },
        {
          originalPayload: sanitizedPayload ?? req.body,
        },
      );

      const vehicle = await storage.createVehicle({
        ...vehicleData,
        leadId: lead.id,
      });

      // Initialize metadata so newly created leads are visible in admin views
      syncLeadMetaWithLead(lead);

      void sendNewLeadNotification({ lead, vehicle });

      res.status(201).json({
        data: lead,
        message: 'Lead created successfully',
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(400).json({ message: 'Invalid lead data' });
    }
  });

  // Get leads (for future admin use)
  app.get('/api/leads', async (req, res) => {
    try {
      const leads = await storage.getLeads({});
      leads.forEach(syncLeadMetaWithLead);
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
      expirationMiles: z.coerce.number().nonnegative().optional(),
      paymentOption: z.enum(['monthly', 'one-time']).optional(),
    });

    try {
      const sessionUser = req.session?.user as AuthenticatedUser | undefined;
      if (!sessionUser) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const dbUser = await storage.getUser(sessionUser.id);
      if (!dbUser) {
        req.session.user = undefined;
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const currentUser: AuthenticatedUser = {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        fullName: dbUser.fullName ?? null,
        email: dbUser.email ?? null,
        phone: dbUser.phone ?? null,
        title: dbUser.title ?? null,
      };
      req.session.user = currentUser;
      res.locals.user = currentUser;

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

      const repEmail = currentUser.email ? currentUser.email.trim() : '';
      if (repEmail && repEmail !== (lead.salespersonEmail ?? '').trim()) {
        await storage.updateLead(leadId, { salespersonEmail: repEmail });
        lead.salespersonEmail = repEmail;
      }

      const vehicle = await storage.getVehicleByLeadId(leadId);
      const policyPromise = storage.getPolicyByLeadId(leadId).catch(() => undefined);
      const instructionsPromise = resolveQuoteEmailInstructions();

      const priceMonthlyCents = Math.round(data.priceMonthly * 100);
      const priceTotalCents = priceMonthlyCents * data.termMonths;
      const createdAt = getEasternDate();
      const validUntil = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);

      const breakdown: Record<string, unknown> = {};
      if (typeof data.expirationMiles === 'number' && Number.isFinite(data.expirationMiles)) {
        breakdown.expirationMiles = data.expirationMiles;
      }
      if (data.paymentOption) {
        breakdown.paymentOption = data.paymentOption;
      }
      const breakdownPayload = Object.keys(breakdown).length > 0 ? breakdown : undefined;

      const quote = await storage.createQuote({
        leadId,
        plan: data.plan,
        deductible: data.deductible,
        termMonths: data.termMonths,
        priceMonthly: priceMonthlyCents,
        priceTotal: priceTotalCents,
        status: 'sent',
        validUntil,
        breakdown: breakdownPayload,
        createdBy: currentUser.id,
      });

      await updateLeadStatus(leadId, 'quoted');

      const [policy, instructions] = await Promise.all([policyPromise, instructionsPromise]);

      const { subject, html } = buildQuoteEmail({
        lead,
        vehicle,
        quote,
        policy,
        expirationMilesOverride: data.expirationMiles ?? null,
        instructions,
        salesRep: {
          displayName: currentUser.fullName ?? currentUser.username,
          title: currentUser.title ?? null,
          email: currentUser.email ?? null,
          phone: currentUser.phone ?? null,
        },
      });
      const text = htmlToPlainText(html) || subject;

      await sendBrandedMail({
        to: recipient,
        subject,
        html,
        text,
        replyTo: currentUser.email ?? undefined,
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
        let template: ContractTemplateFile | null = null;
        try {
          template = await getStoredDefaultContractTemplate();
        } catch (error) {
          console.warn('Unable to load default contract template:', error);
        }

        if (!template) {
          try {
            const placeholder = getPlaceholderContractFile();
            template = placeholder;
          } catch (error) {
            console.error('No contract template available:', error);
            res.status(400).json({ message: 'Please upload a PDF of the contract to continue.' });
            return;
          }
        }

        base64Data = template.base64;
        fileSize = template.size;
        fileType = fileType || template.fileType;
        fileName = fileName || template.fileName;
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

      await sendBrandedMail({ to: recipient, subject, html, text });

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

    const schema = z
      .object({
        username: z
          .string()
          .trim()
          .min(3, 'Username must be at least 3 characters long')
          .max(64, 'Username must be at most 64 characters long')
          .regex(/^[^\s:]+$/, 'Username cannot contain spaces or colons'),
        password: z.string().min(8, 'Password must be at least 8 characters long'),
        role: z.enum(['admin', 'staff']).default('staff'),
      })
      .merge(userContactFieldsSchema);

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
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        title: data.title ?? null,
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

  app.patch('/api/admin/users/:id', async (req, res) => {
    if (!ensureAdminUser(res)) return;

    try {
      const payload = userContactFieldsSchema.parse(req.body ?? {});
      const updates: Partial<InsertUser> = {};

      if (Object.prototype.hasOwnProperty.call(payload, 'fullName')) {
        updates.fullName = payload.fullName ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
        updates.email = payload.email ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
        updates.phone = payload.phone ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
        updates.title = payload.title ?? null;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No updates were provided' });
        return;
      }

      const user = await storage.getUser(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const updated = await storage.updateUser(user.id, updates);

      if (res.locals.user && (res.locals.user as AuthenticatedUser).id === updated.id) {
        const sessionUser: AuthenticatedUser = {
          id: updated.id,
          username: updated.username,
          role: updated.role,
          fullName: updated.fullName ?? null,
          email: updated.email ?? null,
          phone: updated.phone ?? null,
          title: updated.title ?? null,
        };
        req.session.user = sessionUser;
        res.locals.user = sessionUser;
      }

      res.json({
        data: sanitizeUser(updated),
        message: 'User updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid user details', errors: error.errors });
        return;
      }
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
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
          syncLeadMetaWithLead(lead);
          const status = (lead.status ?? 'new') as LeadStatus;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
          if (status === 'sold') soldLeads++;
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

      const lead = await storage.createLead(leadData, {
        originalPayload: req.body,
      });
      const vehicle = await storage.createVehicle({
        ...vehicleData,
        leadId: lead.id,
      });

      // Ensure newly created leads are tracked for admin views
      syncLeadMetaWithLead(lead);

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
          syncLeadMetaWithLead(lead);
          const vehicle = await storage.getVehicleByLeadId(lead.id);
          const quotes = await storage.getQuotesByLeadId(lead.id);
          return {
            lead,
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
      syncLeadMetaWithLead(lead);
      res.json({
        data: {
          lead,
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
      const vehicle = await storage.getVehicleByLeadId(leadId);
      const contracts = await storage.getLeadContracts(leadId);
      const contractEmails = contracts
        .filter((contract) => contract.status === 'signed')
        .map((contract) => contract.signatureEmail)
        .filter((email): email is string => typeof email === 'string' && email.length > 0);
      const policy = await storage.createPolicy({ leadId, ...data });
      await updateLeadStatus(leadId, 'sold');
      const normalizedEmail = typeof lead.email === 'string' ? lead.email.trim().toLowerCase() : '';
      if (normalizedEmail) {
        try {
          let account = await storage.getCustomerAccountByEmail(normalizedEmail);
          if (!account) {
            const displayNameParts: string[] = [];
            if (typeof lead.firstName === 'string') {
              const value = lead.firstName.trim();
              if (value) {
                displayNameParts.push(value);
              }
            }
            if (typeof lead.lastName === 'string') {
              const value = lead.lastName.trim();
              if (value) {
                displayNameParts.push(value);
              }
            }
            account = await storage.createCustomerAccount({
              email: normalizedEmail,
              passwordHash: hashPassword(leadId),
              displayName: displayNameParts.join(' ').trim() || null,
            });
          }

          if (account) {
            await storage.linkCustomerToPolicy(account.id, policy.id);
            await storage.syncCustomerPoliciesByEmail(account.id, account.email);

            const digits = typeof lead.cardNumber === 'string' ? lead.cardNumber.replace(/\D/g, '') : '';
            const cardLastFour = digits.slice(-4);
            const monthRaw = typeof lead.cardExpiryMonth === 'string' ? lead.cardExpiryMonth.trim() : null;
            const yearRaw = typeof lead.cardExpiryYear === 'string' ? lead.cardExpiryYear.trim() : null;
            const monthValue = monthRaw ? Number.parseInt(monthRaw, 10) : Number.isFinite(lead.cardExpiryMonth) ? Number(lead.cardExpiryMonth) : null;
            const yearValue = yearRaw ? Number.parseInt(yearRaw, 10) : Number.isFinite(lead.cardExpiryYear) ? Number(lead.cardExpiryYear) : null;

            if (cardLastFour) {
              const resolvedMonth = Number.isFinite(monthValue) ? Number(monthValue) : null;
              const resolvedYear = Number.isFinite(yearValue)
                ? (() => {
                    const numericYear = Number(yearValue);
                    if (numericYear < 100 && numericYear >= 0) {
                      const century = new Date().getFullYear();
                      const centuryPrefix = Math.floor(century / 100) * 100;
                      const guess = centuryPrefix + numericYear;
                      return guess < century ? guess + 100 : guess;
                    }
                    return numericYear;
                  })()
                : null;

              const billingZip = (() => {
                const leadRecord = lead as Record<string, unknown>;
                const source = leadRecord.billingZip ?? lead.zip ?? null;
                if (typeof source === 'string') {
                  const trimmed = source.trim();
                  return trimmed.length > 0 ? trimmed : undefined;
                }
                return undefined;
              })();
              const accountName = (() => {
                const parts: string[] = [];
                if (typeof lead.firstName === 'string') {
                  const value = lead.firstName.trim();
                  if (value) {
                    parts.push(value);
                  }
                }
                if (typeof lead.lastName === 'string') {
                  const value = lead.lastName.trim();
                  if (value) {
                    parts.push(value);
                  }
                }
                return parts.join(' ').trim() || undefined;
              })();

              await storage.upsertCustomerPaymentProfile({
                customerId: account.id,
                policyId: policy.id,
                paymentMethod: 'Credit card',
                accountName,
                accountIdentifier: undefined,
                cardBrand: undefined,
                cardLastFour,
                cardExpiryMonth: resolvedMonth ?? undefined,
                cardExpiryYear: resolvedYear ?? undefined,
                billingZip: billingZip || undefined,
                autopayEnabled: false,
                notes: undefined,
              });
            }
          }
        } catch (profileError) {
          console.error('Failed to sync payment profile during conversion:', profileError);
        }
      }
      await sendPolicyActivationEmail({
        lead,
        policy,
        vehicle,
        recipients: contractEmails,
      });
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
        status: z.enum(LEAD_STATUS_VALUES).optional(),
        vehicle: insertVehicleSchema.partial().optional(),
        policy: insertPolicySchema
          .extend({
            policyStartDate: z.coerce.date().optional().nullable(),
            expirationDate: z.coerce.date().optional().nullable(),
          })
          .partial()
          .optional(),
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
        await updateLeadStatus(leadId, status);
      }
      const updatedLead = await storage.getLead(leadId);
      if (updatedLead) {
        syncLeadMetaWithLead(updatedLead);
      }
      const updatedVehicle = await storage.getVehicleByLeadId(leadId);
      const updatedPolicy = await storage.getPolicyByLeadId(leadId);
      res.json({
        data: {
          lead: updatedLead,
          vehicle: updatedVehicle,
          policy: updatedPolicy,
          status: updatedLead?.status ?? getLeadMeta(leadId).status,
        },
        message: 'Lead updated successfully',
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(400).json({ message: 'Invalid lead data' });
    }
  });

  app.delete('/api/admin/leads/:id', async (req, res) => {
    try {
      const lead = await loadLeadFromRequest(req, res);
      if (!lead) {
        return;
      }

      await storage.deleteLead(lead.id);
      delete leadMeta[lead.id];

      res.json({ data: lead, message: 'Lead deleted successfully' });
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ message: 'Failed to delete lead' });
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
    if (!ensureAdminOrStaffUser(res)) {
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

  app.delete('/api/admin/policies/:id', async (req, res) => {
    if (!ensureAdminUser(res)) {
      return;
    }

    try {
      const deleted = await storage.deletePolicy(req.params.id);
      if (!deleted) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      res.json({ data: deleted, message: 'Policy deleted successfully' });
    } catch (error) {
      console.error('Error deleting policy:', error);
      res.status(500).json({ message: 'Failed to delete policy' });
    }
  });

  app.get('/api/admin/policies/:id/payment-profiles', async (req, res) => {
    if (!ensureAdminOrStaffUser(res)) {
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

  app.post('/api/admin/policies/:id/charges', async (req, res) => {
    if (!ensureAdminOrStaffUser(res)) {
      return;
    }

    try {
      const payload = policyChargeCreateSchema.parse(req.body ?? {});
      const policy = await storage.getPolicy(req.params.id);
      if (!policy) {
        res.status(404).json({ message: 'Policy not found' });
        return;
      }

      let chargedAt: Date | null = null;
      try {
        chargedAt = parseChargeDateInput(payload.chargedAt ?? null);
      } catch {
        res.status(400).json({ message: 'Charge date is invalid' });
        return;
      }

      let invoiceFileName: string | null = null;
      let invoiceFilePath: string | null = null;
      let invoiceFileType: string | null = null;
      let invoiceFileSize: number | null = null;

      if (payload.invoice) {
        const { fileData, fileName, fileType } = payload.invoice;
        const base64Segment = fileData.includes(',') ? fileData.slice(fileData.indexOf(',') + 1) : fileData;
        const normalizedData = base64Segment.replace(/\s+/g, '');

        let buffer: Buffer;
        try {
          buffer = Buffer.from(normalizedData, 'base64');
        } catch {
          res.status(400).json({ message: 'Invoice file data is invalid' });
          return;
        }

        if (!buffer || buffer.length === 0) {
          res.status(400).json({ message: 'Invoice file is empty' });
          return;
        }

        if (buffer.length > MAX_INVOICE_FILE_SIZE_BYTES) {
          res.status(400).json({ message: 'Invoice file is too large (max 10 MB)' });
          return;
        }

        const invoicesDir = path.join('uploads', 'invoices');
        fs.mkdirSync(invoicesDir, { recursive: true });
        const safeName = sanitizeFileName(fileName);
        const storedName = `${Date.now()}-${safeName}`;
        const filePath = path.join(invoicesDir, storedName);
        fs.writeFileSync(filePath, buffer);

        invoiceFileName = fileName;
        invoiceFileType = fileType?.trim() || null;
        invoiceFileSize = buffer.length;
        invoiceFilePath = filePath.split(path.sep).join('/');
      }

      const charge = await storage.createPolicyCharge({
        policyId: req.params.id,
        description: payload.description.trim(),
        amountCents: payload.amountCents,
        status: payload.status ?? 'pending',
        chargedAt: chargedAt ?? undefined,
        notes: payload.notes && payload.notes.trim().length > 0 ? payload.notes.trim() : null,
        reference: payload.reference && payload.reference.trim().length > 0 ? payload.reference.trim() : null,
        invoiceFileName,
        invoiceFilePath,
        invoiceFileType,
        invoiceFileSize,
      });

      res.status(201).json({ data: charge, message: 'Charge recorded successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.at(0)?.message ?? 'Invalid charge payload';
        res.status(400).json({ message });
        return;
      }
      console.error('Error saving policy charge:', error);
      res.status(500).json({ message: 'Failed to save charge' });
    }
  });

  app.get('/api/admin/policies/:id/charges', async (req, res) => {
    if (!ensureAdminOrStaffUser(res)) {
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
    if (!ensureAdminOrStaffUser(res)) {
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
          await sendBrandedMail({
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
    if (!ensureAdminOrStaffUser(res)) {
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

  const policyFileUploadParser = express.raw({
    type: () => true,
    limit: '10mb',
  });

  const logPolicyFileUploadFailure = (
    policyId: string,
    reason: string,
    details: Record<string, unknown> = {},
  ): void => {
    const metadata = {
      policyId,
      ...details,
    };
    console.warn(`[PolicyFileUpload] ${reason}`, metadata);
  };

  // Admin: upload file to policy
  app.post('/api/admin/policies/:id/files', policyFileUploadParser, async (req, res) => {
    try {
      const policyId = req.params.id;
      const headerFilename = req.header('x-filename');
      const originalFileName = typeof headerFilename === 'string' ? headerFilename.trim() : '';

      const body: unknown = req.body;
      let fileBuffer: Buffer | null = null;
      if (Buffer.isBuffer(body)) {
        fileBuffer = body;
      } else if (body instanceof ArrayBuffer) {
        fileBuffer = Buffer.from(body);
      } else if (ArrayBuffer.isView(body)) {
        fileBuffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
      }

      if (!originalFileName) {
        logPolicyFileUploadFailure(policyId, 'Missing file name header', {
          headerValue: headerFilename,
        });
        res.status(400).json({ message: 'File name missing' });
        return;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        const bodyConstructorName =
          body && typeof body === 'object' && (body as { constructor?: { name?: string } }).constructor
            ? (body as { constructor: { name?: string } }).constructor.name ?? 'Object'
            : undefined;
        const bodyType = bodyConstructorName ?? typeof body;
        logPolicyFileUploadFailure(policyId, 'No file data received', {
          fileName: originalFileName,
          bodyType,
          isBuffer: Buffer.isBuffer(body),
          isArrayBuffer: body instanceof ArrayBuffer,
          isView: ArrayBuffer.isView(body),
        });
        res.status(400).json({ message: 'File data missing' });
        return;
      }

      if (fileBuffer.length > MAX_POLICY_FILE_BYTES) {
        logPolicyFileUploadFailure(policyId, 'File exceeded size limit', {
          fileName: originalFileName,
          fileSize: fileBuffer.length,
          maxSize: MAX_POLICY_FILE_BYTES,
        });
        res.status(400).json({ message: 'File is too large (max 10 MB)' });
        return;
      }

      fs.mkdirSync('uploads', { recursive: true });
      const safeName = sanitizeFileName(originalFileName) || 'document';
      const storedName = `${Date.now()}-${safeName}`;
      const filePath = path.join('uploads', storedName);
      fs.writeFileSync(filePath, fileBuffer);

      const normalizedPath = filePath.split(path.sep).join('/');
      const file = await storage.createPolicyFile({
        policyId,
        fileName: originalFileName,
        filePath: normalizedPath,
      });
      res.json({ data: file, message: 'File uploaded successfully' });
    } catch (error) {
      const policyId = req.params.id;
      const headerFilename = req.header('x-filename');
      console.error('Error uploading policy file:', {
        error,
        policyId,
        fileName: typeof headerFilename === 'string' ? headerFilename.trim() : undefined,
      });
      const rawMessage = error instanceof Error ? error.message : undefined;
      const normalized = rawMessage ? rawMessage.toLowerCase() : '';
      const message =
        rawMessage && !normalized.includes('failed to upload file')
          ? `Failed to upload file: ${rawMessage}`
          : 'Failed to upload file';
      res.status(500).json({ message });
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

      await sendBrandedMail({
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

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    const maybeType = typeof error === 'object' && error !== null ? (error as { type?: string }).type : undefined;
    if (maybeType === 'entity.too.large') {
      console.error('File upload rejected because it exceeded size limits:', error);
      res.status(413).json({ message: 'File is too large (max 10 MB)' });
      return;
    }
    next(error);
  });

  const httpServer = createServer(app);
  return httpServer;
}

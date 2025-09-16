import type { Express, RequestHandler, Response } from "express";
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
  type InsertLead,
  type Lead,
  type Quote,
  type User,
  type Vehicle,
} from "@shared/schema";
import fs from "fs";
import path from "path";
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

type AuthenticatedUser = {
  id: string;
  username: string;
  role: "admin" | "staff";
};

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
  }
}

const getLeadMeta = (id: string): LeadMeta => {
  return leadMeta[id] || DEFAULT_META;
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
  await storage.ensureDefaultAdminUser();
  await storage.ensureDefaultEmailTemplates();

  const MemoryStore = createMemoryStore(session);
  const secureCookie = process.env.NODE_ENV === "production";
  const sessionStore = new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });

  app.set("trust proxy", 1);
  app.use(
    session({
      name: "bh_session",
      secret: process.env.SESSION_SECRET ?? "change-me",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: 12 * 60 * 60 * 1000,
      },
    })
  );

  app.use("/uploads", express.static("uploads"));

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
          plan: z.enum(['bronze', 'silver', 'gold']),
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
  app.get('/api/leads/:id/meta', (req, res) => {
    const meta = getLeadMeta(req.params.id);
    res.json({ data: meta, message: 'Lead metadata retrieved successfully' });
  });

  // Retrieve vehicle information for a lead
  app.get('/api/leads/:id/vehicle', async (req, res) => {
    try {
      const vehicle = await storage.getVehicleByLeadId(req.params.id);
      res.json({ data: vehicle, message: 'Vehicle retrieved successfully' });
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ message: 'Failed to fetch vehicle' });
    }
  });

  // Retrieve quotes for a lead
  app.get('/api/leads/:id/quotes', async (req, res) => {
    try {
      const quotes = await storage.getQuotesByLeadId(req.params.id);
      res.json({ data: quotes, message: 'Quotes retrieved successfully' });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: 'Failed to fetch quotes' });
    }
  });

  // Update basic lead metadata such as tags
  app.post('/api/leads/:id/meta', (req, res) => {
    const schema = z.object({ tags: z.string().optional() });
    try {
      const data = schema.parse(req.body);
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const current = getLeadMeta(req.params.id);
      leadMeta[req.params.id] = { ...current, tags };
      res.redirect('/admin');
    } catch (error) {
      console.error('Error saving meta:', error);
      res.status(400).send('Invalid meta data');
    }
  });

  // Assign coverage plan to a lead
  app.post('/api/leads/:id/coverage', async (req, res) => {
    const schema = z.object({
      plan: z.enum(['bronze', 'silver', 'gold']),
      deductible: z.coerce.number(),
      termMonths: z.coerce.number().default(36),
      priceMonthly: z.coerce.number(),
    });

    try {
      const leadId = req.params.id;
      const data = schema.parse(req.body);

      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

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
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      const vehicle = await storage.getVehicleByLeadId(req.params.id);
      const quotes = await storage.getQuotesByLeadId(req.params.id);
      const notes = await storage.getNotesByLeadId(req.params.id);
      const policy = await storage.getPolicyByLeadId(req.params.id);
      const meta = getLeadMeta(req.params.id);
      res.json({
        data: {
          lead: { ...lead, status: meta.status },
          vehicle,
          quotes,
          notes,
          policy,
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
      const note = await storage.createNote({ leadId: req.params.id, content: data.content });
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
      const existingPolicy = await storage.getPolicyByLeadId(req.params.id);
      if (existingPolicy) {
        return res.status(409).json({
          data: existingPolicy,
          message: 'Lead has already been converted to a policy',
        });
      }
      const data = schema.parse(req.body);
      const policy = await storage.createPolicy({ leadId: req.params.id, ...data });
      const current = getLeadMeta(req.params.id);
      leadMeta[req.params.id] = { ...current, status: 'sold' };
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
      const existingLead = await storage.getLead(req.params.id);
      if (!existingLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
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
        await storage.updateLead(req.params.id, leadUpdates);
      }
      if (vehicle) {
        const existingVehicle = await storage.getVehicleByLeadId(req.params.id);
        if (existingVehicle) {
          await storage.updateVehicle(req.params.id, vehicle);
        } else {
          await storage.createVehicle({ ...vehicle, leadId: req.params.id });
        }
      }
      if (policy) {
        await storage.updatePolicy(req.params.id, policy);
      }
      if (status) {
        const current = getLeadMeta(req.params.id);
        leadMeta[req.params.id] = { ...current, status };
      }
      const updatedLead = await storage.getLead(req.params.id);
      const updatedVehicle = await storage.getVehicleByLeadId(req.params.id);
      const updatedPolicy = await storage.getPolicyByLeadId(req.params.id);
      res.json({
        data: {
          lead: updatedLead,
          vehicle: updatedVehicle,
          policy: updatedPolicy,
          status: getLeadMeta(req.params.id).status,
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
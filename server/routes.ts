import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertVehicleSchema } from "@shared/schema";
import { calculateQuote } from "../client/src/lib/pricing";

const ADMIN_USER = { username: "admin", password: "password" } as const;

type LeadMeta = {
  tags: string[];
  priority: "low" | "medium" | "high";
};
const leadMeta: Record<string, LeadMeta> = {};

const basicAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Authentication required");
  }
  const [type, credentials] = authHeader.split(" ");
  if (type !== "Basic" || !credentials) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Invalid authorization header");
  }
  const [user, pass] = Buffer.from(credentials, "base64").toString().split(":");
  if (user === ADMIN_USER.username && pass === ADMIN_USER.password) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Admin"');
  return res.status(401).send("Invalid credentials");
};

export async function registerRoutes(app: Express): Promise<Server> {

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
          plan: z.enum(['powertrain', 'gold', 'platinum']),
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
      const vehicleData = insertVehicleSchema.parse(req.body.vehicle);
      
      // Create lead
      const lead = await storage.createLead({
        ...leadData,
        consentTimestamp: new Date(),
        consentIP: req.ip,
        consentUserAgent: req.get('User-Agent') || '',
      });
      
      // Create vehicle
      await storage.createVehicle({
        ...vehicleData,
        leadId: lead.id,
      });
      
      res.json({
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

  // Simple admin dashboard protected with basic auth
  app.get('/admin', basicAuth, async (req, res) => {
    try {
      const leads = await storage.getLeads({});
      const customers: { lead: any; quotes: any[] }[] = [];

      let leadContent = '';
      for (const lead of leads) {
        const vehicle = await storage.getVehicleByLeadId(lead.id);
        const quotes = await storage.getQuotesByLeadId(lead.id);
        if (quotes.length) {
          customers.push({ lead, quotes });
        }
        const meta = leadMeta[lead.id] || { tags: [], priority: 'low' };
        leadContent += `\n<div style="border:1px solid #ccc;padding:10px;margin-bottom:10px;">\n` +
          `<h2>${lead.firstName ?? ''} ${lead.lastName ?? ''}</h2>\n` +
          `<p>Email: ${lead.email ?? ''}</p>\n` +
          `<p>Phone: ${lead.phone ?? ''}</p>\n` +
          (vehicle ? `<p>Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>\n` : '') +
          `<form method="POST" action="/api/leads/${lead.id}/coverage">\n` +
          `<label>Plan: <select name="plan">\n` +
          `<option value="powertrain">powertrain</option>\n` +
          `<option value="gold">gold</option>\n` +
          `<option value="platinum">platinum</option>\n` +
          `</select></label>\n` +
          `<label>Deductible: <input type="number" name="deductible" value="100" /></label>\n` +
          `<label>Monthly Price ($): <input type="number" step="0.01" name="priceMonthly" value="100" /></label>\n` +
          `<input type="hidden" name="termMonths" value="36" />\n` +
          `<button type="submit">Assign Coverage</button>\n` +
          `</form>\n` +
          `<form method="POST" action="/api/leads/${lead.id}/meta" style="margin-top:5px;">\n` +
          `<label>Tags (comma separated): <input type="text" name="tags" value="${meta.tags.join(', ')}" /></label>\n` +
          `<label>Priority: <select name="priority">\n` +
          `<option value="low"${meta.priority==='low'?' selected':''}>low</option>\n` +
          `<option value="medium"${meta.priority==='medium'?' selected':''}>medium</option>\n` +
          `<option value="high"${meta.priority==='high'?' selected':''}>high</option>\n` +
          `</select></label>\n` +
          `<button type="submit">Save Meta</button>\n` +
          `</form>\n` +
          `<button disabled style="margin-top:5px;">Send Quote (todo)</button>\n` +
          `</div>`;
      }

      let customerContent = '';
      for (const c of customers) {
        const q = c.quotes[0];
        customerContent += `\n<div style="border:1px solid #ccc;padding:10px;margin-bottom:10px;">\n` +
          `<h2>${c.lead.firstName ?? ''} ${c.lead.lastName ?? ''}</h2>\n` +
          `<p>Plan: ${q.plan}</p>\n` +
          `<p>Monthly Price: $${(q.priceMonthly / 100).toFixed(2)}</p>\n` +
          `</div>`;
      }

      const analyticsContent = `\n<div style="border:1px solid #ccc;padding:10px;margin-bottom:10px;">\n` +
        `<p>Total Leads: ${leads.length}</p>\n` +
        `<p>Customers: ${customers.length}</p>\n` +
        `</div>`;

      const html = `<!DOCTYPE html><html><head><title>Admin Dashboard</title></head><body>` +
        `<h1>Admin Dashboard</h1>` +
        `<h2>Reporting & Analytics</h2>${analyticsContent}` +
        `<h2>Lead Management</h2>${leadContent}` +
        `<h2>Customer Management</h2>${customerContent}` +
        `</body></html>`;
      res.send(html);
    } catch (error) {
      console.error('Error rendering admin dashboard:', error);
      res.status(500).send('Failed to load admin dashboard');
    }
  });

  // Update basic lead metadata such as tags and priority
  app.post('/api/leads/:id/meta', basicAuth, (req, res) => {
    const schema = z.object({
      tags: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']),
    });
    try {
      const data = schema.parse(req.body);
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      leadMeta[req.params.id] = { tags, priority: data.priority };
      res.redirect('/admin');
    } catch (error) {
      console.error('Error saving meta:', error);
      res.status(400).send('Invalid meta data');
    }
  });

  // Assign coverage plan to a lead
  app.post('/api/leads/:id/coverage', basicAuth, async (req, res) => {
    const schema = z.object({
      plan: z.enum(['powertrain', 'gold', 'platinum']),
      deductible: z.coerce.number(),
      termMonths: z.coerce.number().default(36),
      priceMonthly: z.coerce.number(),
    });

    try {
      const leadId = req.params.id;
      const data = schema.parse(req.body);
      const priceMonthlyCents = Math.round(data.priceMonthly * 100);
      await storage.createQuote({
        leadId,
        plan: data.plan,
        deductible: data.deductible,
        termMonths: data.termMonths,
        priceMonthly: priceMonthlyCents,
        priceTotal: priceMonthlyCents * data.termMonths,
      });
      res.redirect('/admin');
    } catch (error) {
      console.error('Error assigning coverage:', error);
      res.status(400).send('Invalid coverage data');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
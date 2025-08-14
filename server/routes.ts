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

  // Admin dashboard route - authentication handled here, React handles rendering
  app.get('/admin', basicAuth, (_req, _res, next) => {
    // pass through to Vite's middleware which will serve the SPA
    next();
  });

  // Retrieve basic metadata for a lead
  app.get('/api/leads/:id/meta', basicAuth, (req, res) => {
    const meta = leadMeta[req.params.id] || { tags: [], priority: 'low' };
    res.json({ data: meta, message: 'Lead metadata retrieved successfully' });
  });

  // Retrieve vehicle information for a lead
  app.get('/api/leads/:id/vehicle', basicAuth, async (req, res) => {
    try {
      const vehicle = await storage.getVehicleByLeadId(req.params.id);
      res.json({ data: vehicle, message: 'Vehicle retrieved successfully' });
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ message: 'Failed to fetch vehicle' });
    }
  });

  // Retrieve quotes for a lead
  app.get('/api/leads/:id/quotes', basicAuth, async (req, res) => {
    try {
      const quotes = await storage.getQuotesByLeadId(req.params.id);
      res.json({ data: quotes, message: 'Quotes retrieved successfully' });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: 'Failed to fetch quotes' });
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
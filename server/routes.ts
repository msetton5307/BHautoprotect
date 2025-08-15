import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertVehicleSchema, insertClaimSchema } from "@shared/schema";
import { calculateQuote } from "../client/src/lib/pricing";

const ADMIN_USER = { username: "admin", password: "password" } as const;

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

const getLeadMeta = (id: string): LeadMeta => {
  return leadMeta[id] || DEFAULT_META;
};

const getEasternDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

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
          plan: z.enum(['basic', 'gold', 'platinum']),
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
    const meta = getLeadMeta(req.params.id);
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

  // Update basic lead metadata such as tags
  app.post('/api/leads/:id/meta', basicAuth, (req, res) => {
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
  app.post('/api/leads/:id/coverage', basicAuth, async (req, res) => {
    const schema = z.object({
      plan: z.enum(['basic', 'gold', 'platinum']),
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

  // Admin: dashboard statistics
  app.get('/api/admin/stats', basicAuth, async (_req, res) => {
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
  app.post('/api/admin/leads', basicAuth, async (req, res) => {
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

      res.json({
        data: { lead, vehicle },
        message: 'Lead created successfully',
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(400).json({ message: 'Invalid lead data' });
    }
  });

  // Admin: list leads with associated data
  app.get('/api/admin/leads', basicAuth, async (_req, res) => {
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
  app.get('/api/admin/leads/:id', basicAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      const vehicle = await storage.getVehicleByLeadId(req.params.id);
      const quotes = await storage.getQuotesByLeadId(req.params.id);
      const notes = await storage.getNotesByLeadId(req.params.id);
      const meta = getLeadMeta(req.params.id);
      res.json({
        data: {
          lead: { ...lead, status: meta.status },
          vehicle,
          quotes,
          notes,
        },
        message: 'Lead retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({ message: 'Failed to fetch lead' });
    }
  });

  // Admin: add note to lead
  app.post('/api/admin/leads/:id/notes', basicAuth, async (req, res) => {
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
  app.post('/api/admin/leads/:id/convert', basicAuth, async (req, res) => {
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
  app.patch('/api/admin/leads/:id', basicAuth, async (req, res) => {
    const schema = insertLeadSchema.partial().extend({
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
    });
    try {
      const data = schema.parse(req.body);
      const { status, ...leadUpdates } = data;
      if (Object.keys(leadUpdates).length > 0) {
        await storage.updateLead(req.params.id, leadUpdates);
      }
      if (status) {
        const current = getLeadMeta(req.params.id);
        leadMeta[req.params.id] = { ...current, status };
      }
      const updatedLead = await storage.getLead(req.params.id);
      res.json({
        data: { lead: updatedLead, status: getLeadMeta(req.params.id).status },
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
  app.get('/api/admin/policies', basicAuth, async (_req, res) => {
    try {
      const policies = await storage.getPolicies();
      res.json({ data: policies, message: 'Policies retrieved successfully' });
    } catch (error) {
      console.error('Error fetching policies:', error);
      res.status(500).json({ message: 'Failed to fetch policies' });
    }
  });

  // Admin: list claims
  app.get('/api/admin/claims', basicAuth, async (_req, res) => {
    try {
      const claims = await storage.getClaims();
      res.json({ data: claims, message: 'Claims retrieved successfully' });
    } catch (error) {
      console.error('Error fetching claims:', error);
      res.status(500).json({ message: 'Failed to fetch claims' });
    }
  });

  // Admin: get claim by id
  app.get('/api/admin/claims/:id', basicAuth, async (req, res) => {
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
  app.patch('/api/admin/claims/:id', basicAuth, async (req, res) => {
    const schema = z.object({
      status: z
        .enum([
          'new',
          'denied',
          'awaiting_customer_action',
          'awaiting_inspection',
          'claim_covered_open',
          'claim_covered_closed',
        ])
        .optional(),
    });
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
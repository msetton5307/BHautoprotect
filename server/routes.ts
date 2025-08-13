import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { insertLeadSchema, insertVehicleSchema, insertQuoteSchema, insertNoteSchema, insertTaskSchema } from "@shared/schema";
import { calculateQuote } from "../client/src/lib/pricing";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Partner API for submitting leads
  app.post('/api/public/leads', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        return res.status(401).json({ message: "API key required" });
      }
      
      const partner = await storage.getPartnerByApiKey(apiKey);
      if (!partner) {
        return res.status(401).json({ message: "Invalid API key" });
      }
      
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead({
        ...leadData,
        partnerId: partner.id,
        source: 'partner',
      });
      
      res.json({
        data: lead,
        message: "Lead created successfully"
      });
    } catch (error) {
      console.error("Error creating partner lead:", error);
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // Protected CRM routes
  app.get('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      let filters: any = req.query;
      
      // Role-based filtering
      if (user?.role === 'agent') {
        filters.assignedToId = user.id;
      }
      
      const leads = await storage.getLeads(filters);
      res.json({
        data: leads,
        message: "Leads retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Get related data
      const vehicle = await storage.getVehicleByLeadId(lead.id);
      const quotes = await storage.getQuotesByLeadId(lead.id);
      const notes = await storage.getNotesByLeadId(lead.id);
      const tasks = await storage.getTasksByLeadId(lead.id);
      const messages = await storage.getMessagesByLeadId(lead.id);
      
      res.json({
        data: {
          lead,
          vehicle,
          quotes,
          notes,
          tasks,
          messages,
        },
        message: "Lead details retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.patch('/api/leads/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;
      const lead = await storage.updateLead(req.params.id, updates);
      
      res.json({
        data: lead,
        message: "Lead updated successfully"
      });
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.post('/api/leads/:id/notes', isAuthenticated, async (req: any, res) => {
    try {
      const noteData = insertNoteSchema.parse({
        ...req.body,
        leadId: req.params.id,
        userId: req.user.claims.sub,
      });
      
      const note = await storage.createNote(noteData);
      
      res.json({
        data: note,
        message: "Note created successfully"
      });
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(400).json({ message: "Invalid note data" });
    }
  });

  app.post('/api/leads/:id/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        leadId: req.params.id,
        assignedToId: req.body.assignedToId || req.user.claims.sub,
      });
      
      const task = await storage.createTask(taskData);
      
      res.json({
        data: task,
        message: "Task created successfully"
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.post('/api/leads/:id/quotes', isAuthenticated, async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.parse({
        ...req.body,
        leadId: req.params.id,
      });
      
      const quote = await storage.createQuote(quoteData);
      
      res.json({
        data: quote,
        message: "Quote created successfully"
      });
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(400).json({ message: "Invalid quote data" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const userId = user?.role === 'agent' ? user.id : undefined;
      
      const stats = await storage.getDashboardStats(userId);
      
      res.json({
        data: stats,
        message: "Dashboard stats retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Partners endpoints
  app.get('/api/partners', isAuthenticated, async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json({
        data: partners,
        message: "Partners retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  // Pricing rules endpoints
  app.get('/api/pricing-rules', isAuthenticated, async (req, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json({
        data: rules,
        message: "Pricing rules retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching pricing rules:", error);
      res.status(500).json({ message: "Failed to fetch pricing rules" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

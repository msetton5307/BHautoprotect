import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertLeadSchema, insertVehicleSchema, insertQuoteSchema } from "@shared/schema";
import { calculateQuote } from "../client/src/lib/pricing";

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

  const httpServer = createServer(app);
  return httpServer;
}

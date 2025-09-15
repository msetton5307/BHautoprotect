import type { Express, RequestHandler, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertLeadSchema,
  insertVehicleSchema,
  insertPolicySchema,
  insertClaimSchema,
  insertPolicyNoteSchema,
  type InsertLead,
  type User,
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

const getLeadMeta = (id: string): LeadMeta => {
  return leadMeta[id] || DEFAULT_META;
};

const getEasternDate = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.ensureDefaultAdminUser();
  app.use('/uploads', express.static('uploads'));

  const unauthorizedResponse = (res: Response) => {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).json({ message: 'Unauthorized' });
  };

  const adminAuth: RequestHandler = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      unauthorizedResponse(res);
      return;
    }

    const base64Credentials = authHeader.slice(6).trim();
    let decoded: string;
    try {
      decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
    } catch (error) {
      unauthorizedResponse(res);
      return;
    }

    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      unauthorizedResponse(res);
      return;
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (!username || !password) {
      unauthorizedResponse(res);
      return;
    }

    try {
      const user = await storage.getUserByUsername(username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        unauthorizedResponse(res);
        return;
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      res.locals.user = authenticatedUser;
      next();
    } catch (error) {
      console.error('Error verifying credentials:', error);
      res.status(500).json({ message: 'Failed to authenticate' });
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
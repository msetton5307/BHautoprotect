import {
  users,
  leads,
  vehicles,
  quotes,
  policies,
  payments,
  tasks,
  notes,
  messages,
  documents,
  partners,
  pricingRules,
  auditLogs,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type Vehicle,
  type InsertVehicle,
  type Quote,
  type InsertQuote,
  type Policy,
  type InsertPolicy,
  type Payment,
  type InsertPayment,
  type Task,
  type InsertTask,
  type Note,
  type InsertNote,
  type Message,
  type InsertMessage,
  type Document,
  type InsertDocument,
  type Partner,
  type InsertPartner,
  type PricingRule,
  type InsertPricingRule,
  type AuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, like, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Lead operations
  getLeads(filters?: any): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;
  getLeadsByStage(stage: string): Promise<Lead[]>;
  getLeadsByAssignee(userId: string): Promise<Lead[]>;
  
  // Vehicle operations
  getVehicleByLeadId(leadId: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle>;
  
  // Quote operations
  getQuotesByLeadId(leadId: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, updates: Partial<Quote>): Promise<Quote>;
  
  // Policy operations
  getPolicies(): Promise<Policy[]>;
  getPolicy(id: string): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy>;
  
  // Payment operations
  getPaymentsByPolicyId(policyId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment>;
  
  // Task operations
  getTasksByLeadId(leadId: string): Promise<Task[]>;
  getTasksByAssignee(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  
  // Note operations
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  
  // Message operations
  getMessagesByLeadId(leadId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Document operations
  getDocumentsByOwner(ownerType: string, ownerId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  
  // Partner operations
  getPartners(): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  getPartnerByApiKey(apiKey: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  
  // Pricing rules
  getPricingRules(): Promise<PricingRule[]>;
  getActivePricingRules(): Promise<PricingRule[]>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule>;
  
  // Analytics
  getDashboardStats(userId?: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Lead operations
  async getLeads(filters?: any): Promise<Lead[]> {
    let query = db.select().from(leads);
    
    if (filters?.stage) {
      query = query.where(eq(leads.stage, filters.stage));
    }
    if (filters?.assignedToId) {
      query = query.where(eq(leads.assignedToId, filters.assignedToId));
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.where(
        sql`${leads.firstName} ILIKE ${searchTerm} OR ${leads.lastName} ILIKE ${searchTerm} OR ${leads.email} ILIKE ${searchTerm}`
      );
    }
    
    return query.orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead;
  }

  async getLeadsByStage(stage: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.stage, stage)).orderBy(desc(leads.createdAt));
  }

  async getLeadsByAssignee(userId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.assignedToId, userId)).orderBy(desc(leads.createdAt));
  }

  // Vehicle operations
  async getVehicleByLeadId(leadId: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.leadId, leadId));
    return vehicle;
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    const [vehicle] = await db
      .update(vehicles)
      .set(updates)
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle;
  }

  // Quote operations
  async getQuotesByLeadId(leadId: string): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.leadId, leadId)).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    const [quote] = await db
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  // Policy operations
  async getPolicies(): Promise<Policy[]> {
    return db.select().from(policies).orderBy(desc(policies.createdAt));
  }

  async getPolicy(id: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const [newPolicy] = await db.insert(policies).values(policy).returning();
    return newPolicy;
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const [policy] = await db
      .update(policies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return policy;
  }

  // Payment operations
  async getPaymentsByPolicyId(policyId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.policyId, policyId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const [payment] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  // Task operations
  async getTasksByLeadId(leadId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.leadId, leadId)).orderBy(asc(tasks.dueAt));
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.assignedToId, userId)).orderBy(asc(tasks.dueAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  // Note operations
  async getNotesByLeadId(leadId: string): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

  // Message operations
  async getMessagesByLeadId(leadId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(asc(messages.createdAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  // Document operations
  async getDocumentsByOwner(ownerType: string, ownerId: string): Promise<Document[]> {
    return db.select().from(documents)
      .where(and(eq(documents.ownerType, ownerType), eq(documents.ownerId, ownerId)))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  // Partner operations
  async getPartners(): Promise<Partner[]> {
    return db.select().from(partners).orderBy(asc(partners.name));
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async getPartnerByApiKey(apiKey: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.apiKey, apiKey));
    return partner;
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const [newPartner] = await db.insert(partners).values(partner).returning();
    return newPartner;
  }

  // Pricing rules
  async getPricingRules(): Promise<PricingRule[]> {
    return db.select().from(pricingRules).orderBy(desc(pricingRules.createdAt));
  }

  async getActivePricingRules(): Promise<PricingRule[]> {
    return db.select().from(pricingRules).where(eq(pricingRules.active, true));
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const [newRule] = await db.insert(pricingRules).values(rule).returning();
    return newRule;
  }

  async updatePricingRule(id: string, updates: Partial<PricingRule>): Promise<PricingRule> {
    const [rule] = await db
      .update(pricingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingRules.id, id))
      .returning();
    return rule;
  }

  // Analytics
  async getDashboardStats(userId?: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let leadsQuery = db.select({ count: sql<number>`count(*)` }).from(leads);
    let quotesQuery = db.select({ count: sql<number>`count(*)` }).from(quotes);
    let tasksQuery = db.select({ count: sql<number>`count(*)` }).from(tasks).where(sql`completed_at IS NULL`);
    
    if (userId) {
      leadsQuery = leadsQuery.where(eq(leads.assignedToId, userId));
      quotesQuery = quotesQuery.innerJoin(leads, eq(quotes.leadId, leads.id)).where(eq(leads.assignedToId, userId));
      tasksQuery = tasksQuery.where(eq(tasks.assignedToId, userId));
    }
    
    const [leadsToday] = await leadsQuery.where(sql`created_at >= ${today}`);
    const [quotesSent] = await quotesQuery.where(eq(quotes.status, 'sent'));
    const [pendingTasks] = await tasksQuery;
    
    // Mock revenue calculation - in real app would be from payments table
    const revenueToday = 8450;
    
    return {
      leadsToday: leadsToday.count,
      quotesSent: quotesSent.count,
      pendingTasks: pendingTasks.count,
      revenueToday,
    };
  }
}

export const storage = new DatabaseStorage();

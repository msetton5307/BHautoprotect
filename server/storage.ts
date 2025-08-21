import {
  leads,
  vehicles,
  quotes,
  notes,
  policies,
  claims,
  type Lead,
  type InsertLead,
  type Vehicle,
  type InsertVehicle,
  type Quote,
  type InsertQuote,
  type Note,
  type InsertNote,
  type Policy,
  type InsertPolicy,
  type Claim,
  type InsertClaim,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

const generateLeadId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
const getEasternDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

// Interface for storage operations
export interface IStorage {
  // Lead operations
  getLeads(filters: any): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead & { id?: string; createdAt?: Date }): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  
  // Vehicle operations
  getVehicleByLeadId(leadId: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  
  // Quote operations
  getQuotesByLeadId(leadId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;

  // Note operations
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  // Policy operations
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  getPolicies(): Promise<Policy[]>;

  // Claim operations
  createClaim(claim: InsertClaim): Promise<Claim>;
  getClaims(): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | undefined>;
  updateClaim(id: string, updates: Partial<Pick<Claim, "status">>): Promise<Claim>;
}

export class DatabaseStorage implements IStorage {
  // Lead operations
  async getLeads(filters: any): Promise<Lead[]> {
    const result = await db.select().from(leads).orderBy(desc(leads.createdAt));
    return result;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(leadData: InsertLead & { id?: string; createdAt?: Date }): Promise<Lead> {
    const id = leadData.id ?? generateLeadId();
    const createdAt = leadData.createdAt ?? getEasternDate();
    const [lead] = await db
      .insert(leads)
      .values({ ...leadData, id, createdAt })
      .returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const [lead] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    return lead;
  }

  // Vehicle operations
  async getVehicleByLeadId(leadId: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.leadId, leadId));
    return vehicle;
  }

  async createVehicle(vehicleData: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(vehicleData).returning();
    return vehicle;
  }

  // Quote operations
  async getQuotesByLeadId(leadId: string): Promise<Quote[]> {
    const result = await db.select().from(quotes).where(eq(quotes.leadId, leadId)).orderBy(desc(quotes.createdAt));
    return result;
  }

  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(quoteData).returning();
    return quote;
  }

  // Note operations
  async getNotesByLeadId(leadId: string): Promise<Note[]> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.leadId, leadId))
      .orderBy(desc(notes.createdAt));
    return result;
  }

  async createNote(noteData: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values(noteData).returning();
    return note;
  }

  // Policy operations
  async createPolicy(policyData: InsertPolicy): Promise<Policy> {
    const [policy] = await db.insert(policies).values(policyData).returning();
    return policy;
  }

  async getPolicies(): Promise<Policy[]> {
    const result = await db.select().from(policies).orderBy(desc(policies.createdAt));
    return result;
  }

  // Claim operations
  async createClaim(claimData: InsertClaim): Promise<Claim> {
    const [claim] = await db.insert(claims).values(claimData).returning();
    return claim;
  }

  async getClaims(): Promise<Claim[]> {
    const result = await db.select().from(claims).orderBy(desc(claims.createdAt));
    return result;
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim;
  }

  async updateClaim(id: string, updates: Partial<Pick<Claim, "status">>): Promise<Claim> {
    const [claim] = await db
      .update(claims)
      .set(updates)
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }
}

export const storage = new DatabaseStorage();
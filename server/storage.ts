import {
  leads,
  vehicles,
  quotes,
  type Lead,
  type InsertLead,
  type Vehicle,
  type InsertVehicle,
  type Quote,
  type InsertQuote,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // Lead operations
  getLeads(filters: any): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  
  // Vehicle operations
  getVehicleByLeadId(leadId: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  
  // Quote operations
  getQuotesByLeadId(leadId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
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

  async createLead(leadData: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
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
}

export const storage = new DatabaseStorage();
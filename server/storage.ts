import {
  leads,
  vehicles,
  quotes,
  notes,
  policies,
  claims,
  policyNotes,
  policyFiles,
  users,
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
  type PolicyNote,
  type InsertPolicyNote,
  type PolicyFile,
  type InsertPolicyFile,
  type User,
  type InsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { hashPassword } from "./password";

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
  updateVehicle(leadId: string, updates: Partial<InsertVehicle>): Promise<Vehicle>;
  
  // Quote operations
  getQuotesByLeadId(leadId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;

  // Note operations
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  // Policy operations
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  getPolicies(): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null })[]>;
  getPolicy(id: string): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null; notes: PolicyNote[]; files: PolicyFile[] }) | undefined>;
  getPolicyByLeadId(leadId: string): Promise<Policy | undefined>;
  updatePolicy(leadId: string, updates: Partial<InsertPolicy>): Promise<Policy>;

  // Policy note operations
  getPolicyNotes(policyId: string): Promise<PolicyNote[]>;
  createPolicyNote(note: InsertPolicyNote): Promise<PolicyNote>;

  // Policy file operations
  getPolicyFiles(policyId: string): Promise<PolicyFile[]>;
  createPolicyFile(file: InsertPolicyFile): Promise<PolicyFile>;

  // Claim operations
  createClaim(claim: InsertClaim): Promise<Claim>;
  getClaims(): Promise<Claim[]>;
  getClaim(id: string): Promise<Claim | undefined>;
  updateClaim(id: string, updates: Partial<Omit<Claim, "id" | "createdAt">>): Promise<Claim>;

  // User operations
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<User | undefined>;
  countAdmins(): Promise<number>;
  ensureDefaultAdminUser(): Promise<void>;
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

  async updateVehicle(leadId: string, updates: Partial<InsertVehicle>): Promise<Vehicle> {
    const [vehicle] = await db
      .update(vehicles)
      .set(updates)
      .where(eq(vehicles.leadId, leadId))
      .returning();
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

  async getPolicies(): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null })[]> {
    const result = await db
      .select({
        policy: policies,
        lead: leads,
        vehicle: vehicles,
      })
      .from(policies)
      .leftJoin(leads, eq(policies.leadId, leads.id))
      .leftJoin(vehicles, eq(vehicles.leadId, leads.id))
      .orderBy(desc(policies.createdAt));

    return result.map((row: { policy: Policy; lead: Lead | null; vehicle: Vehicle | null }) => ({
      ...row.policy,
      lead: row.lead,
      vehicle: row.vehicle,
    }));
  }

  async getPolicy(id: string): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null; notes: PolicyNote[]; files: PolicyFile[] }) | undefined> {
    const [row] = await db
      .select({
        policy: policies,
        lead: leads,
        vehicle: vehicles,
      })
      .from(policies)
      .leftJoin(leads, eq(policies.leadId, leads.id))
      .leftJoin(vehicles, eq(vehicles.leadId, leads.id))
      .where(eq(policies.id, id));

    if (!row) return undefined;
    const notes = await this.getPolicyNotes(id);
    const files = await this.getPolicyFiles(id);
    return { ...row.policy, lead: row.lead, vehicle: row.vehicle, notes, files };
  }

  async getPolicyByLeadId(leadId: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.leadId, leadId));
    return policy;
  }

  async updatePolicy(leadId: string, updates: Partial<InsertPolicy>): Promise<Policy> {
    const existing = await this.getPolicyByLeadId(leadId);
    if (existing) {
      const [policy] = await db
        .update(policies)
        .set(updates)
        .where(eq(policies.leadId, leadId))
        .returning();
      return policy;
    }
    const [policy] = await db
      .insert(policies)
      .values({ ...updates, leadId })
      .returning();
    return policy;
  }

  // Policy note operations
  async getPolicyNotes(policyId: string): Promise<PolicyNote[]> {
    const result = await db
      .select()
      .from(policyNotes)
      .where(eq(policyNotes.policyId, policyId))
      .orderBy(desc(policyNotes.createdAt));
    return result;
  }

  async createPolicyNote(noteData: InsertPolicyNote): Promise<PolicyNote> {
    const [note] = await db.insert(policyNotes).values(noteData).returning();
    return note;
  }

  // Policy file operations
  async getPolicyFiles(policyId: string): Promise<PolicyFile[]> {
    const result = await db
      .select()
      .from(policyFiles)
      .where(eq(policyFiles.policyId, policyId))
      .orderBy(desc(policyFiles.createdAt));
    return result;
  }

  async createPolicyFile(fileData: InsertPolicyFile): Promise<PolicyFile> {
    const [file] = await db.insert(policyFiles).values(fileData).returning();
    return file;
  }

  // Claim operations
  async createClaim(claimData: InsertClaim): Promise<Claim> {
    const [claim] = await db
      .insert(claims)
      .values({ ...claimData, createdAt: getEasternDate(), updatedAt: getEasternDate() })
      .returning();
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

  async updateClaim(id: string, updates: Partial<Omit<Claim, "id" | "createdAt">>): Promise<Claim> {
    const [claim] = await db
      .update(claims)
      .set({ ...updates, updatedAt: getEasternDate() })
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }

  // User operations
  async listUsers(): Promise<User[]> {
    const result = await db.select().from(users).orderBy(desc(users.createdAt));
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async deleteUser(id: string): Promise<User | undefined> {
    const [user] = await db.delete(users).where(eq(users.id, id)).returning();
    return user;
  }

  async countAdmins(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, 'admin'));
    return Number(result?.count ?? 0);
  }

  async ensureDefaultAdminUser(): Promise<void> {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME ?? 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'BHauto123';
    const existing = await this.getUserByUsername(defaultUsername);
    if (existing) return;

    const passwordHash = hashPassword(defaultPassword);
    await this.createUser({ username: defaultUsername, passwordHash, role: 'admin' });
  }
}

export const storage = new DatabaseStorage();
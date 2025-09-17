import {
  leads,
  vehicles,
  quotes,
  notes,
  policies,
  claims,
  policyNotes,
  policyFiles,
  emailTemplates,
  siteSettings,
  users,
  customerAccounts,
  customerPolicies,
  customerPaymentProfiles,
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
  type EmailTemplate,
  type InsertEmailTemplate,
  type SiteSetting,
  type InsertSiteSetting,
  type User,
  type InsertUser,
  type CustomerAccount,
  type InsertCustomerAccount,
  type CustomerPolicy,
  type InsertCustomerPolicy,
  type CustomerPaymentProfile,
  type InsertCustomerPaymentProfile,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import { hashPassword } from "./password";

const generateLeadId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
const getEasternDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

const DEFAULT_EMAIL_TEMPLATES: { name: string; subject: string; bodyHtml: string }[] = [
  {
    name: 'Gas Voucher Added',
    subject: 'Fuel Voucher Added to Your BH Auto Protect Coverage',
    bodyHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fuel Voucher Added</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px;max-width:94%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#111827,#2563eb);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.7;">BHAUTOPROTECT</div>
              <div style="font-size:24px;font-weight:700;margin-top:10px;">Fuel Voucher Added to Your Coverage</div>
              <div style="margin-top:12px;font-size:14px;opacity:0.85;">We're celebrating you with extra miles on us.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi {{Customer Name}},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                We've just added a complimentary fuel voucher to your BH Auto Protect policy as a thank-you for trusting us with your vehicle.
                Use it the next time you fill up—any reputable gas station nationwide qualifies.
              </p>
              <div style="background-color:#f1f5f9;border-radius:14px;border:1px solid #e2e8f0;padding:22px 24px;margin-bottom:24px;">
                <div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;font-weight:600;margin-bottom:12px;">How to redeem</div>
                <ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:#1f2937;">
                  <li style="margin-bottom:10px;">Fill up at your preferred gas station and keep the itemized receipt.</li>
                  <li style="margin-bottom:10px;">Email a photo or scan of the receipt to <a href="mailto:claims@bhautoprotect.com" style="color:#2563eb;text-decoration:none;font-weight:600;">claims@bhautoprotect.com</a> within 30 days.</li>
                  <li>We'll mail a reimbursement check to the mailing address we have on file within 7–10 business days.</li>
                </ol>
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                Need to update your mailing details or have a question before you head to the pump?
                Call us at <a href="tel:18005550123" style="color:#2563eb;text-decoration:none;font-weight:600;">1-800-555-0123</a> or reply to this email and our concierge team will take care of it right away.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                Thanks again for being part of the BH Auto Protect family. Enjoy the extra savings on your next fill-up!
              </p>
              <p style="margin:0;font-size:15px;line-height:1.7;">Warm regards,<br /><strong>The BH Auto Protect Team</strong><br /><a href="mailto:support@bhautoprotect.com" style="color:#2563eb;text-decoration:none;">support@bhautoprotect.com</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:22px 32px;color:#6b7280;font-size:12px;line-height:1.6;">
              Please keep your original receipt until reimbursement is received. This voucher is limited to one redemption per policy unless otherwise noted.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];

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

  // Email template operations
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<EmailTemplate | undefined>;

  // Site settings operations
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  upsertSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting>;

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
  ensureDefaultEmailTemplates(): Promise<void>;

  // Customer account operations
  getCustomerAccount(id: string): Promise<CustomerAccount | undefined>;
  getCustomerAccountByEmail(email: string): Promise<CustomerAccount | undefined>;
  createCustomerAccount(account: InsertCustomerAccount): Promise<CustomerAccount>;
  updateCustomerAccount(
    id: string,
    updates: Partial<InsertCustomerAccount> & { lastLoginAt?: Date },
  ): Promise<CustomerAccount>;
  linkCustomerToPolicy(customerId: string, policyId: string): Promise<CustomerPolicy>;
  syncCustomerPoliciesByEmail(customerId: string, email: string): Promise<void>;
  getCustomerPolicies(
    customerId: string,
  ): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null })[]>;
  getCustomerClaims(customerId: string): Promise<Claim[]>;
  getCustomerPaymentProfiles(customerId: string): Promise<CustomerPaymentProfile[]>;
  getCustomerPaymentProfile(
    customerId: string,
    policyId: string,
  ): Promise<CustomerPaymentProfile | undefined>;
  upsertCustomerPaymentProfile(
    profile: InsertCustomerPaymentProfile & { customerId: string },
  ): Promise<CustomerPaymentProfile>;
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

  // Email template operations
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    const result = await db
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.createdAt));
    return result;
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id));
    return template;
  }

  async createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate> {
    const [template] = await db.insert(emailTemplates).values(templateData).returning();
    return template;
  }

  async updateEmailTemplate(
    id: string,
    updates: Partial<InsertEmailTemplate>,
  ): Promise<EmailTemplate> {
    const [template] = await db
      .update(emailTemplates)
      .set({ ...updates, updatedAt: getEasternDate() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
  }

  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return setting;
  }

  async upsertSiteSetting(setting: InsertSiteSetting): Promise<SiteSetting> {
    const timestamp = getEasternDate();
    const [result] = await db
      .insert(siteSettings)
      .values({ ...setting, updatedAt: timestamp })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: setting.value, updatedAt: timestamp },
      })
      .returning();
    return result;
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
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'GPrs1234?';
    const existing = await this.getUserByUsername(defaultUsername);
    if (existing) return;

    const passwordHash = hashPassword(defaultPassword);
    await this.createUser({ username: defaultUsername, passwordHash, role: 'admin' });
  }

  async ensureDefaultEmailTemplates(): Promise<void> {
    for (const template of DEFAULT_EMAIL_TEMPLATES) {
      const [existing] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.name, template.name));
      if (existing) {
        continue;
      }

      const timestamp = getEasternDate();
      await db.insert(emailTemplates).values({
        ...template,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  // Customer account operations
  async getCustomerAccount(id: string): Promise<CustomerAccount | undefined> {
    const [account] = await db
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.id, id));
    return account;
  }

  async getCustomerAccountByEmail(email: string): Promise<CustomerAccount | undefined> {
    const normalized = email.trim().toLowerCase();
    const [account] = await db
      .select()
      .from(customerAccounts)
      .where(sql`LOWER(${customerAccounts.email}) = ${normalized}`);
    return account;
  }

  async createCustomerAccount(accountData: InsertCustomerAccount): Promise<CustomerAccount> {
    const timestamp = getEasternDate();
    const normalizedEmail = accountData.email.trim().toLowerCase();
    const [account] = await db
      .insert(customerAccounts)
      .values({
        ...accountData,
        email: normalizedEmail,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();
    return account;
  }

  async updateCustomerAccount(
    id: string,
    updates: Partial<InsertCustomerAccount> & { lastLoginAt?: Date },
  ): Promise<CustomerAccount> {
    const timestamp = getEasternDate();
    const payload: Partial<typeof customerAccounts.$inferInsert> = {
      updatedAt: timestamp,
    };

    if (typeof updates.email === 'string') {
      payload.email = updates.email.trim().toLowerCase();
    }
    if (typeof updates.displayName === 'string' || updates.displayName === null) {
      payload.displayName = updates.displayName ?? null;
    }
    if (typeof updates.passwordHash === 'string') {
      payload.passwordHash = updates.passwordHash;
    }
    if (updates.lastLoginAt instanceof Date) {
      payload.lastLoginAt = updates.lastLoginAt;
    }

    const [account] = await db
      .update(customerAccounts)
      .set(payload)
      .where(eq(customerAccounts.id, id))
      .returning();
    return account;
  }

  async linkCustomerToPolicy(customerId: string, policyId: string): Promise<CustomerPolicy> {
    const [link] = await db
      .insert(customerPolicies)
      .values({ customerId, policyId })
      .onConflictDoNothing({
        target: [customerPolicies.customerId, customerPolicies.policyId],
      })
      .returning();

    if (link) {
      return link;
    }

    const [existing] = await db
      .select()
      .from(customerPolicies)
      .where(
        and(
          eq(customerPolicies.customerId, customerId),
          eq(customerPolicies.policyId, policyId),
        ),
      );
    return existing as CustomerPolicy;
  }

  async syncCustomerPoliciesByEmail(customerId: string, email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const policyRows = await db
      .select({ policyId: policies.id })
      .from(policies)
      .leftJoin(leads, eq(policies.leadId, leads.id))
      .where(sql`LOWER(${leads.email}) = ${normalized}`);

    const values = policyRows
      .map((row: { policyId: string | null }) => row.policyId)
      .filter((policyId: string | null): policyId is string => typeof policyId === 'string');

    if (values.length === 0) {
      return;
    }

    await db
      .insert(customerPolicies)
      .values(values.map((policyId: string) => ({ customerId, policyId })))
      .onConflictDoNothing({
        target: [customerPolicies.customerId, customerPolicies.policyId],
      });
  }

  async getCustomerPolicies(
    customerId: string,
  ): Promise<(Policy & { lead: Lead | null; vehicle: Vehicle | null })[]> {
    const rows = await db
      .select({
        policy: policies,
        lead: leads,
        vehicle: vehicles,
      })
      .from(customerPolicies)
      .innerJoin(policies, eq(customerPolicies.policyId, policies.id))
      .leftJoin(leads, eq(policies.leadId, leads.id))
      .leftJoin(vehicles, eq(vehicles.leadId, leads.id))
      .where(eq(customerPolicies.customerId, customerId))
      .orderBy(desc(policies.createdAt));

    return rows.map((row: { policy: Policy; lead: Lead | null; vehicle: Vehicle | null }) => ({
      ...row.policy,
      lead: row.lead,
      vehicle: row.vehicle,
    }));
  }

  async getCustomerClaims(customerId: string): Promise<Claim[]> {
    const rows = await db
      .select({ claim: claims })
      .from(claims)
      .innerJoin(customerPolicies, eq(claims.policyId, customerPolicies.policyId))
      .where(eq(customerPolicies.customerId, customerId))
      .orderBy(desc(claims.createdAt));

    return rows.map((row: { claim: Claim }) => row.claim);
  }

  async getCustomerPaymentProfiles(customerId: string): Promise<CustomerPaymentProfile[]> {
    const rows = await db
      .select()
      .from(customerPaymentProfiles)
      .where(eq(customerPaymentProfiles.customerId, customerId))
      .orderBy(desc(customerPaymentProfiles.updatedAt));
    return rows;
  }

  async getCustomerPaymentProfile(
    customerId: string,
    policyId: string,
  ): Promise<CustomerPaymentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(customerPaymentProfiles)
      .where(
        and(
          eq(customerPaymentProfiles.customerId, customerId),
          eq(customerPaymentProfiles.policyId, policyId),
        ),
      );
    return profile;
  }

  async upsertCustomerPaymentProfile(
    profile: InsertCustomerPaymentProfile & { customerId: string },
  ): Promise<CustomerPaymentProfile> {
    const timestamp = getEasternDate();
    const payload = {
      customerId: profile.customerId,
      policyId: profile.policyId,
      paymentMethod: profile.paymentMethod ?? null,
      accountName: profile.accountName ?? null,
      accountIdentifier: profile.accountIdentifier ?? null,
      autopayEnabled: profile.autopayEnabled ?? false,
      notes: profile.notes ?? null,
      updatedAt: timestamp,
    };

    const [record] = await db
      .insert(customerPaymentProfiles)
      .values({ ...payload, createdAt: timestamp })
      .onConflictDoUpdate({
        target: [customerPaymentProfiles.customerId, customerPaymentProfiles.policyId],
        set: payload,
      })
      .returning();

    return record;
  }
}

export const storage = new DatabaseStorage();
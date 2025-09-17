import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  decimal,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const planTypeEnum = pgEnum('plan_type', ['basic', 'bronze', 'silver', 'gold']);
export const quoteStatusEnum = pgEnum('quote_status', ['draft', 'sent', 'accepted', 'rejected']);
export const claimStatusEnum = pgEnum('claim_status', [
  'new',
  'denied',
  'awaiting_customer_action',
  'awaiting_inspection',
  'claim_covered_open',
  'claim_covered_closed',
]);
export const userRoleEnum = pgEnum('user_role', ['admin', 'staff']);

const shortId = sql`substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)`;

export const users = pgTable('users', {
  id: varchar('id').primaryKey().default(shortId),
  username: varchar('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('staff'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(shortId),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  zip: varchar("zip"),
  state: varchar("state"),
  consentTCPA: boolean("consent_tcpa").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentIP: varchar("consent_ip"),
  consentUserAgent: text("consent_user_agent"),
  source: varchar("source").default('web'),
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(shortId),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  year: integer("year").notNull(),
  make: varchar("make").notNull(),
  model: varchar("model").notNull(),
  trim: varchar("trim"),
  vin: varchar("vin"),
  odometer: integer("odometer").notNull(),
  usage: varchar("usage").default('personal'),
  ev: boolean("ev").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(shortId),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  plan: planTypeEnum("plan").notNull(),
  deductible: integer("deductible").notNull(),
  termMonths: integer("term_months").default(36),
  priceMonthly: integer("price_monthly").notNull(),
  priceTotal: integer("price_total").notNull(),
  fees: integer("fees").default(0),
  taxes: integer("taxes").default(0),
  status: quoteStatusEnum("status").default('draft'),
  breakdown: jsonb("breakdown"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(shortId),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(shortId),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'set null' }).notNull(),
  package: varchar("package"),
  expirationMiles: integer("expiration_miles"),
  expirationDate: timestamp("expiration_date"),
  deductible: integer("deductible"),
  totalPremium: integer("total_premium"),
  downPayment: integer("down_payment"),
  policyStartDate: timestamp("policy_start_date"),
  monthlyPayment: integer("monthly_payment"),
  totalPayments: integer("total_payments"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(shortId),
  policyId: varchar("policy_id").references(() => policies.id, { onDelete: 'cascade' }),
  status: claimStatusEnum("status").default('new'),
  nextEstimate: decimal("next_estimate"),
  nextPayment: decimal("next_payment"),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  year: integer("year"),
  make: varchar("make"),
  model: varchar("model"),
  trim: varchar("trim"),
  vin: varchar("vin"),
  serial: varchar("serial"),
  odometer: integer("odometer"),
  currentOdometer: integer("current_odometer"),
  claimReason: text("claim_reason"),
  agentClaimNumber: varchar("agent_claim_number"),
  message: text("message").notNull(),
  previousNotes: text("previous_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const policyNotes = pgTable("policy_notes", {
  id: varchar("id").primaryKey().default(shortId),
  policyId: varchar("policy_id").references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const policyFiles = pgTable("policy_files", {
  id: varchar("id").primaryKey().default(shortId),
  policyId: varchar("policy_id").references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerAccounts = pgTable('customer_accounts', {
  id: varchar('id').primaryKey().default(shortId),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 120 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: uniqueIndex('customer_accounts_email_idx').on(table.email),
}));

export const customerPolicies = pgTable('customer_policies', {
  id: varchar('id').primaryKey().default(shortId),
  customerId: varchar('customer_id').references(() => customerAccounts.id, { onDelete: 'cascade' }).notNull(),
  policyId: varchar('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  customerPolicyUniqueIdx: uniqueIndex('customer_policies_unique_idx').on(table.customerId, table.policyId),
}));

export const customerPaymentProfiles = pgTable('customer_payment_profiles', {
  id: varchar('id').primaryKey().default(shortId),
  customerId: varchar('customer_id').references(() => customerAccounts.id, { onDelete: 'cascade' }).notNull(),
  policyId: varchar('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  paymentMethod: varchar('payment_method', { length: 120 }),
  accountName: varchar('account_name', { length: 120 }),
  accountIdentifier: varchar('account_identifier', { length: 120 }),
  autopayEnabled: boolean('autopay_enabled').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  customerPaymentProfileUniqueIdx: uniqueIndex('customer_payment_profiles_unique_idx').on(table.customerId, table.policyId),
}));

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(shortId),
  name: varchar("name", { length: 120 }).notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const leadsRelations = relations(leads, ({ one, many }) => ({
  vehicle: one(vehicles),
  quotes: many(quotes),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  lead: one(leads, {
    fields: [vehicles.leadId],
    references: [leads.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  lead: one(leads, {
    fields: [quotes.leadId],
    references: [leads.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  lead: one(leads, {
    fields: [notes.leadId],
    references: [leads.id],
  }),
}));

export const policiesRelations = relations(policies, ({ one }) => ({
  lead: one(leads, {
    fields: [policies.leadId],
    references: [leads.id],
  }),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  policy: one(policies, {
    fields: [claims.policyId],
    references: [policies.id],
  }),
}));

export const policyNotesRelations = relations(policyNotes, ({ one }) => ({
  policy: one(policies, {
    fields: [policyNotes.policyId],
    references: [policies.id],
  }),
}));

export const policyFilesRelations = relations(policyFiles, ({ one }) => ({
  policy: one(policies, {
    fields: [policyFiles.policyId],
    references: [policies.id],
  }),
}));

// Schemas for validation
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicyNoteSchema = createInsertSchema(policyNotes).omit({
  id: true,
  createdAt: true,
});

export const insertPolicyFileSchema = createInsertSchema(policyFiles).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerAccountSchema = createInsertSchema(customerAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertCustomerPolicySchema = createInsertSchema(customerPolicies).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerPaymentProfileSchema = createInsertSchema(customerPaymentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  updatedAt: true,
});

// Types
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Claim = typeof claims.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type PolicyNote = typeof policyNotes.$inferSelect;
export type InsertPolicyNote = z.infer<typeof insertPolicyNoteSchema>;
export type PolicyFile = typeof policyFiles.$inferSelect;
export type InsertPolicyFile = z.infer<typeof insertPolicyFileSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type InsertCustomerAccount = z.infer<typeof insertCustomerAccountSchema>;
export type CustomerPolicy = typeof customerPolicies.$inferSelect;
export type InsertCustomerPolicy = z.infer<typeof insertCustomerPolicySchema>;
export type CustomerPaymentProfile = typeof customerPaymentProfiles.$inferSelect;
export type InsertCustomerPaymentProfile = z.infer<typeof insertCustomerPaymentProfileSchema>;

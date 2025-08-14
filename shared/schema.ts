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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const planTypeEnum = pgEnum('plan_type', ['powertrain', 'gold', 'platinum']);
export const quoteStatusEnum = pgEnum('quote_status', ['draft', 'sent', 'accepted', 'rejected']);
export const claimStatusEnum = pgEnum('claim_status', [
  'new',
  'denied',
  'awaiting_customer_action',
  'awaiting_inspection',
  'claim_covered_open',
  'claim_covered_closed',
]);

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id").references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  status: claimStatusEnum("status").default('new'),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  createdAt: timestamp("created_at").defaultNow(),
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

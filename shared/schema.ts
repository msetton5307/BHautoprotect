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
export const planTypeEnum = pgEnum('plan_type', ['basic', 'silver', 'gold']);
export const leadStatusEnum = pgEnum('lead_status', [
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
]);
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
export const documentRequestTypeEnum = pgEnum('document_request_type', [
  'vin_photo',
  'odometer_photo',
  'diagnosis_report',
  'repair_invoice',
  'other',
]);
export const documentRequestStatusEnum = pgEnum('document_request_status', [
  'pending',
  'submitted',
  'completed',
  'cancelled',
]);

export const policyChargeStatusEnum = pgEnum('policy_charge_status', [
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
]);

export const contractStatusEnum = pgEnum('contract_status', ['draft', 'sent', 'signed', 'void']);

const shortId = sql`substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)`;
const leadIdDefault = sql<string>`lpad(nextval('lead_id_seq')::text, 8, '0')`;

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
  id: varchar("id", { length: 8 }).primaryKey().default(leadIdDefault),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  zip: varchar("zip"),
  state: varchar("state"),
  status: leadStatusEnum('status').notNull().default('new'),
  salespersonEmail: varchar('salesperson_email'),
  cardNumber: text('card_number'),
  cardExpiryMonth: varchar('card_expiry_month', { length: 2 }),
  cardExpiryYear: varchar('card_expiry_year', { length: 4 }),
  cardCvv: varchar('card_cvv', { length: 4 }),
  shippingAddress: text('shipping_address'),
  shippingCity: varchar('shipping_city', { length: 120 }),
  shippingState: varchar('shipping_state', { length: 120 }),
  shippingZip: varchar('shipping_zip', { length: 32 }),
  billingAddress: text('billing_address'),
  billingCity: varchar('billing_city', { length: 120 }),
  billingState: varchar('billing_state', { length: 120 }),
  billingZip: varchar('billing_zip', { length: 32 }),
  shippingSameAsBilling: boolean('shipping_same_as_billing').default(false),
  consentTCPA: boolean("consent_tcpa").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentIP: varchar("consent_ip"),
  consentUserAgent: text("consent_user_agent"),
  source: varchar("source").default('web'),
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  rawPayload: jsonb("raw_payload"),
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
  id: varchar("id", { length: 8 }).primaryKey(),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
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

export const leadContracts = pgTable('lead_contracts', {
  id: varchar('id').primaryKey().default(shortId),
  leadId: varchar('lead_id', { length: 8 })
    .references(() => leads.id, { onDelete: 'cascade' })
    .notNull(),
  quoteId: varchar('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  uploadedBy: varchar('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  fileData: text('file_data').notNull(),
  status: contractStatusEnum('status').notNull().default('draft'),
  signatureName: text('signature_name'),
  signatureEmail: text('signature_email'),
  signatureIp: varchar('signature_ip', { length: 64 }),
  signatureUserAgent: text('signature_user_agent'),
  signatureConsent: boolean('signature_consent').default(false),
  signedAt: timestamp('signed_at'),
  paymentMethod: text('payment_method'),
  paymentLastFour: varchar('payment_last_four', { length: 4 }),
  paymentExpMonth: integer('payment_exp_month'),
  paymentExpYear: integer('payment_exp_year'),
  paymentNotes: text('payment_notes'),
  paymentCardNumber: text('payment_card_number'),
  paymentCvv: varchar('payment_cvv', { length: 4 }),
  billingAddressLine1: text('billing_address_line1'),
  billingAddressLine2: text('billing_address_line2'),
  billingCity: varchar('billing_city'),
  billingState: varchar('billing_state'),
  billingPostalCode: varchar('billing_postal_code'),
  billingCountry: varchar('billing_country'),
  shippingAddressLine1: text('shipping_address_line1'),
  shippingAddressLine2: text('shipping_address_line2'),
  shippingCity: varchar('shipping_city'),
  shippingState: varchar('shipping_state'),
  shippingPostalCode: varchar('shipping_postal_code'),
  shippingCountry: varchar('shipping_country'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  cardBrand: varchar('card_brand', { length: 40 }),
  cardLastFour: varchar('card_last_four', { length: 4 }),
  cardExpiryMonth: integer('card_expiry_month'),
  cardExpiryYear: integer('card_expiry_year'),
  billingZip: varchar('billing_zip', { length: 16 }),
  autopayEnabled: boolean('autopay_enabled').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  customerPaymentProfileUniqueIdx: uniqueIndex('customer_payment_profiles_unique_idx').on(table.customerId, table.policyId),
}));

export const policyCharges = pgTable('policy_charges', {
  id: varchar('id').primaryKey().default(shortId),
  policyId: varchar('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  customerId: varchar('customer_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: policyChargeStatusEnum('status').notNull().default('pending'),
  chargedAt: timestamp('charged_at').defaultNow(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customerDocumentRequests = pgTable('customer_document_requests', {
  id: varchar('id').primaryKey().default(shortId),
  policyId: varchar('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  customerId: varchar('customer_id').references(() => customerAccounts.id, { onDelete: 'cascade' }).notNull(),
  requestedBy: varchar('requested_by').references(() => users.id, { onDelete: 'set null' }),
  type: documentRequestTypeEnum('type').notNull().default('other'),
  title: varchar('title', { length: 160 }).notNull(),
  instructions: text('instructions'),
  status: documentRequestStatusEnum('status').notNull().default('pending'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customerDocumentUploads = pgTable('customer_document_uploads', {
  id: varchar('id').primaryKey().default(shortId),
  requestId: varchar('request_id').references(() => customerDocumentRequests.id, { onDelete: 'cascade' }).notNull(),
  customerId: varchar('customer_id').references(() => customerAccounts.id, { onDelete: 'cascade' }).notNull(),
  policyId: varchar('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  fileData: text('file_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

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
  rawPayload: true,
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

export const insertPolicyChargeSchema = createInsertSchema(policyCharges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerDocumentRequestSchema = createInsertSchema(customerDocumentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerDocumentUploadSchema = createInsertSchema(customerDocumentUploads).omit({
  id: true,
  createdAt: true,
});

export const insertLeadContractSchema = createInsertSchema(leadContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  signedAt: true,
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
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
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
export type PolicyCharge = typeof policyCharges.$inferSelect;
export type InsertPolicyCharge = z.infer<typeof insertPolicyChargeSchema>;
export type CustomerDocumentRequest = typeof customerDocumentRequests.$inferSelect;
export type InsertCustomerDocumentRequest = z.infer<typeof insertCustomerDocumentRequestSchema>;
export type CustomerDocumentUpload = typeof customerDocumentUploads.$inferSelect;
export type InsertCustomerDocumentUpload = z.infer<typeof insertCustomerDocumentUploadSchema>;
export type LeadContract = typeof leadContracts.$inferSelect;
export type InsertLeadContract = z.infer<typeof insertLeadContractSchema>;

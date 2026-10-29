/**
 * Core platform tables: staff users, roles, sessions, settings, audit trail,
 * API keys, outgoing webhooks, media library and security.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow();

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  /** built-in roles can't be deleted; "owner" can't be edited either */
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    status: text("status", { enum: ["active", "invited", "disabled"] }).notNull().default("active"),
    /** AES-GCM encrypted TOTP secret */
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    /** sha256 hashes of unused recovery codes */
    recoveryCodes: jsonb("recovery_codes").$type<string[]>().notNull().default([]),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    passwordChangedAt: ts("password_changed_at"),
    avatarUrl: text("avatar_url"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * Additional authenticator devices of a user (e.g. a co-worker sharing the account).
 * The first device stays in users.totp_secret; any device's code is accepted at sign-in.
 */
export const totpDevices = pgTable(
  "totp_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** encrypted TOTP secret */
    secret: text("secret").notNull(),
    createdAt: created(),
    lastUsedAt: ts("last_used_at"),
  },
  (t) => [index("totp_devices_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the cookie token */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "password" = waiting for the 2FA code, "enroll" = must set up 2FA, "active" = signed in */
    stage: text("stage", { enum: ["password", "enroll", "active"] }).notNull(),
    /** encrypted TOTP secret offered during enrollment */
    pendingSecret: text("pending_secret"),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: created(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** one-time tokens: invitations, password resets, freshly shown recovery codes */
export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(), // sha256 of the token
    type: text("type", { enum: ["invite", "password_reset", "email_change"] }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by"),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: created(),
  },
  (t) => [index("tokens_user_idx").on(t.userId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updated(),
  updatedBy: uuid("updated_by"),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    userEmail: text("user_email").notNull().default(""),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip").notNull().default(""),
    createdAt: created(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entityType, t.entityId)],
);

export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    email: text("email").notNull(),
    success: boolean("success").notNull(),
    reason: text("reason").notNull().default(""),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: created(),
  },
  (t) => [index("login_events_created_idx").on(t.createdAt)],
);

/** sliding counters for rate limits and lockouts (login, API, forms) */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

export const ipBlocks = pgTable("ip_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** single IP or CIDR (v4) */
  cidr: text("cidr").notNull(),
  reason: text("reason").notNull().default(""),
  expiresAt: ts("expires_at"),
  createdBy: uuid("created_by"),
  createdAt: created(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** "public" keys may be shipped to browsers (storefront read + cart + checkout); "secret" keys are server-to-server */
  kind: text("kind", { enum: ["public", "secret"] }).notNull(),
  /** first characters, shown in the UI to identify the key */
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull().default([]),
  lastUsedAt: ts("last_used_at"),
  createdBy: uuid("created_by"),
  createdAt: created(),
  revokedAt: ts("revoked_at"),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  /** encrypted signing secret */
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    attempt: integer("attempt").notNull().default(1),
    status: text("status", { enum: ["pending", "success", "failed"] }).notNull().default("pending"),
    responseCode: integer("response_code"),
    responseMs: integer("response_ms"),
    error: text("error"),
    nextRetryAt: ts("next_retry_at"),
    createdAt: created(),
  },
  (t) => [index("webhook_deliveries_hook_idx").on(t.webhookId, t.createdAt)],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** path below the uploads directory, e.g. 2026/10/abc-name.webp */
    path: text("path").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    folder: text("folder").notNull().default(""),
    uploadedBy: uuid("uploaded_by"),
    createdAt: created(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

/** in-app notifications for staff (new order, low stock, new inquiry …) */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = everyone with the permission below */
    userId: uuid("user_id"),
    permission: text("permission"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readBy: jsonb("read_by").$type<string[]>().notNull().default([]),
    createdAt: created(),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt)],
);

/** outgoing e-mails (for the log in the dashboard and retries) */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    status: text("status", { enum: ["sent", "failed", "skipped"] }).notNull(),
    error: text("error"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    createdAt: created(),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

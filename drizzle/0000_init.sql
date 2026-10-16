CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"summary" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"related_type" text,
	"related_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cidr" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"success" boolean NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"folder" text DEFAULT '' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"permission" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"pending_secret" text,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"response_ms" integer,
	"error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"coupon_code" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_subtotal" integer,
	"usage_limit" integer,
	"usage_limit_per_customer" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"address" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"password_hash" text,
	"accepts_marketing" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_address" jsonb,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"last_order_at" timestamp with time zone,
	"disabled" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"internal" boolean DEFAULT true NOT NULL,
	"user_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"name" text NOT NULL,
	"variant_title" text DEFAULT '' NOT NULL,
	"sku" text,
	"image_path" text,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	"refunded_quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"access_token" text NOT NULL,
	"customer_id" uuid,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"prices_include_tax" boolean DEFAULT true NOT NULL,
	"subtotal" integer NOT NULL,
	"discount_total" integer DEFAULT 0 NOT NULL,
	"shipping_total" integer DEFAULT 0 NOT NULL,
	"tax_total" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"refunded_total" integer DEFAULT 0 NOT NULL,
	"coupon_code" text,
	"shipping_method_id" uuid,
	"shipping_method_name" text DEFAULT '' NOT NULL,
	"billing_address" jsonb NOT NULL,
	"shipping_address" jsonb,
	"customer_note" text DEFAULT '' NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"payment_reference" text,
	"tracking_number" text,
	"tracking_url" text,
	"source" text DEFAULT 'storefront' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"kind" text DEFAULT 'charge' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"option_values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sku" text,
	"barcode" text,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"cost_price" integer,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"allow_backorder" boolean DEFAULT false NOT NULL,
	"weight_grams" integer,
	"image_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"type" text DEFAULT 'physical' NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tax_class_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"price_min" integer DEFAULT 0 NOT NULL,
	"price_max" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"restock" boolean DEFAULT true NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_ref" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'flat' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"free_above" integer,
	"weight_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_subtotal" integer,
	"delivery_days_min" integer,
	"delivery_days_max" integer,
	"tax_class_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reason" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rate_bp" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"form" text DEFAULT 'kontakt' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"assigned_to" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_id" uuid,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_entries" (
	"path" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"og_image" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"canonical" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tax_class_id_tax_classes_id_fk" FOREIGN KEY ("tax_class_id") REFERENCES "public"."tax_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_tax_class_id_tax_classes_id_fk" FOREIGN KEY ("tax_class_id") REFERENCES "public"."tax_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_events_created_idx" ON "login_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tokens_user_idx" ON "tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_hook_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_unique" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_email_idx" ON "orders" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_ref_idx" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "stock_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_ref_idx" ON "inquiries" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "inquiries_created_idx" ON "inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status","published_at");
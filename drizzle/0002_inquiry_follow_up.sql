ALTER TABLE "inquiries" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "follow_up_notified" boolean DEFAULT false NOT NULL;
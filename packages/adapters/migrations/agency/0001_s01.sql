REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE TABLE "audit_event" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"resource_version" bigint NOT NULL,
	"correlation" uuid NOT NULL,
	CONSTRAINT "audit_version" CHECK ("audit_event"."resource_version">0)
);
--> statement-breakpoint
CREATE TABLE "agency_configuration" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"modules_enabled" boolean DEFAULT false NOT NULL,
	"mail_connected" boolean DEFAULT false NOT NULL,
	CONSTRAINT "configuration_singleton" CHECK ("agency_configuration"."singleton"=true),
	CONSTRAINT "s01_closed" CHECK (NOT "agency_configuration"."automation_enabled" AND NOT "agency_configuration"."modules_enabled" AND NOT "agency_configuration"."mail_connected")
);
--> statement-breakpoint
CREATE TABLE "agency_metadata" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"agency_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"migration_checksum" text NOT NULL,
	CONSTRAINT "agency_metadata_agency_id_unique" UNIQUE("agency_id"),
	CONSTRAINT "metadata_singleton" CHECK ("agency_metadata"."singleton"=true),
	CONSTRAINT "metadata_schema" CHECK ("agency_metadata"."schema_version"=1 AND "agency_metadata"."migration_checksum" ~ '^[a-f0-9]{64}$')
);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;

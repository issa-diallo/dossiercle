CREATE SCHEMA control;
CREATE SCHEMA identity;
REVOKE ALL ON SCHEMA control, identity FROM PUBLIC;
CREATE TABLE "control"."agency" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invitation_root_id" uuid NOT NULL,
	"name" text NOT NULL,
	"canonical_name_hash" text NOT NULL,
	"state" text DEFAULT 'PROVISIONING' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"ready_schema_version" integer,
	CONSTRAINT "agency_creation_root_unique" UNIQUE("invitation_root_id"),
	CONSTRAINT "agency_state" CHECK ("control"."agency"."state" IN ('PROVISIONING','READY','ACTIVE','FAILED')),
	CONSTRAINT "agency_ready" CHECK ("control"."agency"."state" NOT IN ('READY','ACTIVE') OR ("control"."agency"."ready_schema_version" IS NOT NULL AND "control"."agency"."ready_schema_version"=1)),
	CONSTRAINT "agency_activation" CHECK (("control"."agency"."state"='ACTIVE') = ("control"."agency"."activated_at" IS NOT NULL)),
	CONSTRAINT "agency_version" CHECK ("control"."agency"."version">0),
	CONSTRAINT "agency_name" CHECK (length("control"."agency"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "control"."audit_event" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"agency_id" uuid,
	"actor_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"resource_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"correlation" uuid NOT NULL,
	"resource_version" bigint NOT NULL,
	CONSTRAINT "audit_version" CHECK ("control"."audit_event"."schema_version"=1 AND "control"."audit_event"."resource_version">0)
);
--> statement-breakpoint
CREATE TABLE "identity"."account_authority" (
	"subject_id" uuid PRIMARY KEY NOT NULL,
	"identity_epoch" bigint DEFAULT 1 NOT NULL,
	"confirmed_epoch" bigint,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"journal_sequence" bigint DEFAULT 0 NOT NULL,
	"journal_hash" text,
	"enrollment_status" text DEFAULT 'PENDING' NOT NULL,
	"recovery_ready" boolean DEFAULT false NOT NULL,
	CONSTRAINT "authority_status" CHECK ("identity"."account_authority"."status" IN ('PENDING','CONFIRMED','DENIED')),
	CONSTRAINT "enrollment_status" CHECK ("enrollment_status" IN ('PENDING','VERIFIED','DENIED')),
 CONSTRAINT "journal_hash" CHECK ("journal_hash" IS NULL OR "journal_hash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "authority_epoch" CHECK ("identity"."account_authority"."identity_epoch">0 AND "identity"."account_authority"."journal_sequence">=0),
	CONSTRAINT "authority_confirmed" CHECK ("identity"."account_authority"."status"<>'CONFIRMED' OR ("identity"."account_authority"."confirmed_epoch" IS NOT NULL AND "identity"."account_authority"."confirmed_epoch"="identity"."account_authority"."identity_epoch" AND "identity"."account_authority"."enrollment_status"='VERIFIED' AND "identity"."account_authority"."recovery_ready" AND "identity"."account_authority"."journal_sequence">0 AND "identity"."account_authority"."journal_hash" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "control"."idempotency_record" (
	"actor_id" uuid NOT NULL,
	"operation_type" text NOT NULL,
	"key" uuid NOT NULL,
	"canonical_body_hash" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	CONSTRAINT "idempotency_record_actor_id_operation_type_key_pk" PRIMARY KEY("actor_id","operation_type","key"),
	CONSTRAINT "body_hash" CHECK ("control"."idempotency_record"."canonical_body_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "control"."agency_invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"root_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"contact" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"identity_status" text DEFAULT 'PENDING' NOT NULL,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING_IDENTITY' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"recovery_channel_ref" text,
	CONSTRAINT "agency_invitation_root_id_unique" UNIQUE("root_id"),
	CONSTRAINT "agency_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitation_status" CHECK ("control"."agency_invitation"."status" IN ('PENDING_IDENTITY','ISSUED','CLAIMED','REVOKED','EXPIRED')),
	CONSTRAINT "invitation_identity" CHECK ("control"."agency_invitation"."identity_status" IN ('PENDING','CONFIRMED','DENIED')),
	CONSTRAINT "invitation_version" CHECK ("control"."agency_invitation"."version">0)
);
--> statement-breakpoint
CREATE TABLE "control"."database_locator" (
	"agency_id" uuid PRIMARY KEY NOT NULL,
	"database_name" text NOT NULL,
	"runtime_role" text NOT NULL,
	"migration_role" text NOT NULL,
	"schema_version" integer DEFAULT 0 NOT NULL,
	"secret_ref" text NOT NULL,
	"verification_version" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "database_locator_database_name_unique" UNIQUE("database_name"),
	CONSTRAINT "database_locator_runtime_role_unique" UNIQUE("runtime_role"),
	CONSTRAINT "database_locator_migration_role_unique" UNIQUE("migration_role"),
	CONSTRAINT "database_locator_secret_ref_unique" UNIQUE("secret_ref"),
	CONSTRAINT "locator_versions" CHECK ("control"."database_locator"."schema_version" IN (0,1) AND "control"."database_locator"."verification_version">=0)
);
--> statement-breakpoint
CREATE TABLE "identity"."membership" (
	"subject_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"role" text NOT NULL,
	"state" text DEFAULT 'PENDING' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "membership_subject_id_agency_id_pk" PRIMARY KEY("subject_id","agency_id"),
	CONSTRAINT "membership_role" CHECK ("identity"."membership"."role" IN ('ADMIN','HABILITED','STANDARD')),
	CONSTRAINT "membership_state" CHECK ("identity"."membership"."state" IN ('PENDING','ACTIVE','DENIED')),
	CONSTRAINT "membership_version" CHECK ("identity"."membership"."version">0)
);
--> statement-breakpoint
CREATE TABLE "control"."provisioning_operation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"step" text DEFAULT 'ACCEPTED' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"last_error_code" text,
	"retryable" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "provisioning_operation_agency_id_unique" UNIQUE("agency_id"),
	CONSTRAINT "operation_step" CHECK ("control"."provisioning_operation"."step" IN ('ACCEPTED','DB_CREATED','SCHEMA_READY','SECRETS_REFERENCED','READY','ACTIVE')),
	CONSTRAINT "operation_status" CHECK ("control"."provisioning_operation"."status" IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),
	CONSTRAINT "operation_attempt" CHECK ("control"."provisioning_operation"."attempt">=0 AND "control"."provisioning_operation"."version">0)
);
--> statement-breakpoint
CREATE TABLE "control"."outbox" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"agency_id" uuid,
	"resource_id" uuid NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "outbox_resource_version" UNIQUE("type","resource_id","version"),
	CONSTRAINT "outbox_status" CHECK ("control"."outbox"."status" IN ('PENDING','DELIVERED')),
	CONSTRAINT "outbox_version" CHECK ("control"."outbox"."schema_version"=1 AND "control"."outbox"."version">0 AND "control"."outbox"."attempt">=0)
);
--> statement-breakpoint
CREATE TABLE "identity"."session" (
	"cookie_hash" text PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"invitation_root_id" uuid,
	"agency_id" uuid,
	"issued_at" timestamp with time zone NOT NULL,
	"last_human_activity_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"epoch" bigint NOT NULL,
	"revoked_at" timestamp with time zone,
	"encrypted_oidc_tokens" text NOT NULL,
	CONSTRAINT "session_scope" CHECK ("identity"."session"."scope" IN ('onboarding','agency','platform')),
	CONSTRAINT "session_bounds" CHECK ("identity"."session"."epoch">0 AND "identity"."session"."absolute_expires_at">"identity"."session"."issued_at" AND "identity"."session"."absolute_expires_at"<="identity"."session"."issued_at"+INTERVAL '15 days' AND "identity"."session"."last_human_activity_at">="identity"."session"."issued_at"),
	CONSTRAINT "session_root" CHECK ("scope"<>'onboarding' OR "invitation_root_id" IS NOT NULL),
 CONSTRAINT "session_agency" CHECK (("identity"."session"."scope"='agency') = ("identity"."session"."agency_id" IS NOT NULL)),
	CONSTRAINT "cookie_hash" CHECK ("identity"."session"."cookie_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "control"."agency" ADD CONSTRAINT "agency_invitation_root_id_agency_invitation_root_id_fk" FOREIGN KEY ("invitation_root_id") REFERENCES "control"."agency_invitation"("root_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control"."audit_event" ADD CONSTRAINT "audit_event_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control"."database_locator" ADD CONSTRAINT "database_locator_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."membership" ADD CONSTRAINT "membership_subject_id_account_authority_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "identity"."account_authority"("subject_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."membership" ADD CONSTRAINT "membership_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control"."provisioning_operation" ADD CONSTRAINT "provisioning_operation_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control"."outbox" ADD CONSTRAINT "outbox_event_id_audit_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "control"."audit_event"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control"."outbox" ADD CONSTRAINT "outbox_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_subject_id_account_authority_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "identity"."account_authority"("subject_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_invitation_root_id_agency_invitation_root_id_fk" FOREIGN KEY ("invitation_root_id") REFERENCES "control"."agency_invitation"("root_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "control"."agency"("id") ON DELETE no action ON UPDATE no action;
REVOKE ALL ON ALL TABLES IN SCHEMA control, identity FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA control, identity REVOKE ALL ON TABLES FROM PUBLIC;

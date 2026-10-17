-- T06 provisioning authority, bounded wakeups and durable effect intentions.
ALTER TABLE control.database_locator
  ADD COLUMN secret_version integer,
  ADD COLUMN migration_secret_ref uuid,
  ADD COLUMN ownership_tag text;
ALTER TABLE control.database_locator
  ADD CONSTRAINT locator_secret_version CHECK (secret_version IS NULL OR secret_version > 0),
  ADD CONSTRAINT locator_ownership_tag CHECK (ownership_tag IS NULL OR ownership_tag ~ '^[a-f0-9]{64}$');

ALTER TABLE control.provisioning_operation
  ADD COLUMN wakeup_generation bigint NOT NULL DEFAULT 0,
  DROP CONSTRAINT operation_step,
  ADD CONSTRAINT operation_step CHECK
    (step IN ('ACCEPTED','DATABASE_CREATED','SCHEMA_READY','SECRETS_REFERENCED','READY','ACTIVE')),
  ADD CONSTRAINT operation_wakeup_generation CHECK (wakeup_generation >= 0);

CREATE TABLE control.provisioning_execution (
  execution_id uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES control.provisioning_operation(id),
  instance_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('RUNNING','CLOSED','BLOCKED','FENCED')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  backends jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(backends)='array'),
  fencing_evidence_ref uuid,
  CHECK ((state IN ('RUNNING','BLOCKED') AND closed_at IS NULL)
      OR (state IN ('CLOSED','FENCED') AND closed_at IS NOT NULL)),
  CHECK ((state='FENCED') = (fencing_evidence_ref IS NOT NULL))
);
CREATE UNIQUE INDEX provisioning_execution_one_open
  ON control.provisioning_execution ((true)) WHERE state IN ('RUNNING','BLOCKED');
CREATE INDEX provisioning_execution_operation ON control.provisioning_execution(operation_id,started_at);

CREATE TABLE control.provisioning_gate (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  execution_id uuid REFERENCES control.provisioning_execution(execution_id),
  state text NOT NULL CHECK (state IN ('IDLE','RUNNING','BLOCKED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state='IDLE') = (execution_id IS NULL))
);
INSERT INTO control.provisioning_gate(singleton,execution_id,state,version) VALUES(true,NULL,'IDLE',1);

CREATE TABLE control.provisioning_effect (
  effect_id uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES control.provisioning_operation(id),
  kind text NOT NULL CHECK (kind IN ('LOCATOR_RESERVED','DATABASE_CREATED','SCHEMA_MIGRATED','RUNTIME_ACL','SECRET_PUBLISHED','AUDIT_CONFIRMED')),
  target_version integer NOT NULL CHECK (target_version > 0),
  status text NOT NULL CHECK (status IN ('PLANNED','CONFIRMED','UNCERTAIN')),
  expected_fingerprint text NOT NULL CHECK (expected_fingerprint ~ '^[a-f0-9]{64}$'),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence)='object'),
  audit_event_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(operation_id,kind,target_version)
);

ALTER TABLE control.provisioning_operation
  ADD CONSTRAINT operation_id_wakeup_generation_unique UNIQUE(id,wakeup_generation);

CREATE TABLE control.provisioning_wakeup (
  event_id uuid PRIMARY KEY REFERENCES control.outbox(event_id),
  operation_id uuid NOT NULL REFERENCES control.provisioning_operation(id),
  expected_operation_version bigint NOT NULL CHECK (expected_operation_version > 0),
  target_attempt integer NOT NULL CHECK (target_attempt > 0),
  delivery_round integer NOT NULL CHECK (delivery_round BETWEEN 1 AND 3),
  generation bigint NOT NULL CHECK (generation > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(operation_id,expected_operation_version,target_attempt,delivery_round),
  UNIQUE(operation_id,generation)
);
CREATE INDEX provisioning_wakeup_operation ON control.provisioning_wakeup(operation_id,generation DESC);

CREATE OR REPLACE FUNCTION control.lock_provisioning_scope(target_operation uuid)
RETURNS TABLE(operation_id uuid, agency_id uuid, invitation_root_id uuid, subject_id uuid,
  agency_state text, operation_step text, operation_status text, operation_attempt integer,
  operation_version bigint, wakeup_generation bigint, identity_epoch bigint,
  confirmed_epoch bigint, authority_status text, journal_sequence bigint, journal_hash text,
  invitation_status text, identity_status text, membership_role text, membership_state text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  resolved_agency uuid;
  resolved_root uuid;
  resolved_subject uuid;
BEGIN
  IF session_user <> 'provisioner' THEN
    RAISE EXCEPTION 'PROVISIONING_CALLER_REFUSED' USING ERRCODE='42501';
  END IF;
  SELECT o.agency_id, a.invitation_root_id, i.subject_id
    INTO resolved_agency,resolved_root,resolved_subject
    FROM control.provisioning_operation o
    JOIN control.agency a ON a.id=o.agency_id
    JOIN control.agency_invitation i ON i.root_id=a.invitation_root_id
    WHERE o.id=target_operation;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_SCOPE_MISSING' USING ERRCODE='P0002'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(resolved_root::text,0));
  PERFORM 1 FROM control.agency_invitation i
    WHERE i.root_id=resolved_root AND i.subject_id=resolved_subject FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_SCOPE_DIVERGED' USING ERRCODE='P0002'; END IF;
  PERFORM 1 FROM identity.account_authority a WHERE a.subject_id=resolved_subject FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_AUTHORITY_MISSING' USING ERRCODE='P0002'; END IF;
  PERFORM 1 FROM identity.membership m
    WHERE m.subject_id=resolved_subject AND m.agency_id=resolved_agency FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_MEMBERSHIP_MISSING' USING ERRCODE='P0002'; END IF;
  PERFORM 1 FROM control.agency a
    WHERE a.id=resolved_agency AND a.invitation_root_id=resolved_root FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_AGENCY_DIVERGED' USING ERRCODE='P0002'; END IF;

  RETURN QUERY
    SELECT o.id,a.id,i.root_id,i.subject_id,a.state,o.step,o.status,o.attempt,o.version,
      o.wakeup_generation,auth.identity_epoch,auth.confirmed_epoch,auth.status,
      auth.journal_sequence,auth.journal_hash,i.status,i.identity_status,m.role,m.state
    FROM control.provisioning_operation o
    JOIN control.agency a ON a.id=o.agency_id
    JOIN control.agency_invitation i ON i.root_id=a.invitation_root_id
    JOIN identity.account_authority auth ON auth.subject_id=i.subject_id
    JOIN identity.membership m ON m.subject_id=i.subject_id AND m.agency_id=a.id
    WHERE o.id=target_operation AND a.id=resolved_agency
      AND a.invitation_root_id=resolved_root AND i.subject_id=resolved_subject
    FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVISIONING_SCOPE_DIVERGED' USING ERRCODE='P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION control.lock_provisioning_scope(uuid) FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA control REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

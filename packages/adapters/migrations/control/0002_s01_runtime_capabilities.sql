-- Correct implementation defects; application schema stays version 1.
-- 0001 is immutable because it was already applied in the synthetic environment.
ALTER TABLE control.provisioning_operation DROP CONSTRAINT operation_step;
ALTER TABLE control.provisioning_operation ADD CONSTRAINT operation_step CHECK
  (step IN ('ACCEPTED','DATABASE_CREATED','SCHEMA_READY','SECRETS_REFERENCED','READY','ACTIVE'));

-- Runtime can hold an authority lock without UPDATE rights on any authority column.
-- Definer owns only the central schema; fixed path and qualified names prohibit injection.
CREATE FUNCTION control.lock_authority(subject uuid, exclusive_lock boolean)
RETURNS SETOF identity.account_authority
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF exclusive_lock THEN
    RETURN QUERY SELECT a.* FROM identity.account_authority a WHERE a.subject_id=subject FOR UPDATE;
  ELSE
    RETURN QUERY SELECT a.* FROM identity.account_authority a WHERE a.subject_id=subject FOR SHARE;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION control.lock_authority(uuid,boolean) FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA control,identity REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- The identity coordinator reads and locks scope without agency UPDATE rights.
CREATE FUNCTION control.lock_session_scope(subject uuid, invitation_root uuid)
RETURNS TABLE(id uuid,state text,role text,membership_state text)
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
 SELECT a.id,a.state,m.role,m.state
 FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id AND m.subject_id=subject
 WHERE a.invitation_root_id=invitation_root FOR SHARE OF a,m;
$$;
REVOKE ALL ON FUNCTION control.lock_session_scope(uuid,uuid) FROM PUBLIC;

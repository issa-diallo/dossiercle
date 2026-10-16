-- Additive completion of T06. Existing 0004 checksums and data remain intact.
CREATE FUNCTION control.reserve_t06_wakeup(target_operation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  aid uuid; rid uuid; sid uuid; op control.provisioning_operation%ROWTYPE;
  invite control.agency_invitation%ROWTYPE; auth identity.account_authority%ROWTYPE;
  previous control.provisioning_wakeup%ROWTYPE; delivered text;
  event uuid; round integer; generation bigint;
BEGIN
  IF session_user <> 'control_dispatcher' THEN
    RAISE EXCEPTION 'WAKEUP_CALLER_REFUSED' USING ERRCODE='42501';
  END IF;
  SELECT a.id,a.invitation_root_id,i.subject_id INTO aid,rid,sid
    FROM control.provisioning_operation o JOIN control.agency a ON a.id=o.agency_id
    JOIN control.agency_invitation i ON i.root_id=a.invitation_root_id
    WHERE o.id=target_operation;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
  SELECT * INTO invite FROM control.agency_invitation WHERE root_id=rid FOR SHARE;
  SELECT * INTO auth FROM identity.account_authority WHERE subject_id=sid FOR SHARE;
  PERFORM 1 FROM identity.membership WHERE subject_id=sid AND agency_id=aid
    AND role='ADMIN' AND state='PENDING' FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM control.agency WHERE id=aid AND invitation_root_id=rid
    AND state IN ('PROVISIONING','FAILED') AND activated_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO op FROM control.provisioning_operation WHERE id=target_operation FOR UPDATE;
  IF op.agency_id<>aid OR invite.subject_id<>sid OR invite.status<>'CLAIMED'
    OR invite.identity_status<>'CONFIRMED' OR auth.status<>'CONFIRMED'
    OR auth.confirmed_epoch IS DISTINCT FROM auth.identity_epoch
    OR op.attempt>=4 OR NOT(op.status='PENDING' OR (op.status='FAILED' AND op.retryable))
    OR EXISTS(SELECT 1 FROM control.provisioning_execution WHERE state IN ('RUNNING','BLOCKED'))
    THEN RETURN NULL; END IF;
  PERFORM 1 FROM control.provisioning_gate WHERE singleton=true
    AND state='IDLE' AND execution_id IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO previous FROM control.provisioning_wakeup
    WHERE operation_id=target_operation AND expected_operation_version=op.version
      AND target_attempt=op.attempt+1 ORDER BY delivery_round DESC LIMIT 1;
  round:=1;
  IF FOUND THEN
    SELECT status INTO delivered FROM control.outbox WHERE event_id=previous.event_id;
    IF delivered='PENDING' OR previous.created_at>clock_timestamp()-interval '30 seconds'
      THEN RETURN previous.event_id; END IF;
    IF previous.delivery_round>=3 THEN RETURN NULL; END IF;
    round:=previous.delivery_round+1;
  ELSE
    SELECT o.event_id INTO event FROM control.outbox o
      WHERE o.type='agency.creation-accepted' AND o.agency_id=aid AND o.status='PENDING';
    IF FOUND THEN RETURN event; END IF;
  END IF;
  generation:=op.wakeup_generation+1; event:=gen_random_uuid();
  UPDATE control.provisioning_operation SET wakeup_generation=generation WHERE id=target_operation;
  INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,
    resource_id,outcome,correlation,resource_version)
    VALUES(event,aid,'00000000-0000-4000-8000-000000000074','service',
      'agency.provisioning-wakeup',target_operation,'accepted',target_operation,generation);
  INSERT INTO control.outbox(event_id,type,agency_id,resource_id,version)
    VALUES(event,'agency.provisioning-wakeup',aid,target_operation,generation);
  INSERT INTO control.provisioning_wakeup(event_id,operation_id,expected_operation_version,
    target_attempt,delivery_round,generation)
    VALUES(event,target_operation,op.version,op.attempt+1,round,generation);
  RETURN event;
END;
$$;
REVOKE ALL ON FUNCTION control.reserve_t06_wakeup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reserve_t06_wakeup(uuid) TO control_dispatcher;

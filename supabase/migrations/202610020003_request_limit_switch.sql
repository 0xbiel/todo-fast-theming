-- Explicitly disable request-count limits only after reviewed policy approval.
BEGIN;
ALTER TABLE board_private.policy ADD COLUMN request_limits_enabled boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.board_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 p board_private.policy%ROWTYPE; r board_private.reservations%ROWTYPE;
 now_at timestamptz := pg_catalog.clock_timestamp(); today date := (now_at AT TIME ZONE 'UTC')::date;
 op text := command->>'op'; reserved bigint; spent bigint; actual bigint; snapshot_count integer;
BEGIN
 -- Shared transaction lock serializes reservations and settlement across all workers.
 IF op='snapshotRead' THEN RETURN pg_catalog.jsonb_build_object('snapshot',(SELECT payload FROM board_private.snapshots WHERE id=(command->>'id')::uuid AND NOT revoked)); END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(781906234);
 SELECT * INTO STRICT p FROM board_private.policy WHERE id=true;
 IF op='policy' THEN
  RETURN pg_catalog.jsonb_build_object('enabled',p.enabled,'maxCompletionTokens',p.completion_tokens,'approvedEmails',p.approved_emails,'rates',pg_catalog.jsonb_build_object('inputMicrosPerMillion',p.input_rate,'outputMicrosPerMillion',p.output_rate));
 END IF;
 IF op='reserve' THEN
  IF NOT p.enabled OR p.breaker THEN RAISE EXCEPTION 'Quota unavailable'; END IF;
  IF NOT COALESCE(command->>'uid' ~ '^[0-9a-f]{64}$',false) OR NOT COALESCE(command->>'lane' IN ('shared','byok'),false) THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
  reserved := CASE WHEN command->>'lane'='byok' THEN 0 ELSE pg_catalog.ceil((4096::numeric*p.input_rate+p.completion_tokens::numeric*p.output_rate)/1000000)::bigint END;
  IF (command->>'amount')::bigint IS DISTINCT FROM reserved THEN RAISE EXCEPTION 'Policy changed'; END IF;
  IF command->>'lane'='shared' AND (p.budget_micros=0 OR NOT COALESCE(pg_catalog.lower(command->>'email')=ANY(p.approved_emails),false)) THEN RAISE EXCEPTION 'Approval required'; END IF;
  UPDATE board_private.reservations SET state='cancelled',amount=0 WHERE state='reserved' AND expires<=now_at;
  UPDATE board_private.reservations SET state='settled' WHERE state='dispatched' AND expires<=now_at;
  IF p.request_limits_enabled AND ((SELECT count(*) FROM board_private.reservations WHERE uid=command->>'uid' AND created>now_at-interval '1 minute')>=p.per_minute
   OR (SELECT count(*) FROM board_private.reservations WHERE uid=command->>'uid' AND lane=command->>'lane' AND day=today)>=(CASE WHEN command->>'lane'='shared' THEN p.shared_user_daily ELSE p.user_daily END)
   OR (SELECT count(*) FROM board_private.reservations WHERE lane=command->>'lane' AND day=today)>=(CASE WHEN command->>'lane'='shared' THEN p.shared_global_daily ELSE p.global_daily END)) THEN RAISE EXCEPTION 'Quota reached'; END IF;
  IF (SELECT count(*) FROM board_private.reservations WHERE state IN ('reserved','dispatched'))>=p.concurrent THEN RAISE EXCEPTION 'Quota reached'; END IF;
  SELECT COALESCE(sum(amount),0) INTO spent FROM board_private.reservations WHERE day=today;
  IF spent+reserved>p.budget_micros THEN RAISE EXCEPTION 'Budget reached'; END IF;
  INSERT INTO board_private.reservations VALUES((command->>'id')::uuid,command->>'uid',command->>'lane',today,now_at,now_at+interval '120 seconds','reserved',reserved);
  RETURN pg_catalog.jsonb_build_object('id',command->>'id');
 ELSIF op IN ('dispatch','cancel','settle') THEN
  SELECT * INTO STRICT r FROM board_private.reservations WHERE id=(command->>'id')::uuid FOR UPDATE;
  IF op='dispatch' THEN
   IF r.state<>'reserved' OR r.expires<=now_at THEN RAISE EXCEPTION 'Reservation expired'; END IF;
   UPDATE board_private.reservations SET state='dispatched' WHERE id=r.id;
  ELSIF op='cancel' AND r.state='reserved' THEN
   UPDATE board_private.reservations SET state='cancelled',amount=0 WHERE id=r.id;
  ELSIF op='settle' AND r.state='dispatched' THEN
   actual:=COALESCE((command->>'actualMicros')::bigint,r.amount);
   IF actual<0 THEN RAISE EXCEPTION 'Invalid settlement'; END IF;
   UPDATE board_private.reservations SET state='settled',amount=actual WHERE id=r.id;
   IF actual>r.amount OR COALESCE((command->>'trip')::boolean,false) THEN UPDATE board_private.policy SET breaker=true WHERE id=true; END IF;
  END IF;
  RETURN '{}'::jsonb;
 ELSIF op='snapshotRead' THEN
  RETURN pg_catalog.jsonb_build_object('snapshot',(SELECT payload FROM board_private.snapshots WHERE id=(command->>'id')::uuid AND NOT revoked));
 ELSIF op IN ('snapshotPublish','snapshotRevoke') THEN
  IF NOT COALESCE(command->>'owner' ~ '^[0-9a-f]{64}$',false) THEN RAISE EXCEPTION 'Owner required'; END IF;
  IF (SELECT count(*) FROM board_private.snapshot_writes WHERE owner=command->>'owner' AND created>now_at-interval '1 day')>=30 THEN RAISE EXCEPTION 'Snapshot quota reached'; END IF;
  IF EXISTS(SELECT 1 FROM board_private.snapshots WHERE id=(command->>'id')::uuid AND owner<>command->>'owner') THEN RAISE EXCEPTION 'Owner required'; END IF;
  IF op='snapshotPublish' THEN
   IF NOT EXISTS(SELECT 1 FROM board_private.snapshots WHERE id=(command->>'id')::uuid) AND (SELECT count(*) FROM board_private.snapshots WHERE owner=command->>'owner')>=5 THEN RAISE EXCEPTION 'Snapshot quota reached'; END IF;
   IF pg_catalog.pg_column_size(command->'payload')>16384 OR command->'payload'->>'version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
   INSERT INTO board_private.snapshots VALUES((command->>'id')::uuid,command->>'owner',command->'payload',false)
    ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,revoked=false;
  ELSE
   UPDATE board_private.snapshots SET revoked=true WHERE id=(command->>'id')::uuid AND owner=command->>'owner';
  END IF;
  INSERT INTO board_private.snapshot_writes VALUES(command->>'owner',now_at);
  RETURN pg_catalog.jsonb_build_object('id',command->>'id');
 END IF;
 RAISE EXCEPTION 'Unsupported operation';
END $$;
REVOKE ALL ON FUNCTION public.board_command(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.board_command(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

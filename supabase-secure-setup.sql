-- =========================================================================
-- SECURE SETUP (ek hi file, ek baar run karein, safe to re-run)
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Is file ke baad:
--   * Browser (anon key) ko database ka koi direct access nahi.
--   * Admin upload / users / pull sab sirf secure server (service-role key) se.
--   * Atomic pull function (allocate_customers_v2) taiyar.
--
-- Pehle naya code + Vercel env vars deploy karein, phir ye SQL run karein.
-- =========================================================================

-- 0. Master admin row
INSERT INTO profiles (id, name, email, role, status, daily_pull_limit, per_pull_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 'Administrator', 'admin@vi-outreach.com',
        'admin', 'active', 1000, 100)
ON CONFLICT (email) DO NOTHING;

-- 1. Atomic pull (ek customer sirf ek user ko, FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION allocate_customers_v2(
  p_user_id UUID,
  p_requested_count INT,
  p_source TEXT,
  p_lot_id TEXT,
  p_day_start TIMESTAMPTZ
)
RETURNS TABLE (
  out_id UUID,
  out_customer_number TEXT,
  out_customer_name TEXT,
  out_matching_number TEXT,
  out_matching_number_2 TEXT,
  out_pulled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user profiles%ROWTYPE;
  v_pulled_today INT;
  v_remaining INT;
  v_actual INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- ek user ke pulls ek ke baad ek chalein (quota race se bachne ke liye)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT * INTO v_user FROM profiles WHERE profiles.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF v_user.status <> 'active' THEN
    RAISE EXCEPTION 'USER_DISABLED';
  END IF;

  SELECT COUNT(*) INTO v_pulled_today
  FROM pull_history ph
  WHERE ph.user_id = p_user_id AND ph.pulled_at >= p_day_start;

  v_remaining := GREATEST(0, v_user.daily_pull_limit - v_pulled_today);
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'QUOTA_REACHED:%', v_user.daily_pull_limit;
  END IF;
  IF p_requested_count > v_user.per_pull_limit THEN
    RAISE EXCEPTION 'PER_PULL_LIMIT:%', v_user.per_pull_limit;
  END IF;

  v_actual := LEAST(p_requested_count, v_remaining);

  RETURN QUERY
  WITH picked AS (
    SELECT c.id
    FROM customers c
    WHERE c.status = 'AVAILABLE'
    ORDER BY c.uploaded_at ASC, c.created_at ASC, c.id ASC
    LIMIT v_actual
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE customers c
    SET status = 'PULLED',
        allocated_to = p_user_id,
        allocated_at = v_now,
        pulled_at = v_now,
        updated_at = v_now
    FROM picked
    WHERE c.id = picked.id
    RETURNING c.id, c.customer_number, c.customer_name, c.matching_number, c.matching_number_2
  ),
  hist AS (
    INSERT INTO pull_history (
      customer_id, customer_number, customer_name, matching_number, matching_number_2,
      user_id, user_name, action, source, pulled_at, metadata
    )
    SELECT u.id, u.customer_number, u.customer_name, u.matching_number, u.matching_number_2,
           v_user.id, v_user.name, 'PULLED', p_source, v_now,
           jsonb_build_object('lot_id', p_lot_id)
    FROM upd u
    RETURNING 1
  )
  SELECT u.id, u.customer_number, u.customer_name, u.matching_number, u.matching_number_2, v_now
  FROM upd u;
END;
$$;


-- 2. Anon-open policies hatao (RLS ON rahegi, koi policy nahi = anon/authenticated ko sab band)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','customers','upload_history','pull_history','send_history','message_templates','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "app_anon_all_%s" ON %I', t, t);
  END LOOP;
END $$;

-- 3. Belt and braces: anon/authenticated se table privileges bhi hata do
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 4. Pull functions sirf server (service_role) chala sakta hai
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION allocate_customers_v2(UUID, INT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION allocate_customers_v2(UUID, INT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
  BEGIN
    REVOKE EXECUTE ON FUNCTION allocate_customers(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END $$;

-- =========================================================================
-- VI PREMIUM OUTREACH & CUSTOMER ALLOCATION PLATFORM
-- SUPABASE POSTGRESQL SCHEMA WITH ATOMIC ROW LOCKING & RLS POLICIES
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('AVAILABLE', 'ALLOCATED', 'PULLED', 'USED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked to auth.users or standalone)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  status user_status DEFAULT 'active'::user_status NOT NULL,
  daily_pull_limit INTEGER DEFAULT 100 NOT NULL,
  per_pull_limit INTEGER DEFAULT 20 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  matching_number TEXT NOT NULL,
  matching_number_2 TEXT,
  status customer_status DEFAULT 'AVAILABLE'::customer_status NOT NULL,
  allocated_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ,
  pulled_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_allocated_to ON customers(allocated_to);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_uploaded_at ON customers(uploaded_at);

-- 5. PULL HISTORY TABLE
CREATE TABLE IF NOT EXISTS pull_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_number TEXT NOT NULL,
  customer_name TEXT,
  matching_number TEXT NOT NULL,
  matching_number_2 TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT DEFAULT 'PULLED' NOT NULL,
  source TEXT DEFAULT 'MATCHING_SEND' NOT NULL,
  pulled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pull_history_user_id ON pull_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pull_history_pulled_at ON pull_history(pulled_at);
CREATE INDEX IF NOT EXISTS idx_pull_history_cust_number ON pull_history(customer_number);

-- 6. SEND HISTORY TABLE (WhatsApp / RCS / SMS)
CREATE TABLE IF NOT EXISTS send_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_number TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('wa', 'rcs', 'sms')),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'OPENED' NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_send_history_user ON send_history(user_id);
CREATE INDEX IF NOT EXISTS idx_send_history_sent_at ON send_history(sent_at);

-- 7. MESSAGE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. UPLOAD HISTORY TABLE
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0 NOT NULL,
  valid_rows INTEGER DEFAULT 0 NOT NULL,
  duplicate_rows INTEGER DEFAULT 0 NOT NULL,
  invalid_rows INTEGER DEFAULT 0 NOT NULL,
  new_rows INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =========================================================================
-- ATOMIC ALLOCATION FUNCTION USING 'FOR UPDATE SKIP LOCKED'
-- GUARANTEES: ONE CUSTOMER = ONE USER ALLOCATION (NO CONCURRENCY CONFLICTS)
-- =========================================================================

CREATE OR REPLACE FUNCTION allocate_customers(
  p_user_id UUID,
  p_requested_count INT DEFAULT 1,
  p_source TEXT DEFAULT 'MATCHING_SEND'
)
RETURNS TABLE (
  allocated_id UUID,
  out_customer_number TEXT,
  out_customer_name TEXT,
  out_matching_number TEXT,
  out_matching_number_2 TEXT,
  out_status customer_status,
  out_pulled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user profiles%ROWTYPE;
  v_pulled_today INT;
  v_remaining_quota INT;
  v_actual_limit INT;
  v_rec RECORD;
BEGIN
  -- 1. Fetch user & check status
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF v_user.status <> 'active' THEN
    RAISE EXCEPTION 'User account is disabled. Contact administrator.';
  END IF;

  -- 2. Count pulls performed today
  SELECT COUNT(*) INTO v_pulled_today
  FROM pull_history
  WHERE user_id = p_user_id
    AND pulled_at >= CURRENT_DATE;

  -- 3. Calculate remaining daily quota
  v_remaining_quota := GREATEST(0, v_user.daily_pull_limit - v_pulled_today);
  IF v_remaining_quota <= 0 THEN
    RAISE EXCEPTION 'Your daily customer limit (% customers) has been reached.', v_user.daily_pull_limit;
  END IF;

  -- 4. Enforce per-pull limit
  IF p_requested_count > v_user.per_pull_limit THEN
    RAISE EXCEPTION 'You can pull maximum % customers at a time.', v_user.per_pull_limit;
  END IF;

  v_actual_limit := LEAST(p_requested_count, v_remaining_quota);

  -- 5. ATOMIC SELECT AND LOCK: Lock available customer rows without race conditions
  FOR v_rec IN
    SELECT id, customer_number, customer_name, matching_number, matching_number_2
    FROM customers
    WHERE status = 'AVAILABLE'
    ORDER BY uploaded_at ASC, created_at ASC
    LIMIT v_actual_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Update customer record atomically
    UPDATE customers
    SET status = 'PULLED',
        allocated_to = p_user_id,
        allocated_at = NOW(),
        pulled_at = NOW(),
        updated_at = NOW()
    WHERE id = v_rec.id;

    -- Record in pull history
    INSERT INTO pull_history (
      customer_id,
      customer_number,
      customer_name,
      matching_number,
      matching_number_2,
      user_id,
      user_name,
      action,
      source,
      pulled_at
    ) VALUES (
      v_rec.id,
      v_rec.customer_number,
      v_rec.customer_name,
      v_rec.matching_number,
      v_rec.matching_number_2,
      v_user.id,
      v_user.name,
      'PULLED',
      p_source,
      NOW()
    );

    -- Return row to client
    allocated_id := v_rec.id;
    out_customer_number := v_rec.customer_number;
    out_customer_name := v_rec.customer_name;
    out_matching_number := v_rec.matching_number;
    out_matching_number_2 := v_rec.matching_number_2;
    out_status := 'PULLED'::customer_status;
    out_pulled_at := NOW();
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Admins can view/update all; Users can view their own profile
CREATE POLICY "Admins full access on profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (
    auth_user_id = auth.uid()
  );

-- Customers: Admins can do anything; Users can only select their allocated customers
CREATE POLICY "Admins manage all customers" ON customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Users view assigned customers" ON customers
  FOR SELECT USING (
    allocated_to IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- Pull History: Admins view all, Users view their own
CREATE POLICY "Admins view all pull history" ON pull_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Users view own pull history" ON pull_history
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

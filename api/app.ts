/**
 * Server side of the app (Vercel serverless function): POST /api/app  { action, ...params }
 *
 * - The Supabase SERVICE ROLE key and the admin password live ONLY here (Vercel env vars).
 * - The browser only ever receives a signed, expiring session token.
 * - Agents can only: log in, read their own data and pull customers (atomic DB function).
 * - Everything else (customers, users, uploads, template) needs an admin token.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'admin@vi-outreach.com';
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
const AGENT_TTL_MS = 12 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER_STATUSES = ['AVAILABLE', 'ALLOCATED', 'PULLED', 'USED', 'DISABLED'];
const PAGE = 1000;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- config
function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!adminPassword) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new HttpError(500, `Server not configured. Vercel env vars missing: ${missing.join(', ')}`);
  }
  const secret =
    process.env.SESSION_SECRET ||
    createHash('sha256').update(`${serviceKey}|match-session-v1`).digest('hex');
  const tzOffsetMinutes = Number.isFinite(Number(process.env.TZ_OFFSET_MINUTES))
    ? Number(process.env.TZ_OFFSET_MINUTES)
    : 330; // IST
  return { url, serviceKey, adminPassword, secret, tzOffsetMinutes };
}

let cached: { key: string; client: SupabaseClient } | null = null;
function db(): SupabaseClient {
  const c = config();
  const key = `${c.url}|${c.serviceKey}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      client: createClient(c.url, c.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    };
  }
  return cached.client;
}

// ---------------------------------------------------------------- tokens
interface TokenPayload {
  sub: string;
  role: 'admin' | 'user';
  exp: number;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

function signToken(payload: TokenPayload): string {
  const body = b64(JSON.stringify(payload));
  const sig = createHmac('sha256', config().secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', config().secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== 'admin' && payload.role !== 'user') return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req: any, role?: 'admin' | 'user'): TokenPayload {
  const header = String(req.headers['authorization'] || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, 'Session expired. Please log in again.');
  if (role && payload.role !== role) throw new HttpError(403, 'Not allowed.');
  return payload;
}

// ---------------------------------------------------------------- brute-force throttle (best effort)
const attempts = new Map<string, { count: number; until: number }>();
function clientIp(req: any): string {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}
function checkThrottle(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now()) {
    throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');
  }
}
function recordFailure(key: string) {
  const a = attempts.get(key) || { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= 5) {
    a.until = Date.now() + 10 * 60 * 1000;
    a.count = 0;
  }
  attempts.set(key, a);
}
function clearFailures(key: string) {
  attempts.delete(key);
}

// ---------------------------------------------------------------- helpers
const sha = (s: string) => createHash('sha256').update(s).digest();

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function digits(v: unknown): string {
  return (v === null || v === undefined ? '' : String(v)).replace(/\D/g, '');
}
function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function fail(error: { message?: string; code?: string } | null, what: string): never {
  throw new HttpError(500, `${what}: ${error?.message || 'database error'}${error?.code ? ` (${error.code})` : ''}`);
}

function dayStartIso(): string {
  const off = config().tzOffsetMinutes * 60000;
  const t = Date.now();
  return new Date(Math.floor((t + off) / 86400000) * 86400000 - off).toISOString();
}

async function audit(userId: string | null, userName: string, action: string, message: string) {
  try {
    await db().from('audit_logs').insert([
      {
        user_id: userId && UUID_RE.test(userId) ? userId : null,
        user_name: userName,
        action,
        details: { message },
      },
    ]);
  } catch {
    // audit must never break the request
  }
}

async function ensureAdminProfile() {
  await db()
    .from('profiles')
    .upsert(
      [
        {
          id: ADMIN_ID,
          name: 'Administrator',
          email: ADMIN_EMAIL,
          role: 'admin',
          status: 'active',
          daily_pull_limit: 1000,
          per_pull_limit: 100,
        },
      ],
      { onConflict: 'email', ignoreDuplicates: true }
    );
}

async function getProfile(id: string) {
  const { data, error } = await db().from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) fail(error, 'Profile lookup failed');
  return data;
}

async function getTemplate() {
  const { data } = await db().from('message_templates').select('*').eq('is_default', true).limit(1).maybeSingle();
  return data || null;
}

function sessionFor(profile: any, ttl: number) {
  return {
    token: signToken({ sub: profile.id, role: profile.role === 'admin' ? 'admin' : 'user', exp: Date.now() + ttl }),
    profile,
  };
}

// ---------------------------------------------------------------- actions
type Ctx = { req: any; body: any };

const publicActions: Record<string, (c: Ctx) => Promise<any>> = {
  async status() {
    const c = config();
    return { ok: true, tzOffsetMinutes: c.tzOffsetMinutes };
  },

  // Template is not sensitive: guests (single/bulk tools) use it too
  async template() {
    const t = await getTemplate();
    return { template: t?.template || null };
  },

  async 'admin-login'({ req, body }) {
    const c = config();
    const key = `admin:${clientIp(req)}`;
    checkThrottle(key);
    const given = sha(String(body.password ?? ''));
    const real = sha(c.adminPassword);
    if (!timingSafeEqual(given, real)) {
      recordFailure(key);
      throw new HttpError(401, 'Incorrect password. Access denied.');
    }
    clearFailures(key);
    await ensureAdminProfile();
    const profile = await getProfile(ADMIN_ID);
    if (!profile) throw new HttpError(500, 'Admin profile missing in Supabase. Run the SQL setup files.');
    await audit(ADMIN_ID, profile.name, 'ADMIN_LOGIN', 'Admin logged in');
    return { ...sessionFor(profile, ADMIN_TTL_MS), tzOffsetMinutes: c.tzOffsetMinutes };
  },

  async 'agent-login'({ req, body }) {
    const c = config();
    const key = `agent:${clientIp(req)}`;
    checkThrottle(key);
    const clean = str(body.identifier, 120).toLowerCase();
    if (!clean) throw new HttpError(400, 'Please enter your username or email.');

    // Exact match in JS (no wildcard/filter-injection surface): fetch active+inactive agents once
    const { data, error } = await db().from('profiles').select('*').eq('role', 'user');
    if (error) fail(error, 'Login lookup failed');
    const user = (data || []).find(
      (p: any) =>
        String(p.email).toLowerCase() === clean ||
        String(p.name).toLowerCase() === clean ||
        String(p.email).split('@')[0].toLowerCase() === clean
    );
    if (!user) {
      recordFailure(key);
      throw new HttpError(404, 'Agent account not found. Please contact Administrator to create your login.');
    }
    if (user.status !== 'active') {
      throw new HttpError(403, 'Your account is currently disabled. Please contact Administrator.');
    }
    clearFailures(key);
    await audit(user.id, user.name, 'USER_LOGIN', `Agent ${user.name} logged in`);
    return { ...sessionFor(user, AGENT_TTL_MS), tzOffsetMinutes: c.tzOffsetMinutes };
  },
};

const authedActions: Record<string, (c: Ctx, who: TokenPayload) => Promise<any>> = {
  // Fresh profile + template + own pull history (works for agent and admin)
  async me(_c, who) {
    const profile = await getProfile(who.sub);
    if (!profile) throw new HttpError(401, 'Account no longer exists.');
    if (profile.status !== 'active') throw new HttpError(401, 'Your account is disabled.');
    const template = await getTemplate();
    let history: any[] = [];
    if (who.role === 'user') {
      const { data, error } = await db()
        .from('pull_history')
        .select('*')
        .eq('user_id', who.sub)
        .order('pulled_at', { ascending: false })
        .limit(1000);
      if (error) fail(error, 'History fetch failed');
      history = data || [];
    }
    return { profile, template, history, tzOffsetMinutes: config().tzOffsetMinutes };
  },

  // Agent sets the reply number used in HIS outreach message (empty = back to default)
  async 'set-reply-number'({ body }, who) {
    if (who.role !== 'user') throw new HttpError(403, 'Only agents can set a reply number.');
    const raw = digits(body.number);
    const num = raw.length === 12 && raw.startsWith('91') ? raw.slice(2) : raw;
    if (num && num.length !== 10) throw new HttpError(400, 'Number must be exactly 10 digits.');
    const { data, error } = await db()
      .from('profiles')
      .update({ reply_number: num || null, updated_at: new Date().toISOString() })
      .eq('id', who.sub)
      .select()
      .maybeSingle();
    if (error) {
      if (/reply_number/i.test(error.message || '') || error.code === '42703' || error.code === 'PGRST204') {
        throw new HttpError(500, 'Database setup pending: run supabase-reply-number.sql in Supabase SQL Editor.');
      }
      fail(error, 'Save failed');
    }
    if (!data) throw new HttpError(404, 'Account no longer exists.');
    return { profile: data };
  },

  // Atomic pull: only the database function hands out customers
  async pull({ body }, who) {
    if (who.role !== 'user') throw new HttpError(403, 'Only agents can pull customers.');
    const count = int(body.count, 1, 100, 1);
    const source = ['MATCHING_SEND', 'BULK'].includes(body.source) ? body.source : 'MATCHING_SEND';
    const lotId = randomUUID();

    const { data, error } = await db().rpc('allocate_customers_v2', {
      p_user_id: who.sub,
      p_requested_count: count,
      p_source: source,
      p_lot_id: lotId,
      p_day_start: dayStartIso(),
    });

    if (error) {
      const m = error.message || '';
      if (m.startsWith('QUOTA_REACHED'))
        throw new HttpError(409, `Your daily customer limit (${m.split(':')[1] || ''}) has been reached.`);
      if (m.startsWith('PER_PULL_LIMIT'))
        throw new HttpError(409, `You can pull maximum ${m.split(':')[1] || ''} customers at a time.`);
      if (m.startsWith('USER_DISABLED'))
        throw new HttpError(403, 'Your account is disabled. Please contact the administrator.');
      if (m.startsWith('USER_NOT_FOUND')) throw new HttpError(401, 'Account no longer exists.');
      if (error.code === 'PGRST202' || /could not find the function/i.test(m))
        throw new HttpError(500, 'Database setup pending: run supabase-customers-fix.sql in Supabase SQL Editor.');
      fail(error, 'Pull failed');
    }

    const rows = (data || []) as any[];
    if (rows.length === 0) {
      throw new HttpError(
        409,
        'No new customer is currently available in the system. Please request Admin to upload fresh data.'
      );
    }

    const { data: history } = await db()
      .from('pull_history')
      .select('*')
      .eq('user_id', who.sub)
      .eq('metadata->>lot_id', lotId);

    const profile = await getProfile(who.sub);
    await audit(who.sub, profile?.name || 'Agent', 'CUSTOMER_PULL', `Pulled ${rows.length} customer(s) via ${source}`);
    return { customers: rows, history: history || [] };
  },
};

const adminActions: Record<string, (c: Ctx, who: TokenPayload) => Promise<any>> = {
  async 'admin-overview'() {
    await ensureAdminProfile();
    const [profiles, uploads, audits, template] = await Promise.all([
      db().from('profiles').select('*').order('created_at', { ascending: true }),
      db().from('upload_history').select('*').order('created_at', { ascending: false }).limit(200),
      db().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
      getTemplate(),
    ]);
    if (profiles.error) fail(profiles.error, 'Profiles fetch failed');
    if (uploads.error) fail(uploads.error, 'Upload history fetch failed');
    return {
      profiles: profiles.data || [],
      uploads: uploads.data || [],
      audits: (audits.data || []).map((a: any) => ({
        ...a,
        details: typeof a.details === 'string' ? a.details : a.details?.message || '',
      })),
      template,
    };
  },

  async 'customers-page'({ body }) {
    const offset = int(body.offset, 0, 1_000_000, 0);
    const { data, error } = await db()
      .from('customers')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) fail(error, 'Customers fetch failed');
    return { rows: data || [], more: (data || []).length === PAGE };
  },

  async 'pull-history-page'({ body }) {
    const offset = int(body.offset, 0, 1_000_000, 0);
    const { data, error } = await db()
      .from('pull_history')
      .select('*')
      .order('pulled_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) fail(error, 'Pull history fetch failed');
    return { rows: data || [], more: (data || []).length === PAGE };
  },

  // ---- users
  async 'create-profile'({ body }, who) {
    const name = str(body.name, 100);
    const email = str(body.email, 200);
    if (!name || !email) throw new HttpError(400, 'Name and email are required.');
    const row = {
      name,
      email,
      role: body.role === 'admin' ? 'admin' : 'user',
      status: 'active',
      daily_pull_limit: int(body.daily_pull_limit, 0, 100000, 100),
      per_pull_limit: int(body.per_pull_limit, 1, 1000, 20),
    };
    const { data, error } = await db().from('profiles').insert([row]).select().single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, `User with email ${email} already exists.`);
      fail(error, 'Save failed');
    }
    await audit(who.sub, 'Admin', 'CREATE_USER', `Created user ${name} (${email})`);
    return { profile: data };
  },

  async 'update-profile'({ body }, who) {
    if (!UUID_RE.test(String(body.id))) throw new HttpError(400, 'Invalid user id.');
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.daily_pull_limit !== undefined) upd.daily_pull_limit = int(body.daily_pull_limit, 0, 100000, 100);
    if (body.per_pull_limit !== undefined) upd.per_pull_limit = int(body.per_pull_limit, 1, 1000, 20);
    if (body.status !== undefined) upd.status = body.status === 'disabled' ? 'disabled' : 'active';
    if (body.role !== undefined) upd.role = body.role === 'admin' ? 'admin' : 'user';
    if (body.id === ADMIN_ID) {
      delete upd.status;
      delete upd.role; // master admin can't be demoted/disabled
    }
    const { data, error } = await db().from('profiles').update(upd).eq('id', body.id).select().maybeSingle();
    if (error) fail(error, 'Update failed');
    if (!data) throw new HttpError(404, 'User not found.');
    await audit(who.sub, 'Admin', 'UPDATE_USER', `Updated user ${data.name} limits or status`);
    return { profile: data };
  },

  async 'delete-profile'({ body }, who) {
    if (!UUID_RE.test(String(body.id))) throw new HttpError(400, 'Invalid user id.');
    if (body.id === ADMIN_ID) throw new HttpError(400, 'The master admin cannot be deleted.');
    const { data, error } = await db().from('profiles').delete().eq('id', body.id).select('name').maybeSingle();
    if (error) fail(error, 'Delete failed');
    if (!data) throw new HttpError(404, 'User not found.');
    await audit(who.sub, 'Admin', 'DELETE_USER', `Deleted user ${data.name}`);
    return { ok: true };
  },

  // ---- customers
  async 'import-chunk'({ body }) {
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length > 2000) throw new HttpError(400, 'Chunk too large (max 2000 rows).');
    const baseMs = Number.isFinite(Date.parse(body.base)) ? Date.parse(body.base) : Date.now();
    const startIndex = int(body.startIndex, 0, 10_000_000, 0);

    let invalid = 0;
    let duplicate = 0;
    const seen = new Set<string>();
    const payload: any[] = [];
    rows.forEach((r, i) => {
      const num = digits(r?.customer_number);
      const m1 = digits(r?.matching_number);
      const m2 = digits(r?.matching_number_2);
      if (num.length !== 10 || m1.length !== 10) {
        invalid++;
        return;
      }
      if (seen.has(num)) {
        duplicate++;
        return;
      }
      seen.add(num);
      const ts = new Date(baseMs + startIndex + i).toISOString(); // keeps file order for FIFO pulls
      payload.push({
        customer_number: num,
        customer_name: str(r?.customer_name, 100) || null,
        matching_number: m1,
        matching_number_2: m2.length === 10 ? m2 : null,
        status: 'AVAILABLE',
        uploaded_at: ts,
        created_at: ts,
      });
    });

    let inserted = 0;
    if (payload.length > 0) {
      const { data, error } = await db()
        .from('customers')
        .upsert(payload, { onConflict: 'customer_number', ignoreDuplicates: true })
        .select('customer_number');
      if (error) fail(error, 'Upload failed');
      inserted = (data || []).length;
      duplicate += payload.length - inserted;
    }
    return { inserted, duplicate, invalid };
  },

  async 'record-upload'({ body }, who) {
    const rec = {
      uploaded_by: who.sub,
      filename: str(body.filename, 255) || 'upload',
      total_rows: int(body.total, 0, 10_000_000, 0),
      valid_rows: int(body.valid, 0, 10_000_000, 0),
      duplicate_rows: int(body.duplicate, 0, 10_000_000, 0),
      invalid_rows: int(body.invalid, 0, 10_000_000, 0),
      new_rows: int(body.newRows, 0, 10_000_000, 0),
    };
    const { error } = await db().from('upload_history').insert([rec]);
    if (error) fail(error, 'Upload history save failed');
    await audit(
      who.sub,
      'Admin',
      'EXCEL_UPLOAD',
      `Imported ${rec.new_rows} new records from ${rec.filename} (${rec.duplicate_rows} duplicates, ${rec.invalid_rows} invalid)`
    );
    return { ok: true };
  },

  async 'add-customer'({ body }, who) {
    const num = digits(body.customer_number);
    const m1 = digits(body.matching_number);
    const m2 = digits(body.matching_number_2);
    if (num.length !== 10) throw new HttpError(400, 'Customer number must be exactly 10 digits.');
    if (m1.length !== 10) throw new HttpError(400, 'Matching number must be exactly 10 digits.');
    const { data, error } = await db()
      .from('customers')
      .insert([
        {
          customer_number: num,
          customer_name: str(body.customer_name, 100) || null,
          matching_number: m1,
          matching_number_2: m2.length === 10 ? m2 : null,
          status: 'AVAILABLE',
        },
      ])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, `Customer number ${num} already exists in database.`);
      fail(error, 'Save failed');
    }
    await audit(who.sub, 'Admin', 'ADD_CUSTOMER', `Added customer ${num}`);
    return { customer: data };
  },

  async 'update-customer'({ body }) {
    if (!UUID_RE.test(String(body.id))) throw new HttpError(400, 'Invalid customer id.');
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.customer_name !== undefined) upd.customer_name = str(body.customer_name, 100) || null;
    if (body.matching_number !== undefined) {
      const m1 = digits(body.matching_number);
      if (m1.length !== 10) throw new HttpError(400, 'Matching number must be exactly 10 digits.');
      upd.matching_number = m1;
    }
    if (body.matching_number_2 !== undefined) {
      const m2 = digits(body.matching_number_2);
      upd.matching_number_2 = m2.length === 10 ? m2 : null;
    }
    if (body.status !== undefined) {
      if (!CUSTOMER_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status.');
      upd.status = body.status;
      if (body.status === 'AVAILABLE') {
        upd.allocated_to = null;
        upd.allocated_at = null;
        upd.pulled_at = null;
      }
    }
    const { data, error } = await db().from('customers').update(upd).eq('id', body.id).select().maybeSingle();
    if (error) fail(error, 'Update failed');
    if (!data) throw new HttpError(404, 'Customer not found.');
    return { customer: data };
  },

  async 'delete-customer'({ body }, who) {
    if (!UUID_RE.test(String(body.id))) throw new HttpError(400, 'Invalid customer id.');
    const { data, error } = await db().from('customers').delete().eq('id', body.id).select('customer_number').maybeSingle();
    if (error) fail(error, 'Delete failed');
    if (!data) throw new HttpError(404, 'Customer not found.');
    await audit(who.sub, 'Admin', 'DELETE_CUSTOMER', `Deleted customer ${data.customer_number}`);
    return { ok: true };
  },

  // ---- template
  async 'save-template'({ body }, who) {
    const template = typeof body.template === 'string' ? body.template.slice(0, 5000) : '';
    if (!template.trim()) throw new HttpError(400, 'Template cannot be empty.');
    const existing = await getTemplate();
    const now = new Date().toISOString();
    const { error } = existing
      ? await db().from('message_templates').update({ template, updated_at: now }).eq('id', existing.id)
      : await db()
          .from('message_templates')
          .insert([{ name: 'Default Template', template, is_default: true, created_by: UUID_RE.test(who.sub) ? who.sub : null }]);
    if (error) fail(error, 'Template save failed');
    await audit(who.sub, 'Admin', 'UPDATE_TEMPLATE', 'Updated outreach message template');
    return { ok: true };
  },
};

// ---------------------------------------------------------------- entry
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body && typeof body === 'object' ? body : {};
    const action = String(body.action || '');
    const ctx: Ctx = { req, body };

    if (publicActions[action]) {
      return res.status(200).json(await publicActions[action](ctx));
    }
    if (authedActions[action]) {
      const who = requireAuth(req);
      return res.status(200).json(await authedActions[action](ctx, who));
    }
    if (adminActions[action]) {
      const who = requireAuth(req, 'admin');
      return res.status(200).json(await adminActions[action](ctx, who));
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Server error. Please try again.';
    if (!(err instanceof HttpError)) console.error('API error:', err);
    return res.status(status).json({ error: message });
  }
}

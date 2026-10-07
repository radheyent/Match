import {
  UserProfile,
  Customer,
  PullHistory,
  SendHistory,
  MessageTemplate,
  UploadHistory,
  AuditLog,
  AllocationResult,
} from '../types';
import { DEF_FMT, INITIAL_PROFILES, ADMIN_PROFILE_ID, LEGACY_ADMIN_PROFILE_ID } from './constants';
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEYS = {
  PROFILES: 'vi_profiles_v3',
  CUSTOMERS: 'vi_customers_v3',
  PULL_HISTORY: 'vi_pull_history_v3',
  SEND_HISTORY: 'vi_send_history_v3',
  TEMPLATES: 'vi_templates_v3',
  UPLOADS: 'vi_uploads_v3',
  AUDIT: 'vi_audit_v3',
  ACTIVE_USER_ID: 'vi_active_user_id_v3',
};

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function dbErrorText(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return 'Unknown database error.';
  return `${err.message || 'Database error'}${err.code ? ` (code ${err.code})` : ''}`;
}

class DataStore {
  private profiles: UserProfile[] = [];
  private customers: Customer[] = [];
  private pullHistory: PullHistory[] = [];
  private sendHistory: SendHistory[] = [];
  private templates: MessageTemplate[] = [];
  private uploadHistory: UploadHistory[] = [];
  private auditLogs: AuditLog[] = [];
  private activeUser: UserProfile | null = null;
  private listeners: Set<() => void> = new Set();
  private allocationLock: boolean = false;
  private isSyncing: boolean = false;

  constructor() {
    this.init();
    // Asynchronously sync with Supabase if configured
    this.syncWithSupabase();
  }

  private init() {
    try {
      // 1. Purge legacy demo storage keys to guarantee 100% production clean start
      try {
        localStorage.removeItem('vi_customers_v2');
        localStorage.removeItem('vi_profiles_v2');
      } catch {
        // ignore
      }

      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        const cleaned = parsed
          .map((p: UserProfile) =>
            p.id === LEGACY_ADMIN_PROFILE_ID ? { ...p, id: ADMIN_PROFILE_ID } : p
          )
          .filter(
          (p: UserProfile) =>
            !['ramesh@vi-outreach.com', 'priya@vi-outreach.com', 'ricky@vi-outreach.com'].includes(
              p.email
            )
        );
        if (!cleaned.some((p: UserProfile) => p.role === 'admin')) {
          cleaned.unshift(INITIAL_PROFILES[0]);
        }
        this.profiles = cleaned;
      } else {
        this.profiles = [...INITIAL_PROFILES];
      }

      // Purge any demo numbers completely
      const storedCust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (storedCust) {
        const parsedCust = JSON.parse(storedCust);
        this.customers = parsedCust.filter(
          (c: Customer) =>
            !c.id.startsWith('cust-10') &&
            !c.id.startsWith('cust-11') &&
            !c.id.startsWith('cust-12') &&
            !['9811223344', '9876543210', '8800112233', '9999888877', '7011223344'].includes(
              c.customer_number
            )
        );
      } else {
        this.customers = [];
      }

      const storedPull = localStorage.getItem(STORAGE_KEYS.PULL_HISTORY);
      this.pullHistory = storedPull ? JSON.parse(storedPull) : [];

      const storedSend = localStorage.getItem(STORAGE_KEYS.SEND_HISTORY);
      this.sendHistory = storedSend ? JSON.parse(storedSend) : [];

      const storedTemplates = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      this.templates = storedTemplates
        ? JSON.parse(storedTemplates)
        : [
            {
              id: 'tmpl-default',
              name: 'Vi Premium Default Template',
              template: DEF_FMT,
              is_default: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];

      const storedUploads = localStorage.getItem(STORAGE_KEYS.UPLOADS);
      this.uploadHistory = storedUploads ? JSON.parse(storedUploads) : [];

      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);
      this.auditLogs = storedAudit ? JSON.parse(storedAudit) : [];

      let activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
      if (activeId === LEGACY_ADMIN_PROFILE_ID) activeId = ADMIN_PROFILE_ID;
      this.activeUser = activeId ? this.profiles.find(p => p.id === activeId) || null : null;

      this.persistAll();
    } catch {
      this.profiles = [...INITIAL_PROFILES];
      this.customers = [];
      this.activeUser = null;
    }
  }

  // Sync with Supabase on boot and when credentials are saved
  public async syncWithSupabase() {
    const client = getSupabaseClient();
    if (!client || this.isSyncing) return;

    this.isSyncing = true;
    try {
      // 1. Profiles: Supabase is the source of truth (admin + users)
      await this.ensureAdminProfile(client);

      const { data: remoteProfiles, error: pErr } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (pErr) {
        console.error('Supabase profiles fetch failed:', dbErrorText(pErr));
      } else if (remoteProfiles && remoteProfiles.length > 0) {
        this.profiles = remoteProfiles as UserProfile[];

        // Keep the logged-in session aligned with the database copy
        if (this.activeUser) {
          const fresh = this.profiles.find(p => p.id === this.activeUser!.id);
          if (fresh && fresh.status === 'active') {
            this.activeUser = fresh;
          } else if (!fresh && this.activeUser.role === 'user') {
            this.activeUser = null;
          } else if (fresh && fresh.status !== 'active') {
            this.activeUser = null;
          }
        }
      }

      // 2. Fetch remote customers
      const { data: remoteCustomers, error: cErr } = await client
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!cErr && remoteCustomers) {
        this.customers = remoteCustomers as Customer[];
      }

      // 3. Fetch remote pull history
      const { data: remotePulls, error: hErr } = await client
        .from('pull_history')
        .select('*')
        .order('pulled_at', { ascending: false });

      if (!hErr && remotePulls) {
        this.pullHistory = remotePulls as PullHistory[];
      }

      // 4. Fetch remote template
      const { data: remoteTmpl, error: tErr } = await client
        .from('message_templates')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

      if (!tErr && remoteTmpl && remoteTmpl.template) {
        this.templates = [remoteTmpl as MessageTemplate];
      }

      this.persistAll();
    } catch (err) {
      console.warn('Supabase sync skipped/failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  // Make sure the master admin row exists in Supabase (insert-only, never overwrites edits)
  private async ensureAdminProfile(client: NonNullable<ReturnType<typeof getSupabaseClient>>) {
    try {
      const { error } = await client
        .from('profiles')
        .upsert([INITIAL_PROFILES[0]], { onConflict: 'email', ignoreDuplicates: true });
      if (error) {
        console.error('Supabase admin profile save failed:', dbErrorText(error));
      }
    } catch (err) {
      console.error('Supabase admin profile save error:', err);
    }
  }

  private persistAll() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(this.profiles));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(this.customers));
      localStorage.setItem(STORAGE_KEYS.PULL_HISTORY, JSON.stringify(this.pullHistory));
      localStorage.setItem(STORAGE_KEYS.SEND_HISTORY, JSON.stringify(this.sendHistory));
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(this.templates));
      localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(this.uploadHistory));
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(this.auditLogs));
      if (this.activeUser) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, this.activeUser.id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      }
    } catch {
      // storage limit or SSR
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore
      }
    }
  }

  // --- AUTH & PROFILES ---
  public getActiveUser(): UserProfile | null {
    return this.activeUser;
  }

  public setActiveUser(userId: string) {
    const user = this.profiles.find(p => p.id === userId);
    if (user) {
      this.activeUser = user;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, user.id);
      this.addAuditLog(user.id, user.name, 'USER_LOGIN', `User session active for ${user.name}`);
      this.notify();
    }
  }

  // User Login directly checking Supabase profiles table
  public async loginUser(identifier: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    const clean = identifier.trim().toLowerCase();
    if (!clean) {
      return { success: false, error: 'Please enter your username or email address.' };
    }

    const client = getSupabaseClient();
    if (client) {
      // Supabase is configured: it is the only source for agent logins (no local fallback)
      const safe = clean.replace(/[,()%*\\]/g, '');
      const { data: rows, error } = await client
        .from('profiles')
        .select('*')
        .or(`email.ilike.${safe},email.ilike.${safe}@*,name.ilike.${safe}`)
        .limit(20);

      if (error) {
        console.error('Supabase login lookup failed:', dbErrorText(error));
        return {
          success: false,
          error: `Supabase se connect nahi ho paya: ${dbErrorText(error)}`,
        };
      }

      const dbUser = (rows || []).find(
        (p: UserProfile) =>
          p.role === 'user' &&
          (p.email.toLowerCase() === clean ||
            p.name.toLowerCase() === clean ||
            p.email.split('@')[0].toLowerCase() === clean)
      ) as UserProfile | undefined;

      if (!dbUser) {
        return {
          success: false,
          error: 'Agent account not found. Please contact Administrator to create your login.',
        };
      }

      if (dbUser.status !== 'active') {
        return {
          success: false,
          error: 'Your account is currently disabled. Please contact Administrator.',
        };
      }

      const existingIdx = this.profiles.findIndex(p => p.id === dbUser.id);
      if (existingIdx !== -1) {
        this.profiles[existingIdx] = dbUser;
      } else {
        this.profiles.push(dbUser);
      }

      this.activeUser = dbUser;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, dbUser.id);
      this.addAuditLog(dbUser.id, dbUser.name, 'USER_LOGIN', `Agent ${dbUser.name} logged in via Supabase`);
      this.persistAll();
      return { success: true, user: dbUser };
    }

    // Fallback to local profile check
    const localUser = this.profiles.find(
      p =>
        p.role === 'user' &&
        (p.email.toLowerCase() === clean ||
          p.name.toLowerCase() === clean ||
          p.email.split('@')[0].toLowerCase() === clean)
    );

    if (!localUser) {
      return {
        success: false,
        error: 'Agent account not found. Please contact Administrator to create your login.',
      };
    }

    if (localUser.status !== 'active') {
      return {
        success: false,
        error: 'Your account is currently disabled. Please contact Administrator.',
      };
    }

    this.activeUser = localUser;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, localUser.id);
    this.addAuditLog(localUser.id, localUser.name, 'USER_LOGIN', `Agent ${localUser.name} logged in`);
    this.persistAll();
    return { success: true, user: localUser };
  }

  public logout() {
    if (this.activeUser) {
      this.addAuditLog(
        this.activeUser.id,
        this.activeUser.name,
        'USER_LOGOUT',
        `User ${this.activeUser.name} logged out`
      );
    }
    this.activeUser = null;
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
    this.persistAll();
  }

  public getProfiles(): UserProfile[] {
    return [...this.profiles];
  }

  // Delete User with Supabase deletion
  public async deleteProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    const user = this.profiles.find(p => p.id === userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }
    if (user.role === 'admin') {
      return { success: false, error: 'Cannot delete primary administrator profile.' };
    }

    const client = getSupabaseClient();
    if (client) {
      const { data: deleted, error } = await client
        .from('profiles')
        .delete()
        .eq('id', userId)
        .select();
      if (error) {
        return { success: false, error: `Supabase delete failed: ${dbErrorText(error)}` };
      }
      if (!deleted || deleted.length === 0) {
        return {
          success: false,
          error: 'Supabase ne koi row delete nahi ki (RLS policy ya id mismatch check karein).',
        };
      }
    }

    this.profiles = this.profiles.filter(p => p.id !== userId);
    if (this.activeUser?.id === userId) {
      this.activeUser = null;
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
    }

    this.addAuditLog(
      'admin',
      'Administrator',
      'DELETE_USER',
      `Deleted user account ${user.name} (${user.email})`
    );
    this.persistAll();
    return { success: true };
  }

  // Create User: saved in Supabase when configured (no silent local-only fallback)
  public async createProfile(
    data: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const email = data.email.trim();
    const name = data.name.trim();

    if (this.profiles.some(p => p.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: `User with email ${email} already exists.` };
    }

    const newProfile: UserProfile = {
      ...data,
      name,
      email,
      id: newUuid(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      const { data: inserted, error } = await client
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error || !inserted) {
        console.error('Supabase insert profile failed:', dbErrorText(error));
        return { success: false, error: `Supabase save failed: ${dbErrorText(error)}` };
      }

      this.profiles.push(inserted as UserProfile);
      this.addAuditLog(
        this.activeUser?.id || ADMIN_PROFILE_ID,
        this.activeUser?.name || 'Admin',
        'CREATE_USER',
        `Created user ${inserted.name} (${inserted.email}) in Supabase`
      );
      this.persistAll();
      return { success: true, profile: inserted as UserProfile };
    }

    // Supabase not configured: built-in local mode
    this.profiles.push(newProfile);
    this.addAuditLog(
      this.activeUser?.id || ADMIN_PROFILE_ID,
      this.activeUser?.name || 'Admin',
      'CREATE_USER',
      `Created user ${newProfile.name} (${newProfile.email})`
    );
    this.persistAll();
    return { success: true, profile: newProfile };
  }

  // Update User with Supabase update
  public async updateProfile(
    id: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, error: 'User not found.' };

    const updatedAt = new Date().toISOString();
    const updated = {
      ...this.profiles[idx],
      ...updates,
      updated_at: updatedAt,
    };

    const client = getSupabaseClient();
    if (client) {
      const { data: rows, error } = await client
        .from('profiles')
        .update({ ...updates, updated_at: updatedAt })
        .eq('id', id)
        .select();
      if (error) {
        return { success: false, error: `Supabase update failed: ${dbErrorText(error)}` };
      }
      if (!rows || rows.length === 0) {
        return {
          success: false,
          error: 'Supabase ne koi row update nahi ki (RLS policy ya id mismatch check karein).',
        };
      }
    }

    this.profiles[idx] = updated;
    if (this.activeUser?.id === id) {
      this.activeUser = updated;
    }
    this.addAuditLog(
      this.activeUser?.id || ADMIN_PROFILE_ID,
      this.activeUser?.name || 'Admin',
      'UPDATE_USER',
      `Updated user ${updated.name} limits or status`
    );
    this.persistAll();
    return { success: true, profile: updated };
  }

  // --- QUOTA & USER PULL STATS ---
  public getUserPullStats(userId: string): {
    pulledToday: number;
    remainingQuota: number;
    dailyLimit: number;
    perPullLimit: number;
    totalPulled: number;
  } {
    const user = this.profiles.find(p => p.id === userId);
    const dailyLimit = user?.daily_pull_limit ?? 100;
    const perPullLimit = user?.per_pull_limit ?? 20;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const userPulls = this.pullHistory.filter(p => p.user_id === userId);
    const totalPulled = userPulls.length;

    const pulledToday = userPulls.filter(p => {
      const pDate = new Date(p.pulled_at);
      return pDate >= startOfToday;
    }).length;

    const remainingQuota = Math.max(0, dailyLimit - pulledToday);

    return {
      pulledToday,
      remainingQuota,
      dailyLimit,
      perPullLimit,
      totalPulled,
    };
  }

  // --- ATOMIC ALLOCATION (DATABASE LEVEL CONCURRENCY PROTECTION) ---
  public async allocateCustomers(
    userId: string,
    requestedCount: number = 1,
    source: string = 'MATCHING_SEND'
  ): Promise<AllocationResult> {
    const client = getSupabaseClient();

    // 1. If Supabase is configured with custom RPC, attempt it first
    if (client) {
      try {
        const { data, error } = await client.rpc('allocate_customers', {
          p_user_id: userId,
          p_requested_count: requestedCount,
          p_source: source,
        });

        if (!error && data && Array.isArray(data) && data.length > 0) {
          const allocatedFromRpc = data as Customer[];
          // Sync with local memory
          await this.syncWithSupabase();
          return { success: true, customers: allocatedFromRpc };
        }
      } catch (err: any) {
        console.warn('Supabase RPC fallback to direct allocation:', err);
      }
    }

    // 2. Built-in Atomic Implementation with concurrency locking
    while (this.allocationLock) {
      await new Promise(res => setTimeout(res, 20));
    }

    this.allocationLock = true;
    try {
      const user = this.profiles.find(p => p.id === userId);
      if (!user) {
        return { success: false, customers: [], error: 'User profile not found.' };
      }

      if (user.status !== 'active') {
        return {
          success: false,
          customers: [],
          error: 'Your account is disabled. Please contact the administrator.',
        };
      }

      const { pulledToday, remainingQuota, perPullLimit } = this.getUserPullStats(userId);

      if (remainingQuota <= 0) {
        return {
          success: false,
          customers: [],
          error: `Your daily customer limit (${user.daily_pull_limit}) has been reached.`,
        };
      }

      if (requestedCount > perPullLimit) {
        return {
          success: false,
          customers: [],
          error: `You can pull maximum ${perPullLimit} customers at a time.`,
        };
      }

      const actualLimit = Math.min(requestedCount, remainingQuota);

      // Lock available customers
      const availableIndexes: number[] = [];
      for (let i = 0; i < this.customers.length; i++) {
        if (this.customers[i].status === 'AVAILABLE') {
          availableIndexes.push(i);
          if (availableIndexes.length >= actualLimit) break;
        }
      }

      if (availableIndexes.length === 0) {
        return {
          success: false,
          customers: [],
          error: 'No new customer is currently available in the system. Please request Admin to upload fresh data.',
        };
      }

      const allocatedList: Customer[] = [];
      const now = new Date().toISOString();

      for (const idx of availableIndexes) {
        const cust = this.customers[idx];
        cust.status = 'PULLED';
        cust.allocated_to = user.id;
        cust.allocated_to_name = user.name;
        cust.allocated_at = now;
        cust.pulled_at = now;
        cust.updated_at = now;

        allocatedList.push({ ...cust });

        // Update in Supabase if connected
        if (client) {
          try {
            client
              .from('customers')
              .update({
                status: 'PULLED',
                allocated_to: user.id,
                allocated_at: now,
                pulled_at: now,
              })
              .eq('id', cust.id)
              .then();
          } catch {
            // ignore
          }
        }

        const pullHistoryItem: PullHistory = {
          id: `pull-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer_id: cust.id,
          customer_number: cust.customer_number,
          customer_name: cust.customer_name,
          matching_number: cust.matching_number,
          matching_number_2: cust.matching_number_2,
          user_id: user.id,
          user_name: user.name,
          action: 'PULLED',
          source,
          pulled_at: now,
        };

        this.pullHistory.unshift(pullHistoryItem);

        if (client) {
          try {
            client.from('pull_history').insert([pullHistoryItem]).then();
          } catch {
            // ignore
          }
        }
      }

      this.addAuditLog(
        user.id,
        user.name,
        'CUSTOMER_PULL',
        `Pulled ${allocatedList.length} customer(s) via ${source}`
      );

      this.persistAll();
      return {
        success: true,
        customers: allocatedList,
        quotaRemaining: remainingQuota - allocatedList.length,
      };
    } finally {
      this.allocationLock = false;
    }
  }

  // --- RECENT USER DATA ---
  public getUserRecentPulled(userId: string, limit: number = 30): Customer[] {
    return this.customers
      .filter(c => c.allocated_to === userId && c.status === 'PULLED')
      .sort((a, b) => new Date(b.pulled_at || 0).getTime() - new Date(a.pulled_at || 0).getTime())
      .slice(0, limit);
  }

  // Last lot = all numbers pulled together in the user's most recent pull.
  // Stays the same until the user pulls new data.
  public getUserLastLot(userId: string): Customer[] {
    const mine = this.customers.filter(
      c => c.allocated_to === userId && c.status === 'PULLED' && c.pulled_at
    );
    if (mine.length === 0) return [];
    const latest = Math.max(...mine.map(c => new Date(c.pulled_at as string).getTime()));
    return mine.filter(c => new Date(c.pulled_at as string).getTime() === latest);
  }

  // Customers this user has already sent (WhatsApp / RCS) - used to hide the send buttons
  public getSentCustomerIds(userId: string): Set<string> {
    const ids = new Set<string>();
    for (const rec of this.sendHistory) {
      if (rec.user_id === userId && rec.customer_id) ids.add(rec.customer_id);
    }
    return ids;
  }

  // --- CUSTOMER DATA MANAGEMENT ---
  public getAllCustomers(): Customer[] {
    return [...this.customers];
  }

  public getCustomerCounts(): {
    total: number;
    available: number;
    pulled: number;
    used: number;
    disabled: number;
  } {
    let available = 0,
      pulled = 0,
      used = 0,
      disabled = 0;
    for (const c of this.customers) {
      if (c.status === 'AVAILABLE') available++;
      else if (c.status === 'PULLED' || c.status === 'ALLOCATED') pulled++;
      else if (c.status === 'USED') used++;
      else if (c.status === 'DISABLED') disabled++;
    }
    return {
      total: this.customers.length,
      available,
      pulled,
      used,
      disabled,
    };
  }

  public async addCustomer(
    data: Omit<Customer, 'id' | 'status' | 'created_at' | 'uploaded_at'>
  ): Promise<{ success: boolean; error?: string; customer?: Customer }> {
    const cleanNum = data.customer_number.replace(/\D/g, '');
    if (cleanNum.length !== 10) {
      return { success: false, error: 'Customer number must be exactly 10 digits.' };
    }
    const cleanMatch = data.matching_number.replace(/\D/g, '');
    if (cleanMatch.length !== 10) {
      return { success: false, error: 'Matching number must be exactly 10 digits.' };
    }

    if (this.customers.some(c => c.customer_number === cleanNum)) {
      return { success: false, error: `Customer number ${cleanNum} already exists in database.` };
    }

    const newCust: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customer_number: cleanNum,
      customer_name: data.customer_name?.trim() || undefined,
      matching_number: cleanMatch,
      matching_number_2: data.matching_number_2
        ? data.matching_number_2.replace(/\D/g, '')
        : undefined,
      status: 'AVAILABLE',
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('customers').insert([newCust]);
      } catch (err) {
        console.warn('Supabase insert customer error:', err);
      }
    }

    this.customers.unshift(newCust);
    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'ADD_CUSTOMER',
      `Added customer ${cleanNum}`
    );
    this.persistAll();
    return { success: true, customer: newCust };
  }

  public async updateCustomer(id: string, updates: Partial<Customer>): Promise<boolean> {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) return false;

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('customers').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase update customer error:', err);
      }
    }

    this.customers[idx] = {
      ...this.customers[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persistAll();
    return true;
  }

  public async deleteCustomer(id: string): Promise<boolean> {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const removed = this.customers.splice(idx, 1)[0];

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('customers').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete customer error:', err);
      }
    }

    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'DELETE_CUSTOMER',
      `Deleted customer ${removed.customer_number} (${removed.customer_name || 'No Name'})`
    );
    this.persistAll();
    return true;
  }

  // --- EXCEL / CSV BULK IMPORT TO SUPABASE & LOCAL STORE ---
  public async importBulkData(
    filename: string,
    rows: Array<{
      customer_number: string;
      matching_number: string;
      matching_number_2?: string;
      customer_name?: string;
    }>
  ): Promise<{
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
    newRows: number;
    addedCustomers: Customer[];
  }> {
    let duplicate = 0;
    let invalid = 0;
    const existingSet = new Set(this.customers.map(c => c.customer_number));
    const newlyAdded: Customer[] = [];
    const now = new Date().toISOString();

    for (const r of rows) {
      const cNum = (r.customer_number || '').toString().replace(/\D/g, '');
      const m1 = (r.matching_number || '').toString().replace(/\D/g, '');
      const m2 = r.matching_number_2 ? r.matching_number_2.toString().replace(/\D/g, '') : '';
      const name = (r.customer_name || '').toString().trim();

      if (cNum.length !== 10 || m1.length !== 10) {
        invalid++;
        continue;
      }

      if (existingSet.has(cNum)) {
        duplicate++;
        continue;
      }

      existingSet.add(cNum);
      const newC: Customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customer_number: cNum,
        customer_name: name || undefined,
        matching_number: m1,
        matching_number_2: m2 && m2.length === 10 ? m2 : undefined,
        status: 'AVAILABLE',
        uploaded_at: now,
        created_at: now,
      };

      this.customers.unshift(newC);
      newlyAdded.push(newC);
    }

    // Insert into Supabase in batches
    const client = getSupabaseClient();
    if (client && newlyAdded.length > 0) {
      try {
        const batchSize = 100;
        for (let i = 0; i < newlyAdded.length; i += batchSize) {
          const slice = newlyAdded.slice(i, i + batchSize);
          await client.from('customers').insert(slice);
        }
      } catch (err) {
        console.warn('Supabase bulk insert error:', err);
      }
    }

    const uploadRecord: UploadHistory = {
      id: `up-${Date.now()}`,
      uploaded_by: this.activeUser?.id || 'admin',
      uploaded_by_name: this.activeUser?.name || 'Admin',
      filename,
      total_rows: rows.length,
      valid_rows: rows.length - invalid,
      duplicate_rows: duplicate,
      invalid_rows: invalid,
      new_rows: newlyAdded.length,
      created_at: now,
    };

    this.uploadHistory.unshift(uploadRecord);

    if (client) {
      try {
        client.from('upload_history').insert([uploadRecord]).then();
      } catch {
        // ignore
      }
    }

    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'EXCEL_UPLOAD',
      `Imported ${newlyAdded.length} new records from ${filename} (${duplicate} duplicates, ${invalid} invalid)`
    );

    this.persistAll();
    return {
      total: rows.length,
      valid: rows.length - invalid,
      duplicate,
      invalid,
      newRows: newlyAdded.length,
      addedCustomers: newlyAdded,
    };
  }

  // --- MESSAGE TEMPLATES ---
  public getActiveTemplate(): string {
    const def = this.templates.find(t => t.is_default);
    return def ? def.template : DEF_FMT;
  }

  public async saveTemplate(newTemplate: string): Promise<boolean> {
    const def = this.templates.find(t => t.is_default);
    if (def) {
      def.template = newTemplate;
      def.updated_at = new Date().toISOString();
    } else {
      this.templates.push({
        id: `tmpl-${Date.now()}`,
        name: 'Default Template',
        template: newTemplate,
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('message_templates').upsert({
          name: 'Default Template',
          template: newTemplate,
          is_default: true,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    }

    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'UPDATE_TEMPLATE',
      'Updated outreach message template'
    );
    this.persistAll();
    return true;
  }

  public resetTemplate(): string {
    const def = this.templates.find(t => t.is_default);
    if (def) {
      def.template = DEF_FMT;
      def.updated_at = new Date().toISOString();
    }
    this.persistAll();
    return DEF_FMT;
  }

  // --- SEND HISTORY ---
  public recordSend(data: {
    customer_number: string;
    customer_id?: string;
    channel: 'wa' | 'rcs' | 'sms';
    message: string;
  }) {
    const user = this.activeUser;
    const sendRecord: SendHistory = {
      id: `snd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customer_id: data.customer_id,
      customer_number: data.customer_number,
      user_id: user?.id || 'guest',
      user_name: user?.name || 'Agent',
      channel: data.channel,
      message: data.message,
      sent_at: new Date().toISOString(),
      status: 'OPENED',
    };
    this.sendHistory.unshift(sendRecord);

    const client = getSupabaseClient();
    if (client) {
      try {
        client.from('send_history').insert([sendRecord]).then();
      } catch {
        // ignore
      }
    }

    this.persistAll();
  }

  public getSendHistory(): SendHistory[] {
    return [...this.sendHistory];
  }

  public getPullHistory(): PullHistory[] {
    return [...this.pullHistory];
  }

  public getUploadHistory(): UploadHistory[] {
    return [...this.uploadHistory];
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  private addAuditLog(userId: string, userName: string, action: string, details: string) {
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      user_id: userId,
      user_name: userName,
      action,
      details,
      created_at: new Date().toISOString(),
    });
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  public resetToCleanProduction() {
    this.profiles = [...INITIAL_PROFILES];
    this.customers = [];
    this.pullHistory = [];
    this.sendHistory = [];
    this.templates = [
      {
        id: 'tmpl-default',
        name: 'Vi Premium Default Template',
        template: DEF_FMT,
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    this.activeUser = null;
    this.persistAll();
  }
}

export const dataStore = new DataStore();

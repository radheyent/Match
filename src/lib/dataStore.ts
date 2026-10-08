import {
  UserProfile,
  Customer,
  PullHistory,
  SendHistory,
  UploadHistory,
  AuditLog,
  AllocationResult,
  PullLot,
} from '../types';
import { DEF_FMT, DEFAULT_REPLY_NUMBER } from './constants';
import { api, ApiError, loadSession, saveSession, clearSession } from './api';

// Everything (profiles, customers, pulls, uploads, template, audit) is stored in Supabase and
// reached ONLY through the secure server (/api/app). This store is just an in-memory view of it.
// Only the "sent" list is kept in this browser (as requested).
const SEND_HISTORY_KEY = 'vi_send_history_v3';
const DEFAULT_TZ_OFFSET = 330; // IST, overridden by the server value

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : 'Unexpected error.';
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const asHistory = (rows: any[]): PullHistory[] =>
  (rows || []).map(r => ({ ...r, customer_id: r.customer_id || '' }));

class DataStore {
  private profiles: UserProfile[] = [];
  private customers: Customer[] = [];
  private pullHistory: PullHistory[] = [];
  private sendHistory: SendHistory[] = [];
  private uploadHistory: UploadHistory[] = [];
  private auditLogs: AuditLog[] = [];
  private template: string = '';
  private activeUser: UserProfile | null = null;
  private tzOffsetMinutes: number = DEFAULT_TZ_OFFSET;
  private listeners: Set<() => void> = new Set();
  private syncPromise: Promise<{ customersLoaded: number | null; errors: string[] }> | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(SEND_HISTORY_KEY);
      this.sendHistory = raw ? JSON.parse(raw) : [];
    } catch {
      this.sendHistory = [];
    }

    const session = loadSession();
    if (session) {
      this.activeUser = session.profile;
      this.profiles = [session.profile];
      if (session.tzOffsetMinutes !== undefined) this.tzOffsetMinutes = session.tzOffsetMinutes;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('match-session-expired', () => this.resetState());
    }

    // Fresh data from the server (also validates the session); guests only need the template
    if (session) void this.syncWithSupabase(session.role === 'admin');
    else void this.loadPublicTemplate();
  }

  // ------------------------------------------------------------ plumbing
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (err) {
        console.warn('Listener error:', err);
      }
    });
  }

  private persistSend() {
    try {
      localStorage.setItem(SEND_HISTORY_KEY, JSON.stringify(this.sendHistory.slice(0, 5000)));
    } catch {
      // storage full / unavailable
    }
  }

  private resetState() {
    this.activeUser = null;
    this.profiles = [];
    this.customers = [];
    this.pullHistory = [];
    this.uploadHistory = [];
    this.auditLogs = [];
    this.notify();
  }

  private async loadPublicTemplate() {
    try {
      const r = await api<{ template: string | null }>('template');
      if (r.template) {
        this.template = r.template;
        this.notify();
      }
    } catch {
      // guests simply use the built-in default
    }
  }

  // ------------------------------------------------------------ sync (server -> memory)
  public syncWithSupabase(
    _includeCustomers: boolean = false
  ): Promise<{ customersLoaded: number | null; errors: string[] }> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async doSync(): Promise<{ customersLoaded: number | null; errors: string[] }> {
    const errors: string[] = [];
    let customersLoaded: number | null = null;
    const session = loadSession();
    if (!session) {
      await this.loadPublicTemplate();
      return { customersLoaded, errors };
    }

    try {
      const me = await api<any>('me');
      this.activeUser = me.profile;
      if (typeof me.tzOffsetMinutes === 'number') this.tzOffsetMinutes = me.tzOffsetMinutes;
      if (me.template?.template) this.template = me.template.template;
      saveSession(session.token, me.profile, this.tzOffsetMinutes);

      if (me.profile.role === 'user') {
        this.profiles = [me.profile];
        this.pullHistory = asHistory(me.history);
      } else {
        const ov = await api<any>('admin-overview');
        this.profiles = ov.profiles;
        const names = new Map<string, string>(ov.profiles.map((p: UserProfile) => [p.id, p.name]));
        this.uploadHistory = (ov.uploads || []).map((u: any) => ({
          ...u,
          uploaded_by_name: names.get(u.uploaded_by) || 'Admin',
        }));
        this.auditLogs = ov.audits || [];
        if (ov.template?.template) this.template = ov.template.template;

        try {
          this.pullHistory = await this.fetchAllPages('pull-history-page', 30, asHistory);
        } catch (e) {
          errors.push(`Pull history: ${errMsg(e)}`);
        }
        try {
          customersLoaded = await this.loadCustomers();
        } catch (e) {
          errors.push(`Customers: ${errMsg(e)}`);
        }
      }
    } catch (e) {
      errors.push(errMsg(e));
    }

    this.notify();
    return { customersLoaded, errors };
  }

  private async fetchAllPages<T>(action: string, maxPages: number, map: (rows: any[]) => T[]): Promise<T[]> {
    const all: T[] = [];
    for (let page = 0; page < maxPages; page++) {
      const res = await api<{ rows: any[]; more: boolean }>(action, { offset: page * 1000 });
      all.push(...map(res.rows));
      if (!res.more) break;
    }
    return all;
  }

  private async loadCustomers(): Promise<number> {
    const names = new Map(this.profiles.map(p => [p.id, p.name]));
    this.customers = await this.fetchAllPages<Customer>('customers-page', 300, rows =>
      rows.map(c => ({
        ...c,
        allocated_to: c.allocated_to || undefined,
        allocated_to_name: c.allocated_to ? names.get(c.allocated_to) : undefined,
      }))
    );
    return this.customers.length;
  }

  // ------------------------------------------------------------ session
  public getActiveUser(): UserProfile | null {
    return this.activeUser;
  }

  public async loginUser(identifier: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    try {
      const r = await api<any>('agent-login', { identifier });
      saveSession(r.token, r.profile, r.tzOffsetMinutes);
      if (typeof r.tzOffsetMinutes === 'number') this.tzOffsetMinutes = r.tzOffsetMinutes;
      this.activeUser = r.profile;
      this.profiles = [r.profile];
      this.customers = [];
      await this.syncWithSupabase();
      return { success: true, user: this.activeUser || r.profile };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public async loginAdmin(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const r = await api<any>('admin-login', { password });
      saveSession(r.token, r.profile, r.tzOffsetMinutes);
      if (typeof r.tzOffsetMinutes === 'number') this.tzOffsetMinutes = r.tzOffsetMinutes;
      this.activeUser = r.profile;
      this.profiles = [r.profile];
      this.pullHistory = [];
      await this.syncWithSupabase(true);
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public logout() {
    clearSession();
    this.resetState();
  }

  // ------------------------------------------------------------ users (admin)
  public getProfiles(): UserProfile[] {
    return [...this.profiles];
  }

  public async createProfile(
    data: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    try {
      const r = await api<{ profile: UserProfile }>('create-profile', data as any);
      this.profiles.push(r.profile);
      this.notify();
      return { success: true, profile: r.profile };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public async updateProfile(
    id: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    try {
      const r = await api<{ profile: UserProfile }>('update-profile', { id, ...updates });
      const idx = this.profiles.findIndex(p => p.id === id);
      if (idx !== -1) this.profiles[idx] = r.profile;
      this.notify();
      return { success: true, profile: r.profile };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public async deleteProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await api('delete-profile', { id: userId });
      this.profiles = this.profiles.filter(p => p.id !== userId);
      this.pullHistory = this.pullHistory.filter(h => h.user_id !== userId);
      this.notify();
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  // ------------------------------------------------------------ pull quota / stats
  private startOfTodayMs(): number {
    const off = this.tzOffsetMinutes * 60000;
    return Math.floor((Date.now() + off) / 86400000) * 86400000 - off;
  }

  public getUserPullStats(userId: string): {
    pulledToday: number;
    remainingQuota: number;
    dailyLimit: number;
    perPullLimit: number;
    totalPulled: number;
  } {
    const user = this.profiles.find(p => p.id === userId) || (this.activeUser?.id === userId ? this.activeUser : null);
    const dailyLimit = user?.daily_pull_limit ?? 100;
    const perPullLimit = user?.per_pull_limit ?? 20;
    const start = this.startOfTodayMs();
    const mine = this.pullHistory.filter(p => p.user_id === userId);
    const pulledToday = mine.filter(p => new Date(p.pulled_at).getTime() >= start).length;
    return {
      pulledToday,
      remainingQuota: Math.max(0, dailyLimit - pulledToday),
      dailyLimit,
      perPullLimit,
      totalPulled: mine.length,
    };
  }

  // ------------------------------------------------------------ pull (atomic, in the database)
  public async allocateCustomers(
    userId: string,
    requestedCount: number = 1,
    source: string = 'MATCHING_SEND'
  ): Promise<AllocationResult> {
    try {
      const r = await api<{ customers: any[]; history: any[] }>('pull', { count: requestedCount, source });
      const user = this.profiles.find(p => p.id === userId);

      const fresh = asHistory(r.history);
      const freshIds = new Set(fresh.map(h => h.id));
      this.pullHistory = [...fresh, ...this.pullHistory.filter(h => !freshIds.has(h.id))].sort(
        (a, b) => new Date(b.pulled_at).getTime() - new Date(a.pulled_at).getTime()
      );

      try {
        localStorage.removeItem(`vi_recent_lot_${userId}`);
      } catch {
        // ignore
      }

      const customers: Customer[] = r.customers.map(c => ({
        id: c.out_id,
        customer_number: c.out_customer_number,
        customer_name: c.out_customer_name || undefined,
        matching_number: c.out_matching_number,
        matching_number_2: c.out_matching_number_2 || undefined,
        status: 'PULLED',
        allocated_to: userId,
        allocated_to_name: user?.name,
        pulled_at: c.out_pulled_at,
        uploaded_at: c.out_pulled_at,
        created_at: c.out_pulled_at,
      }));

      this.notify();
      return { success: true, customers, quotaRemaining: this.getUserPullStats(userId).remainingQuota };
    } catch (e) {
      return { success: false, customers: [], error: errMsg(e) };
    }
  }

  // ------------------------------------------------------------ pull lots (bunches)
  // Pull history grouped into bunches: numbers pulled together in one pull. Newest first.
  public getUserPullLots(userId: string, maxLots: number = 5): PullLot[] {
    const mine = this.pullHistory
      .filter(h => h.user_id === userId)
      .sort((a, b) => new Date(b.pulled_at).getTime() - new Date(a.pulled_at).getTime());

    const lots: PullLot[] = [];
    const byKey = new Map<string, PullLot>();
    for (const item of mine) {
      const lotId = (item.metadata as { lot_id?: string } | undefined)?.lot_id;
      const key = lotId || `t-${new Date(item.pulled_at).getTime()}`;
      let lot = byKey.get(key);
      if (!lot) {
        lot = { key, pulled_at: item.pulled_at, items: [] };
        byKey.set(key, lot);
        lots.push(lot);
      }
      lot.items.push(item);
    }
    return lots.slice(0, maxLots);
  }

  // "Recent Pulled Data": the latest bunch, unless the user chose an older one from History.
  public getRecentLot(userId: string): PullLot | null {
    const lots = this.getUserPullLots(userId, 1000);
    if (lots.length === 0) return null;
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem(`vi_recent_lot_${userId}`);
    } catch {
      chosen = null;
    }
    return (chosen && lots.find(l => l.key === chosen)) || lots[0];
  }

  public setRecentLot(userId: string, lotKey: string | null) {
    try {
      if (lotKey) localStorage.setItem(`vi_recent_lot_${userId}`, lotKey);
      else localStorage.removeItem(`vi_recent_lot_${userId}`);
    } catch {
      // ignore
    }
    this.notify();
  }

  public getSentNumbers(userId: string): Set<string> {
    const nums = new Set<string>();
    for (const rec of this.sendHistory) {
      if (rec.user_id === userId) nums.add(rec.customer_number);
    }
    return nums;
  }

  // ------------------------------------------------------------ customers (admin)
  public getAllCustomers(): Customer[] {
    return [...this.customers];
  }

  public getCustomerCounts(): { total: number; available: number; pulled: number; used: number; disabled: number } {
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
    return { total: this.customers.length, available, pulled, used, disabled };
  }

  public async addCustomer(
    data: Omit<Customer, 'id' | 'status' | 'created_at' | 'uploaded_at'>
  ): Promise<{ success: boolean; error?: string; customer?: Customer }> {
    try {
      const r = await api<{ customer: Customer }>('add-customer', data as any);
      this.customers.unshift(r.customer);
      this.notify();
      return { success: true, customer: r.customer };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public async updateCustomer(id: string, updates: Partial<Customer>): Promise<boolean> {
    try {
      const r = await api<{ customer: Customer }>('update-customer', {
        id,
        customer_name: updates.customer_name,
        matching_number: updates.matching_number,
        matching_number_2: updates.matching_number_2 ?? '',
        status: updates.status,
      });
      const idx = this.customers.findIndex(c => c.id === id);
      if (idx !== -1) {
        const names = new Map(this.profiles.map(p => [p.id, p.name]));
        this.customers[idx] = {
          ...r.customer,
          allocated_to: r.customer.allocated_to || undefined,
          allocated_to_name: r.customer.allocated_to ? names.get(r.customer.allocated_to) : undefined,
        };
      }
      this.notify();
      return true;
    } catch (e) {
      console.error('Update customer failed:', errMsg(e));
      return false;
    }
  }

  public async deleteCustomer(id: string): Promise<boolean> {
    try {
      await api('delete-customer', { id });
      this.customers = this.customers.filter(c => c.id !== id);
      this.notify();
      return true;
    } catch (e) {
      console.error('Delete customer failed:', errMsg(e));
      return false;
    }
  }

  // Excel / CSV upload: sent to the server in chunks and saved in Supabase
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
    failed: number;
    error?: string;
    addedCustomers: Customer[];
  }> {
    const base = new Date().toISOString();
    const chunkSize = 1000;
    let inserted = 0;
    let duplicate = 0;
    let invalid = 0;
    let processed = 0;
    let error: string | undefined;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      try {
        const r = await api<{ inserted: number; duplicate: number; invalid: number }>('import-chunk', {
          rows: slice,
          base,
          startIndex: i,
        });
        inserted += r.inserted;
        duplicate += r.duplicate;
        invalid += r.invalid;
        processed += slice.length;
      } catch (e) {
        error = `Upload failed: ${errMsg(e)}`;
        break;
      }
    }

    const valid = rows.length - invalid;
    try {
      await api('record-upload', {
        filename,
        total: rows.length,
        valid,
        duplicate,
        invalid,
        newRows: inserted,
      });
    } catch (e) {
      console.error('Upload history save failed:', errMsg(e));
    }

    // Show exactly what is in Supabase now
    await this.syncWithSupabase(true);

    return {
      total: rows.length,
      valid,
      duplicate,
      invalid,
      newRows: inserted,
      failed: rows.length - processed,
      error,
      addedCustomers: [],
    };
  }

  // ------------------------------------------------------------ template
  // The template for the logged-in agent: the default reply number is swapped for the agent's own
  public getActiveTemplate(): string {
    const base = this.template || DEF_FMT;
    const mine = this.activeUser?.role === 'user' ? this.activeUser.reply_number : null;
    return mine ? base.split(DEFAULT_REPLY_NUMBER).join(mine) : base;
  }

  public getReplyNumber(): string {
    return (this.activeUser?.role === 'user' && this.activeUser.reply_number) || DEFAULT_REPLY_NUMBER;
  }

  // Saved in Supabase on the agent's profile (empty string = use the default number again)
  public async setReplyNumber(number: string): Promise<{ success: boolean; error?: string }> {
    try {
      const r = await api<{ profile: UserProfile }>('set-reply-number', { number });
      this.activeUser = r.profile;
      this.profiles = this.profiles.map(p => (p.id === r.profile.id ? r.profile : p));
      const s = loadSession();
      if (s) saveSession(s.token, r.profile, this.tzOffsetMinutes);
      this.notify();
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }

  public async saveTemplate(newTemplate: string): Promise<boolean> {
    try {
      await api('save-template', { template: newTemplate });
      this.template = newTemplate;
      this.notify();
      return true;
    } catch (e) {
      console.error('Template save failed:', errMsg(e));
      return false;
    }
  }

  public resetTemplate(): string {
    this.template = DEF_FMT;
    this.notify();
    return DEF_FMT;
  }

  // ------------------------------------------------------------ send history (this browser only)
  public recordSend(data: {
    customer_number: string;
    customer_id?: string;
    channel: 'wa' | 'rcs' | 'sms';
    message: string;
  }) {
    const user = this.activeUser;
    const rec: SendHistory = {
      id: newUuid(),
      customer_id: data.customer_id,
      customer_number: data.customer_number,
      user_id: user?.id || 'guest',
      user_name: user?.name || 'Agent',
      channel: data.channel,
      message: data.message,
      sent_at: new Date().toISOString(),
      status: 'OPENED',
    };
    this.sendHistory.unshift(rec);
    this.persistSend();
    this.notify();
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
}

export const dataStore = new DataStore();

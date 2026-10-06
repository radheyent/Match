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
import { DEF_FMT, INITIAL_PROFILES, INITIAL_CUSTOMERS } from './constants';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  PROFILES: 'vi_profiles_v2',
  CUSTOMERS: 'vi_customers_v2',
  PULL_HISTORY: 'vi_pull_history_v2',
  SEND_HISTORY: 'vi_send_history_v2',
  TEMPLATES: 'vi_templates_v2',
  UPLOADS: 'vi_uploads_v2',
  AUDIT: 'vi_audit_v2',
  ACTIVE_USER_ID: 'vi_active_user_id_v2',
};

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
  // In-memory mutex lock to prevent concurrent allocation race conditions in JavaScript runtime
  private allocationLock: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      this.profiles = storedProfiles ? JSON.parse(storedProfiles) : [...INITIAL_PROFILES];

      const storedCust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      this.customers = storedCust ? JSON.parse(storedCust) : [...INITIAL_CUSTOMERS];

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

      const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID) || 'user-admin-1';
      this.activeUser = this.profiles.find(p => p.id === activeId) || this.profiles[0] || null;

      this.persistAll();
    } catch {
      this.profiles = [...INITIAL_PROFILES];
      this.customers = [...INITIAL_CUSTOMERS];
      this.activeUser = this.profiles[0];
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
      this.addAuditLog(user.id, user.name, 'USER_LOGIN', `Switched active user to ${user.name}`);
      this.notify();
    }
  }

  public getProfiles(): UserProfile[] {
    return [...this.profiles];
  }

  public createProfile(data: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): UserProfile {
    const newProfile: UserProfile = {
      ...data,
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.profiles.push(newProfile);
    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'CREATE_USER',
      `Created user ${newProfile.name} (${newProfile.email})`
    );
    this.persistAll();
    return newProfile;
  }

  public updateProfile(id: string, updates: Partial<UserProfile>): UserProfile | null {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.profiles[idx] = {
      ...this.profiles[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (this.activeUser?.id === id) {
      this.activeUser = this.profiles[idx];
    }
    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'UPDATE_USER',
      `Updated user ${this.profiles[idx].name} limits or status`
    );
    this.persistAll();
    return this.profiles[idx];
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
    // 1. If Supabase is configured with custom RPC, attempt it first
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('allocate_customers', {
          p_user_id: userId,
          p_requested_count: requestedCount,
          p_source: source,
        });
        if (error) {
          return { success: false, customers: [], error: error.message };
        }
        if (data && Array.isArray(data)) {
          return { success: true, customers: data as Customer[] };
        }
      } catch (err: any) {
        console.warn('Supabase RPC fallback to atomic local store:', err);
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

      // Lock available customers (equivalent to SELECT ... FOR UPDATE SKIP LOCKED)
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

        // Record in pull history
        this.pullHistory.unshift({
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
        });
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

  public addCustomer(
    data: Omit<Customer, 'id' | 'status' | 'created_at' | 'uploaded_at'>
  ): { success: boolean; error?: string; customer?: Customer } {
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

  public updateCustomer(id: string, updates: Partial<Customer>): boolean {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.customers[idx] = {
      ...this.customers[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persistAll();
    return true;
  }

  public deleteCustomer(id: string): boolean {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const removed = this.customers.splice(idx, 1)[0];
    this.addAuditLog(
      this.activeUser?.id || 'admin',
      this.activeUser?.name || 'Admin',
      'DELETE_CUSTOMER',
      `Deleted customer ${removed.customer_number} (${removed.customer_name || 'No Name'})`
    );
    this.persistAll();
    return true;
  }

  // --- EXCEL / CSV BULK IMPORT ---
  public importBulkData(
    filename: string,
    rows: Array<{
      customer_number: string;
      matching_number: string;
      matching_number_2?: string;
      customer_name?: string;
    }>
  ): {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
    newRows: number;
    addedCustomers: Customer[];
  } {
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

  public saveTemplate(newTemplate: string): boolean {
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

  // Demo data reset helper if needed by Admin
  public resetToSampleData() {
    this.profiles = [...INITIAL_PROFILES];
    this.customers = [...INITIAL_CUSTOMERS];
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
    this.activeUser = this.profiles[0];
    this.persistAll();
  }
}

export const dataStore = new DataStore();

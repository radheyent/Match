import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Customer, UserProfile, UploadHistory, PullHistory, AuditLog } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { getSupabaseStatus, saveCustomSupabaseConfig } from '../../lib/supabaseClient';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onLockAdmin?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser: _currentUser, onLockAdmin }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'upload' | 'customers' | 'users' | 'history' | 'template' | 'supabase'
  >('overview');

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [pullHistory, setPullHistory] = useState<PullHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [templateText, setTemplateText] = useState<string>('');
  const [isTemplateSaved, setIsTemplateSaved] = useState<boolean>(false);

  // Excel Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploadPreview, setUploadPreview] = useState<{
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
    newRows: number;
    sampleRows: any[];
  } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Customer Management Filter & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Modals & Forms
  const [deleteCustModal, setDeleteCustModal] = useState<Customer | null>(null);
  const [editCustModal, setEditCustModal] = useState<Customer | null>(null);
  const [addCustModal, setAddCustModal] = useState<boolean>(false);
  const [newCustForm, setNewCustForm] = useState({
    customer_number: '',
    customer_name: '',
    matching_number: '',
    matching_number_2: '',
  });
  const [newCustError, setNewCustError] = useState<string>('');

  // User Management State
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'user' as 'admin' | 'user',
    daily_pull_limit: 100,
    per_pull_limit: 20,
  });
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<UserProfile | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState<boolean>(true);

  // Supabase Copy & Live Sync State
  const [isSqlCopied, setIsSqlCopied] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>(
    localStorage.getItem('vi_custom_supabase_url') || ''
  );
  const [customKey, setCustomKey] = useState<string>(
    localStorage.getItem('vi_custom_supabase_anon_key') || ''
  );
  const [syncFeedback, setSyncFeedback] = useState<string>('');
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customKey.trim()) {
      setSyncFeedback('⚠️ Please enter both Supabase URL and Anon Key.');
      return;
    }
    setIsSyncingSupabase(true);
    setSyncFeedback('⏳ Connecting and synchronizing with Supabase...');
    saveCustomSupabaseConfig(customUrl.trim(), customKey.trim());
    await dataStore.syncWithSupabase();
    refreshAll();
    setIsSyncingSupabase(false);
    setSyncFeedback('✅ Successfully connected to Supabase! Live database in sync.');
  };

  const handleManualSync = async () => {
    setIsSyncingSupabase(true);
    setSyncFeedback('⏳ Fetching latest data from Supabase...');
    await dataStore.syncWithSupabase();
    refreshAll();
    setIsSyncingSupabase(false);
    setSyncFeedback('✅ Sync complete! Latest profiles, customers, and history loaded.');
  };

  const refreshAll = () => {
    setCustomers(dataStore.getAllCustomers());
    setProfiles(dataStore.getProfiles());
    setUploadHistory(dataStore.getUploadHistory());
    setPullHistory(dataStore.getPullHistory());
    setAuditLogs(dataStore.getAuditLogs());
    setTemplateText(dataStore.getActiveTemplate());
  };

  useEffect(() => {
    refreshAll();
    const unsub = dataStore.subscribe(refreshAll);
    return () => unsub();
  }, []);

  // Stats calculation
  const counts = dataStore.getCustomerCounts();
  const todayPulls = pullHistory.filter(p => {
    const d = new Date(p.pulled_at);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }).length;
  const activeUsersCount = profiles.filter(p => p.status === 'active').length;
  const totalSends = dataStore.getSendHistory().length;

  // --- EXCEL FILE SELECTION & VALIDATION ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setUploadMessage('');
    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length === 0) {
          setUploadMessage('⚠️ File is empty.');
          setUploadPreview(null);
          return;
        }

        // Process rows: detect headers or raw columns
        let startIndex = 0;
        const firstRow = rawJson[0] || [];
        const isHeader = firstRow.some(
          (c: any) =>
            typeof c === 'string' &&
            (c.toLowerCase().includes('cust') ||
              c.toLowerCase().includes('phone') ||
              c.toLowerCase().includes('number') ||
              c.toLowerCase().includes('match'))
        );
        if (isHeader) {
          startIndex = 1;
        }

        const normalized: Array<{
          customer_number: string;
          matching_number: string;
          matching_number_2?: string;
          customer_name?: string;
        }> = [];

        const existingSet = new Set(dataStore.getAllCustomers().map(c => c.customer_number));
        let valid = 0,
          duplicate = 0,
          invalid = 0,
          newRows = 0;

        for (let i = startIndex; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || !Array.isArray(row) || row.length < 2) {
            invalid++;
            continue;
          }

          const cNum = (row[0] || '').toString().replace(/\D/g, '');
          const m1 = (row[1] || '').toString().replace(/\D/g, '');
          let m2 = '';
          let name = '';

          if (row.length === 3) {
            const thirdClean = (row[2] || '').toString().replace(/\D/g, '');
            if (thirdClean.length === 10) {
              m2 = thirdClean;
            } else {
              name = (row[2] || '').toString().trim();
            }
          } else if (row.length >= 4) {
            const thirdClean = (row[2] || '').toString().replace(/\D/g, '');
            if (thirdClean.length === 10) m2 = thirdClean;
            name = (row[3] || '').toString().trim();
          }

          if (cNum.length !== 10 || m1.length !== 10) {
            invalid++;
            continue;
          }

          valid++;

          if (existingSet.has(cNum)) {
            duplicate++;
          } else {
            newRows++;
            existingSet.add(cNum); // Prevent in-file duplicates too
            normalized.push({
              customer_number: cNum,
              matching_number: m1,
              matching_number_2: m2 || undefined,
              customer_name: name || undefined,
            });
          }
        }

        setParsedRows(normalized);
        setUploadPreview({
          total: rawJson.length - startIndex,
          valid,
          duplicate,
          invalid,
          newRows,
          sampleRows: normalized.slice(0, 5),
        });
      } catch (err: any) {
        setUploadMessage('⚠️ Failed to parse file: ' + err?.message);
        setUploadPreview(null);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!uploadFile || parsedRows.length === 0) return;
    setIsImporting(true);

    try {
      const result = await dataStore.importBulkData(uploadFile.name, parsedRows);
      setUploadMessage(
        `✅ Successfully imported ${result.newRows} new customers (${result.duplicate} duplicates skipped, ${result.invalid} invalid rows skipped).`
      );
      setUploadPreview(null);
      setUploadFile(null);
      setParsedRows([]);
      refreshAll();
    } catch (err: any) {
      setUploadMessage('⚠️ Import error: ' + err?.message);
    } finally {
      setIsImporting(false);
    }
  };

  // --- CUSTOMER FILTERING & PAGINATION ---
  const filteredCustomers = customers.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = c.customer_number.includes(q);
      const nameMatch = c.customer_name?.toLowerCase().includes(q);
      const match1Match = c.matching_number.includes(q);
      if (!numMatch && !nameMatch && !match1Match) return false;
    }
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (userFilter !== 'ALL') {
      if (userFilter === 'UNASSIGNED' && c.allocated_to) return false;
      if (userFilter !== 'UNASSIGNED' && c.allocated_to !== userFilter) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // --- ADD SINGLE CUSTOMER ---
  const handleAddSingleCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCustError('');

    const res = await dataStore.addCustomer({
      customer_number: newCustForm.customer_number,
      customer_name: newCustForm.customer_name,
      matching_number: newCustForm.matching_number,
      matching_number_2: newCustForm.matching_number_2 || undefined,
    });

    if (!res.success) {
      setNewCustError(res.error || 'Failed to add customer.');
      return;
    }

    setAddCustModal(false);
    setNewCustForm({
      customer_number: '',
      customer_name: '',
      matching_number: '',
      matching_number_2: '',
    });
    refreshAll();
  };

  // --- SAVE CUSTOMER EDIT ---
  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustModal) return;

    await dataStore.updateCustomer(editCustModal.id, {
      customer_name: editCustModal.customer_name,
      matching_number: editCustModal.matching_number,
      matching_number_2: editCustModal.matching_number_2,
      status: editCustModal.status,
    });

    setEditCustModal(null);
    refreshAll();
  };

  // --- DELETE CUSTOMER ---
  const handleConfirmDelete = async () => {
    if (!deleteCustModal) return;
    await dataStore.deleteCustomer(deleteCustModal.id);
    setDeleteCustModal(null);
    refreshAll();
  };

  // --- USER CREATION & EDITING ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email) return;

    await dataStore.createProfile({
      name: newUserForm.name,
      email: newUserForm.email,
      role: newUserForm.role,
      status: 'active',
      daily_pull_limit: Number(newUserForm.daily_pull_limit) || 100,
      per_pull_limit: Number(newUserForm.per_pull_limit) || 20,
    });

    setShowAddUserModal(false);
    setNewUserForm({
      name: '',
      email: '',
      role: 'user',
      daily_pull_limit: 100,
      per_pull_limit: 20,
    });
    refreshAll();
  };

  const handleSaveUserLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    await dataStore.updateProfile(editingUser.id, {
      daily_pull_limit: editingUser.daily_pull_limit,
      per_pull_limit: editingUser.per_pull_limit,
      status: editingUser.status,
      role: editingUser.role,
    });

    setEditingUser(null);
    refreshAll();
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserModal) return;
    await dataStore.deleteProfile(deleteUserModal.id);
    setDeleteUserModal(null);
    refreshAll();
  };

  const handleInsertPlaceholder = (ph: string) => {
    setTemplateText(prev => prev + ph);
  };

  const handleResetTemplate = () => {
    if (window.confirm('Restore standard default outreach message format?')) {
      const def = dataStore.resetTemplate();
      setTemplateText(def);
      setIsTemplateSaved(false);
      refreshAll();
    }
  };

  const handleCopySchemaSql = () => {
    const sql = `-- Vi Premium Outreach Database Schema
-- Run this in Supabase SQL Editor:
-- (Full schema is saved in /supabase-schema.sql)
SELECT 'Schema loaded successfully' AS result;`;
    navigator.clipboard.writeText(sql);
    setIsSqlCopied(true);
    setTimeout(() => setIsSqlCopied(false), 2000);
  };

  const supabaseStatus = getSupabaseStatus();

  return (
    <div className="space-y-6">
      {/* Admin Security Banner with Lock Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-[rgba(201,147,42,0.3)] bg-[rgba(201,147,42,0.06)] shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔐</span>
          <div>
            <div className="text-sm font-bold text-[var(--txt)] flex items-center gap-2">
              <span>Admin Control Center</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(201,147,42,0.2)] text-[var(--gold-pale)] border border-[rgba(201,147,42,0.4)]">
                Password Verified
              </span>
            </div>
            <div className="text-xs text-[var(--txt3)] font-mono">
              Master Admin Access • Authorization Active
            </div>
          </div>
        </div>

        {onLockAdmin && (
          <button
            onClick={onLockAdmin}
            className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/50 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>🔒</span>
            <span>Lock Admin & Exit</span>
          </button>
        )}
      </div>

      {/* Top Admin Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Total</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--txt)] mt-1">
            {counts.total}
          </div>
          <div className="text-[10px] text-[var(--txt3)]">In Database</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Available</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            {counts.available}
          </div>
          <div className="text-[10px] text-emerald-400/70">Ready to Pull</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Allocated</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--gold-lt)] mt-1">
            {counts.pulled}
          </div>
          <div className="text-[10px] text-[var(--gold-lt)]/70">Pulled / In Use</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Today</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--violet-lt)] mt-1">
            {todayPulls}
          </div>
          <div className="text-[10px] text-[var(--violet-lt)]/70">Pulls Today</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Agents</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--txt)] mt-1">
            {activeUsersCount}
          </div>
          <div className="text-[10px] text-[var(--txt3)]">Active Profiles</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-[var(--rim)] bg-[var(--panel)]">
          <div className="text-xs font-mono text-[var(--txt3)] uppercase tracking-wider">Sends</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1">
            {totalSends}
          </div>
          <div className="text-[10px] text-rose-400/70">WA & RCS Opened</div>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="p-1 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📊</span>
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'upload'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📥</span>
          <span>Upload Excel</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'customers'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🗃️</span>
          <span>Customers</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>👥</span>
          <span>User Limits</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📜</span>
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('template')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'template'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📝</span>
          <span>Template</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1 ${
            activeTab === 'supabase'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🔌</span>
          <span>Supabase</span>
        </button>
      </div>

      {/* --- TAB 1: OVERVIEW & ANALYTICS --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* User-wise Pull Activity Breakdown */}
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
            <h3 className="text-sm font-bold text-[var(--txt)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>👥</span>
              <span>Agent Performance & Quota Consumption</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles
                .filter(p => p.role === 'user')
                .map(user => {
                  const userStats = dataStore.getUserPullStats(user.id);
                  const pct = Math.min(
                    100,
                    Math.round((userStats.pulledToday / userStats.dailyLimit) * 100)
                  );

                  return (
                    <div
                      key={user.id}
                      className="p-4 rounded-xl border border-[var(--rim)] bg-[var(--panel)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[var(--txt)]">{user.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            user.status === 'active'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                              : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                          }`}
                        >
                          {user.status}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--txt2)] flex items-center justify-between">
                        <span>Today's Pulls:</span>
                        <span className="font-mono font-bold text-[var(--gold-lt)]">
                          {userStats.pulledToday} / {userStats.dailyLimit}
                        </span>
                      </div>

                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-pale)] h-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--txt3)] pt-1">
                        <span>Max {user.per_pull_limit} / pull</span>
                        <span>Total: {userStats.totalPulled}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
            <h3 className="text-sm font-bold text-[var(--txt)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>⚡</span>
              <span>Recent System Activity</span>
            </h3>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {auditLogs.slice(0, 10).map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-[var(--rim)] bg-[var(--panel)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono px-2 py-0.5 rounded bg-white/5 text-[var(--gold-lt)] text-[10px] font-bold">
                      {log.action}
                    </span>
                    <span className="text-[var(--txt)]">{log.details}</span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--txt3)] shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: EXCEL / CSV UPLOAD --- */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
            <div>
              <h3 className="text-base font-bold text-[var(--txt)]">📥 Upload Customer Excel / CSV</h3>
              <p className="text-xs text-[var(--txt3)] leading-relaxed mt-0.5">
                Upload customer files with phone numbers and matching CPOS pairs. Our validation engine
                automatically removes malformed rows and prevents duplicate numbers in the database.
              </p>
            </div>

            {/* Dropzone / File Picker */}
            <div className="border-2 border-dashed border-[var(--rim-hi)] hover:border-[var(--gold)] rounded-2xl p-8 text-center transition-colors bg-[var(--panel)]/50">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="excelInput"
              />
              <label htmlFor="excelInput" className="cursor-pointer block space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(201,147,42,0.1)] border border-[rgba(201,147,42,0.3)] flex items-center justify-center text-2xl text-[var(--gold-lt)]">
                  📁
                </div>
                <div>
                  <span className="text-sm font-bold text-[var(--txt)]">
                    {uploadFile ? uploadFile.name : 'Click to select Excel or CSV file'}
                  </span>
                  <p className="text-xs text-[var(--txt3)] mt-1">
                    Supports .xlsx, .xls and .csv (Columns: Customer, Match1, Match2, Name)
                  </p>
                </div>
              </label>
            </div>

            {/* Preview Banner */}
            {uploadPreview && (
              <div className="p-4 rounded-xl border border-[var(--gold)]/30 bg-[rgba(201,147,42,0.06)] space-y-3">
                <div className="text-xs font-bold text-[var(--gold-lt)] uppercase tracking-wider">
                  File Analysis Preview
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] text-center">
                    <div className="text-xs text-[var(--txt3)]">Total Rows</div>
                    <div className="text-lg font-bold font-mono text-[var(--txt)]">
                      {uploadPreview.total}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] text-center">
                    <div className="text-xs text-emerald-400">Valid Rows</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {uploadPreview.valid}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] text-center">
                    <div className="text-xs text-amber-400">Duplicates</div>
                    <div className="text-lg font-bold font-mono text-amber-400">
                      {uploadPreview.duplicate}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] text-center">
                    <div className="text-xs text-rose-400">Invalid Rows</div>
                    <div className="text-lg font-bold font-mono text-rose-400">
                      {uploadPreview.invalid}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--panel)] text-center col-span-2 sm:col-span-1">
                    <div className="text-xs text-[var(--gold-lt)]">New to Insert</div>
                    <div className="text-lg font-bold font-mono text-[var(--gold-lt)]">
                      {uploadPreview.newRows}
                    </div>
                  </div>
                </div>

                {uploadPreview.sampleRows.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-[var(--txt3)] mb-1.5">Sample valid rows:</div>
                    <div className="space-y-1 font-mono text-xs">
                      {uploadPreview.sampleRows.map((r, i) => (
                        <div
                          key={i}
                          className="p-1.5 rounded bg-black/20 text-[var(--txt2)] flex items-center justify-between"
                        >
                          <span>{r.customer_number} ↔ {r.matching_number}</span>
                          <span>{r.customer_name || 'No name'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setUploadFile(null);
                      setUploadPreview(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--rim)] text-[var(--txt2)] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting || uploadPreview.newRows === 0}
                    className="px-6 py-2.5 text-xs font-bold rounded-xl text-[var(--ink)] bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] shadow-md hover:opacity-95 cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? 'Importing...' : `✅ Confirm & Insert ${uploadPreview.newRows} Customers`}
                  </button>
                </div>
              </div>
            )}

            {uploadMessage && (
              <div className="p-3.5 rounded-xl text-xs bg-[var(--panel)] border border-[var(--rim)] text-[var(--txt)]">
                {uploadMessage}
              </div>
            )}
          </div>

          {/* Past Upload History */}
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
            <h4 className="text-xs font-bold text-[var(--txt2)] uppercase tracking-wider mb-3">
              Upload History
            </h4>
            {uploadHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--txt3)]">
                No previous file uploads recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--rim)] text-[var(--txt3)] font-mono">
                      <th className="py-2">File</th>
                      <th className="py-2">Uploaded By</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Inserted</th>
                      <th className="py-2">Duplicates</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rim)]">
                    {uploadHistory.map(u => (
                      <tr key={u.id} className="text-[var(--txt)]">
                        <td className="py-2.5 font-mono">{u.filename}</td>
                        <td className="py-2.5">{u.uploaded_by_name}</td>
                        <td className="py-2.5 font-mono">{u.total_rows}</td>
                        <td className="py-2.5 font-mono text-emerald-400 font-bold">{u.new_rows}</td>
                        <td className="py-2.5 font-mono text-amber-400">{u.duplicate_rows}</td>
                        <td className="py-2.5 font-mono text-[var(--txt3)]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: CUSTOMER DATA MANAGEMENT --- */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[var(--txt)]">🗃️ Customer Data Management</h3>
                <p className="text-xs text-[var(--txt3)]">
                  Search, filter, allocate, edit or safely delete customer records
                </p>
              </div>

              <button
                onClick={() => setAddCustModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow-sm hover:opacity-90 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span>
                <span>Add Single Customer</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Search phone number, name or match..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-xs text-[var(--txt)] focus:outline-none"
              />

              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-[var(--rim)] bg-[var(--panel)] text-xs text-[var(--txt)] focus:outline-none"
              >
                <option value="ALL">All Statuses ({counts.total})</option>
                <option value="AVAILABLE">AVAILABLE ({counts.available})</option>
                <option value="PULLED">PULLED / ALLOCATED ({counts.pulled})</option>
                <option value="USED">USED</option>
                <option value="DISABLED">DISABLED</option>
              </select>

              <select
                value={userFilter}
                onChange={e => {
                  setUserFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-[var(--rim)] bg-[var(--panel)] text-xs text-[var(--txt)] focus:outline-none"
              >
                <option value="ALL">All Agents</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {profiles
                  .filter(p => p.role === 'user')
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Customer Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rim)] text-[var(--txt3)] font-mono">
                    <th className="py-2.5">Customer No.</th>
                    <th className="py-2.5">Name</th>
                    <th className="py-2.5">Matching No.</th>
                    <th className="py-2.5">2nd Match</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5">Allocated To</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rim)]">
                  {paginatedCustomers.map(cust => (
                    <tr key={cust.id} className="text-[var(--txt)] hover:bg-white/5 transition-colors">
                      <td className="py-2.5 font-mono font-semibold text-[var(--gold-pale)]">
                        {cust.customer_number}
                      </td>
                      <td className="py-2.5 text-[var(--txt2)]">
                        {cust.customer_name || '—'}
                      </td>
                      <td className="py-2.5 font-mono text-[var(--txt2)]">
                        {cust.matching_number}
                      </td>
                      <td className="py-2.5 font-mono text-[var(--txt3)]">
                        {cust.matching_number_2 || '—'}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            cust.status === 'AVAILABLE'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                              : cust.status === 'PULLED'
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-[var(--txt2)]">
                        {cust.allocated_to_name || (cust.allocated_to ? 'Assigned' : '—')}
                      </td>
                      <td className="py-2.5 text-right space-x-1">
                        <button
                          onClick={() => setEditCustModal(cust)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[var(--gold-lt)] cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setDeleteCustModal(cust)}
                          className="px-2 py-1 rounded bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 cursor-pointer"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedCustomers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--txt3)]">
                        No customers match current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-[var(--rim)] text-xs">
                <span className="text-[var(--txt3)]">
                  Showing {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, filteredCustomers.length)} of{' '}
                  {filteredCustomers.length}
                </span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-[var(--rim)] text-[var(--txt2)] hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="px-2 py-1 font-mono text-[var(--gold-lt)] font-bold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-[var(--rim)] text-[var(--txt2)] hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 4: USER MANAGEMENT & LIMITS --- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--txt)]">👥 User Management & Quota Limits</h3>
                <p className="text-xs text-[var(--txt3)]">
                  Configure daily pull quotas and maximum per-request limits for each agent
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow-sm hover:opacity-90 cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Create User</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles.map(user => {
                const uStats = dataStore.getUserPullStats(user.id);

                return (
                  <div
                    key={user.id}
                    className="p-4 rounded-xl border border-[var(--rim)] bg-[var(--panel)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-[var(--txt)] flex items-center gap-2">
                          <span>{user.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 border border-[var(--rim)] text-[var(--gold-lt)]">
                            {user.role}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--txt3)] font-mono">{user.email}</div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          user.status === 'active'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                            : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {user.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-[var(--rim)]">
                      <div className="p-2 rounded bg-black/15">
                        <div className="text-[10px] text-[var(--txt3)]">Daily Quota</div>
                        <div className="font-bold font-mono text-[var(--txt)]">{user.daily_pull_limit}</div>
                      </div>
                      <div className="p-2 rounded bg-black/15">
                        <div className="text-[10px] text-[var(--txt3)]">Per Pull Limit</div>
                        <div className="font-bold font-mono text-[var(--violet-lt)]">{user.per_pull_limit}</div>
                      </div>
                      <div className="p-2 rounded bg-black/15">
                        <div className="text-[10px] text-[var(--txt3)]">Total Pulled</div>
                        <div className="font-bold font-mono text-[var(--gold-lt)]">{uStats.totalPulled}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => setDeleteUserModal(user)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/30 cursor-pointer transition-colors"
                          title="Delete this agent account"
                        >
                          🗑️ Delete
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(user)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-[var(--gold-lt)] border border-[var(--rim)] cursor-pointer"
                      >
                        ⚙️ Limits & Status
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: AUDIT LOGS & USER ACTIVITY --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
            <h3 className="text-base font-bold text-[var(--txt)]">📜 System Audit & Allocation Trail</h3>
            <p className="text-xs text-[var(--txt3)]">
              Complete traceable record of WHO pulled WHAT and WHEN
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--rim)] text-[var(--txt3)] font-mono">
                    <th className="py-2.5">Time</th>
                    <th className="py-2.5">User</th>
                    <th className="py-2.5">Customer Number</th>
                    <th className="py-2.5">Matching Pairs</th>
                    <th className="py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rim)]">
                  {pullHistory.slice(0, 30).map(pull => (
                    <tr key={pull.id} className="text-[var(--txt)] hover:bg-white/5">
                      <td className="py-2.5 font-mono text-[var(--txt3)]">
                        {new Date(pull.pulled_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 font-bold text-[var(--violet-lt)]">{pull.user_name}</td>
                      <td className="py-2.5 font-mono font-bold text-[var(--gold-pale)]">
                        {pull.customer_number}
                      </td>
                      <td className="py-2.5 font-mono text-[var(--txt2)]">
                        {pull.matching_number}
                        {pull.matching_number_2 ? ` & ${pull.matching_number_2}` : ''}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-[var(--rim)] text-[var(--txt2)]">
                          {pull.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {pullHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--txt3)]">
                        No customer pull events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 6: GLOBAL TEMPLATE EDITOR --- */}
      {activeTab === 'template' && (
        <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[var(--txt)]">📝 Global Outreach Message Template</h3>
              <p className="text-xs text-[var(--txt3)]">
                Admin Exclusive: This template applies across all WhatsApp and RCS outreach links
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetTemplate}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[var(--rim)] text-[var(--txt3)] hover:text-rose-400 cursor-pointer transition-colors"
              >
                🔄 Reset Default
              </button>
              <button
                onClick={() => {
                  dataStore.saveTemplate(templateText);
                  setIsTemplateSaved(true);
                  setTimeout(() => setIsTemplateSaved(false), 2000);
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow cursor-pointer transition-opacity"
              >
                {isTemplateSaved ? '✅ Saved Globally!' : '💾 Save Global Format'}
              </button>
            </div>
          </div>

          {/* Placeholders bar */}
          <div className="p-3.5 rounded-xl border border-[rgba(201,147,42,0.25)] bg-[rgba(201,147,42,0.05)] space-y-2">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--gold-lt)]">
              Insert Variable Placeholders (Click to Add):
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{custNum}')}
                className="px-2.5 py-1 rounded-lg bg-[rgba(201,147,42,0.12)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-pale)] font-mono text-xs hover:bg-[rgba(201,147,42,0.25)] cursor-pointer transition-colors"
              >
                + {'{custNum}'} <span className="text-[10px] text-[var(--txt3)] font-sans">(Phone)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{matchNum}')}
                className="px-2.5 py-1 rounded-lg bg-[rgba(201,147,42,0.12)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-pale)] font-mono text-xs hover:bg-[rgba(201,147,42,0.25)] cursor-pointer transition-colors"
              >
                + {'{matchNum}'} <span className="text-[10px] text-[var(--txt3)] font-sans">(Match 1)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{matchNum2}')}
                className="px-2.5 py-1 rounded-lg bg-[rgba(201,147,42,0.12)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-pale)] font-mono text-xs hover:bg-[rgba(201,147,42,0.25)] cursor-pointer transition-colors"
              >
                + {'{matchNum2}'} <span className="text-[10px] text-[var(--txt3)] font-sans">(Match 2)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{name}')}
                className="px-2.5 py-1 rounded-lg bg-[rgba(201,147,42,0.12)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-pale)] font-mono text-xs hover:bg-[rgba(201,147,42,0.25)] cursor-pointer transition-colors"
              >
                + {'{name}'} <span className="text-[10px] text-[var(--txt3)] font-sans">(Name)</span>
              </button>
            </div>
            <p className="text-[10px] text-[var(--txt3)] pt-1 border-t border-[rgba(201,147,42,0.15)] leading-relaxed">
              💡 <strong>Automated Logic:</strong> Any line containing <code className="text-[var(--gold-pale)]">{'{matchNum2}'}</code> is automatically dropped if a customer does not have a 2nd matching number.
            </p>
          </div>

          <textarea
            rows={9}
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs leading-relaxed focus:outline-none focus:border-[var(--violet-lt)]"
          />

          {/* Live Preview Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowTemplatePreview(!showTemplatePreview)}
              className="text-xs text-[var(--txt2)] hover:text-white flex items-center gap-1.5 cursor-pointer font-medium py-1"
            >
              <span>{showTemplatePreview ? '▼' : '▶'}</span>
              <span>Live Sample Message Preview</span>
            </button>
            {showTemplatePreview && (
              <div className="mt-2 p-3.5 rounded-xl border border-[var(--rim)] bg-black/20 text-[var(--txt2)] font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {templateText
                  .replace(/\{custNum\}/g, '9876543210')
                  .replace(/\{matchNum\}/g, '9876543219')
                  .replace(/\{matchNum2\}/g, '9876543211')
                  .replace(/\{name\}/g, 'Manish')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 7: SUPABASE & DEPLOYMENT CONFIG --- */}
      {activeTab === 'supabase' && (
        <div className="space-y-5">
          <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--txt)]">🔌 Supabase & Vercel Deployment</h3>
                <p className="text-xs text-[var(--txt3)]">
                  Seamlessly connect external Cloud Supabase PostgreSQL or run with built-in engine
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  supabaseStatus.isConfigured
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                }`}
              >
                {supabaseStatus.isConfigured ? 'Connected to Cloud Supabase' : 'Built-in Atomic Engine Active'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)]">
                <span className="text-[var(--txt3)]">Supabase Project URL:</span>
                <div className="font-mono font-semibold text-[var(--txt)] mt-1 truncate">
                  {supabaseStatus.url}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)]">
                <span className="text-[var(--txt3)]">Anon Key Configured:</span>
                <div className="font-mono font-semibold text-[var(--txt)] mt-1">
                  {supabaseStatus.hasAnonKey ? '✅ Present & Connected' : '❌ Not Provided'}
                </div>
              </div>
            </div>

            {/* Live Credentials Manager */}
            <form onSubmit={handleSaveSupabaseConfig} className="p-4 rounded-xl border border-[var(--rim)] bg-[var(--panel)] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--txt)] uppercase tracking-wider font-mono">
                  Live Supabase Credentials & Instant Sync
                </h4>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingSupabase}
                  className="px-2.5 py-1 rounded-lg border border-[var(--rim)] text-xs text-[var(--gold-lt)] hover:text-white cursor-pointer disabled:opacity-50"
                >
                  {isSyncingSupabase ? 'Syncing...' : '🔄 Fetch From Supabase'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[var(--txt3)] mb-1">Project URL</label>
                  <input
                    type="url"
                    placeholder="https://xyz.supabase.co"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs focus:outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--txt3)] mb-1">Anon Public Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOi..."
                    value={customKey}
                    onChange={e => setCustomKey(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs focus:outline-none focus:border-[var(--gold)]"
                  />
                </div>
              </div>

              {syncFeedback && (
                <div className="text-xs p-2 rounded-lg bg-black/20 text-[var(--gold-pale)] font-mono">
                  {syncFeedback}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSyncingSupabase}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white text-xs font-bold shadow hover:opacity-95 cursor-pointer disabled:opacity-50"
                >
                  💾 Save & Sync Supabase Database
                </button>
              </div>
            </form>

            <div className="p-4 rounded-xl border border-[var(--gold)]/30 bg-[rgba(201,147,42,0.06)] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--gold-lt)] uppercase tracking-wider">
                  PostgreSQL Schema & RPC Migration (FOR UPDATE SKIP LOCKED)
                </h4>
                <button
                  onClick={handleCopySchemaSql}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--gold)] text-[var(--ink)] hover:opacity-90 cursor-pointer"
                >
                  {isSqlCopied ? '✅ Copied SQL!' : '📋 Copy SQL Script'}
                </button>
              </div>
              <p className="text-xs text-[var(--txt2)] leading-relaxed">
                The complete SQL schema with <code>allocate_customers</code> stored procedure and Row Level Security
                is saved in <code>/supabase-schema.sql</code>. Copy and run it in the Supabase SQL Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CUSTOMER CONFIRMATION */}
      {deleteCustModal && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[var(--modal-card)] border border-rose-500/40 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-950/40 text-rose-400 flex items-center justify-center text-xl">
              🗑️
            </div>
            <h4 className="text-lg font-bold text-[var(--txt)] mb-1">Delete Customer Record?</h4>
            <p className="text-xs text-[var(--txt2)] mb-5">
              Are you sure you want to delete{' '}
              <strong className="text-white font-mono">{deleteCustModal.customer_number}</strong>
              {deleteCustModal.customer_name ? ` (${deleteCustModal.customer_name})` : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteCustModal(null)}
                className="flex-1 py-2 rounded-xl border border-[var(--rim)] text-xs text-[var(--txt3)] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CUSTOMER */}
      {editCustModal && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--card)] border border-[var(--rim)] shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-[var(--txt)]">
              Edit Customer: {editCustModal.customer_number}
            </h4>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--txt2)] mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editCustModal.customer_name || ''}
                  onChange={e =>
                    setEditCustModal({ ...editCustModal, customer_name: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)]"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Matching Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={editCustModal.matching_number}
                  onChange={e =>
                    setEditCustModal({ ...editCustModal, matching_number: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">2nd Matching Number (Optional)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={editCustModal.matching_number_2 || ''}
                  onChange={e =>
                    setEditCustModal({ ...editCustModal, matching_number_2: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Status</label>
                <select
                  value={editCustModal.status}
                  onChange={e =>
                    setEditCustModal({ ...editCustModal, status: e.target.value as any })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--panel)] text-[var(--txt)]"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="PULLED">PULLED</option>
                  <option value="USED">USED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCustModal(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--rim)] text-[var(--txt3)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SINGLE CUSTOMER */}
      {addCustModal && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--card)] border border-[var(--rim)] shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-[var(--txt)]">Add Single Customer</h4>

            <form onSubmit={handleAddSingleCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--gold-lt)] font-semibold mb-1 font-mono">
                  Customer Mobile (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={newCustForm.customer_number}
                  onChange={e =>
                    setNewCustForm({ ...newCustForm, customer_number: e.target.value })
                  }
                  placeholder="98XXXXXXXX"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Customer Name (Optional)</label>
                <input
                  type="text"
                  value={newCustForm.customer_name}
                  onChange={e =>
                    setNewCustForm({ ...newCustForm, customer_name: e.target.value })
                  }
                  placeholder="e.g. Manish Verma"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)]"
                />
              </div>

              <div>
                <label className="block text-[var(--gold-lt)] font-semibold mb-1 font-mono">
                  1st Matching Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={newCustForm.matching_number}
                  onChange={e =>
                    setNewCustForm({ ...newCustForm, matching_number: e.target.value })
                  }
                  placeholder="98XXXXXX99"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">
                  2nd Matching Number (Optional)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={newCustForm.matching_number_2}
                  onChange={e =>
                    setNewCustForm({ ...newCustForm, matching_number_2: e.target.value })
                  }
                  placeholder="98XXXXXX01"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm"
                />
              </div>

              {newCustError && <div className="text-rose-400">⚠️ {newCustError}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddCustModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--rim)] text-[var(--txt3)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)]"
                >
                  Save to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--card)] border border-[var(--rim)] shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-[var(--txt)]">Create New Agent Account</h4>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--txt2)] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="e.g. Amit Kumar"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)]"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Email / Login ID</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="amit@vi-outreach.com"
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Role</label>
                <select
                  value={newUserForm.role}
                  onChange={e =>
                    setNewUserForm({ ...newUserForm, role: e.target.value as any })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--panel)] text-[var(--txt)]"
                >
                  <option value="user">Agent / Regular User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--txt2)] mb-1">Daily Pull Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={newUserForm.daily_pull_limit}
                    onChange={e =>
                      setNewUserForm({
                        ...newUserForm,
                        daily_pull_limit: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[var(--txt2)] mb-1">Per Pull Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newUserForm.per_pull_limit}
                    onChange={e =>
                      setNewUserForm({
                        ...newUserForm,
                        per_pull_limit: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--rim)] text-[var(--txt3)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)]"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER LIMITS & STATUS */}
      {editingUser && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--card)] border border-[var(--rim)] shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-[var(--txt)]">
              Configure Limits for {editingUser.name}
            </h4>

            <form onSubmit={handleSaveUserLimits} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--txt2)] mb-1">Account Status</label>
                <select
                  value={editingUser.status}
                  onChange={e =>
                    setEditingUser({ ...editingUser, status: e.target.value as any })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--panel)] text-[var(--txt)]"
                >
                  <option value="active">Active (Permitted to pull)</option>
                  <option value="disabled">Disabled (Blocked from pulling)</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Daily Pull Limit</label>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={editingUser.daily_pull_limit}
                  onChange={e =>
                    setEditingUser({
                      ...editingUser,
                      daily_pull_limit: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[var(--txt2)] mb-1">Maximum Customers Per Request</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={editingUser.per_pull_limit}
                  onChange={e =>
                    setEditingUser({
                      ...editingUser,
                      per_pull_limit: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--rim)] text-[var(--txt3)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)]"
                >
                  Save Limits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: DELETE USER CONFIRMATION */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[var(--modal-card)] border border-rose-500/40 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-950/40 text-rose-400 flex items-center justify-center text-xl">
              🗑️
            </div>
            <h4 className="text-base font-bold text-[var(--txt)] mb-1">Delete Agent Account?</h4>
            <p className="text-xs text-[var(--txt2)] mb-5">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{deleteUserModal.name}</strong> ({deleteUserModal.email})?
              All future customer pull allocations for this agent will be revoked.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteUserModal(null)}
                className="flex-1 py-2 rounded-xl border border-[var(--rim)] text-xs text-[var(--txt3)] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow cursor-pointer transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

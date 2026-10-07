import React, { useState, useEffect } from 'react';
import { Customer, PullHistory, UserProfile } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { NumberCard } from '../NumberCard';

interface MatchingNumberSendProps {
  currentUser: UserProfile;
}

export const MatchingNumberSend: React.FC<MatchingNumberSendProps> = ({ currentUser }) => {
  // Selected mode ('recent' | 'new' | null)
  // Kept in sessionStorage so coming back from WhatsApp / refresh keeps the same screen
  const modeKey = `match_send_mode_${currentUser.id}`;
  const [selectedMode, setSelectedMode] = useState<'recent' | 'new' | null>(() => {
    try {
      // a "new" pull screen comes back as the Recent bunch (the just-pulled numbers)
      return sessionStorage.getItem(modeKey) ? 'recent' : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (selectedMode) sessionStorage.setItem(modeKey, selectedMode);
      else sessionStorage.removeItem(modeKey);
    } catch {
      // ignore
    }
  }, [selectedMode]);

  // New Customer Pull state
  const [pullCount, setPullCount] = useState<number>(1);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullError, setPullError] = useState<string>('');
  const [newlyPulled, setNewlyPulled] = useState<Customer[]>([]);

  // Recent Data state: only the user's last pulled lot, plus which ones are already sent
  const [recentCustomers, setRecentCustomers] = useState<PullHistory[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set()); // sent customer numbers
  const [recentTime, setRecentTime] = useState<string>('');
  const [pullWarning, setPullWarning] = useState<string>('');

  // Quota info
  const [quotaStats, setQuotaStats] = useState(dataStore.getUserPullStats(currentUser.id));

  const refreshRecent = () => {
    const lot = dataStore.getRecentLot(currentUser.id);
    setRecentCustomers(lot ? lot.items : []);
    setRecentTime(lot ? lot.pulled_at : '');
    setSentIds(dataStore.getSentNumbers(currentUser.id));
    setQuotaStats(dataStore.getUserPullStats(currentUser.id));
  };

  // Depends on the user id only: a new currentUser object (e.g. after every send)
  // must NOT reset the screen back to the "choose" page.
  useEffect(() => {
    refreshRecent();
    const unsubscribe = dataStore.subscribe(refreshRecent);
    return () => unsubscribe();
  }, [currentUser.id]);

  const handlePullNewCustomer = async () => {
    setIsPulling(true);
    setPullError('');
    setPullWarning('');

    try {
      const res = await dataStore.allocateCustomers(currentUser.id, pullCount, 'MATCHING_SEND');
      if (!res.success) {
        setPullError(res.error || 'Failed to pull customer.');
        return;
      }

      setNewlyPulled(res.customers);
      if (res.warning) setPullWarning(res.warning);
      refreshRecent();
    } catch (err: any) {
      setPullError(err?.message || 'Error executing atomic allocation.');
    } finally {
      setIsPulling(false);
    }
  };

  // Choose between "Recent Pulled Data" or "New Customer"
  return (
    <div className="space-y-6">
      {/* User bar */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--violet)] to-[var(--rose)] flex items-center justify-center text-white font-bold text-xs shadow">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-bold text-[var(--txt)]">{currentUser.name}</span>
      </div>

      {/* Two small chips, side by side */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setSelectedMode('recent');
            setNewlyPulled([]);
            refreshRecent();
          }}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            selectedMode === 'recent'
              ? 'border-[var(--gold)] bg-[rgba(201,147,42,0.1)] text-[var(--gold-lt)] ring-1 ring-[var(--gold)]'
              : 'border-[var(--rim)] bg-[var(--card)] text-[var(--txt2)] hover:border-[rgba(201,147,42,0.3)]'
          }`}
        >
          <span>📜</span>
          <span>Recent Pulled Data</span>
          <span className="px-1.5 rounded-full text-[10px] font-mono bg-white/10">
            {recentCustomers.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedMode('new')}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            selectedMode === 'new'
              ? 'border-[var(--violet-lt)] bg-[rgba(123,63,228,0.1)] text-[var(--violet-lt)] ring-1 ring-[var(--violet-lt)]'
              : 'border-[var(--rim)] bg-[var(--card)] text-[var(--txt2)] hover:border-[rgba(123,63,228,0.3)]'
          }`}
        >
          <span>⚡</span>
          <span>New Customers</span>
        </button>
      </div>

      {/* --- SUBVIEW: NEW CUSTOMER PULL --- */}
      {selectedMode === 'new' && (
        <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] space-y-4 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--rim)] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[var(--txt)]">⚡ Pull New Available Customer</h4>
            </div>
            <span className="text-xs font-mono text-[var(--gold-lt)] font-semibold">
              Remaining Quota: {quotaStats.remainingQuota}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-auto flex items-center gap-2">
              <label className="text-xs text-[var(--txt2)] font-medium">Quantity:</label>
              <select
                value={pullCount}
                onChange={e => setPullCount(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-sm focus:outline-none"
              >
                {[1, 2, 5, 10, Math.min(20, quotaStats.perPullLimit)].filter(
                  (v, i, a) => v <= quotaStats.perPullLimit && a.indexOf(v) === i
                ).map(c => (
                  <option key={c} value={c} className="bg-[var(--panel)]">
                    {c} {c === 1 ? 'Customer' : 'Customers'}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePullNewCustomer}
              disabled={isPulling || quotaStats.remainingQuota <= 0}
              className={`flex-1 w-full py-3 px-6 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                quotaStats.remainingQuota <= 0
                  ? 'bg-neutral-700 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] hover:opacity-95'
              }`}
            >
              {isPulling ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span>Allocating from Database...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Pull {pullCount} Customer(s) Now</span>
                </>
              )}
            </button>
          </div>

          {pullError && (
            <div className="p-3.5 rounded-xl text-xs text-rose-300 bg-rose-950/30 border-l-4 border-rose-500 leading-relaxed">
              ⚠️ {pullError}
            </div>
          )}

          {pullWarning && (
            <div className="p-3.5 rounded-xl text-xs text-amber-300 bg-amber-950/30 border-l-4 border-amber-500 leading-relaxed">
              ⚠️ {pullWarning}
            </div>
          )}

          {/* Render newly pulled customer cards */}
          {newlyPulled.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--rim)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span>✅</span> Successfully Allocated ({newlyPulled.length})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newlyPulled.map(cust => (
                  <NumberCard
                    key={cust.id}
                    customerId={cust.id}
                    customerNumber={cust.customer_number}
                    matches={
                      cust.matching_number_2
                        ? [cust.matching_number, cust.matching_number_2]
                        : [cust.matching_number]
                    }
                    customerName={cust.customer_name}
                    tagLabel="⚡ New Pull"
                    tagClass="bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                    hideAfterSend
                    alreadySent={sentIds.has(cust.customer_number)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUBVIEW: RECENT PULLED DATA (last lot) --- */}
      {selectedMode === 'recent' && (
        <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] space-y-4 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--rim)] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[var(--txt)]">
                📜 Recent Pulled Data{recentTime ? ` • ${new Date(recentTime).toLocaleString()}` : ''}
              </h4>
            </div>
            <span className="text-xs font-mono text-[var(--gold-lt)] font-semibold">
              {recentCustomers.filter(c => !sentIds.has(c.customer_number)).length} / {recentCustomers.length} left to send
            </span>
          </div>

          {recentCustomers.length === 0 ? (
            <div className="py-12 text-center text-[var(--txt3)] space-y-2">
              <div className="text-3xl">📭</div>
              <div className="text-sm">No pulled data yet.</div>
              <p className="text-xs text-[var(--txt3)]">
                Tap "New Customers" to pull.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentCustomers.map(cust => (
                <NumberCard
                  key={cust.id}
                  customerId={cust.customer_id || undefined}
                  customerNumber={cust.customer_number}
                  matches={
                    cust.matching_number_2
                      ? [cust.matching_number, cust.matching_number_2]
                      : [cust.matching_number]
                  }
                  customerName={cust.customer_name}
                  tagLabel="📜 Pulled Data"
                  tagClass="bg-amber-950/40 text-amber-300 border-amber-800/40"
                  hideAfterSend
                  alreadySent={sentIds.has(cust.customer_number)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

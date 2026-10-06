import React, { useState, useEffect } from 'react';
import { Customer, UserProfile } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { NumberCard } from '../NumberCard';

interface MatchingNumberSendProps {
  currentUser: UserProfile;
}

export const MatchingNumberSend: React.FC<MatchingNumberSendProps> = ({ currentUser }) => {
  // Step 1: User name confirmation
  const [userNameInput, setUserNameInput] = useState<string>(currentUser.name);
  const [isUserConfirmed, setIsUserConfirmed] = useState<boolean>(false);

  // Step 2: Selected mode ('recent' | 'new' | null)
  const [selectedMode, setSelectedMode] = useState<'recent' | 'new' | null>(null);

  // New Customer Pull state
  const [pullCount, setPullCount] = useState<number>(1);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullError, setPullError] = useState<string>('');
  const [newlyPulled, setNewlyPulled] = useState<Customer[]>([]);

  // Recent Data state
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [selectedRecentCustomer, setSelectedRecentCustomer] = useState<Customer | null>(null);

  // Quota info
  const [quotaStats, setQuotaStats] = useState(dataStore.getUserPullStats(currentUser.id));

  const refreshRecent = () => {
    const list = dataStore.getUserRecentPulled(currentUser.id, 25);
    setRecentCustomers(list);
    setQuotaStats(dataStore.getUserPullStats(currentUser.id));
  };

  useEffect(() => {
    setUserNameInput(currentUser.name);
    setIsUserConfirmed(false);
    setSelectedMode(null);
    setNewlyPulled([]);
    setSelectedRecentCustomer(null);
    refreshRecent();
  }, [currentUser]);

  const handleConfirmUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNameInput.trim()) return;
    setIsUserConfirmed(true);
    refreshRecent();
  };

  const handlePullNewCustomer = async () => {
    setIsPulling(true);
    setPullError('');

    try {
      const res = await dataStore.allocateCustomers(currentUser.id, pullCount, 'MATCHING_SEND');
      if (!res.success) {
        setPullError(res.error || 'Failed to pull customer.');
        return;
      }

      setNewlyPulled(res.customers);
      refreshRecent();
    } catch (err: any) {
      setPullError(err?.message || 'Error executing atomic allocation.');
    } finally {
      setIsPulling(false);
    }
  };

  // STEP 1: Enter User Name
  if (!isUserConfirmed) {
    return (
      <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-xl text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br from-[var(--violet)] to-[var(--rose)] shadow-lg text-white">
          🚀
        </div>
        <h3 className="text-xl font-bold text-[var(--txt)] mb-1">Matching Number Send</h3>
        <p className="text-xs text-[var(--txt2)] mb-6">
          Step 1: Enter or verify user name to continue with outreach allocation
        </p>

        <form onSubmit={handleConfirmUser} className="space-y-4">
          <div className="text-left">
            <label className="block text-xs font-semibold text-[var(--gold-lt)] uppercase tracking-wider mb-1 font-mono">
              User Name
            </label>
            <input
              type="text"
              value={userNameInput}
              onChange={e => setUserNameInput(e.target.value)}
              placeholder="Enter your name"
              required
              className="w-full px-4 py-3 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] text-sm focus:outline-none focus:border-[var(--gold)] transition-colors font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-bold text-sm text-[var(--ink)] bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Continue to Next Step ▶
          </button>
        </form>

        <div className="mt-4 text-[11px] text-[var(--txt3)] flex items-center justify-center gap-2">
          <span>Logged in as:</span>
          <span className="font-semibold text-[var(--txt2)]">{currentUser.email}</span>
        </div>
      </div>
    );
  }

  // STEP 2: Choose between "Recent Pulled Data" or "New Customer"
  return (
    <div className="space-y-6">
      {/* Top Header / Verified User Bar */}
      <div className="p-4 rounded-2xl border border-[var(--rim)] bg-[var(--card)] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--violet)] to-[var(--rose)] flex items-center justify-center text-white font-bold text-sm shadow">
            {userNameInput.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--txt)] flex items-center gap-2">
              <span>{userNameInput}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                Verified
              </span>
            </div>
            <div className="text-xs text-[var(--txt3)] font-mono">
              Today's quota: {quotaStats.pulledToday} / {quotaStats.dailyLimit} pulled •{' '}
              <strong className="text-[var(--gold-lt)]">{quotaStats.remainingQuota} remaining</strong>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setIsUserConfirmed(false);
            setSelectedMode(null);
          }}
          className="text-xs text-[var(--txt3)] hover:text-[var(--txt)] underline cursor-pointer"
        >
          Change User Name
        </button>
      </div>

      {/* Two Prominent Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Recent Pulled Data */}
        <div
          onClick={() => {
            setSelectedMode('recent');
            setNewlyPulled([]);
            refreshRecent();
          }}
          className={`p-6 rounded-2xl border transition-all cursor-pointer ${
            selectedMode === 'recent'
              ? 'border-[var(--gold)] bg-[rgba(201,147,42,0.08)] shadow-lg ring-1 ring-[var(--gold)]'
              : 'border-[var(--rim)] bg-[var(--card)] hover:border-[rgba(201,147,42,0.3)] hover:bg-[var(--card-hi)]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">📜</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/5 border border-[var(--rim)] text-[var(--txt2)]">
              {recentCustomers.length} on record
            </span>
          </div>
          <h4 className="text-base font-bold text-[var(--txt)] mb-1">Recent Pulled Data</h4>
          <p className="text-xs text-[var(--txt2)] leading-relaxed">
            Send outreach message to a customer previously allocated to your account.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--gold-lt)]">
            <span>Open Recent List</span>
            <span>→</span>
          </div>
        </div>

        {/* Option 2: New Customer */}
        <div
          onClick={() => {
            setSelectedMode('new');
            setSelectedRecentCustomer(null);
          }}
          className={`p-6 rounded-2xl border transition-all cursor-pointer ${
            selectedMode === 'new'
              ? 'border-[var(--violet-lt)] bg-[rgba(123,63,228,0.08)] shadow-lg ring-1 ring-[var(--violet-lt)]'
              : 'border-[var(--rim)] bg-[var(--card)] hover:border-[rgba(123,63,228,0.3)] hover:bg-[var(--card-hi)]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">⚡</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/30 border border-emerald-800/40 text-emerald-400">
              Max {quotaStats.perPullLimit} per pull
            </span>
          </div>
          <h4 className="text-base font-bold text-[var(--txt)] mb-1">New Customer</h4>
          <p className="text-xs text-[var(--txt2)] leading-relaxed">
            Pull a fresh, unallocated customer from CPOS database and instantly generate the matching
            message.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--violet-lt)]">
            <span>Pull Fresh Customer</span>
            <span>→</span>
          </div>
        </div>
      </div>

      {/* --- SUBVIEW: NEW CUSTOMER PULL --- */}
      {selectedMode === 'new' && (
        <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] space-y-4 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--rim)] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[var(--txt)]">⚡ Pull New Available Customer</h4>
              <p className="text-xs text-[var(--txt3)]">
                Atomic database locking ensures no duplicate customer is ever pulled twice.
              </p>
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

          {/* Render newly pulled customer cards */}
          {newlyPulled.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--rim)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span>✅</span> Successfully Allocated ({newlyPulled.length})
                </span>
                <span className="text-xs text-[var(--txt3)] font-mono">
                  Ready to send via WhatsApp / RCS
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
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUBVIEW: RECENT PULLED DATA --- */}
      {selectedMode === 'recent' && (
        <div className="p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] space-y-4 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--rim)] pb-3">
            <div>
              <h4 className="text-sm font-bold text-[var(--txt)]">📜 Your Recently Pulled Customers</h4>
              <p className="text-xs text-[var(--txt3)]">
                Showing customers assigned exclusively to your profile
              </p>
            </div>
            <button
              onClick={refreshRecent}
              className="text-xs text-[var(--gold-lt)] hover:underline flex items-center gap-1"
            >
              🔄 Refresh
            </button>
          </div>

          {recentCustomers.length === 0 ? (
            <div className="py-12 text-center text-[var(--txt3)] space-y-2">
              <div className="text-3xl">📭</div>
              <div className="text-sm">No customers have been pulled yet today.</div>
              <p className="text-xs text-[var(--txt3)]">
                Click "New Customer" above to allocate your first customer!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {recentCustomers.map(cust => {
                  const isSelected = selectedRecentCustomer?.id === cust.id;
                  const matches = cust.matching_number_2
                    ? [cust.matching_number, cust.matching_number_2]
                    : [cust.matching_number];

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedRecentCustomer(cust)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-[var(--gold)] bg-[rgba(201,147,42,0.1)] ring-1 ring-[var(--gold)]'
                          : 'border-[var(--rim)] bg-[var(--inp-bg)] hover:border-[rgba(201,147,42,0.3)]'
                      }`}
                    >
                      <div>
                        <div className="font-mono text-base font-bold text-[var(--txt)] tracking-wider">
                          {cust.customer_number}
                        </div>
                        <div className="text-xs text-[var(--txt2)] flex items-center gap-2 mt-0.5">
                          <span>Matching: <strong className="font-mono text-[var(--gold-lt)]">{matches.join(' & ')}</strong></span>
                          {cust.customer_name && (
                            <span className="text-[var(--violet-lt)] font-medium">
                              • {cust.customer_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-[var(--txt3)]">
                          {cust.pulled_at ? new Date(cust.pulled_at).toLocaleTimeString() : 'Recent'}
                        </span>
                        <span
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-[var(--gold)] text-[var(--ink)]'
                              : 'bg-white/5 border border-[var(--rim)] text-[var(--txt2)] hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ Loaded' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show loaded outreach card for the selected customer */}
              {selectedRecentCustomer && (
                <div className="mt-4 pt-4 border-t border-[var(--rim)] space-y-2">
                  <div className="text-xs font-semibold text-[var(--gold-lt)] uppercase tracking-wider">
                    Outreach Card Ready
                  </div>
                  <NumberCard
                    customerId={selectedRecentCustomer.id}
                    customerNumber={selectedRecentCustomer.customer_number}
                    matches={
                      selectedRecentCustomer.matching_number_2
                        ? [
                            selectedRecentCustomer.matching_number,
                            selectedRecentCustomer.matching_number_2,
                          ]
                        : [selectedRecentCustomer.matching_number]
                    }
                    customerName={selectedRecentCustomer.customer_name}
                    tagLabel="📜 Pulled Data"
                    tagClass="bg-amber-950/40 text-amber-300 border-amber-800/40"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

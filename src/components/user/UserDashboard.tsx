import React, { useState, useEffect } from 'react';
import { UserProfile, PullHistory } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { MatchingNumberSend } from '../matching/MatchingNumberSend';
import { SingleMatch } from '../matching/SingleMatch';
import { BulkMatch } from '../matching/BulkMatch';
import { PositionMatch } from '../matching/PositionMatch';
import { NumberCard } from '../NumberCard';

interface UserDashboardProps {
  currentUser: UserProfile | null;
  onRequestLogin?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, onRequestLogin }) => {
  // If not logged in, default to 'single'; if logged in, default to 'send' (Matching Send)
  const [activeTab, setActiveTab] = useState<'send' | 'single' | 'bulk' | 'check' | 'history'>(
    currentUser ? 'send' : 'single'
  );
  const [stats, setStats] = useState(
    currentUser
      ? dataStore.getUserPullStats(currentUser.id)
      : { pulledToday: 0, remainingQuota: 0, dailyLimit: 0, perPullLimit: 0, totalPulled: 0 }
  );
  const [history, setHistory] = useState<PullHistory[]>([]);

  const refreshData = () => {
    if (currentUser) {
      setStats(dataStore.getUserPullStats(currentUser.id));
      const allPulls = dataStore.getPullHistory();
      setHistory(allPulls.filter(p => p.user_id === currentUser.id));
    }
  };

  useEffect(() => {
    if (currentUser) {
      setActiveTab('send');
      refreshData();
    } else {
      setActiveTab('single');
    }
    const unsubscribe = dataStore.subscribe(refreshData);
    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="space-y-5">
      {/* If Agent is logged in: Show quota stats */}
      {currentUser ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
            <div className="text-base mb-0.5">🔢</div>
            <div className="text-xl sm:text-2xl font-mono font-bold bg-gradient-to-r from-[var(--gold-lt)] to-[var(--gold-pale)] bg-clip-text text-transparent">
              {stats.pulledToday}
            </div>
            <div className="text-[9px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-0.5">
              Pulled Today
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
            <div className="text-base mb-0.5">🎯</div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
              {stats.remainingQuota}
            </div>
            <div className="text-[9px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-0.5">
              Quota Remaining
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
            <div className="text-base mb-0.5">📊</div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[var(--txt)]">
              {stats.dailyLimit}
            </div>
            <div className="text-[9px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-0.5">
              Daily Pull Limit
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
            <div className="text-base mb-0.5">⚡</div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[var(--violet-lt)]">
              {stats.perPullLimit}
            </div>
            <div className="text-[9px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-0.5">
              Max Per Pull
            </div>
          </div>
        </div>
      ) : (
        /* If not logged in: Banner explaining how to unlock Matching Send & History */
        <div className="p-3.5 sm:p-4 rounded-xl border border-[rgba(201,147,42,0.25)] bg-[rgba(201,147,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <div className="text-xs font-bold text-[var(--txt)] flex items-center gap-1.5">
                <span>Customer Matching & History Portal</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[rgba(201,147,42,0.15)] text-[var(--gold-lt)]">
                  Agent Sign In Required
                </span>
              </div>
              <div className="text-[11px] text-[var(--txt3)] leading-relaxed">
                Log in with your agent username/email to pull fresh customers and view your pull history.
              </div>
            </div>
          </div>

          {onRequestLogin && (
            <button
              onClick={onRequestLogin}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white text-xs font-semibold shadow hover:opacity-95 transition-opacity shrink-0 cursor-pointer"
            >
              Sign In as Agent ▶
            </button>
          )}
        </div>
      )}

      {/* Tabs Navigation: Dynamically shows Matching Send & My History when Agent is logged in */}
      <div className="p-1 rounded-xl border border-[var(--rim)] bg-[var(--panel)] grid grid-cols-3 sm:flex items-center gap-1 shadow-sm">
        {currentUser && (
          <button
            onClick={() => setActiveTab('send')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'send'
                ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
                : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🚀</span>
            <span>Matching Send</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('single')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'single'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>👤</span>
          <span>Single (10 Var)</span>
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'bulk'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📦</span>
          <span>Bulk Process</span>
        </button>

        <button
          onClick={() => setActiveTab('check')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'check'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🔍</span>
          <span>Position Match</span>
        </button>

        {currentUser && (
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
                : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📜</span>
            <span>My History</span>
          </button>
        )}
      </div>

      {/* Main View Area */}
      <div>
        {activeTab === 'send' && currentUser && <MatchingNumberSend currentUser={currentUser} />}
        {activeTab === 'single' && <SingleMatch />}
        {activeTab === 'bulk' && <BulkMatch />}
        {activeTab === 'check' && <PositionMatch />}
        {activeTab === 'history' && currentUser && (
          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--txt)]">📜 Your Customer Pull History</h3>
                  <p className="text-xs text-[var(--txt3)]">
                    Trace of customers allocated exclusively to your account from Supabase
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[rgba(201,147,42,0.1)] text-[var(--gold-lt)] border border-[rgba(201,147,42,0.3)]">
                  {history.length} records
                </span>
              </div>

              {history.length === 0 ? (
                <div className="py-12 text-center text-[var(--txt3)]">
                  <div className="text-2xl mb-1.5">📭</div>
                  <div className="text-xs">No customer pull records found yet.</div>
                  <div className="text-[11px] text-[var(--txt3)] mt-0.5">
                    Click "Matching Send" above to allocate your first customer!
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {history.map(item => (
                    <NumberCard
                      key={item.id}
                      customerId={item.customer_id}
                      customerNumber={item.customer_number}
                      matches={
                        item.matching_number_2
                          ? [item.matching_number, item.matching_number_2]
                          : [item.matching_number]
                      }
                      customerName={item.customer_name}
                      tagLabel="📜 Pulled"
                      tagClass="bg-blue-950/40 text-blue-300 border-blue-800/40"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

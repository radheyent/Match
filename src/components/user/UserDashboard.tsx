import React, { useState, useEffect } from 'react';
import { UserProfile, PullHistory } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { MatchingNumberSend } from '../matching/MatchingNumberSend';
import { SingleMatch } from '../matching/SingleMatch';
import { BulkMatch } from '../matching/BulkMatch';
import { PositionMatch } from '../matching/PositionMatch';
import { NumberCard } from '../NumberCard';

interface UserDashboardProps {
  currentUser: UserProfile;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'send' | 'single' | 'bulk' | 'check' | 'history'>('send');
  const [stats, setStats] = useState(dataStore.getUserPullStats(currentUser.id));
  const [history, setHistory] = useState<PullHistory[]>([]);

  const refreshData = () => {
    setStats(dataStore.getUserPullStats(currentUser.id));
    const allPulls = dataStore.getPullHistory();
    setHistory(allPulls.filter(p => p.user_id === currentUser.id));
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = dataStore.subscribe(refreshData);
    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="space-y-6">
      {/* User Quota & Activity Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
          <div className="text-xl mb-1">🔢</div>
          <div className="text-2xl font-mono font-bold bg-gradient-to-r from-[var(--gold-lt)] to-[var(--gold-pale)] bg-clip-text text-transparent">
            {stats.pulledToday}
          </div>
          <div className="text-[10px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-1">
            Pulled Today
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
          <div className="text-xl mb-1">🎯</div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {stats.remainingQuota}
          </div>
          <div className="text-[10px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-1">
            Quota Remaining
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
          <div className="text-xl mb-1">📊</div>
          <div className="text-2xl font-mono font-bold text-[var(--txt)]">
            {stats.dailyLimit}
          </div>
          <div className="text-[10px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-1">
            Daily Pull Limit
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] shadow-sm">
          <div className="text-xl mb-1">⚡</div>
          <div className="text-2xl font-mono font-bold text-[var(--violet-lt)]">
            {stats.perPullLimit}
          </div>
          <div className="text-[10px] font-mono text-[var(--txt3)] uppercase tracking-wider mt-1">
            Max Per Pull
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="p-1 rounded-2xl border border-[var(--rim)] bg-[var(--panel)] grid grid-cols-2 sm:grid-cols-5 gap-1 shadow-sm">
        <button
          onClick={() => setActiveTab('send')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'send'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🚀</span>
          <span>Matching Send</span>
        </button>

        <button
          onClick={() => setActiveTab('single')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'single'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>👤</span>
          <span>Single (10 Var)</span>
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'bulk'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📦</span>
          <span>Bulk Process</span>
        </button>

        <button
          onClick={() => setActiveTab('check')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'check'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🔍</span>
          <span>Position Match</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1 ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-md'
              : 'text-[var(--txt2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <span>📜</span>
          <span>My History</span>
        </button>
      </div>

      {/* Main View Area */}
      <div>
        {activeTab === 'send' && <MatchingNumberSend currentUser={currentUser} />}
        {activeTab === 'single' && <SingleMatch />}
        {activeTab === 'bulk' && <BulkMatch />}
        {activeTab === 'check' && <PositionMatch />}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--txt)]">📜 Your Customer Pull History</h3>
                  <p className="text-xs text-[var(--txt3)]">
                    Audit log of customers assigned to your account with 1-click outreach buttons
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[rgba(201,147,42,0.1)] text-[var(--gold-lt)] border border-[rgba(201,147,42,0.3)]">
                  {history.length} records
                </span>
              </div>

              {history.length === 0 ? (
                <div className="py-12 text-center text-[var(--txt3)]">
                  <div className="text-3xl mb-2">📭</div>
                  <div className="text-sm">No pull records found yet.</div>
                  <div className="text-xs mt-1">Use "Matching Send" to allocate your first customer!</div>
                </div>
              ) : (
                <div className="space-y-3">
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
                      tagLabel="📜 History"
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

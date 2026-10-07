import React, { useState, useEffect } from 'react';
import { UserProfile, PullLot, SendHistory } from '../../types';
import { NumberCard } from '../NumberCard';
import { dataStore } from '../../lib/dataStore';
import { MatchingNumberSend } from '../matching/MatchingNumberSend';
import { SingleMatch } from '../matching/SingleMatch';
import { BulkMatch } from '../matching/BulkMatch';
import { PositionMatch } from '../matching/PositionMatch';

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
  const [lots, setLots] = useState<PullLot[]>([]);
  const [sentNumbers, setSentNumbers] = useState<Set<string>>(new Set());
  const [openLots, setOpenLots] = useState<Set<string>>(new Set());
  const [sendHistory, setSendHistory] = useState<SendHistory[]>([]);

  const refreshData = () => {
    if (currentUser) {
      setStats(dataStore.getUserPullStats(currentUser.id));
      setLots(dataStore.getUserPullLots(currentUser.id, 5));
      setSentNumbers(dataStore.getSentNumbers(currentUser.id));
      setSendHistory(
        dataStore
          .getSendHistory()
          .filter(r => r.user_id === currentUser.id)
          .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
          .slice(0, 50)
      );
    }
  };

  // Only react to login/logout (user id), not to every new currentUser object,
  // so the open tab is not reset after each send.
  useEffect(() => {
    if (currentUser) {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem('match_user_tab');
      } catch {
        saved = null;
      }
      const valid = ['send', 'single', 'bulk', 'check', 'history'];
      setActiveTab(saved && valid.includes(saved) ? (saved as typeof activeTab) : 'send');
    } else {
      setActiveTab('single');
    }
  }, [currentUser?.id]);

  useEffect(() => {
    try {
      sessionStorage.setItem('match_user_tab', activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    refreshData();
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
        {activeTab === 'send' && currentUser && (
          <MatchingNumberSend key={currentUser.id} currentUser={currentUser} />
        )}
        {activeTab === 'single' && <SingleMatch />}
        {activeTab === 'bulk' && <BulkMatch />}
        {activeTab === 'check' && <PositionMatch />}
        {activeTab === 'history' && currentUser && (
          <div className="space-y-4">
            {/* Pulled history (last 50 numbers) grouped into bunches */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--txt)]">📥 Pulled History</h3>
                  <p className="text-xs text-[var(--txt3)]">
                    Your last 5 bunches (one bunch = one pull). Open a bunch to send or re-send.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[rgba(201,147,42,0.1)] text-[var(--gold-lt)] border border-[rgba(201,147,42,0.3)]">
                  {lots.reduce((n, l) => n + l.items.length, 0)} numbers
                </span>
              </div>

              {lots.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--txt3)]">
                  📭 No pulled numbers yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
                  {lots.map((lot, idx) => {
                    const isOpen = openLots.has(lot.key) || (idx === 0 && !openLots.has('closed-' + lot.key));
                    const left = lot.items.filter(i => !sentNumbers.has(i.customer_number)).length;
                    return (
                      <div key={lot.key} className="rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)]">
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button
                            onClick={() => {
                              const next = new Set(openLots);
                              if (isOpen) {
                                next.delete(lot.key);
                                next.add('closed-' + lot.key);
                              } else {
                                next.add(lot.key);
                                next.delete('closed-' + lot.key);
                              }
                              setOpenLots(next);
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="text-xs font-bold text-[var(--txt)]">
                              {isOpen ? '▲' : '▼'} {idx === 0 ? '🆕 Latest bunch' : '📦 Bunch'} • {lot.items.length} numbers
                            </div>
                            <div className="text-[10px] font-mono text-[var(--txt3)]">
                              {new Date(lot.pulled_at).toLocaleString()} • {left} left to send
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              dataStore.setRecentLot(currentUser.id, lot.key);
                              try {
                                sessionStorage.setItem(`match_send_mode_${currentUser.id}`, 'recent');
                              } catch {
                                // ignore
                              }
                              setActiveTab('send');
                            }}
                            className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-[var(--gold-lt)] bg-[rgba(201,147,42,0.1)] border border-[rgba(201,147,42,0.3)] hover:bg-[rgba(201,147,42,0.2)] cursor-pointer"
                          >
                            📤 Send to Matching Recent
                          </button>
                        </div>

                        {isOpen && (
                          <div className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {lot.items.map(item => (
                              <NumberCard
                                key={item.id}
                                customerId={item.customer_id || undefined}
                                customerNumber={item.customer_number}
                                matches={
                                  item.matching_number_2
                                    ? [item.matching_number, item.matching_number_2]
                                    : [item.matching_number]
                                }
                                customerName={item.customer_name}
                                tagLabel="📜 Pulled"
                                tagClass="bg-blue-950/40 text-blue-300 border-blue-800/40"
                                hideAfterSend
                                alreadySent={sentNumbers.has(item.customer_number)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Send message history (last 50) */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--txt)]">📤 Send Message History</h3>
                  <p className="text-xs text-[var(--txt3)]">Your last 50 sent numbers</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-800/40">
                  {sendHistory.length} records
                </span>
              </div>

              {sendHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--txt3)]">
                  📭 No messages sent yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {sendHistory.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)]"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-[var(--txt)] tracking-wider">
                          {item.customer_number}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--txt3)]">
                          {item.channel === 'wa' ? '💬 WhatsApp' : item.channel === 'rcs' ? '✉️ RCS' : '✉️ SMS'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--txt3)] shrink-0">
                        {new Date(item.sent_at).toLocaleString()}
                      </span>
                    </div>
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

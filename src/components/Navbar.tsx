import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { dataStore } from '../lib/dataStore';
import { ThemeToggle } from './ThemeToggle';
import { FormatEditorModal } from './FormatEditorModal';
import { DEF_FMT } from '../lib/constants';

interface NavbarProps {
  currentUser: UserProfile;
  onSelectUser: (userId: string) => void;
  activeView: 'user' | 'admin';
  isAdminUnlocked: boolean;
  onRequestAdminView: () => void;
  onSwitchToUserView: () => void;
  onLockAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectUser,
  activeView,
  isAdminUnlocked,
  onRequestAdminView,
  onSwitchToUserView,
  onLockAdmin,
}) => {
  const [timerText, setTimerText] = useState<string>('00:00');
  const [isFormatModalOpen, setIsFormatModalOpen] = useState<boolean>(false);
  const [isCustomFmt, setIsCustomFmt] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  useEffect(() => {
    const t0 = Date.now();
    const interval = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setTimerText(
        String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
      );
    }, 1000);

    const checkTemplate = () => {
      const cur = dataStore.getActiveTemplate();
      setIsCustomFmt(cur !== DEF_FMT);
      setProfiles(dataStore.getProfiles());
    };

    checkTemplate();
    const unsub = dataStore.subscribe(checkTemplate);

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  return (
    <nav className="sticky top-0 z-[500] h-14 flex items-center justify-between px-3 sm:px-6 bg-[var(--nav-bg)] border-b border-[var(--rim)] backdrop-blur-md transition-colors">
      {/* Left: Vi Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full vi-ring-spin p-[1.5px] bg-[conic-gradient(var(--gold),var(--violet),var(--rose),var(--gold))]">
            <div className="w-full h-full bg-[var(--ink)] rounded-full" />
          </div>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] z-10 leading-none">
            👑
          </span>
          <span className="relative z-10 font-mono text-sm font-bold bg-gradient-to-br from-[var(--gold-lt)] to-[var(--gold-pale)] bg-clip-text text-transparent">
            Vi
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-light text-xs sm:text-sm text-[var(--txt2)] tracking-wider">
            <strong className="text-[var(--gold-lt)] font-semibold not-italic">Vi Premium</strong>{' '}
            Outreach
          </span>

          {isCustomFmt && (
            <span
              onClick={() => setIsFormatModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 cursor-pointer hover:bg-emerald-950/60 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Custom Format
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Session Timer */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-[var(--gold-lt)] bg-[rgba(201,147,42,0.08)] border border-[rgba(201,147,42,0.2)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] pulse-dot" />
          <span>{timerText}</span>
        </div>

        {/* Format Editor Button */}
        <button
          onClick={() => setIsFormatModalOpen(true)}
          className="px-2.5 py-1 rounded-xl text-xs font-semibold border border-[var(--rim)] text-[var(--txt2)] hover:text-white hover:border-[var(--gold)] transition-colors flex items-center gap-1 cursor-pointer"
          title="Open Message Format Editor"
        >
          <span>✏️</span>
          <span className="hidden sm:inline">Format</span>
        </button>

        {/* View Switcher: User Side vs Admin Side (Password Gate Protected) */}
        <div className="flex items-center p-0.5 rounded-xl border border-[var(--rim)] bg-[var(--panel)] text-xs">
          <button
            onClick={onSwitchToUserView}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeView === 'user'
                ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
                : 'text-[var(--txt2)] hover:text-white'
            }`}
          >
            User Side
          </button>

          <button
            onClick={onRequestAdminView}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeView === 'admin'
                ? 'bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] text-[var(--ink)] font-bold shadow-sm'
                : 'text-[var(--txt2)] hover:text-[var(--gold-lt)]'
            }`}
          >
            <span>{isAdminUnlocked ? '👑' : '🔒'}</span>
            <span>Admin Side</span>
          </button>
        </div>

        {/* If Admin is unlocked, show a quick Lock button */}
        {isAdminUnlocked && (
          <button
            onClick={onLockAdmin}
            title="Lock Admin and exit to User side"
            className="p-1.5 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 transition-colors text-xs cursor-pointer"
          >
            🔒 Lock
          </button>
        )}

        {/* User Account Switcher Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--rim)] bg-[var(--card)] hover:border-[var(--rim-hi)] transition-colors cursor-pointer"
          >
            <span className="text-xs">
              {currentUser.role === 'admin' ? '👑' : '👤'}
            </span>
            <span className="text-xs font-bold text-[var(--txt)] max-w-[80px] sm:max-w-[120px] truncate">
              {currentUser.name}
            </span>
            <span className="text-[10px] opacity-50">▼</span>
          </button>

          {showProfileMenu && (
            <div
              className="absolute right-0 mt-2 w-56 p-2 rounded-2xl border border-[var(--rim)] bg-[var(--modal-card)] shadow-2xl z-[600] space-y-1"
              onClick={() => setShowProfileMenu(false)}
            >
              <div className="px-2.5 py-1.5 text-[10px] font-mono text-[var(--txt3)] uppercase tracking-wider border-b border-[var(--rim)]">
                Switch Active Agent
              </div>
              {profiles.map(p => (
                <div
                  key={p.id}
                  onClick={() => onSelectUser(p.id)}
                  className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    p.id === currentUser.id
                      ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white font-bold'
                      : 'text-[var(--txt)] hover:bg-white/5'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate">{p.name}</div>
                    <div className="text-[10px] opacity-75 truncate">{p.email}</div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/20 shrink-0">
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggle />
      </div>

      <FormatEditorModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        onSaved={() => {
          setIsCustomFmt(dataStore.getActiveTemplate() !== DEF_FMT);
        }}
      />
    </nav>
  );
};

import React from 'react';
import { UserProfile } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  currentUser: UserProfile | null;
  isAdminUnlocked: boolean;
  activeView: 'user' | 'admin' | 'login';
  onRequestAdminView: () => void;
  onSwitchToUserView: () => void;
  onLockAdmin: () => void;
  onUserLogout: () => void;
  onRequestUserLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  isAdminUnlocked,
  activeView,
  onRequestAdminView,
  onSwitchToUserView,
  onLockAdmin,
  onUserLogout,
  onRequestUserLogin,
}) => {
  return (
    <nav className="sticky top-0 z-[500] h-13 flex items-center justify-between px-3 sm:px-6 bg-[var(--nav-bg)] border-b border-[var(--rim)] backdrop-blur-md transition-colors">
      {/* Left: Vi Logo & Platform Branding */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full vi-ring-spin p-[1.5px] bg-[conic-gradient(var(--gold),var(--violet),var(--rose),var(--gold))]">
            <div className="w-full h-full bg-[var(--ink)] rounded-full" />
          </div>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] z-10 leading-none">
            👑
          </span>
          <span className="relative z-10 font-mono text-xs font-bold bg-gradient-to-br from-[var(--gold-lt)] to-[var(--gold-pale)] bg-clip-text text-transparent">
            Vi
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-medium tracking-tight text-[var(--txt)]">
            <strong className="text-[var(--gold-lt)] font-semibold not-italic">Vi Premium</strong>{' '}
            <span className="text-[var(--txt2)] font-normal">Outreach</span>
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider text-[var(--txt3)] border border-[var(--rim)] bg-white/5 uppercase">
            Enterprise
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Navigation Mode: User Side vs Admin Side */}
        {currentUser && (
          <button
            onClick={onSwitchToUserView}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeView === 'user'
                ? 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white shadow-sm'
                : 'text-[var(--txt2)] hover:text-white hover:bg-white/5 border border-[var(--rim)]'
            }`}
          >
            Dashboard
          </button>
        )}

        {/* Admin Portal Button (Always Protected by Password) */}
        <button
          onClick={onRequestAdminView}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
            activeView === 'admin'
              ? 'bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] text-[var(--ink)] font-semibold border-transparent shadow-sm'
              : 'border-[var(--rim)] text-[var(--txt2)] hover:text-[var(--gold-lt)] hover:border-[var(--gold)]/40 hover:bg-white/5'
          }`}
          title="Open Admin Control Center"
        >
          <span>{isAdminUnlocked ? '👑' : '🔒'}</span>
          <span className="hidden sm:inline">Admin</span>
          <span className="sm:hidden">Admin</span>
        </button>

        {/* If Admin is unlocked, show a quick Lock button */}
        {isAdminUnlocked && (
          <button
            onClick={onLockAdmin}
            title="Lock Admin and exit to User side"
            className="px-2 py-1 rounded-lg border border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 transition-colors text-xs font-medium cursor-pointer"
          >
            🔒 Lock
          </button>
        )}

        {/* User Authentication Pill: Shows ONLY currently logged-in user with Logout */}
        {currentUser ? (
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-[var(--rim)]">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--rim)] bg-[var(--card)] text-xs">
              <span className="text-[11px] text-[var(--txt3)]">👤</span>
              <span className="font-medium text-[var(--txt)] max-w-[90px] sm:max-w-[130px] truncate">
                {currentUser.name}
              </span>
            </div>
            <button
              onClick={onUserLogout}
              className="px-2 py-1 rounded-lg border border-[var(--rim)] text-[11px] font-medium text-[var(--txt3)] hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
              title="Sign out of current account"
            >
              Logout
            </button>
          </div>
        ) : (
          !isAdminUnlocked && (
            <button
              onClick={onRequestUserLogin}
              className="px-2.5 py-1 rounded-lg border border-[var(--rim)] text-xs font-medium text-[var(--txt2)] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Agent Sign In
            </button>
          )
        )}

        {/* Theme Toggle Button */}
        <ThemeToggle />
      </div>
    </nav>
  );
};

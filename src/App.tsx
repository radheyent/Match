/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { dataStore } from './lib/dataStore';
import { Navbar } from './components/Navbar';
import { UserDashboard } from './components/user/UserDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Footer } from './components/Footer';
import { AdminPasswordModal } from './components/auth/AdminPasswordModal';
import { AgentLoginModal } from './components/auth/AgentLoginModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(dataStore.getActiveUser());
  const [activeView, setActiveView] = useState<'user' | 'admin'>('user');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showAdminPwModal, setShowAdminPwModal] = useState<boolean>(false);
  const [showAgentLoginModal, setShowAgentLoginModal] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      const active = dataStore.getActiveUser();
      setCurrentUser(active ? { ...active } : null);
    };

    const unsub = dataStore.subscribe(handleUpdate);
    return () => unsub();
  }, []);

  const handleRequestAdminView = () => {
    if (isAdminUnlocked) {
      setActiveView('admin');
    } else {
      setShowAdminPwModal(true);
    }
  };

  const handleAdminPasswordSuccess = () => {
    setIsAdminUnlocked(true);
    setShowAdminPwModal(false);

    // Primary admin session
    const adminProfile = dataStore.getProfiles().find(p => p.role === 'admin') || {
      id: 'user-admin-master',
      name: 'Administrator',
      email: 'admin@vi-outreach.com',
      role: 'admin' as const,
      status: 'active' as const,
      daily_pull_limit: 1000,
      per_pull_limit: 100,
    };

    dataStore.setActiveUser(adminProfile.id);
    setCurrentUser({ ...adminProfile });
    setActiveView('admin');
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    dataStore.logout();
    setCurrentUser(null);
    setActiveView('user');
  };

  const handleUserLogout = () => {
    dataStore.logout();
    setCurrentUser(null);
    setActiveView('user');
  };

  const handleAgentLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveView('user');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ink)] text-[var(--txt)] transition-colors">
      <Navbar
        currentUser={currentUser}
        isAdminUnlocked={isAdminUnlocked}
        activeView={activeView}
        onRequestAdminView={handleRequestAdminView}
        onSwitchToUserView={() => setActiveView('user')}
        onLockAdmin={handleLockAdmin}
        onUserLogout={handleUserLogout}
        onRequestUserLogin={() => setShowAgentLoginModal(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
        {/* Hero Branding Header */}
        <section className="text-center py-1.5 sm:py-2.5">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <div className="w-7 h-px bg-gradient-to-r from-transparent to-[var(--gold)]" />
            <span className="text-[9px] font-mono font-medium uppercase tracking-widest text-[var(--gold)]">
              CPOS Smart Matching Platform
            </span>
            <div className="w-7 h-px bg-gradient-to-l from-transparent to-[var(--gold)]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            <span className="bg-gradient-to-r from-[var(--gold-lt)] via-[var(--gold-pale)] to-[var(--violet-lt)] bg-clip-text text-transparent">
              Vi Premium
            </span>{' '}
            <span className="font-light text-[var(--txt2)]">Number Outreach</span>
          </h1>

          <p className="text-[10px] sm:text-[11px] text-[var(--txt3)] uppercase tracking-wider font-mono">
            Smart Matching · WhatsApp & RCS · Bulk Processing · Atomic Supabase Allocation
          </p>
        </section>

        {/* Dynamic Main Workspace */}
        {activeView === 'admin' && isAdminUnlocked && currentUser?.role === 'admin' ? (
          <AdminDashboard currentUser={currentUser} onLockAdmin={handleLockAdmin} />
        ) : (
          <UserDashboard
            currentUser={currentUser?.role === 'user' ? currentUser : null}
            onRequestLogin={() => setShowAgentLoginModal(true)}
          />
        )}

        <Footer onAdminAccessGranted={handleRequestAdminView} />
      </main>

      {/* Admin Password Gate Modal (Strictly 'Ricky@1212') */}
      <AdminPasswordModal
        isOpen={showAdminPwModal}
        onSuccess={handleAdminPasswordSuccess}
        onCancel={() => setShowAdminPwModal(false)}
      />

      {/* Agent Login Modal (Enter Username or Email) */}
      <AgentLoginModal
        isOpen={showAgentLoginModal}
        onClose={() => setShowAgentLoginModal(false)}
        onSuccess={handleAgentLoginSuccess}
        onRequestAdmin={handleRequestAdminView}
      />
    </div>
  );
}

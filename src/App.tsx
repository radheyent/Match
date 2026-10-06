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

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(dataStore.getActiveUser());
  const [activeView, setActiveView] = useState<'user' | 'admin'>('user');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showAdminPwModal, setShowAdminPwModal] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      const active = dataStore.getActiveUser();
      setCurrentUser(active ? { ...active } : null);
    };

    const unsub = dataStore.subscribe(handleUpdate);
    return () => unsub();
  }, []);

  const handleSelectUser = (userId: string) => {
    const targetUser = dataStore.getProfiles().find(p => p.id === userId);
    // If selecting an admin account and admin is not unlocked yet, require password first!
    if (targetUser?.role === 'admin' && !isAdminUnlocked) {
      setShowAdminPwModal(true);
      return;
    }

    dataStore.setActiveUser(userId);
    const u = dataStore.getActiveUser();
    setCurrentUser(u ? { ...u } : null);
    if (u?.role !== 'admin') {
      setActiveView('user');
    }
  };

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

    // Switch to an admin profile if current is regular user
    if (currentUser?.role !== 'admin') {
      const adminProfile = dataStore.getProfiles().find(p => p.role === 'admin');
      if (adminProfile) {
        dataStore.setActiveUser(adminProfile.id);
        setCurrentUser({ ...adminProfile });
      }
    }
    setActiveView('admin');
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    setActiveView('user');
    // Switch to first regular user if desired
    const regularUser = dataStore.getProfiles().find(p => p.role === 'user');
    if (regularUser) {
      dataStore.setActiveUser(regularUser.id);
      setCurrentUser({ ...regularUser });
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] text-[var(--txt)]">
        <div className="text-center space-y-3">
          <div className="animate-spin text-3xl">👑</div>
          <div className="text-sm font-mono text-[var(--txt2)]">Loading Vi Premium Outreach...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ink)] text-[var(--txt)] transition-colors">
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        activeView={activeView}
        isAdminUnlocked={isAdminUnlocked}
        onRequestAdminView={handleRequestAdminView}
        onSwitchToUserView={() => setActiveView('user')}
        onLockAdmin={handleLockAdmin}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero Banner */}
        <section className="text-center py-2 sm:py-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-9 h-px bg-gradient-to-r from-transparent to-[var(--gold)]" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[var(--gold)]">
              CPOS Smart Matching Platform
            </span>
            <div className="w-9 h-px bg-gradient-to-l from-transparent to-[var(--gold)]" />
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-2">
            <span className="bg-gradient-to-r from-[var(--gold-lt)] via-[var(--gold-pale)] to-[var(--violet-lt)] bg-clip-text text-transparent">
              Vi Premium
            </span>{' '}
            <span className="italic font-light text-[var(--txt2)]">Number Outreach</span>
          </h1>

          <p className="text-xs sm:text-sm text-[var(--txt3)] uppercase tracking-wider font-mono">
            Smart Matching · WhatsApp & RCS · Bulk Processing · Atomic Allocation
          </p>
        </section>

        {/* Dynamic View: User Side vs Admin Side (strictly guarded by isAdminUnlocked) */}
        {activeView === 'admin' && isAdminUnlocked ? (
          <AdminDashboard currentUser={currentUser} onLockAdmin={handleLockAdmin} />
        ) : (
          <UserDashboard currentUser={currentUser} />
        )}

        <Footer onAdminAccessGranted={handleRequestAdminView} />
      </main>

      {/* Admin Password Protection Gate Modal */}
      <AdminPasswordModal
        isOpen={showAdminPwModal}
        onSuccess={handleAdminPasswordSuccess}
        onCancel={() => setShowAdminPwModal(false)}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { dataStore } from '../../lib/dataStore';
import { UserProfile } from '../../types';

interface AgentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  onRequestAdmin: () => void;
}

export const AgentLoginModal: React.FC<AgentLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onRequestAdmin,
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await dataStore.loginUser(identifier);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
        setIdentifier('');
      } else {
        setError(res.error || 'Agent account not found. Please contact Administrator.');
      }
    } catch (err: any) {
      setError(err?.message || 'Login error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 sm:p-7 rounded-2xl bg-[var(--modal-card)] border border-[var(--rim)] shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[var(--violet)] to-[var(--rose)] flex items-center justify-center text-xl text-white shadow-md font-bold">
          👤
        </div>

        <h3 className="text-lg font-bold text-[var(--txt)] mb-1">Agent Portal Sign In</h3>
        <p className="text-xs text-[var(--txt3)] mb-5">
          Enter your assigned username or email to unlock customer allocation and history.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--gold-lt)] uppercase tracking-wider mb-1 font-mono">
              Username / Email ID
            </label>
            <input
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={e => {
                setIdentifier(e.target.value);
                setError('');
              }}
              placeholder="e.g. rahul or rahul@vi-outreach.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-xs text-[var(--txt)] font-medium focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl text-xs text-rose-300 bg-rose-950/30 border-l-4 border-rose-500 leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--rim)] text-xs font-semibold text-[var(--txt3)] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] font-bold text-xs text-white hover:opacity-95 shadow cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In ▶'}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-[var(--rim)] text-center">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestAdmin();
            }}
            className="text-[11px] text-[var(--gold-lt)] hover:underline font-medium cursor-pointer"
          >
            🔐 Open Administrator Portal
          </button>
        </div>
      </div>
    </div>
  );
};

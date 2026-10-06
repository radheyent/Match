import React, { useState } from 'react';
import { dataStore } from '../../lib/dataStore';
import { UserProfile } from '../../types';

interface UserLoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  onRequestAdmin: () => void;
}

export const UserLoginView: React.FC<UserLoginViewProps> = ({
  onLoginSuccess,
  onRequestAdmin,
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setError('');
    setIsLoading(true);

    try {
      const res = await dataStore.loginUser(identifier);
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Authentication failed.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'Authentication error.');
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 p-6 sm:p-8 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-xl text-center animate-fade-in">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center text-xl bg-gradient-to-br from-[var(--violet)] to-[var(--rose)] shadow-md text-white font-bold">
        👤
      </div>

      <h2 className="text-xl font-bold text-[var(--txt)] tracking-tight mb-1">
        Agent Workspace Sign In
      </h2>
      <p className="text-xs text-[var(--txt3)] mb-6 leading-relaxed">
        Enter your assigned agent email or username to access number outreach tools
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--gold-lt)] uppercase tracking-wider mb-1.5 font-mono">
            Agent Email / Username
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
            placeholder="agent@vi-outreach.com or name"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-xs text-[var(--txt)] focus:outline-none focus:border-[var(--gold)] transition-colors placeholder:text-[var(--txt3)] font-medium"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs text-rose-300 bg-rose-950/20 border border-rose-500/30 flex items-start gap-2">
            <span>⚠️</span>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isLoading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Sign In to Agent Portal</span>
              <span>▶</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[var(--rim)] text-center space-y-2">
        <p className="text-[11px] text-[var(--txt3)]">
          Agent accounts are provisioned exclusively by System Administrators.
        </p>
        <button
          type="button"
          onClick={onRequestAdmin}
          className="text-xs text-[var(--gold-lt)] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
        >
          <span>🔐</span>
          <span>Administrator Access (Password Protected)</span>
        </button>
      </div>
    </div>
  );
};

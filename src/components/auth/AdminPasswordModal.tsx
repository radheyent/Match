import React, { useState } from 'react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const ADMIN_PASSWORD = 'Ricky@1212';

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setError('');
      setPassword('');
      onSuccess();
    } else {
      setError('❌ Incorrect password. Access denied.');
      setPassword('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm p-6 sm:p-7 rounded-2xl bg-[var(--modal-card)] border border-[rgba(201,147,42,0.3)] shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#7A4A0A] to-[var(--gold)] flex items-center justify-center text-2xl text-[var(--ink)] shadow-lg">
          🔐
        </div>

        <h3 className="text-xl font-bold text-[var(--txt)] mb-1">Admin Access Required</h3>
        <p className="text-xs text-[var(--txt3)] mb-5">
          Please enter the administrator password to open the Admin Control Center.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError('');
              }}
              autoFocus
              placeholder="••••••••••"
              className={`w-full px-4 py-3.5 pr-11 rounded-xl border text-base font-mono tracking-widest text-[var(--txt)] bg-[var(--inp-bg)] focus:outline-none transition-colors ${
                error
                  ? 'border-rose-500 bg-rose-950/10'
                  : 'border-[var(--rim)] focus:border-[var(--gold)]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base text-[var(--txt3)] hover:text-white cursor-pointer"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/30 p-2.5 rounded-lg border-l-4 border-rose-500 text-left font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-[var(--rim)] text-xs font-semibold text-[var(--txt3)] hover:text-white cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] font-bold text-xs text-[var(--ink)] hover:opacity-95 shadow-lg cursor-pointer transition-opacity"
            >
              🔓 Unlock Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

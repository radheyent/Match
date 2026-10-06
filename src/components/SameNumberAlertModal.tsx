import React from 'react';

interface SameNumberAlertModalProps {
  isOpen: boolean;
  number: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SameNumberAlertModal: React.FC<SameNumberAlertModalProps> = ({
  isOpen,
  number,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm p-6 rounded-2xl bg-[var(--modal-card)] border border-[rgba(212,68,122,0.35)] shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-[#8B1A3A] to-[var(--rose)] text-white shadow-lg">
          ⚠️
        </div>
        <h3 className="text-xl font-bold text-[var(--txt)] mb-2">Same Number Alert</h3>
        <p className="text-sm text-[var(--txt2)] leading-relaxed mb-6">
          You are sending to the{' '}
          <strong className="text-[var(--gold-pale)] font-semibold">{number}</strong>, which is the
          exact same number entered in CPOS. Are you sure you want to proceed?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--rim)] text-[var(--txt3)] hover:text-[var(--txt)] hover:bg-white/5 transition-colors font-medium text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-[2] py-2.5 px-4 rounded-xl bg-gradient-to-br from-[#8B1A3A] to-[var(--rose)] text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity cursor-pointer"
          >
            ✅ Yes, Send
          </button>
        </div>
      </div>
    </div>
  );
};

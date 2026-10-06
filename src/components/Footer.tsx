import React from 'react';

interface FooterProps {
  onAdminAccessGranted?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onAdminAccessGranted }) => {
  return (
    <footer className="mt-16 border-t border-[var(--rim)] pt-8 pb-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full vi-ring-spin p-[1px] bg-[conic-gradient(var(--gold),var(--violet),var(--rose),var(--gold))]">
            <div className="w-full h-full bg-[var(--ink)] rounded-full" />
          </div>
          <span className="relative z-10 font-mono text-[10px] font-bold text-[var(--gold-lt)]">
            Vi
          </span>
        </div>
        <div className="w-px h-3.5 bg-[var(--rim)]" />
        <span className="text-xs font-light tracking-widest italic text-[var(--txt3)]">
          Premium Outreach Platform
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
        <span className="px-2.5 py-1 rounded text-[10px] bg-white/5 border border-[var(--rim)] text-[var(--txt3)]">
          WhatsApp Ready
        </span>
        <span className="px-2.5 py-1 rounded text-[10px] bg-white/5 border border-[var(--rim)] text-[var(--txt3)]">
          RCS Enabled
        </span>
        <span className="px-2.5 py-1 rounded text-[10px] bg-white/5 border border-[var(--rim)] text-[var(--txt3)]">
          CPOS Compatible
        </span>
        <span className="px-2.5 py-1 rounded text-[10px] bg-white/5 border border-[var(--rim)] text-[var(--txt3)]">
          Bulk Processing
        </span>
        <span className="px-2.5 py-1 rounded text-[10px] bg-white/5 border border-[var(--rim)] text-[var(--txt3)]">
          Atomic Supabase Allocation
        </span>
      </div>

      <div className="text-xs text-[var(--txt3)] font-mono space-y-1">
        <div>
          <button
            onClick={onAdminAccessGranted}
            className="hover:text-[var(--gold-lt)] transition-colors cursor-pointer text-xs underline decoration-dotted"
            title="Administrator Access"
          >
            Internal Use Only
          </button>
        </div>
        <div className="text-[11px] tracking-widest pt-1">
          <strong>RAM</strong>-<strong>Gurgaon</strong>-V.17.04.2026
        </div>
      </div>
    </footer>
  );
};

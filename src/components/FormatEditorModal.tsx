import React, { useState, useEffect } from 'react';
import { DEF_FMT } from '../lib/constants';
import { buildMsg } from '../lib/messageBuilder';
import { dataStore } from '../lib/dataStore';

interface FormatEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const FormatEditorModal: React.FC<FormatEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [template, setTemplate] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTemplate(dataStore.getActiveTemplate());
      setIsSaved(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const insertPlaceholder = (ph: string) => {
    const textarea = document.getElementById('fmtTextarea') as HTMLTextAreaElement | null;
    if (!textarea) {
      setTemplate(prev => prev + ph);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextVal = template.substring(0, start) + ph + template.substring(end);
    setTemplate(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + ph.length, start + ph.length);
    }, 10);
  };

  const handleSave = () => {
    if (!template.trim()) {
      setError('Template cannot be empty.');
      return;
    }
    dataStore.saveTemplate(template.trim());
    setIsSaved(true);
    setError('');
    onSaved();
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleReset = () => {
    if (window.confirm('Restore default template?')) {
      const def = dataStore.resetTemplate();
      setTemplate(def);
      setIsSaved(false);
      setError('');
      onSaved();
    }
  };

  // Preview generated using buildMsg with sample numbers
  const previewText = buildMsg(
    '9876543210',
    ['9876543219', '9876543211'],
    'Ricky',
    template
  );

  return (
    <div
      className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--card)] border border-[rgba(123,63,228,0.25)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] text-white">
          <div>
            <h3 className="text-lg font-bold">✏️ Message Format Editor</h3>
            <p className="text-xs text-white/80">WhatsApp & RCS messages will automatically adapt</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Placeholders helper */}
          <div className="p-4 rounded-xl border border-[rgba(201,147,42,0.2)] bg-[rgba(201,147,42,0.05)]">
            <div className="text-xs font-semibold text-[var(--gold-lt)] uppercase tracking-wider mb-2">
              ⚡ Placeholders — Click to Insert
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                onClick={() => insertPlaceholder('{custNum}')}
                className="flex items-center justify-between p-2 rounded-lg bg-[rgba(201,147,42,0.1)] hover:bg-[rgba(201,147,42,0.2)] cursor-pointer border border-[rgba(201,147,42,0.2)] transition-colors"
              >
                <code className="font-mono text-[var(--gold-pale)] font-bold">{'{custNum}'}</code>
                <span className="text-[var(--txt2)]">Customer phone</span>
              </div>
              <div
                onClick={() => insertPlaceholder('{matchNum}')}
                className="flex items-center justify-between p-2 rounded-lg bg-[rgba(201,147,42,0.1)] hover:bg-[rgba(201,147,42,0.2)] cursor-pointer border border-[rgba(201,147,42,0.2)] transition-colors"
              >
                <code className="font-mono text-[var(--gold-pale)] font-bold">{'{matchNum}'}</code>
                <span className="text-[var(--txt2)]">1st matching phone</span>
              </div>
              <div
                onClick={() => insertPlaceholder('{matchNum2}')}
                className="flex items-center justify-between p-2 rounded-lg bg-[rgba(201,147,42,0.1)] hover:bg-[rgba(201,147,42,0.2)] cursor-pointer border border-[rgba(201,147,42,0.2)] transition-colors"
              >
                <code className="font-mono text-[var(--gold-pale)] font-bold">{'{matchNum2}'}</code>
                <span className="text-[var(--txt2)]">2nd matching phone</span>
              </div>
              <div
                onClick={() => insertPlaceholder('{name}')}
                className="flex items-center justify-between p-2 rounded-lg bg-[rgba(201,147,42,0.1)] hover:bg-[rgba(201,147,42,0.2)] cursor-pointer border border-[rgba(201,147,42,0.2)] transition-colors"
              >
                <code className="font-mono text-[var(--gold-pale)] font-bold">{'{name}'}</code>
                <span className="text-[var(--txt2)]">Customer name</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--txt3)] border-t border-[rgba(201,147,42,0.15)] pt-2 leading-relaxed">
              💡 <strong>Smart Feature:</strong> Any line containing <code className="text-[var(--gold-pale)]">{'{matchNum2}'}</code> is automatically removed from outreach messages if no second matching number exists!
            </p>
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-semibold text-[var(--txt2)] uppercase tracking-wider mb-1.5 font-mono">
              Template Text
            </label>
            <textarea
              id="fmtTextarea"
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={8}
              className="w-full p-3.5 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs leading-relaxed focus:outline-none focus:border-[var(--violet-lt)] transition-colors"
            />
          </div>

          {error && <div className="text-xs text-rose-400">⚠️ {error}</div>}

          {/* Live Preview Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-xs font-medium text-[var(--txt2)] hover:text-[var(--txt)] py-1"
            >
              <span>{showPreview ? '▼' : '▶'}</span>
              <span>Live Preview with Sample Data</span>
            </button>
            {showPreview && (
              <div className="mt-2 p-3.5 rounded-xl border border-[var(--rim)] bg-black/20 text-[var(--txt2)] font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {previewText}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--rim)] bg-[var(--panel)]">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--rim)] text-[var(--txt3)] hover:text-rose-400 hover:border-rose-400/40 transition-colors"
          >
            🔄 Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--rim)] text-[var(--txt2)] hover:text-[var(--txt)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-5 py-2 text-xs font-bold rounded-lg text-white transition-all shadow-md ${
                isSaved
                  ? 'bg-emerald-600'
                  : 'bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] hover:opacity-95'
              }`}
            >
              {isSaved ? '✅ Saved!' : '💾 Save Format'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

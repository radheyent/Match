import React, { useState } from 'react';
import { NumberCard } from '../NumberCard';
import { SameNumberAlertModal } from '../SameNumberAlertModal';

export const SingleMatch: React.FC = () => {
  const [inputVal, setInputVal] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [variations, setVariations] = useState<Array<{ number: string; isSame: boolean }>>([]);
  const [alertData, setAlertData] = useState<{
    isOpen: boolean;
    number: string;
    actionUrl: string;
    type: 'wa' | 'rcs';
  }>({
    isOpen: false,
    number: '',
    actionUrl: '',
    type: 'wa',
  });

  const handleGenerate = () => {
    const clean = inputVal.trim().replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      setVariations([]);
      return;
    }
    setError('');

    const results: Array<{ number: string; isSame: boolean }> = [];
    const prefix = clean.substring(0, 9);
    const lastDigit = clean[9];

    for (let i = 0; i <= 9; i++) {
      const generated = prefix + i;
      const isSame = String(i) === lastDigit;
      results.push({ number: generated, isSame });
    }

    setVariations(results);
  };

  const handleAlertTrigger = (num: string, actionUrl: string, type: 'wa' | 'rcs') => {
    setAlertData({
      isOpen: true,
      number: num,
      actionUrl,
      type,
    });
  };

  const confirmSameNumberSend = () => {
    const { actionUrl, type } = alertData;
    setAlertData(prev => ({ ...prev, isOpen: false }));
    if (type === 'wa') {
      window.open(actionUrl, '_blank');
    } else {
      window.location.href = actionUrl;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 sm:p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-lg transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--gold-lt)]">
            📋 CPOS Available Number
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[rgba(201,147,42,0.3)] to-transparent" />
        </div>

        <div className="relative mb-4">
          <input
            type="tel"
            maxLength={10}
            value={inputVal}
            onChange={e => {
              setInputVal(e.target.value);
              setError('');
            }}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="XXXXXXXXXX"
            className="w-full px-4 py-3.5 pr-12 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xl sm:text-2xl tracking-widest placeholder:tracking-widest focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-40 pointer-events-none">
            📱
          </span>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-3.5 px-6 rounded-xl text-white font-semibold text-sm sm:text-base bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow-lg hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          ▶ Generate 10 Variations
        </button>

        {error && (
          <div className="mt-3 p-3 rounded-lg text-xs text-rose-300 bg-rose-950/20 border-l-4 border-rose-500">
            ⚠️ {error}
          </div>
        )}
      </div>

      {variations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--txt2)]">Generated Variations</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[rgba(201,147,42,0.1)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-lt)]">
              {variations.length} numbers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {variations.map((item, idx) => (
              <NumberCard
                key={idx}
                customerNumber={item.number}
                matches={[inputVal.trim()]}
                tagLabel={item.isSame ? '⭐ Entered' : '✦ Match'}
                tagClass={
                  item.isSame
                    ? 'bg-[rgba(201,147,42,0.18)] text-[var(--gold-pale)] border-[rgba(201,147,42,0.4)]'
                    : 'bg-purple-900/30 text-purple-300 border-purple-700/40'
                }
                highlightPosition={9}
                isEnteredNumber={item.isSame}
                onSameNumberAlert={handleAlertTrigger}
              />
            ))}
          </div>
        </div>
      )}

      <SameNumberAlertModal
        isOpen={alertData.isOpen}
        number={alertData.number}
        onConfirm={confirmSameNumberSend}
        onCancel={() => setAlertData(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

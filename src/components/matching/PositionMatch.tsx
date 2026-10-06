import React, { useState } from 'react';
import { NumberCard } from '../NumberCard';
import { SameNumberAlertModal } from '../SameNumberAlertModal';

export const PositionMatch: React.FC = () => {
  const [inputVal, setInputVal] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loadedNumber, setLoadedNumber] = useState<string>('');
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [generatedList, setGeneratedList] = useState<Array<{ number: string; isSame: boolean }>>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);

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

  const handleLoadDigits = () => {
    const clean = inputVal.trim().replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit number.');
      setLoadedNumber('');
      setSelectedPos(null);
      setGeneratedList([]);
      return;
    }
    setError('');
    setLoadedNumber(clean);
    setSelectedPos(null);
    setGeneratedList([]);
  };

  const handleSelectPos = (pos: number) => {
    setSelectedPos(pos);
    const prefix = loadedNumber.substring(0, pos);
    const suffix = loadedNumber.substring(pos + 1);

    const results: Array<{ number: string; isSame: boolean }> = [];
    for (let d = 0; d <= 9; d++) {
      // For position 0 (first digit), mobile numbers in India start with 6,7,8,9
      if (pos === 0 && d < 6) continue;
      const target = prefix + d + suffix;
      const isSame = target === loadedNumber;
      results.push({ number: target, isSame });
    }

    setGeneratedList(results);
    setIsCopied(false);
  };

  const handleCopyAll = () => {
    const text = generatedList.map(item => item.number).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
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
            🔍 CPOS Number — Position Match
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
            onKeyDown={e => e.key === 'Enter' && handleLoadDigits()}
            placeholder="XXXXXXXXXX"
            className="w-full px-4 py-3.5 pr-12 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xl sm:text-2xl tracking-widest focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-40 pointer-events-none">
            🔢
          </span>
        </div>

        <button
          onClick={handleLoadDigits}
          className="w-full py-3.5 px-6 rounded-xl text-[var(--ink)] font-bold text-sm sm:text-base bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          📍 Load Digit Selector
        </button>

        {error && (
          <div className="mt-3 p-3 rounded-lg text-xs text-rose-300 bg-rose-950/20 border-l-4 border-rose-500">
            ⚠️ {error}
          </div>
        )}

        {/* Digit Selector Grid */}
        {loadedNumber && (
          <div className="mt-6 pt-5 border-t border-[var(--rim)]">
            <div className="text-center font-mono text-xs uppercase tracking-widest text-[var(--txt3)] mb-3">
              Select Position to Vary
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {loadedNumber.split('').map((digit, pos) => {
                const isSelected = selectedPos === pos;
                return (
                  <button
                    key={pos}
                    onClick={() => handleSelectPos(pos)}
                    className={`w-11 h-12 rounded-xl flex flex-col items-center justify-center border font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#7A4A0A] to-[var(--gold)] text-[#0E0B1A] border-transparent shadow-lg scale-105 font-bold'
                        : 'border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] hover:border-[var(--rim-hi)] hover:bg-white/5'
                    }`}
                  >
                    <span className="text-base leading-none">{digit}</span>
                    <span
                      className={`text-[9px] mt-1 ${
                        isSelected ? 'text-[#0E0B1A]/70' : 'text-[var(--txt3)]'
                      }`}
                    >
                      P{pos + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Generated list */}
      {generatedList.length > 0 && selectedPos !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--txt2)]">
              Position {selectedPos + 1} Matches
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[rgba(201,147,42,0.1)] border border-[rgba(201,147,42,0.3)] text-[var(--gold-lt)]">
              {generatedList.length} numbers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {generatedList.map((item, idx) => (
              <NumberCard
                key={idx}
                customerNumber={item.number}
                matches={[loadedNumber]}
                tagLabel={item.isSame ? '⭐ Entered' : '✦ Pos'}
                tagClass={
                  item.isSame
                    ? 'bg-[rgba(201,147,42,0.18)] text-[var(--gold-pale)] border-[rgba(201,147,42,0.4)]'
                    : 'bg-rose-950/30 text-rose-300 border-rose-800/40'
                }
                highlightPosition={selectedPos}
                isEnteredNumber={item.isSame}
                onSameNumberAlert={handleAlertTrigger}
              />
            ))}
          </div>

          {/* Quick Copy Panel */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[var(--gold-lt)] uppercase tracking-wider">
                Quick Copy List
              </span>
              <span className="text-xs font-mono text-[var(--txt3)]">
                {generatedList.length} numbers
              </span>
            </div>
            <div className="flex gap-3 items-stretch">
              <textarea
                readOnly
                rows={4}
                value={generatedList.map(item => item.number).join('\n')}
                className="flex-1 p-3 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs leading-relaxed resize-none focus:outline-none"
              />
              <button
                onClick={handleCopyAll}
                className={`px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-[#7A4A0A] to-[var(--gold)] text-[var(--ink)] hover:opacity-90'
                }`}
              >
                {isCopied ? '✅ Copied' : '📋 Copy All'}
              </button>
            </div>
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

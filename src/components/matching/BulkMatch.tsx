import React, { useState } from 'react';
import { NumberCard } from '../NumberCard';

interface BulkParsedRow {
  customer: string;
  matches: string[];
  name?: string;
}

export const BulkMatch: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<BulkParsedRow[]>([]);

  const handleProcessBulk = () => {
    const text = inputText.trim();
    if (!text) {
      setError('Input field is empty. Please paste your numbers.');
      setResults([]);
      return;
    }
    setError('');

    const lines = text.split('\n');
    const parsed: BulkParsedRow[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      const cust = parts[0].replace(/\D/g, '');
      const match1 = parts[1].replace(/\D/g, '');
      let match2 = '';
      let name = '';

      if (parts.length === 3) {
        const cleanedThird = parts[2].replace(/\D/g, '');
        // If 3rd column is a 10-digit number, treat as 2nd match; otherwise customer name
        if (/^\d+$/.test(parts[2]) && cleanedThird.length === 10) {
          match2 = cleanedThird;
        } else {
          name = parts[2];
        }
      } else if (parts.length >= 4) {
        const cleanedThird = parts[2].replace(/\D/g, '');
        if (/^\d+$/.test(parts[2]) && cleanedThird.length === 10) {
          match2 = cleanedThird;
        }
        name = parts[3];
      }

      if (cust.length === 10 && match1.length === 10) {
        const matchesArr = match2.length === 10 ? [match1, match2] : [match1];
        parsed.push({
          customer: cust,
          matches: matchesArr,
          name: name || undefined,
        });
      }
    }

    if (parsed.length === 0) {
      setError('No valid 10-digit number pairs found. Check format: Customer, Match1, [Match2], [Name]');
      setResults([]);
      return;
    }

    setResults(parsed);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 sm:p-6 rounded-2xl border border-[var(--rim)] bg-[var(--card)] shadow-lg transition-colors">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--gold-lt)]">
            📦 Bulk Input Processing
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[rgba(201,147,42,0.3)] to-transparent" />
        </div>

        <div className="p-3.5 rounded-xl border border-[rgba(123,63,228,0.2)] bg-[rgba(123,63,228,0.06)] text-xs text-[var(--txt2)] leading-relaxed mb-4">
          <span className="text-base mr-1">💡</span>
          <strong>Flexible Format:</strong> Enter one pair per line:<br />
          • <code>Customer, Match1</code><br />
          • <code>Customer, Match1, Name</code><br />
          • <code>Customer, Match1, Match2</code> (if 3rd is 10 digits)<br />
          • <code>Customer, Match1, Match2, Name</code>
        </div>

        <textarea
          rows={6}
          value={inputText}
          onChange={e => {
            setInputText(e.target.value);
            setError('');
          }}
          placeholder="98XXXXXXXX, 98XXXXXX01&#10;99XXXXXXXX, 99XXXXXX05, Ricky&#10;88XXXXXXXX, 88XXXXXX03, 88XXXXXX09&#10;77XXXXXXXX, 77XXXXXX02, 77XXXXXX07, Manish"
          className="w-full p-4 rounded-xl border border-[var(--rim)] bg-[var(--inp-bg)] text-[var(--txt)] font-mono text-xs sm:text-sm leading-relaxed placeholder:text-[var(--txt3)] focus:outline-none focus:border-[var(--violet-lt)] transition-colors mb-4"
        />

        <button
          onClick={handleProcessBulk}
          className="w-full py-3.5 px-6 rounded-xl text-white font-semibold text-sm sm:text-base bg-gradient-to-r from-[var(--violet)] to-[var(--rose)] shadow-lg hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          ⚡ Generate All Cards ({results.length > 0 ? results.length : 'Batch'})
        </button>

        {error && (
          <div className="mt-3 p-3 rounded-lg text-xs text-rose-300 bg-rose-950/20 border-l-4 border-rose-500">
            ⚠️ {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--txt2)]">Bulk Results</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[rgba(123,63,228,0.15)] border border-[rgba(123,63,228,0.3)] text-[var(--violet-lt)]">
              {results.length} numbers processed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {results.map((row, idx) => (
              <NumberCard
                key={idx}
                customerNumber={row.customer}
                matches={row.matches}
                customerName={row.name}
                tagLabel="📦 Bulk"
                tagClass="bg-indigo-900/30 text-indigo-300 border-indigo-700/40"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

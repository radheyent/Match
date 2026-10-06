import React, { useState } from 'react';
import { buildMsg, getWhatsAppLink, getRcsSmsLink } from '../lib/messageBuilder';
import { dataStore } from '../lib/dataStore';

interface NumberCardProps {
  customerNumber: string;
  matches: string[];
  customerName?: string;
  tagClass?: string;
  tagLabel: string;
  highlightPosition?: number;
  isEnteredNumber?: boolean;
  onSameNumberAlert?: (number: string, actionUrl: string, type: 'wa' | 'rcs') => void;
  customerId?: string;
}

export const NumberCard: React.FC<NumberCardProps> = ({
  customerNumber,
  matches,
  customerName,
  tagClass = 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  tagLabel,
  highlightPosition = -1,
  isEnteredNumber = false,
  onSameNumberAlert,
  customerId,
}) => {
  const [isSent, setIsSent] = useState<boolean>(false);

  const activeTemplate = dataStore.getActiveTemplate();
  const message = buildMsg(customerNumber, matches, customerName, activeTemplate);
  const waUrl = getWhatsAppLink(customerNumber, message);
  const rcsUrl = getRcsSmsLink(customerNumber, message);

  const handleWaClick = (e: React.MouseEvent) => {
    if (isEnteredNumber && onSameNumberAlert) {
      e.preventDefault();
      onSameNumberAlert(customerNumber, waUrl, 'wa');
      return;
    }
    dataStore.recordSend({
      customer_number: customerNumber,
      customer_id: customerId,
      channel: 'wa',
      message,
    });
    setIsSent(true);
  };

  const handleRcsClick = (e: React.MouseEvent) => {
    if (isEnteredNumber && onSameNumberAlert) {
      e.preventDefault();
      onSameNumberAlert(customerNumber, rcsUrl, 'rcs');
      return;
    }
    dataStore.recordSend({
      customer_number: customerNumber,
      customer_id: customerId,
      channel: 'rcs',
      message,
    });
    setIsSent(true);
  };

  // Render phone digits with optional highlighted index
  const renderNumberDigits = () => {
    if (highlightPosition < 0 || highlightPosition >= customerNumber.length) {
      return <span>{customerNumber}</span>;
    }
    return (
      <>
        {customerNumber.split('').map((digit, idx) => (
          <span
            key={idx}
            className={
              idx === highlightPosition
                ? 'text-[var(--gold-pale)] font-bold text-lg underline decoration-[var(--gold)] decoration-2'
                : ''
            }
          >
            {digit}
          </span>
        ))}
      </>
    );
  };

  return (
    <div
      className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all ${
        isEnteredNumber
          ? 'border-[rgba(201,147,42,0.45)] bg-[rgba(201,147,42,0.08)] shadow-sm'
          : 'border-[var(--rim)] bg-[var(--card)] hover:border-[rgba(201,147,42,0.25)] hover:bg-[var(--card-hi)]'
      }`}
    >
      <div className="flex-1 min-w-0 pr-3">
        <div
          className={`font-mono text-base font-medium tracking-wider mb-1 truncate ${
            isEnteredNumber ? 'text-[var(--gold-pale)] font-semibold' : 'text-[var(--txt)]'
          }`}
        >
          {renderNumberDigits()}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {matches.length > 0 && (
            <span className="font-mono text-[11px] text-[var(--txt3)] truncate">
              ↔ {matches.join(' & ')}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${tagClass}`}
          >
            {tagLabel}
          </span>
          {customerName && (
            <span className="text-[11px] text-[var(--violet-lt)] font-medium truncate">
              👤 {customerName}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={isEnteredNumber ? '#' : waUrl}
          target={isEnteredNumber ? undefined : '_blank'}
          rel="noopener noreferrer"
          onClick={handleWaClick}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity inline-flex items-center gap-1 ${
            isSent
              ? 'bg-white/10 text-[var(--txt3)] cursor-default'
              : 'bg-[#1FAD54] hover:opacity-90 shadow-sm'
          }`}
        >
          {isSent ? '✅' : '💬 WA'}
        </a>

        <a
          href={isEnteredNumber ? '#' : rcsUrl}
          onClick={handleRcsClick}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity inline-flex items-center gap-1 ${
            isSent
              ? 'bg-white/10 text-[var(--txt3)] cursor-default'
              : 'bg-[#1667D9] hover:opacity-90 shadow-sm'
          }`}
        >
          {isSent ? '✅' : '✉️ RCS'}
        </a>
      </div>
    </div>
  );
};

import { DEF_FMT } from './constants';

/**
 * Builds the outreach message.
 * Matches: array of 1 or 2 ten-digit numbers.
 * Any template line containing {matchNum2} is auto-removed if no 2nd match number exists.
 */
export function buildMsg(
  custNum: string,
  matches: string[],
  name?: string,
  customFmt?: string | null
): string {
  const m1 = (matches && matches[0]) ? matches[0] : '';
  const m2 = (matches && matches[1]) ? matches[1] : '';
  const displayName = (name && name.trim()) ? name.trim() : 'Sir/Mam';
  const tmpl = customFmt || DEF_FMT;

  return tmpl
    .split('\n')
    .filter(line => {
      // If line has {matchNum2} placeholder but no 2nd match number exists, drop the entire line
      if (line.includes('{matchNum2}') && !m2) {
        return false;
      }
      return true;
    })
    .map(line =>
      line
        .replace(/\{custNum\}/g, custNum)
        .replace(/\{matchNum2\}/g, m2)
        .replace(/\{matchNum\}/g, m1)
        .replace(/\{name\}/g, displayName)
    )
    .join('\n');
}

export function getWhatsAppLink(custNum: string, msg: string): string {
  const clean = custNum.replace(/\D/g, '');
  return `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`;
}

export function getRcsSmsLink(custNum: string, msg: string): string {
  const clean = custNum.replace(/\D/g, '');
  return `sms:+91${clean}?body=${encodeURIComponent(msg)}`;
}

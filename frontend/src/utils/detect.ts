import { ColumnType } from './types';
import { parseISO, isValid as isValidDate } from 'date-fns';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Validators de base
export function isURL(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}
export function isEmail(s: string): boolean {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  return EMAIL_RE.test(s);
}
export function isIBAN(s: string): boolean {
  const v = s.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  // mod-97
  const re = v.slice(4) + v.slice(0, 4);
  const toNum = re.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (let i = 0; i < toNum.length; i += 7) {
    rem = Number(String(rem) + toNum.slice(i, i + 7)) % 97;
  }
  return rem === 1;
}
export function isPhoneE164Like(s: string, defaultCountry = 'FR'): boolean {
  const p = parsePhoneNumberFromString(s, defaultCountry as any);
  return !!(p && p.isValid());
}
export function toPhoneE164(s: string, defaultCountry = 'FR'): string | null {
  const p = parsePhoneNumberFromString(s, defaultCountry as any);
  return p && p.isValid() ? p.number : null;
}

export function detectColumnType(values: any[]): ColumnType {
  const nonNull = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'text';

  // Boolean?
  const boolSet = new Set(nonNull.map(v => String(v).toLowerCase()));
  const isBool = [...boolSet].every(v => ['true','false','0','1','yes','no','oui','non'].includes(v));
  if (isBool) return 'boolean';

  // Number?
  const isNums = nonNull.every(v => !isNaN(Number(String(v).toString().replace(',', '.'))));
  if (isNums) return 'number';

  // Email?
  const emailShare = nonNull.filter(v => isEmail(String(v))).length / nonNull.length;
  if (emailShare > 0.6) return 'email';

  // URL?
  const urlShare = nonNull.filter(v => isURL(String(v))).length / nonNull.length;
  if (urlShare > 0.6) return 'url';

  // IBAN?
  const ibanShare = nonNull.filter(v => isIBAN(String(v))).length / nonNull.length;
  if (ibanShare > 0.6) return 'iban';

  // Phone heuristic
  const phoneShare = nonNull.filter(v => isPhoneE164Like(String(v))).length / nonNull.length;
  if (phoneShare > 0.5) return 'phone';

  // Date ISO-ish?
  const dateShare = nonNull.filter(v => {
    const s = String(v).trim();
    const d = parseISO(s);
    return isValidDate(d);
  }).length / nonNull.length;
  if (dateShare > 0.5) return 'date';

  return 'text';
}

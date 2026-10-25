export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ Owner validation ============

export function formatAttendeeList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

export function validateOwner(rawInput: string, attendees: string[]): ValidationResult<string> {
  const input = rawInput.trim();
  if (!input) return { ok: false, error: "Enter an attendee's name." };

  if (attendees.length === 0) {
    return {
      ok: false,
      error:
        'No attendees could be identified from this transcript yet. Add an "Attendees: ..." line, then try again.',
    };
  }

  const exact = attendees.find((a) => a.toLowerCase() === input.toLowerCase());
  if (exact) return { ok: true, value: exact };

  const mentioned = attendees.filter((a) => new RegExp(`\\b${escapeRegExp(a)}\\b`, 'i').test(input));
  if (mentioned.length === 1) return { ok: true, value: mentioned[0] };
  if (mentioned.length > 1) {
    return {
      ok: false,
      error: `That could mean more than one attendee. Enter just the name: ${formatAttendeeList(attendees)}.`,
    };
  }

  return {
    ok: false,
    error: `"${input}" isn't listed as an attendee. Choose ${formatAttendeeList(attendees)}.`,
  };
}

// ============ Date parsing core ============

function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 0 || m > 11 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d;
}

function toIso(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function addDaysIso(anchor: Date, days: number): string {
  const dt = new Date(anchor.getTime());
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function isoYear(iso: string): number {
  return Number(iso.slice(0, 4));
}

function setIsoYear(iso: string, year: number): string {
  return `${year.toString().padStart(4, '0')}${iso.slice(4)}`;
}

function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

interface DateParseResult {
  ok: boolean;
  iso?: string;
  yearExplicit?: boolean;
  error?: string;
}

function parseDateInput(raw: string, anchor: Date): DateParseResult {
  const input = raw.trim();
  const lower = input.toLowerCase();

  // Canonical ISO: YYYY-MM-DD (always unambiguous)
  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]) - 1;
    const d = Number(isoMatch[3]);
    if (!isValidYMD(y, m, d)) return { ok: false, error: `"${input}" is not a valid calendar date.` };
    return { ok: true, iso: toIso(y, m, d), yearExplicit: true };
  }

  // Ambiguous all-numeric formats like 11/8, 11/8/26, 8-11-2026
  if (/^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(input)) {
    return {
      ok: false,
      error: `"${input}" is an ambiguous date. Use a format like "November 8, 2026" or "2026-11-08".`,
    };
  }

  if (lower === 'today' || lower === 'end of day' || lower === 'eod') {
    return { ok: true, iso: addDaysIso(anchor, 0), yearExplicit: true };
  }
  if (lower === 'tomorrow') {
    return { ok: true, iso: addDaysIso(anchor, 1), yearExplicit: true };
  }
  if (lower === 'yesterday') {
    return { ok: true, iso: addDaysIso(anchor, -1), yearExplicit: true };
  }
  if (lower === 'end of week' || lower === 'eow' || lower === 'this week') {
    const dow = anchor.getUTCDay();
    const diff = (5 - dow + 7) % 7;
    return { ok: true, iso: addDaysIso(anchor, diff), yearExplicit: true };
  }
  if (lower === 'next week') {
    return { ok: true, iso: addDaysIso(anchor, 7), yearExplicit: true };
  }
  if (lower === 'end of month') {
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return { ok: true, iso: toIso(y, m, lastDay), yearExplicit: true };
  }
  if (lower === 'next month') {
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const d = anchor.getUTCDate();
    const targetMonthRaw = m + 1;
    const targetY = y + Math.floor(targetMonthRaw / 12);
    const targetM = targetMonthRaw % 12;
    const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
    return { ok: true, iso: toIso(targetY, targetM, Math.min(d, lastDay)), yearExplicit: true };
  }

  const nextWeekday = lower.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextWeekday) {
    const target = WEEKDAYS[nextWeekday[1]];
    const dow = anchor.getUTCDay();
    let diff = (target - dow + 7) % 7;
    if (diff === 0) diff = 7;
    return { ok: true, iso: addDaysIso(anchor, diff), yearExplicit: true };
  }
  const thisWeekday = lower.match(/^this\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (thisWeekday) {
    const target = WEEKDAYS[thisWeekday[1]];
    const dow = anchor.getUTCDay();
    const diff = (target - dow + 7) % 7;
    return { ok: true, iso: addDaysIso(anchor, diff), yearExplicit: true };
  }

  // "Month D[, YYYY]"
  const monthFirst = input.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{3,4}))?$/i);
  if (monthFirst && monthFirst[1].toLowerCase() in MONTHS) {
    const m = MONTHS[monthFirst[1].toLowerCase()];
    const d = Number(monthFirst[2]);
    const yearExplicit = !!monthFirst[3];
    const y = yearExplicit ? Number(monthFirst[3]) : anchor.getUTCFullYear();
    if (!isValidYMD(y, m, d)) return { ok: false, error: `"${input}" is not a valid calendar date.` };
    return { ok: true, iso: toIso(y, m, d), yearExplicit };
  }

  // "D Month[ YYYY]"
  const dayFirst = input.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?(?:,?\s+(\d{3,4}))?$/i);
  if (dayFirst && dayFirst[2].toLowerCase() in MONTHS) {
    const m = MONTHS[dayFirst[2].toLowerCase()];
    const d = Number(dayFirst[1]);
    const yearExplicit = !!dayFirst[3];
    const y = yearExplicit ? Number(dayFirst[3]) : anchor.getUTCFullYear();
    if (!isValidYMD(y, m, d)) return { ok: false, error: `"${input}" is not a valid calendar date.` };
    return { ok: true, iso: toIso(y, m, d), yearExplicit };
  }

  return {
    ok: false,
    error: `"${input}" isn't a recognized date. Try something like "November 8, 2026" or "next Friday".`,
  };
}

/** Parses the meeting's own free-text date (from the "Date:" header) into canonical ISO, if possible. */
export function parseMeetingDateToIso(rawMeetingDate: string | null): string | null {
  if (!rawMeetingDate || !rawMeetingDate.trim()) return null;
  const parsed = parseDateInput(rawMeetingDate.trim(), new Date());
  return parsed.ok && parsed.iso ? parsed.iso : null;
}

export interface DeadlineContext {
  meetingDateIso: string | null;
}

export function validateDeadline(rawInput: string, context: DeadlineContext): ValidationResult<string> {
  const input = rawInput.trim();
  if (!input) return { ok: false, error: 'Enter a deadline.' };

  const anchor = context.meetingDateIso ? isoToUtcDate(context.meetingDateIso) : new Date();
  const parsed = parseDateInput(input, anchor);
  if (!parsed.ok || !parsed.iso) {
    return { ok: false, error: parsed.error ?? `"${input}" isn't a recognized date.` };
  }

  if (parsed.yearExplicit) {
    return { ok: true, value: parsed.iso };
  }

  // Year was not explicitly stated — only resolve it from confident meeting context.
  if (context.meetingDateIso) {
    const corrected = setIsoYear(parsed.iso, isoYear(context.meetingDateIso));
    const [y, m, d] = corrected.split('-').map(Number);
    if (!isValidYMD(y, m - 1, d)) {
      return { ok: false, error: `"${input}" is not a valid date in ${y}. Please confirm the date.` };
    }
    return { ok: true, value: corrected };
  }

  return {
    ok: false,
    error: `Which year did you mean by "${input}"? Please include the year, e.g. "${input}, ${anchor.getUTCFullYear()}".`,
  };
}

/** Formats a canonical YYYY-MM-DD value for display, e.g. "Nov 8, 2026". Non-canonical input passes through unchanged. */
export function formatDeadlineDisplay(iso: string | null): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const [, y, mo, d] = match;
  return `${DISPLAY_MONTHS[Number(mo) - 1]} ${Number(d)}, ${y}`;
}

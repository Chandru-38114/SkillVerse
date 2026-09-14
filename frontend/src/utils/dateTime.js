/**
 * dateTime.js
 * Centralized timezone formatting for SkillVerse.
 * Requirement: Ensure all time displayed natively defaults to Asia/Kolkata (IST).
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Ensures a date string is treated as UTC if it lacks a timezone indicator.
 */
function getUtcDate(dateStr) {
  if (!dateStr) return null;
  let str = String(dateStr);
  if (!str.match(/(Z|[+-]\d{2}:?\d{2})$/)) {
    str = `${str}Z`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(dateStr) {
  const d = getUtcDate(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

export function formatDate(dateStr) {
  const d = getUtcDate(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(dateStr) {
  const d = getUtcDate(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Given a date string ("YYYY-MM-DD") and a time string ("HH:MM") 
 * expected to represent IST (Asia/Kolkata), creates and returns a Date 
 * object equivalent to that exact absolute instant in time.
 */
export function createIstToUtcDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  // Construct an ISO string with the IST offset (+05:30)
  const isoStr = `${dateStr}T${timeStr}:00+05:30`;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns today's date in YYYY-MM-DD format, evaluated specifically in IST timezone.
 */
export function getTodayIstYMD() {
  const d = new Date();
  const options = { timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  // Intl.DateTimeFormat with 'en-CA' gives YYYY-MM-DD format directly
  return new Intl.DateTimeFormat('en-CA', options).format(d);
}

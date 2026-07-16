/**
 * Format a Date object as YYYY-MM-DD string.
 * Defaults to today if no date is provided.
 */
export function toDateStr(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add a number of days to a Date object.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

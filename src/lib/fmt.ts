/**
 * Safe numeric display helpers.
 * Neon serverless driver may return NUMERIC columns as strings in edge cases
 * (e.g. inside json_build_object results). These helpers guard against that.
 */

/** Convert any value to a guaranteed number (0 if null/NaN). */
export const n = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

/** Format as currency string with 2 decimal places. */
export const fmt = (val: any, decimals = 2): string =>
  n(val).toFixed(decimals);

/** Format as locale string (e.g. "1,23,456"). */
export const fmtLocale = (val: any): string =>
  n(val).toLocaleString();

import { sql } from './db';

/**
 * Neon serverless driver returns NUMERIC/DECIMAL columns as strings.
 * This coerces any string that looks like a number back to a JS number.
 */
export const parseNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

/**
 * Cast all numeric-looking string fields on a row object to actual numbers.
 * Safe to call on any row — non-numeric strings are left unchanged.
 */
export const castRow = <T extends Record<string, any>>(row: T): T => {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      result[key] = val;
    } else if (Array.isArray(val)) {
      // Recursively cast arrays of objects (e.g. bill_items, product_vendors)
      result[key] = val.map((item: any) =>
        item && typeof item === 'object' ? castRow(item) : item
      );
    } else if (typeof val === 'object' && !(val instanceof Date)) {
      // Recursively cast nested objects (e.g. customers inside bills)
      result[key] = castRow(val);
    } else if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) {
      result[key] = Number(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
};

export const dbUtils = {
  /**
   * Execute a raw SQL query.
   * Automatically casts NUMERIC/DECIMAL string fields to JS numbers.
   */
  execute: async (query: string, params: any[] = []) => {
    try {
      const result = await sql(query, params);
      const rows = Array.isArray(result) ? result.map(castRow) : result;
      return { data: rows, error: null };
    } catch (error: any) {
      console.error('Neon Query Error:', error);
      return { data: null, error: error.message };
    }
  },

  /**
   * Fetch rows from a table (Basic select)
   */
  select: async (table: string, options: { columns?: string; where?: string; params?: any[]; orderBy?: string } = {}) => {
    const cols = options.columns || '*';
    let query = `SELECT ${cols} FROM ${table}`;
    if (options.where) query += ` WHERE ${options.where}`;
    if (options.orderBy) query += ` ORDER BY ${options.orderBy}`;
    
    return dbUtils.execute(query, options.params || []);
  },

  /**
   * Insert a row into a table
   */
  insert: async (table: string, data: Record<string, any>) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    return dbUtils.execute(query, values);
  },

  /**
   * Update rows in a table
   */
  update: async (table: string, data: Record<string, any>, where: string, whereParams: any[]) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    // Offset the where parameters
    const query = `UPDATE ${table} SET ${setClause} WHERE ${where} RETURNING *`;
    return dbUtils.execute(query, [...values, ...whereParams]);
  },

  /**
   * Call a stored procedure (RPC)
   */
  rpc: async (name: string, params: Record<string, any> = {}) => {
    const keys = Object.keys(params);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const query = `SELECT * FROM ${name}(${placeholders})`;
    
    return dbUtils.execute(query, Object.values(params));
  }
};

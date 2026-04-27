import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_DATABASE_URL || 'postgres://user:password@host/database';

const sqlTag = neon(databaseUrl);

/**
 * Execute a parameterized SQL query via the Neon serverless driver.
 * sql.query(text, values[]) returns rows directly as an array.
 */
export const sql = async (query: string, params: any[] = []): Promise<any[]> => {
  // neon() exposes .query(string, values[]) which returns rows[] directly
  return (sqlTag as any).query(query, params) as Promise<any[]>;
};

// Helper for common query patterns
export const db = {
  query: async (query: string, params: any[] = []) => {
    try {
      const result = await sql(query, params);
      return { data: result, error: null };
    } catch (error: any) {
      console.error('Database Error:', error);
      return { data: null, error: error.message ?? String(error) };
    }
  }
};

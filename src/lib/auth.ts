import { dbUtils } from './db-utils';

const SESSION_KEY = 'kb_session';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

/**
 * Sign in with email + password.
 * Compares password_hash stored in the Neon `users` table.
 * Uses pgcrypto's crypt() via a Postgres function for secure comparison.
 */
export const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
  const { data, error } = await dbUtils.execute(
    `SELECT id, email, username, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (error) return { error };
  if (!data || data.length === 0) return { error: 'Invalid email or password.' };

  const user = data[0];

  // Verify the password using Postgres crypt
  const { data: verifyResult, error: verifyError } = await dbUtils.execute(
    `SELECT (password_hash = crypt($1, password_hash)) AS is_valid FROM users WHERE id = $2`,
    [password, user.id]
  );

  if (verifyError) return { error: verifyError };
  if (!verifyResult || !verifyResult[0]?.is_valid) return { error: 'Invalid email or password.' };

  const session: AuthSession = {
    user: { id: user.id, email: user.email, username: user.username },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { error: null };
};

/**
 * Sign out the current user.
 */
export const signOut = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

/**
 * Get the current session from localStorage.
 */
export const getSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
};

/**
 * Listen for auth state changes (storage events across tabs).
 * Returns an unsubscribe function.
 */
export const onAuthStateChange = (
  callback: (session: AuthSession | null) => void
): (() => void) => {
  const handler = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) {
      callback(getSession());
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

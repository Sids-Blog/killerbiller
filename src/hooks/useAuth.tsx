import { useState, useEffect } from 'react';
import { getSession, onAuthStateChange, type AuthSession } from '@/lib/auth';
import { dbUtils } from '@/lib/db-utils';

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    const { data, error } = await dbUtils.execute(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );

    if (!error && data && data.length > 0) {
      setRole(data[0].name);
    } else {
      setRole(null);
    }
  };

  useEffect(() => {
    // Bootstrap from localStorage
    const currentSession = getSession();
    setSession(currentSession);
    if (currentSession) {
      fetchRole(currentSession.user.id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Listen for cross-tab sign-in/sign-out
    const unsubscribe = onAuthStateChange((newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchRole(newSession.user.id);
      } else {
        setRole(null);
      }
    });

    return unsubscribe;
  }, []);

  return { session, loading, role };
};
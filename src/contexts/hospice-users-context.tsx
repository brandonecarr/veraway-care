'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useHospiceUsers } from '@/lib/queries/users';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
}

interface HospiceUsersContextType {
  users: User[];
  isLoading: boolean;
  error: Error | null;
  getUserById: (id: string) => User | undefined;
  getUsersByIds: (ids: string[]) => User[];
}

const HospiceUsersContext = createContext<HospiceUsersContextType | null>(null);

/**
 * Provider that caches hospice users at the app level
 * Eliminates redundant fetches across components
 */
export function HospiceUsersProvider({ children }: { children: ReactNode }) {
  const { data: users = [], isLoading, error } = useHospiceUsers();

  // Memoized user lookup map for O(1) access
  const userMap = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  const getUserById = useMemo(() => {
    return (id: string) => userMap.get(id);
  }, [userMap]);

  const getUsersByIds = useMemo(() => {
    return (ids: string[]) => ids.map((id) => userMap.get(id)).filter(Boolean) as User[];
  }, [userMap]);

  const value = useMemo(
    () => ({
      users,
      isLoading,
      error: error as Error | null,
      getUserById,
      getUsersByIds,
    }),
    [users, isLoading, error, getUserById, getUsersByIds]
  );

  return (
    <HospiceUsersContext.Provider value={value}>
      {children}
    </HospiceUsersContext.Provider>
  );
}

/**
 * Hook to access hospice users from context
 * More efficient than useHospiceUsers when you need user lookup functions
 */
export function useHospiceUsersContext() {
  const context = useContext(HospiceUsersContext);
  if (!context) {
    throw new Error('useHospiceUsersContext must be used within HospiceUsersProvider');
  }
  return context;
}

// Re-export with legacy names for backwards compatibility during transition
export const FacilityUsersProvider = HospiceUsersProvider;
export const useFacilityUsersContext = useHospiceUsersContext;

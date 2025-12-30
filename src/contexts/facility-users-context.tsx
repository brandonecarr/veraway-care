'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useFacilityUsers } from '@/lib/queries/users';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
}

interface FacilityUsersContextType {
  users: User[];
  isLoading: boolean;
  error: Error | null;
  getUserById: (id: string) => User | undefined;
  getUsersByIds: (ids: string[]) => User[];
}

const FacilityUsersContext = createContext<FacilityUsersContextType | null>(null);

/**
 * Provider that caches facility users at the app level
 * Eliminates redundant fetches across components
 */
export function FacilityUsersProvider({ children }: { children: ReactNode }) {
  const { data: users = [], isLoading, error } = useFacilityUsers();

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
    <FacilityUsersContext.Provider value={value}>
      {children}
    </FacilityUsersContext.Provider>
  );
}

/**
 * Hook to access facility users from context
 * More efficient than useFacilityUsers when you need user lookup functions
 */
export function useFacilityUsersContext() {
  const context = useContext(FacilityUsersContext);
  if (!context) {
    throw new Error('useFacilityUsersContext must be used within FacilityUsersProvider');
  }
  return context;
}

import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
}

interface UsersResponse {
  users: User[];
}

/**
 * Fetch all facility users
 * Used for: issue assignment, message recipients, participant lists
 * Cached for 5 minutes (users don't change frequently)
 */
async function fetchFacilityUsers(): Promise<User[]> {
  const response = await fetch('/api/users?all=true');
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  const data = await response.json();
  const users = Array.isArray(data.users) ? data.users : [];
  // Transform null values to undefined for TypeScript compatibility
  return users.map((u: Record<string, unknown>) => ({
    id: u.id as string,
    email: u.email as string,
    name: u.name ?? undefined,
    avatar_url: u.avatar_url ?? undefined,
    role: u.role as string | undefined,
  }));
}

/**
 * Hook to get all facility users with automatic caching
 * Replaces multiple independent fetch calls with a single cached query
 */
export function useFacilityUsers() {
  return useQuery({
    queryKey: ['facility-users'],
    queryFn: fetchFacilityUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes - users don't change often
  });
}

/**
 * Hook to get a specific user by ID from the cached users list
 * More efficient than a separate API call when we already have the users
 */
export function useUser(userId: string | null) {
  const { data: users, ...rest } = useFacilityUsers();

  return {
    ...rest,
    data: userId ? users?.find((u) => u.id === userId) : undefined,
  };
}

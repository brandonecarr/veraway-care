/**
 * In-memory user cache with TTL
 * Used for caching user details across the application
 * Reduces redundant database queries for user information
 */

interface CachedUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface CacheEntry {
  user: CachedUser;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const userCache = new Map<string, CacheEntry>();

/**
 * Get a cached user by ID
 * Returns undefined if not cached or cache expired
 */
export function getCachedUser(userId: string): CachedUser | undefined {
  const entry = userCache.get(userId);
  if (!entry) return undefined;

  // Check if cache entry is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    userCache.delete(userId);
    return undefined;
  }

  return entry.user;
}

/**
 * Cache a user
 */
export function setCachedUser(user: CachedUser): void {
  userCache.set(user.id, {
    user,
    timestamp: Date.now(),
  });
}

/**
 * Cache multiple users at once
 */
export function setCachedUsers(users: CachedUser[]): void {
  const timestamp = Date.now();
  users.forEach((user) => {
    userCache.set(user.id, { user, timestamp });
  });
}

/**
 * Get multiple cached users
 * Returns only the users that are cached and not expired
 */
export function getCachedUsers(userIds: string[]): Map<string, CachedUser> {
  const result = new Map<string, CachedUser>();
  const now = Date.now();

  userIds.forEach((id) => {
    const entry = userCache.get(id);
    if (entry && now - entry.timestamp <= CACHE_TTL) {
      result.set(id, entry.user);
    }
  });

  return result;
}

/**
 * Get IDs of users that are not in cache (for batch fetching)
 */
export function getUncachedUserIds(userIds: string[]): string[] {
  const now = Date.now();
  return userIds.filter((id) => {
    const entry = userCache.get(id);
    return !entry || now - entry.timestamp > CACHE_TTL;
  });
}

/**
 * Clear the entire cache
 */
export function clearUserCache(): void {
  userCache.clear();
}

/**
 * Get cache statistics (for debugging/monitoring)
 */
export function getCacheStats(): { size: number; validEntries: number } {
  const now = Date.now();
  let validEntries = 0;

  userCache.forEach((entry) => {
    if (now - entry.timestamp <= CACHE_TTL) {
      validEntries++;
    }
  });

  return {
    size: userCache.size,
    validEntries,
  };
}

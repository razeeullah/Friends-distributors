import { unstable_cache } from "next/cache";

type CacheCallback<T extends (...args: any[]) => any> = T;

/**
 * Wraps a database query with Next.js unstable_cache.
 * This caches the result on the server to reduce database load.
 */
export function withCache<T extends (...args: any[]) => any>(
  cb: CacheCallback<T>,
  keyParts: string[],
  options?: {
    revalidate?: number | false;
    tags?: string[];
  }
): T {
  return unstable_cache(cb, keyParts, options) as unknown as T;
}

/**
 * Standard cache tags used throughout the application.
 * Use these tags when fetching data, and pass them to revalidateTag() in server actions to clear the cache.
 */
export const CacheTags = {
  products: (businessId: string) => `products-${businessId}`,
  categories: (businessId: string) => `categories-${businessId}`,
  brands: (businessId: string) => `brands-${businessId}`,
  units: (businessId: string) => `units-${businessId}`,
  dashboard: (businessId: string) => `dashboard-${businessId}`,
  customers: (businessId: string) => `customers-${businessId}`,
  suppliers: (businessId: string) => `suppliers-${businessId}`,
};

export type CacheSource = 'default' | 'custom';

export const DEFAULT_CUSTOM_CACHE_PATH = 'C:\\Users\\user\\Desktop\\Cache-backup';

export const DEFAULT_CACHE_SOURCE_LABEL = 'Default RSMap static tile source';
export const CUSTOM_CACHE_SOURCE_LABEL = 'Custom local cache path';

export const CACHE_STORAGE_KEYS = {
  source: 'rsmap.cache.source',
  customPath: 'rsmap.cache.customPath',
} as const;

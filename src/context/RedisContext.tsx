'use client';

import React, { createContext, useContext } from 'react';

interface RedisContextType {
  cache: Map<string, any>;
  set: (key: string, value: any, ttl?: number) => void;
  get: (key: string) => any;
  remove: (key: string) => void;
  clear: () => void;
}

const RedisContext = createContext<RedisContextType | undefined>(undefined);

export const RedisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Client-side Redis-like cache
  const cache = new Map<string, { value: any; expiry?: number }>();

  const set = (key: string, value: any, ttl?: number) => {
    const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
    cache.set(key, { value, expiry });
  };

  const get = (key: string) => {
    const item = cache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      cache.delete(key);
      return null;
    }
    return item.value;
  };

  const remove = (key: string) => {
    cache.delete(key);
  };

  const clear = () => {
    cache.clear();
  };

  return (
    <RedisContext.Provider value={{ cache, set, get, remove, clear }}>
      {children}
    </RedisContext.Provider>
  );
};

export const useRedisCache = () => {
  const context = useContext(RedisContext);
  if (!context) {
    throw new Error('useRedisCache must be used within RedisProvider');
  }
  return context;
};

// types/lru.d.ts

declare module 'lru' {
  export class LRU<T> {
    constructor(options?: any)
    set(key: string, value: T): void
    get(key: string): T | undefined
    remove(key: string): void
    keys(): IterableIterator<string>
    // Add other methods as needed
  }

  export default LRU
}

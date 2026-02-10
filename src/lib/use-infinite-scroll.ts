import { useCallback, useEffect, useRef, useState } from "react";
import type { PaginatedResult } from "~/server/pagination";

interface UseInfiniteScrollOptions<T> {
  initialData: PaginatedResult<T>;
  fetchPage: (cursor: string) => Promise<PaginatedResult<T>>;
  resetKey?: string;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  sentinelRef: React.RefCallback<HTMLElement>;
  isLoadingMore: boolean;
  isExhausted: boolean;
}

export function useInfiniteScroll<T>({
  initialData,
  fetchPage,
  resetKey,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>(initialData.items);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData.nextCursor,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const prevResetKey = useRef(resetKey);

  // Reset when resetKey or initialData changes
  useEffect(() => {
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey;
      setItems(initialData.items);
      setNextCursor(initialData.nextCursor);
      setIsLoadingMore(false);
    }
  }, [resetKey, initialData]);

  // Also reset when initialData identity changes (for routes without resetKey)
  const prevInitialData = useRef(initialData);
  useEffect(() => {
    if (prevInitialData.current !== initialData && resetKey === undefined) {
      prevInitialData.current = initialData;
      setItems(initialData.items);
      setNextCursor(initialData.nextCursor);
      setIsLoadingMore(false);
    }
  }, [initialData, resetKey]);

  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;

  const isLoadingRef = useRef(isLoadingMore);
  isLoadingRef.current = isLoadingMore;

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || isLoadingRef.current) return;

    setIsLoadingMore(true);
    try {
      const page = await fetchPageRef.current(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      console.error("Failed to load more items:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            void loadMore();
          }
        },
        { rootMargin: "0px 0px 200px 0px" },
      );

      observerRef.current.observe(node);
    },
    [loadMore],
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    items,
    sentinelRef,
    isLoadingMore,
    isExhausted: nextCursor === null,
  };
}

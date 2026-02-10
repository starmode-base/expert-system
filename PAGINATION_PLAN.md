# Remaining Feed Pagination Plan

## Completed

- Step 1: Shared types (`src/server/pagination.ts`)
- Step 2: Infinite scroll hook (`src/lib/use-infinite-scroll.ts`)
- Step 3: News Feed pagination

## Remaining Steps

### Step 4: Research Feed (authenticated + guest)

**`src/server/queries.ts`** — Add paginated server functions:

- `queryInsightsFeedPaginated` — same auth middleware as `queryInsightsFeed`, cursor on `(createdAt, id)`, same nested relations/mapping, returns `PaginatedResult<InsightsItem>`
- `queryPublicInsightsFeedPaginated` — same as above but no auth (loads all insights with non-null insight field), returns `PaginatedResult<InsightsItem>`

**`src/routes/research-feed.tsx`** — Loader calls `queryInsightsFeedPaginated` with `cursor: null, limit: 10`

**`src/routes/guest.research-feed.tsx`** — Loader calls `queryPublicInsightsFeedPaginated` with `cursor: null, limit: 10`

**`src/components/insight-feed/insights-feed.tsx`** — Accept `initialPage` + `fetchPage` callback, use `useInfiniteScroll`, add sentinel div with loading indicator

**`src/components/signed-out.tsx`** — Pass `initialPage` + `fetchPage` to `InsightsFeed` (the `SignedOutExperience` currently passes `items` prop to `InsightsFeed`)

### Step 5: Takeaway Feed (most complex — search/filter branching)

**`src/server/queries.ts`** — Add `queryTakeawaysPaginated` server function:

- Accepts cursor + limit + filters (sources, startDate, endDate)
- Pushes source and date filters down to SQL WHERE clauses (currently done client-side)
- Cursor on `(publicationDate, createdAt, id)` with JOIN to documents table
- Returns `PaginatedResult<TakeawaySearchResult>`

**`src/server/searchSFs.ts`** — Modify `searchTakeawaysSF`:

- Add `cursor` and `limit` to validator
- When search input exists: return vector results with `nextCursor: null` (no pagination, already capped at 100)
- When no search input: call `queryTakeawaysPaginated` with cursor/limit/filters
- Return type becomes `PaginatedResult<TakeawaySearchResult>`

**`src/routes/takeaway-feed.tsx`** — Use `useInfiniteScroll` with `resetKey` derived from `searchInput + filters`. Remove the `useState`/`useEffect` pattern for `takeawaySearchResults`.

### Step 6: Loading States

Add a small loading spinner (inline, e.g. `animate-spin` on a circle SVG) shown at the bottom of each feed while `isLoadingMore` is true. Show "No more items" text when `isExhausted` and items exist.

## Cursor Strategy Reference

| Feed              | Sort Order                                        | Cursor Shape                         | Page Size |
| ----------------- | ------------------------------------------------- | ------------------------------------ | --------- |
| Research          | `createdAt DESC`                                  | `{ createdAt, id }`                  | 10        |
| Takeaway (browse) | `publicationDate DESC, createdAt DESC`            | `{ publicationDate, createdAt, id }` | 20        |
| Takeaway (search) | No pagination — vector search already caps at 100 | —                                    | —         |
| News              | `publicationDate DESC`                            | `{ publicationDate, id }`            | 25        |

## Reusable Patterns (already implemented)

- `PaginatedResult<T>` type in `src/server/pagination.ts`
- `useInfiniteScroll` hook in `src/lib/use-infinite-scroll.ts`
- `queryDocumentsPaginated` in `src/server/queries.ts` as reference for cursor query pattern

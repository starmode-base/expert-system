import { inngest } from "~/inngest/client";
import { randomId } from "~/lib/random-id";
import { fetchCompanyCatalogPage } from "../api/earnings-calls";
import {
  finalizeCatalogSync,
  upsertCatalogPage,
} from "../services/catalog-repository";

const CATALOG_PAGE_SIZE = 100;
const CATALOG_PAGE_CONCURRENCY = 5;

export const syncEarningsCompanyCatalog = inngest.createFunction(
  {
    id: "earnings.sync-company-catalog",
    retries: 5,
    concurrency: { limit: 1 },
  },
  [
    { cron: "TZ=America/Los_Angeles 0 3 * * 0" },
    { event: "earnings/catalog.sync.requested" },
  ],
  async ({ event, step }) => {
    const sync = await step.run("initialize-catalog-sync", () => ({
      syncRunId: event.id ?? randomId(),
      syncedAt: new Date().toISOString(),
    }));

    const firstPage = await step.run("sync-catalog-page-1", async () => {
      const page = await fetchCompanyCatalogPage({
        page: 1,
        limit: CATALOG_PAGE_SIZE,
      });
      const saved = await upsertCatalogPage({
        companies: page.companies,
        syncRunId: sync.syncRunId,
        syncedAt: new Date(sync.syncedAt),
      });
      return {
        saved,
        total: page.total,
        totalPages: page.totalPages,
      };
    });

    let saved = firstPage.saved;
    for (
      let firstPageNumber = 2;
      firstPageNumber <= firstPage.totalPages;
      firstPageNumber += CATALOG_PAGE_CONCURRENCY
    ) {
      const pageNumbers = Array.from(
        {
          length: Math.min(
            CATALOG_PAGE_CONCURRENCY,
            firstPage.totalPages - firstPageNumber + 1,
          ),
        },
        (_, index) => firstPageNumber + index,
      );
      const savedCounts = await Promise.all(
        pageNumbers.map((pageNumber) =>
          step.run(`sync-catalog-page-${String(pageNumber)}`, async () => {
            const page = await fetchCompanyCatalogPage({
              page: pageNumber,
              limit: CATALOG_PAGE_SIZE,
            });
            return upsertCatalogPage({
              companies: page.companies,
              syncRunId: sync.syncRunId,
              syncedAt: new Date(sync.syncedAt),
            });
          }),
        ),
      );
      saved += savedCounts.reduce((total, count) => total + count, 0);
    }

    const removed = await step.run("remove-stale-catalog-entries", () =>
      finalizeCatalogSync(sync.syncRunId),
    );

    return {
      providerCompanies: firstPage.total,
      pages: firstPage.totalPages,
      usCompaniesSaved: saved,
      staleCompaniesRemoved: removed,
    };
  },
);

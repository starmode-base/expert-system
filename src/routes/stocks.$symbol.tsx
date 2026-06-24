import { createFileRoute } from "@tanstack/react-router";
import { getStockProfileSF } from "~/server/stock-profile";

export const Route = createFileRoute("/stocks/$symbol")({
  loader: async ({ params: { symbol } }) => {
    return await getStockProfileSF({ data: { symbol } });
  },
  component: StockProfilePage,
});

function StockProfilePage() {
  const data = Route.useLoaderData();
  const { symbol: routeSymbol } = Route.useParams();
  const { dbStock } = data;

  const symbol = dbStock?.symbol ?? routeSymbol.toUpperCase();
  const name = dbStock?.name ?? symbol;
  const exchange = dbStock?.exchange ?? "";
  const sector = dbStock?.sector ?? "";
  const industry = dbStock?.industry ?? "";
  const description = dbStock?.description ?? "";
  const address = dbStock?.address ?? "";
  const officialSite = dbStock?.officialSite ?? "";
  const fiscalYearEnd = dbStock?.fiscalYearEnd ?? "";
  const cik = dbStock?.cik ?? "";

  return (
    <div className="h-[calc(100dvh-64px-49px)] overflow-y-auto">
      <div className="mx-auto max-w-4xl px-2 py-6 sm:px-4">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <section className="border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{symbol}</h1>
                  <span className="text-base text-gray-500">{name}</span>
                </div>
                {exchange || sector || industry ? (
                  <div className="flex flex-wrap gap-1.5">
                    {exchange ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {exchange}
                      </span>
                    ) : null}
                    {sector ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {sector}
                      </span>
                    ) : null}
                    {industry ? (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        {industry}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Company Overview */}
          {description ? (
            <section className="border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                Company Overview
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-gray-700">
                {description}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                {address ? (
                  <span>
                    <span className="text-gray-400">Address: </span>
                    {address}
                  </span>
                ) : null}
                {officialSite ? (
                  <span>
                    <span className="text-gray-400">Website: </span>
                    <a
                      href={officialSite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {officialSite}
                    </a>
                  </span>
                ) : null}
                {fiscalYearEnd ? (
                  <span>
                    <span className="text-gray-400">Fiscal Year End: </span>
                    {fiscalYearEnd}
                  </span>
                ) : null}
                {cik ? (
                  <span>
                    <span className="text-gray-400">CIK: </span>
                    {cik}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { createAPIFileRoute } from "@tanstack/react-start/api";

const DOCS = `# API Reference

REST API for programmatic access to takeaways, research, and documents.

## Authentication

All API requests must include an API key in the Authorization header using the Bearer scheme.

    Authorization: Bearer esak_<your-key>

A missing or invalid key returns 401 Unauthorized. Revoked keys are rejected immediately.

---

## GET /api/v1/takeaways/recent

Returns the most recent takeaways ordered by source document publication date (newest first). Returns lightweight results — use the returned IDs with /api/v1/takeaways to fetch full details.

### Query parameters

| Parameter | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| limit     | number | no       | Number of takeaways to return. Default: 10. Max: 100. |

### Response

    { "items": [ TakeawayObject, ... ] }

### Takeaway object

| Field      | Type   | Description                              |
|------------|--------|------------------------------------------|
| id         | string | Takeaway unique identifier.              |
| documentId | string | ID of the source document.               |
| title      | string | Short headline summarising the takeaway. |
| summary    | string | Brief summary of the takeaway.           |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/recent?limit=5"

### Example response

    {
      "items": [
        {
          "id": "tak_abc123",
          "documentId": "doc_xyz789",
          "title": "Fed signals pause through Q2",
          "summary": "The Federal Reserve indicated it will hold rates..."
        }
      ]
    }

---

## GET /api/v1/takeaways

Fetch up to 50 takeaways by their IDs in a single request. Results are returned in the same order as the IDs provided. Each takeaway includes its source document metadata and any inline references.

### Query parameters

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| ids       | string | yes      | Comma-separated list of takeaway IDs. Maximum 50 per request. |

### Response

    { "items": [ TakeawayObject, ... ] }

### Takeaway object

| Field              | Type   | Description                                                                              |
|--------------------|--------|------------------------------------------------------------------------------------------|
| id                 | string | Unique identifier.                                                                       |
| title              | string | Short headline summarising the takeaway.                                                 |
| takeaway           | string | Full takeaway text — the actionable or notable finding.                                  |
| document           | object | Source document metadata: id, title, source, link, publicationDate.                      |
| takeawayReferences | array  | Ordered list of inline references. Each entry has referenceNumber (integer) and reference (string). |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways?ids=tak_abc123,tak_def456"

---

## GET /api/v1/takeaways/search

Semantic search across all takeaways using vector similarity. Returns lightweight results ranked by relevance. Use the returned IDs with /api/v1/takeaways to fetch full takeaway details. Optionally applies a time-weighted reranking to favour more recent content.

### Query parameters

| Parameter | Type   | Required | Description                                                                 |
|-----------|--------|----------|-----------------------------------------------------------------------------|
| query     | string | yes      | Natural-language search query.                                              |
| limit     | number | no       | Number of results to return. Default: 10. Max: 100.                         |
| recent    | string | no       | Set to "true" to apply time-weighted reranking that favours newer content.  |

### Response

    { "items": [ SearchResultObject, ... ] }

### Search result object

| Field      | Type   | Description                              |
|------------|--------|------------------------------------------|
| id         | string | Takeaway unique identifier.              |
| documentId | string | ID of the source document.               |
| title      | string | Short headline summarising the takeaway. |
| summary    | string | Brief summary of the takeaway.           |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&limit=5"

### Example request — time-weighted

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/takeaways/search?query=inflation+expectations&recent=true"

---

## GET /api/v1/documents

Fetch up to 50 source documents by their IDs in a single request. Document IDs are available on takeaway objects returned by the takeaway endpoints.

### Query parameters

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| ids       | string | yes      | Comma-separated list of document IDs. Maximum 50 per request. |

### Response

    { "items": [ DocumentObject, ... ] }

### Document object

| Field           | Type             | Description                                                  |
|-----------------|------------------|--------------------------------------------------------------|
| id              | string           | Unique identifier.                                           |
| source          | string           | Origin of the document, e.g. "a16z", "Fed Speeches".         |
| title           | string           | Document title.                                              |
| description     | string           | Short description or abstract of the document.               |
| publicationDate | string (ISO 8601)| When the document was originally published.                  |
| link            | string           | URL to the original source.                                  |
| articleText     | string           | Full plain-text body of the document.                        |
| isSubstantive   | boolean          | Whether the document contains enough content to be worth processing. |
| createdAt       | string (ISO 8601)| When the document was ingested.                              |
| updatedAt       | string (ISO 8601)| When the document record was last updated.                   |

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/documents?ids=doc_xyz789,doc_abc123"

---

## GET /api/v1/research

AI-generated research insights. Scoped to the user who owns the API key — each key only returns research belonging to that user. Sorted by creation date (newest first).

### Query parameters

| Parameter | Type   | Required | Description                                                                                 |
|-----------|--------|----------|---------------------------------------------------------------------------------------------|
| cursor    | string | no       | Opaque pagination cursor from the previous response's nextCursor field.                     |
| limit     | number | no       | Items per page. Default: 4. Max: 100.                                                       |
| date      | string | no       | Filter to a single day in YYYY-MM-DD format (UTC). Returns only research created on that date. |

### Response

    {
      "items": [ ResearchObject, ... ],
      "nextCursor": "<string> | null"
    }

### Research object

| Field     | Type             | Description                                                   |
|-----------|------------------|---------------------------------------------------------------|
| id        | string           | Unique identifier.                                            |
| title     | string           | Title of the research insight.                                |
| summary   | string or null   | Short summary of the insight's main finding.                  |
| insight   | string or null   | Full insight text. Only insights with a non-null value are returned. |
| research  | string or null   | Background research notes used to generate the insight.       |
| takeaways | array            | Takeaways linked to this insight. Each entry has id and title.|
| createdAt | string (ISO 8601)| When the insight was created.                                 |
| updatedAt | string (ISO 8601)| When the insight was last updated.                            |

### Cursor pagination

Pass the opaque nextCursor value from a response as the cursor parameter on the next request. When nextCursor is null, you have reached the last page. Do not parse or construct cursor values — treat them as opaque strings.

### Example request

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/research?limit=10"

### Example request — filter by date

    curl -H "Authorization: Bearer esak_<your-key>" \\
         "https://expert-system.starmode.dev/api/v1/research?date=2026-03-05"

---

## POST /api/v1/query/macro

Natural language query interface for macroeconomic data. An AI agent translates your question into FRED API calls and returns structured data. Ask about any of the series listed below using plain English — the agent resolves series IDs automatically.

### Available data

Growth / Real Economy: Real GDP (GDPC1), Industrial Production (INDPRO), Capacity Utilization (TCU), Real Personal Consumption (PCEC96), Real Business Fixed Investment (PNFIC1).

Labor Market: Unemployment Rate (UNRATE), Labor Force Participation (CIVPART), Employment-Population Ratio (EMRATIO), Nonfarm Payrolls (PAYEMS), Initial Jobless Claims (ICSA), Continuing Jobless Claims (CCSA), Job Openings Rate (JTSJOR), Quits Rate (JTSQUR).

Inflation / Prices: CPI All Items (CPIAUCSL), Core CPI (CPILFESL), PCE Price Index (PCEPI), Core PCE (PCEPILFE), Trimmed Mean PCE (PCETRIM1M158SFRBDAL), Median CPI (MEDCPIM158SFRBCLE).

Wages / Income: Average Hourly Earnings (CES0500000003), Employment Cost Index (ECIALLCIV), Real Disposable Personal Income (DSPIC96).

Monetary Policy / Liquidity: Fed Funds Rate (FEDFUNDS), Effective Fed Funds Rate (EFFR), Interest on Reserve Balances (IORB), Fed Total Assets (WALCL), Reserve Balances (WRESBAL), Overnight Reverse Repo (RRPONTSYD), M2 Money Supply (M2SL).

Rates / Yield Curve: 2-Year Treasury (DGS2), 10-Year Treasury (DGS10), 10Y-2Y Spread (T10Y2Y), 10-Year Term Premium (THREEFYTP10), 10-Year Breakeven Inflation (T10YIE).

Credit / Financial Stress: Baa Corporate Spread (BAA10Y), High Yield OAS (BAMLH0A0HYM2), Senior Loan Officer Survey (DRTSCILM), Financial Conditions Index (NFCI), Bank Credit (TOTBKCR).

Housing: Housing Starts (HOUST), Building Permits (PERMIT), Existing Home Sales (EXHOSLUSM495S), Case-Shiller Home Price Index (CSUSHPINSA), 30-Year Mortgage Rate (MORTGAGE30US).

Sentiment: Consumer Sentiment (UMCSENT).

### Request body (JSON)

| Field | Type   | Required | Description                                          |
|-------|--------|----------|------------------------------------------------------|
| query | string | yes      | Natural-language macro question (e.g. "What is the current unemployment rate?"). |

### Response

    {
      "data": [ { ... }, ... ],
      "seriesQueried": [ "UNRATE", ... ]
    }

### Response fields

| Field         | Type     | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| data          | array    | Array of result objects from tool calls, preserving original structure (e.g. seriesId, observations, metadata). |
| seriesQueried | string[] | List of FRED series IDs that were queried.                         |

### Example request

    curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
         -H "Content-Type: application/json" \\
         -d '{"query": "What is the current unemployment rate?"}' \\
         "https://expert-system.starmode.dev/api/v1/query/macro"

### Example response

    {
      "data": [
        {
          "seriesId": "UNRATE",
          "observations": [
            { "date": "2026-02-01", "value": "4.4" },
            { "date": "2026-01-01", "value": "4.0" }
          ]
        }
      ],
      "seriesQueried": ["UNRATE"]
    }

---

## POST /api/v1/query/financial

Natural language query interface for company financial data. An AI agent translates your question into Alpha Vantage API calls and returns structured data. Ask about any public company by name or ticker — the agent resolves symbols automatically.

### Available data

Company Overview: Symbol, Name, Description, Sector, Industry, MarketCapitalization, EBITDA, PERatio, PEGRatio, BookValue, DividendPerShare, DividendYield, EPS, RevenuePerShareTTM, ProfitMargin, OperatingMarginTTM, ReturnOnAssetsTTM, ReturnOnEquityTTM, RevenueTTM, GrossProfitTTM, DilutedEPSTTM, QuarterlyEarningsGrowthYOY, QuarterlyRevenueGrowthYOY, AnalystTargetPrice, TrailingPE, ForwardPE, PriceToSalesRatioTTM, PriceToBookRatio, EVToRevenue, EVToEBITDA, Beta, 52WeekHigh, 52WeekLow, 50DayMovingAverage, 200DayMovingAverage, SharesOutstanding, SharesFloat.

Income Statement (quarterly): totalRevenue, grossProfit, costOfRevenue, operatingIncome, operatingExpenses, sellingGeneralAndAdministrative, researchAndDevelopment, interestExpense, incomeBeforeTax, incomeTaxExpense, netIncome, ebit, ebitda, netIncomeFromContinuingOperations, depreciationAndAmortization.

Balance Sheet (quarterly): totalAssets, totalCurrentAssets, cashAndCashEquivalentsAtCarryingValue, cashAndShortTermInvestments, inventory, currentNetReceivables, totalNonCurrentAssets, propertyPlantEquipment, goodwill, intangibleAssets, totalLiabilities, totalCurrentLiabilities, currentAccountsPayable, currentDebt, shortTermDebt, longTermDebt, shortLongTermDebtTotal, totalShareholderEquity, retainedEarnings, commonStockSharesOutstanding.

Cash Flow (quarterly): operatingCashflow, capitalExpenditures, cashflowFromInvestment, cashflowFromFinancing, dividendPayout, paymentsForRepurchaseOfCommonStock, proceedsFromIssuanceOfLongTermDebtAndCapitalSecuritiesNet, changeInCashAndCashEquivalents, netIncome, profitLoss, depreciationDepletionAndAmortization, changeInReceivables, changeInInventory.

### Request body (JSON)

| Field | Type   | Required | Description                                          |
|-------|--------|----------|------------------------------------------------------|
| query | string | yes      | Natural-language financial question (e.g. "What is Apple's revenue trend?"). |

### Response

    {
      "data": [ { ... }, ... ],
      "tickersQueried": [ "AAPL", ... ]
    }

### Response fields

| Field          | Type     | Description                                                        |
|----------------|----------|--------------------------------------------------------------------|
| data           | array    | Array of result objects from tool calls, preserving original structure (e.g. symbol, metric, quarterly reports). |
| tickersQueried | string[] | List of ticker symbols that were queried.                          |

### Example request

    curl -X POST -H "Authorization: Bearer esak_<your-key>" \\
         -H "Content-Type: application/json" \\
         -d '{"query": "What is Apple\\'s latest quarterly revenue?"}' \\
         "https://expert-system.starmode.dev/api/v1/query/financial"

### Example response

    {
      "data": [
        {
          "symbol": "AAPL",
          "metric": "totalRevenue",
          "reports": [
            { "fiscalDateEnding": "2025-12-31", "value": "143756000000" }
          ]
        }
      ],
      "tickersQueried": ["AAPL"]
    }

---

## Error responses

Errors return a JSON body with an error field and the corresponding HTTP status code.

| Status            | Description                                                                              |
|-------------------|------------------------------------------------------------------------------------------|
| 400 Bad Request   | Missing or invalid parameter (e.g. missing ids, invalid limit, malformed cursor or date).|
| 401 Unauthorized  | Missing, invalid, or revoked API key.                                                    |
| 200 OK            | Successful response. Always returns an items array.                                      |

### Example error body

    { "error": "Missing required parameter: ids" }
`;

export const APIRoute = createAPIFileRoute("/api/v1/docs")({
  GET: () => {
    return new Response(DOCS, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
});

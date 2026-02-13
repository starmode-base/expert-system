// import {
//   fetchCompanyOverview,
//   fetchGlobalQuote,
//   fetchIncomeStatement,
//   fetchBalanceSheet,
//   fetchCashFlow,
//   searchTickers,
//   fetchTreasuryYield,
// } from "~/server/financial-data-api/alpha-vantage-api";

import { fetchCompanyOverview } from "~/server/financial-data-api/alpha-vantage-api";

// const symbol = (process.argv[2] ?? "TSLA").toUpperCase();
// const searchKeywords = process.argv[3];

const overview = await fetchCompanyOverview("BRK.B");
console.log("Overview", overview);

// // Alpha Vantage allows one request per second, so wait before the quote call
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const quote = await fetchGlobalQuote(symbol);

// // Sleep before income statement call to respect rate limits
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const income = await fetchIncomeStatement(symbol);

// // Sleep before balance sheet call to respect rate limits
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const balanceSheet = await fetchBalanceSheet(symbol);

// // Sleep before cash flow call to respect rate limits
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const cashFlow = await fetchCashFlow(symbol);

// // Sleep before treasury yield call to respect rate limits
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const treasuryYield = await fetchTreasuryYield({
//   interval: "monthly",
//   maturity: "10year",
// });

// // console.log("Overview", {
// //   symbol: overview.Symbol,
// //   name: overview.Name,
// //   marketCap: overview.MarketCapitalization,
// //   overview,
// // });

// // console.log("Quote", {
// //   symbol: quote["01. symbol"],
// //   price: quote["05. price"],
// //   change: quote["10. change percent"],
// //   quote,
// // });

// // console.log("Income statement", {
// //   symbol: income.symbol,
// //   annualReports: income.annualReports.length,
// //   quarterlyReports: income.quarterlyReports.length,
// //   latestAnnual: income.annualReports[0]?.fiscalDateEnding,
// //   latestQuarterly: income.quarterlyReports[0]?.fiscalDateEnding,
// //   latestQuarterlyReport: income.quarterlyReports[0],
// // });

// // console.log("Balance sheet", {
// //   symbol: balanceSheet.symbol,
// //   annualReports: balanceSheet.annualReports.length,
// //   quarterlyReports: balanceSheet.quarterlyReports.length,
// //   latestAnnual: balanceSheet.annualReports[0]?.fiscalDateEnding,
// //   latestQuarterly: balanceSheet.quarterlyReports[0]?.fiscalDateEnding,
// //   latestQuarterlyReport: balanceSheet.quarterlyReports[0],
// // });

// // console.log("Cash flow", {
// //   symbol: cashFlow.symbol,
// //   annualReports: cashFlow.annualReports.length,
// //   quarterlyReports: cashFlow.quarterlyReports.length,
// //   latestAnnual: cashFlow.annualReports[0]?.fiscalDateEnding,
// //   latestQuarterly: cashFlow.quarterlyReports[0]?.fiscalDateEnding,
// //   latestQuarterlyReport: cashFlow.quarterlyReports[0],
// // });

// // console.log("Treasury yield", {
// //   interval: treasuryYield.interval,
// //   maturity: treasuryYield.maturity,
// //   name: treasuryYield.name,
// //   firstThree: treasuryYield.data.slice(0, 3),
// // });

// // if (searchKeywords) {
// //   //sleep
// //   await new Promise((resolve) => setTimeout(resolve, 1100));
// //   // Optional search test to exercise the SYMBOL_SEARCH endpoint
// //   const matches = await searchTickers(searchKeywords);
// //   console.log("Search", {
// //     keywords: searchKeywords,
// //     count: matches.length,
// //     top: matches.slice(0, 5),
// //   });
// // }

// const result = await fetchLatestIncomeStatementByMetric("TSLA", 4, [
//   "totalRevenue",
//   "grossProfit",
// ]);

// console.log("Result", result);

// //sleep
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const result2 = await fetchLatestBalanceSheetByMetric("TSLA", 4, [
//   "totalAssets",
//   "totalLiabilities",
// ]);

// console.log("Result2", result2);

// //sleep
// await new Promise((resolve) => setTimeout(resolve, 1100));

// const result3 = await fetchLatestCashFlowByMetric("TSLA", 4, [
//   "operatingCashflow",
//   "cashflowFromInvestment",
//   "cashflowFromFinancing",
//   "profitLoss",
// ]);

// console.log("Result3", result3);

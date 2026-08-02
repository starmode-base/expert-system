export const FINANCIAL_CATALOG_VERSION = "1";

export type FinancialStatement =
  | "incomeStatement"
  | "balanceSheet"
  | "cashFlow";
export type FinancialUnitClass = "monetary" | "perShare";
export type FinancialFactType = "duration" | "instant";

export interface FinancialMetricDefinition {
  label: string;
  statement: FinancialStatement;
  unitClass: FinancialUnitClass;
  factType: FinancialFactType;
  concepts: readonly string[];
}

export const financialMetricCatalog = {
  revenue: {
    label: "Revenue",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ],
  },
  costOfRevenue: {
    label: "Cost of revenue",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["CostOfRevenue", "CostOfGoodsAndServicesSold"],
  },
  grossProfit: {
    label: "Gross profit",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["GrossProfit"],
  },
  operatingIncome: {
    label: "Operating income",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["OperatingIncomeLoss"],
  },
  netIncome: {
    label: "Net income",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["NetIncomeLoss", "ProfitLoss"],
  },
  epsBasic: {
    label: "Basic earnings per share",
    statement: "incomeStatement",
    unitClass: "perShare",
    factType: "duration",
    concepts: ["EarningsPerShareBasic"],
  },
  epsDiluted: {
    label: "Diluted earnings per share",
    statement: "incomeStatement",
    unitClass: "perShare",
    factType: "duration",
    concepts: ["EarningsPerShareDiluted"],
  },
  researchAndDevelopment: {
    label: "Research and development",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["ResearchAndDevelopmentExpense"],
  },
  sellingGeneralAdministrative: {
    label: "Selling, general and administrative",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["SellingGeneralAndAdministrativeExpense"],
  },
  incomeTaxExpense: {
    label: "Income tax expense",
    statement: "incomeStatement",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["IncomeTaxExpenseBenefit"],
  },
  cash: {
    label: "Cash and cash equivalents",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["CashAndCashEquivalentsAtCarryingValue"],
  },
  accountsReceivable: {
    label: "Accounts receivable",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["AccountsReceivableNetCurrent", "AccountsReceivableNet"],
  },
  inventory: {
    label: "Inventory",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["InventoryNet"],
  },
  currentAssets: {
    label: "Current assets",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["AssetsCurrent"],
  },
  totalAssets: {
    label: "Total assets",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["Assets"],
  },
  accountsPayable: {
    label: "Accounts payable",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: [
      "AccountsPayableCurrent",
      "AccountsPayableAndAccruedLiabilitiesCurrent",
    ],
  },
  currentLiabilities: {
    label: "Current liabilities",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["LiabilitiesCurrent"],
  },
  totalLiabilities: {
    label: "Total liabilities",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["Liabilities"],
  },
  shortTermDebt: {
    label: "Short-term debt",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["ShortTermBorrowings", "LongTermDebtCurrent", "DebtCurrent"],
  },
  longTermDebt: {
    label: "Long-term debt",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: ["LongTermDebtNoncurrent", "LongTermDebt"],
  },
  stockholdersEquity: {
    label: "Stockholders' equity",
    statement: "balanceSheet",
    unitClass: "monetary",
    factType: "instant",
    concepts: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
  },
  operatingCashFlow: {
    label: "Operating cash flow",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["NetCashProvidedByUsedInOperatingActivities"],
  },
  capitalExpenditures: {
    label: "Capital expenditures",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsForAdditionsToPropertyPlantAndEquipment",
    ],
  },
  investingCashFlow: {
    label: "Investing cash flow",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["NetCashProvidedByUsedInInvestingActivities"],
  },
  financingCashFlow: {
    label: "Financing cash flow",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["NetCashProvidedByUsedInFinancingActivities"],
  },
  dividendsPaid: {
    label: "Dividends paid",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  },
  shareRepurchases: {
    label: "Share repurchases",
    statement: "cashFlow",
    unitClass: "monetary",
    factType: "duration",
    concepts: ["PaymentsForRepurchaseOfCommonStock"],
  },
} as const satisfies Record<string, FinancialMetricDefinition>;

export type FinancialMetricId = keyof typeof financialMetricCatalog;

export const financialMetricIds = Object.keys(
  financialMetricCatalog,
) as FinancialMetricId[];

export function isFinancialMetricId(value: string): value is FinancialMetricId {
  return Object.hasOwn(financialMetricCatalog, value);
}

export function getPublicFinancialCatalog() {
  return financialMetricIds.map((id) => {
    const metric = financialMetricCatalog[id];
    return {
      id,
      label: metric.label,
      statement: metric.statement,
      unitType: metric.unitClass,
    };
  });
}

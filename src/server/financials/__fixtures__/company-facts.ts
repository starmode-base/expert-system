interface FactInput {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

function concept(unit: string, facts: FactInput[]) {
  return {
    label: "Fixture concept",
    description: "Fixture",
    units: { [unit]: facts },
  };
}

const apple = {
  cik: 320193,
  entityName: "Apple Inc.",
  facts: {
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: concept("USD", [
        {
          start: "2025-09-28",
          end: "2026-03-28",
          val: 254_940,
          accn: "apple-q2-ytd",
          fy: 2026,
          fp: "Q2",
          form: "10-Q",
          filed: "2026-05-01",
        },
        {
          start: "2025-12-28",
          end: "2026-03-28",
          val: 111_184,
          accn: "apple-q2-old",
          fy: 2026,
          fp: "Q2",
          form: "10-Q",
          filed: "2026-05-01",
        },
        {
          start: "2025-12-28",
          end: "2026-03-28",
          val: 111_185,
          accn: "apple-q2-amended",
          fy: 2026,
          fp: "Q2",
          form: "10-Q/A",
          filed: "2026-05-02",
        },
      ]),
      CashAndCashEquivalentsAtCarryingValue: concept("USD", [
        {
          end: "2026-03-28",
          val: 36_269,
          accn: "apple-cash",
          fy: 2026,
          fp: "Q2",
          form: "10-Q",
          filed: "2026-05-01",
        },
      ]),
      NetCashProvidedByUsedInOperatingActivities: concept("USD", [
        {
          start: "2025-09-28",
          end: "2026-03-28",
          val: 82_627,
          accn: "apple-cfo-ytd",
          fy: 2026,
          fp: "Q2",
          form: "10-Q",
          filed: "2026-05-01",
        },
      ]),
      AccountsPayableCurrent: concept("USD", [
        {
          end: "2026-03-28",
          val: 68_260,
          accn: "apple-ap",
          fy: 2026,
          fp: "Q2",
          form: "10-Q",
          filed: "2026-05-01",
        },
      ]),
    },
  },
};

const walmart = {
  cik: 104169,
  entityName: "Walmart Inc.",
  facts: {
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: concept("USD", [
        {
          start: "2025-08-01",
          end: "2025-10-31",
          val: 180_000,
          accn: "walmart-fiscal-q3",
          fy: 2026,
          fp: "Q3",
          form: "10-Q",
          filed: "2025-12-05",
        },
      ]),
      InventoryNet: concept("USD", [
        {
          end: "2025-10-31",
          val: 58_000,
          accn: "walmart-inventory",
          fy: 2026,
          fp: "Q3",
          form: "10-Q",
          filed: "2025-12-05",
        },
      ]),
    },
  },
};

const jpmorgan = {
  cik: 19617,
  entityName: "JPMorgan Chase & Co.",
  facts: {
    "us-gaap": {
      Revenues: concept("USD", [
        {
          start: "2026-01-01",
          end: "2026-03-31",
          val: 45_000,
          accn: "jpm-revenue",
          fy: 2026,
          fp: "Q1",
          form: "10-Q",
          filed: "2026-05-01",
        },
      ]),
      StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:
        concept("USD", [
          {
            end: "2026-03-31",
            val: 360_000,
            accn: "jpm-equity",
            fy: 2026,
            fp: "Q1",
            form: "10-Q",
            filed: "2026-05-01",
          },
        ]),
    },
  },
};

const exxon = {
  cik: 34088,
  entityName: "Exxon Mobil Corporation",
  facts: {
    "us-gaap": {
      DebtCurrent: concept("USD", [
        {
          end: "2026-03-31",
          val: 11_000,
          accn: "exxon-current-debt",
          fy: 2026,
          fp: "Q1",
          form: "10-Q",
          filed: "2026-05-01",
        },
      ]),
      NetIncomeLoss: concept("USD", [
        {
          start: "2025-01-01",
          end: "2025-12-31",
          val: 34_000,
          accn: "exxon-net-income",
          fy: 2025,
          fp: "FY",
          form: "10-K",
          filed: "2026-02-15",
        },
      ]),
    },
  },
};

export const companyFactsFixtures = { apple, walmart, jpmorgan, exxon };

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("~/lib/env", () => ({
  ensureEnv: vi.fn(() => "test-api-key"),
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const {
  EarningsCallsApiError,
  fetchLatestCall,
  fetchRecentCalls,
  fetchTranscript,
} = await import("./earnings-calls");

beforeEach(() => {
  fetchMock.mockReset();
});

describe("earningscalls.dev client", () => {
  test("normalizes the latest US call", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          company_name: "NVIDIA",
          sector: "Technology",
          industry: "Semiconductors",
          stock_symbol: "NVDA",
          company_ticker: "nvda",
          exchange: "NASDAQ",
          country: "US",
          mic: "XNAS",
          earnings_calls: [
            {
              id: 50,
              transcript_title: "NVIDIA Conference Presentation",
              event_type: "conference_presentation",
              event_date_time: "2026-06-04T21:00:00.000Z",
            },
            {
              id: 42,
              transcript_title: "NVIDIA Q1 2026 Earnings Call",
              event_type: "earnings",
              event_date_time: "2026-05-20T21:00:00.000Z",
            },
          ],
        },
      }),
    );

    const call = await fetchLatestCall(" nvda ");

    expect(call).toMatchObject({
      providerCallId: 42,
      symbol: "NVDA",
      mic: "XNAS",
      country: "US",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/api/v1/companies/ticker/NVDA",
        search: "?country=US",
      }),
      expect.objectContaining({
        headers: { "X-API-Key": "test-api-key" },
      }),
    );
  });

  test("returns a resumable cursor from the recent feed", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: [
          {
            earnings_call_id: 43,
            added_at: "2026-06-23T12:30:02.212Z",
            company_name: "NVIDIA",
            company_ticker: "NVDA",
            stock_symbol: "NVDA",
            sector: "Technology",
            industry: "Semiconductors",
            exchange: "NASDAQ",
            country: "US",
            event_date_time: "2026-05-20T21:00:00.000Z",
            event_type: "Earnings",
            duration_seconds: 3600,
            mic: "XNAS",
          },
        ],
        pagination: {
          has_more: true,
          next_after_id: 43,
        },
      }),
    );

    const page = await fetchRecentCalls({ afterId: 40, limit: 100 });

    expect(page.nextAfterId).toBe(43);
    expect(page.hasMore).toBe(true);
    expect(page.calls[0]?.providerCallId).toBe(43);
  });

  test("filters non-earnings events from the recent feed", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: [
          {
            earnings_call_id: 45,
            added_at: "2026-06-23T12:30:02.212Z",
            company_name: "NVIDIA",
            company_ticker: "NVDA",
            stock_symbol: "NVDA",
            sector: "Technology",
            industry: "Semiconductors",
            exchange: "NASDAQ",
            country: "US",
            event_date_time: "2026-06-04T21:00:00.000Z",
            event_type: "conference_presentation",
            duration_seconds: 3600,
            mic: "XNAS",
          },
        ],
        pagination: {
          has_more: false,
          next_after_id: 45,
        },
      }),
    );

    const page = await fetchRecentCalls();
    expect(page.calls).toEqual([]);
    expect(page.nextAfterId).toBe(45);
  });

  test("parses full transcript text", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          earnings_call_id: 44,
          company_name: "NVIDIA",
          transcript_title: "NVIDIA Earnings Call",
          event_type: "Earnings",
          event_date_time: "2026-05-20T21:00:00.000Z",
          sector: "Technology",
          industry: "Semiconductors",
          company_ticker: "NVDA",
          duration_seconds: 3600,
          full_transcript_text: "Prepared remarks and questions.",
        },
      }),
    );

    const transcript = await fetchTranscript(44);
    expect(transcript.text).toBe("Prepared remarks and questions.");
  });

  test("classifies rate limits and server failures as retryable", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Quota exceeded" }, { status: 429 }),
    );

    const error = await fetchLatestCall("NVDA").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(EarningsCallsApiError);
    expect(
      (error as InstanceType<typeof EarningsCallsApiError>).retryable,
    ).toBe(true);
  });

  test("classifies invalid credentials as non-retryable", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Invalid key" }, { status: 401 }),
    );

    const error = await fetchLatestCall("NVDA").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(EarningsCallsApiError);
    expect(
      (error as InstanceType<typeof EarningsCallsApiError>).retryable,
    ).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { fredUnits, type FredObservationsResponse } from "./fred-api";
import { getFredObservationBatch, getInvalidFrequencyMessage } from "./service";

function fredResponse(
  observations: FredObservationsResponse["observations"],
): FredObservationsResponse {
  return {
    realtime_start: "2026-08-01",
    realtime_end: "2026-08-01",
    observation_start: "2026-01-01",
    observation_end: "2026-08-01",
    units: "lin",
    output_type: 1,
    file_type: "json",
    order_by: "observation_date",
    sort_order: "desc",
    count: observations.length,
    offset: 0,
    limit: 12,
    observations,
  };
}

describe("FRED observation service", () => {
  it("normalizes numeric observations and removes missing values", async () => {
    const fetchObservations = vi.fn().mockResolvedValue(
      fredResponse([
        {
          realtime_start: "2026-08-01",
          realtime_end: "2026-08-01",
          date: "2026-07-01",
          value: "4.2",
        },
        {
          realtime_start: "2026-08-01",
          realtime_end: "2026-08-01",
          date: "2026-06-01",
          value: ".",
        },
      ]),
    );

    const result = await getFredObservationBatch(
      [{ id: "UNRATE", lastN: 12 }],
      { fetchObservations, rateLimitMs: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({
      seriesId: "UNRATE",
      nativeFrequency: "monthly",
      returnedFrequency: "monthly",
      transformation: "lin",
      observations: [{ date: "2026-07-01", value: 4.2 }],
    });
    expect(fetchObservations).toHaveBeenCalledWith(
      "UNRATE",
      expect.objectContaining({ sortOrder: "desc", limit: 12, units: "lin" }),
    );
  });

  it("keeps independent options for mixed-frequency batches", async () => {
    const fetchObservations = vi.fn().mockResolvedValue(fredResponse([]));
    const result = await getFredObservationBatch(
      [
        { id: "UNRATE", lastN: 6 },
        {
          id: "ICSA",
          lastN: 12,
          frequency: "m",
          aggregationMethod: "avg",
        },
      ],
      { fetchObservations, rateLimitMs: 0 },
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.returnedFrequency).toBe("monthly");
    expect(result.items[1]).toMatchObject({
      nativeFrequency: "weekly",
      returnedFrequency: "monthly",
      aggregationMethod: "avg",
    });
    expect(fetchObservations).toHaveBeenNthCalledWith(
      1,
      "UNRATE",
      expect.objectContaining({ limit: 6, frequency: undefined }),
    );
    expect(fetchObservations).toHaveBeenNthCalledWith(
      2,
      "ICSA",
      expect.objectContaining({ limit: 12, frequency: "m" }),
    );
  });

  it("uses ascending observations for explicit date ranges", async () => {
    const fetchObservations = vi.fn().mockResolvedValue(fredResponse([]));
    await getFredObservationBatch(
      [
        {
          id: "GDPC1",
          startDate: "2020-01-01",
          endDate: "2024-12-31",
        },
      ],
      { fetchObservations, rateLimitMs: 0 },
    );

    expect(fetchObservations).toHaveBeenCalledWith(
      "GDPC1",
      expect.objectContaining({
        observationStart: "2020-01-01",
        observationEnd: "2024-12-31",
        sortOrder: "asc",
        limit: undefined,
      }),
    );
  });

  it.each(fredUnits)("forwards the %s value transformation", async (units) => {
    const fetchObservations = vi.fn().mockResolvedValue(fredResponse([]));
    await getFredObservationBatch([{ id: "CPIAUCSL", units }], {
      fetchObservations,
      rateLimitMs: 0,
    });
    expect(fetchObservations).toHaveBeenCalledWith(
      "CPIAUCSL",
      expect.objectContaining({ units }),
    );
  });

  it("preserves successful items when another provider request fails", async () => {
    const fetchObservations = vi
      .fn()
      .mockResolvedValueOnce(fredResponse([]))
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const result = await getFredObservationBatch(
      [{ id: "UNRATE" }, { id: "ICSA" }],
      { fetchObservations, rateLimitMs: 0 },
    );

    expect(result.items.map((item) => item.seriesId)).toEqual(["UNRATE"]);
    expect(result.errors).toEqual([
      {
        seriesId: "ICSA",
        code: "FRED_UNAVAILABLE",
        message: "provider unavailable",
      },
    ]);
  });

  it("rejects implicit upsampling", () => {
    expect(
      getInvalidFrequencyMessage({ id: "UNRATE", frequency: "w" }),
    ).toContain("cannot be upsampled");
    expect(
      getInvalidFrequencyMessage({ id: "ICSA", frequency: "m" }),
    ).toBeNull();
  });

  it("returns a per-series validation error without calling FRED", async () => {
    const fetchObservations = vi.fn();
    const result = await getFredObservationBatch(
      [{ id: "UNRATE", frequency: "w" }],
      { fetchObservations, rateLimitMs: 0 },
    );

    expect(fetchObservations).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.seriesId).toBe("UNRATE");
    expect(result.errors[0]?.code).toBe("INVALID_FREQUENCY");
    expect(result.errors[0]?.message).toContain("cannot be upsampled");
  });
});

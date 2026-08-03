import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeMock = vi.fn();
const searchMock = vi.fn();
const recentMock = vi.fn();
const takeawaysMock = vi.fn();
const documentsMock = vi.fn();
const documentContentMock = vi.fn();

vi.mock("@tanstack/react-start", () => ({
  json: (body: unknown) => Response.json(body),
}));
vi.mock("@tanstack/react-start/api", () => ({
  createAPIFileRoute:
    (path: string) =>
    (methods: unknown): { path: string; methods: unknown } => ({
      path,
      methods,
    }),
}));
vi.mock("~/server/quota", () => ({ authorizeApiRequest: authorizeMock }));
vi.mock("~/server/public-api/research", () => ({
  MAX_PUBLIC_IDS: 50,
  searchTakeawayPreviews: searchMock,
  getRecentTakeawayPreviews: recentMock,
  getTakeawaysByIds: takeawaysMock,
  getDocumentsByIds: documentsMock,
  getDocumentContent: documentContentMock,
}));

const { APIRoute: searchRoute } = await import("./v1.takeaways.search");
const { APIRoute: recentRoute } = await import("./v1.takeaways.recent");
const { APIRoute: takeawaysRoute } = await import("./v1.takeaways");
const { APIRoute: documentsRoute } = await import("./v1.documents");
const { APIRoute: documentContentRoute } = await import(
  "./v1.documents.$documentId.content"
);

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ type: "ok", userId: "user_1" });
  searchMock.mockResolvedValue([]);
  recentMock.mockResolvedValue([]);
  takeawaysMock.mockResolvedValue([]);
  documentsMock.mockResolvedValue([]);
});

describe("research API routes", () => {
  it("passes search options to the shared service", async () => {
    const item = {
      id: "tak_1",
      documentId: "doc_1",
      title: "Title",
      summary: "Summary",
      publicationDate: "2026-01-01",
      document: { id: "doc_1", source: "Source", link: "https://source" },
    };
    searchMock.mockResolvedValue([item]);
    const handler = searchRoute.methods.GET;
    if (!handler) throw new Error("Missing search GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/takeaways/search?query=ai&limit=4&recent=true",
      ),
      params: {},
    });

    expect(searchMock).toHaveBeenCalledWith("ai", { limit: 4, recent: true });
    expect(await response.json()).toEqual({ items: [item] });
  });

  it("uses the shared services for recent and ordered ID lookups", async () => {
    const recentHandler = recentRoute.methods.GET;
    const takeawaysHandler = takeawaysRoute.methods.GET;
    const documentsHandler = documentsRoute.methods.GET;
    if (!recentHandler || !takeawaysHandler || !documentsHandler) {
      throw new Error("Missing research GET handler");
    }

    await recentHandler({
      request: new Request(
        "https://example.com/api/v1/takeaways/recent?limit=3",
      ),
      params: {},
    });
    await takeawaysHandler({
      request: new Request(
        "https://example.com/api/v1/takeaways?ids=tak_2,tak_1",
      ),
      params: {},
    });
    await documentsHandler({
      request: new Request(
        "https://example.com/api/v1/documents?ids=doc_2,doc_1",
      ),
      params: {},
    });

    expect(recentMock).toHaveBeenCalledWith(3);
    expect(takeawaysMock).toHaveBeenCalledWith(["tak_2", "tak_1"]);
    expect(documentsMock).toHaveBeenCalledWith(["doc_2", "doc_1"]);
  });

  it("reads bounded document content and validates offsets", async () => {
    documentContentMock.mockResolvedValue({
      item: {
        id: "doc_1",
        content: {
          text: "content",
          offset: 10,
          nextOffset: null,
          totalCharacters: 17,
          truncated: false,
        },
      },
    });
    const handler = documentContentRoute.methods.GET;
    if (!handler) throw new Error("Missing document content GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/documents/doc_1/content?offset=10&limit=100",
      ),
      params: { documentId: "doc_1" },
    });

    expect(response.status).toBe(200);
    expect(documentContentMock).toHaveBeenCalledWith("doc_1", 10, 100);

    documentContentMock.mockResolvedValue({
      item: {
        content: { text: "", offset: 18, totalCharacters: 17 },
      },
    });
    const invalid = await handler({
      request: new Request(
        "https://example.com/api/v1/documents/doc_1/content?offset=18",
      ),
      params: { documentId: "doc_1" },
    });
    expect(invalid.status).toBe(400);
  });

  it("applies document content defaults and caps the requested limit", async () => {
    documentContentMock.mockResolvedValue({
      item: {
        id: "doc_1",
        content: {
          text: "",
          offset: 0,
          nextOffset: null,
          totalCharacters: 0,
          truncated: false,
        },
      },
    });
    const handler = documentContentRoute.methods.GET;
    if (!handler) throw new Error("Missing document content GET handler");

    await handler({
      request: new Request(
        "https://example.com/api/v1/documents/doc_1/content",
      ),
      params: { documentId: "doc_1" },
    });
    await handler({
      request: new Request(
        "https://example.com/api/v1/documents/doc_1/content?limit=50000",
      ),
      params: { documentId: "doc_1" },
    });

    expect(documentContentMock).toHaveBeenNthCalledWith(1, "doc_1", 0, 12_000);
    expect(documentContentMock).toHaveBeenNthCalledWith(2, "doc_1", 0, 30_000);
  });

  it("returns 404 for unknown document content", async () => {
    documentContentMock.mockResolvedValue(null);
    const handler = documentContentRoute.methods.GET;
    if (!handler) throw new Error("Missing document content GET handler");
    const response = await handler({
      request: new Request(
        "https://example.com/api/v1/documents/missing/content",
      ),
      params: { documentId: "missing" },
    });
    expect(response.status).toBe(404);
  });
});

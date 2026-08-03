import { describe, expect, it } from "vitest";
import { sliceDocumentContent } from "./document-content";

describe("document content pagination", () => {
  it("returns an intermediate page with the next offset", () => {
    expect(sliceDocumentContent("abcdefghij", 2, 4)).toEqual({
      text: "cdef",
      offset: 2,
      nextOffset: 6,
      totalCharacters: 10,
      truncated: true,
    });
  });

  it("returns a final partial page", () => {
    expect(sliceDocumentContent("abcdefghij", 8, 10)).toEqual({
      text: "ij",
      offset: 8,
      nextOffset: null,
      totalCharacters: 10,
      truncated: false,
    });
  });

  it("returns an empty final page at the content length", () => {
    expect(sliceDocumentContent("abcdefghij", 10, 4)).toEqual({
      text: "",
      offset: 10,
      nextOffset: null,
      totalCharacters: 10,
      truncated: false,
    });
  });
});

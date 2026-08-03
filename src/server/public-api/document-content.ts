export interface DocumentContentPage {
  text: string;
  offset: number;
  nextOffset: number | null;
  totalCharacters: number;
  truncated: boolean;
}

export function sliceDocumentContent(
  articleText: string,
  offset: number,
  limit: number,
): DocumentContentPage {
  const totalCharacters = articleText.length;
  const text = articleText.slice(offset, offset + limit);
  const nextOffset = offset + text.length;
  const truncated = nextOffset < totalCharacters;

  return {
    text,
    offset,
    nextOffset: truncated ? nextOffset : null,
    totalCharacters,
    truncated,
  };
}

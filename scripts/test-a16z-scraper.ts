import fetch from "node-fetch";
import {
  parseA16zArchiveList,
  fetchA16zArticleText,
} from "~/inngest/importers/scheduled/a16z/a16z-helpers";

const archivePath = 'https://www.a16z.news/archive?sort=new'




try {
  // Archive test
  const archiveHtml = await fetch(archivePath).then((res) => res.text());
  const candidates = parseA16zArchiveList(archiveHtml);
  console.log("Parsed archive candidates:", candidates);

  const latest = candidates[0];
  if (!latest) {
    console.log("No candidates found in archive HTML");
    process.exit(0);
  }

  const articleText = await fetchA16zArticleText(latest.link);
  console.log(`Fetched article text for ${latest.link}:\n`, articleText);
} catch (error) {
  console.error("Failed to parse a16z HTML", error);
  process.exit(1);
}

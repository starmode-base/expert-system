import { invariant } from "@tanstack/react-router";
import OpenAI from "openai";

const client = new OpenAI();

export async function getArticleText(htmlText: string) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Return only the text from the article.
        - remove all html tags
        - remove all links
        - remove all advertisements

        HTML Text:
        ${htmlText}`,
      },
    ],
  });

  invariant(completion.choices[0]?.message.content, "No content");
  return completion.choices[0].message.content;
}

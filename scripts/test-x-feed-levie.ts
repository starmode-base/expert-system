import { fetchTweetsByUsername } from "~/inngest/functions/importers/unused/fetch-x-posts";

const username = "levie";

function formatPost(args: {
  username: string;
  post: { id: string; text: string; created_at?: string };
}): string {
  const createdAt = args.post.created_at ?? "Unknown time";
  const url = `https://x.com/${args.username}/status/${args.post.id}`;

  return [
    `Most recent post from @${args.username}`,
    `Created: ${createdAt}`,
    `URL: ${url}`,
    "",
    args.post.text,
  ].join("\n");
}

const res = await fetchTweetsByUsername({ username, maxResults: 5 });
const post = res.posts[0];

if (!post) {
  throw new Error(`No posts returned for @${username}`);
}

console.log(formatPost({ username, post }));

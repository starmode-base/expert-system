export interface TwitterApiArticleResponse {
  article: Article;
  status: string;
  msg: string;
}

export interface Article {
  id: string;
  author: Author;

  replyCount: number;
  likeCount: number;
  quoteCount: number;

  /** API returns this as a string (e.g. "399327") */
  viewCount: string;

  /** e.g. "Mon Feb 02 21:51:38 +0000 2026" */
  createdAt: string;

  title: string;
  preview_text: string;

  cover_media_img_url: string;

  contents: ArticleContent[];
}

export interface ArticleContent {
  text: string;
}

export interface Author {
  type: string;
  userName: string;

  url: string;
  twitterUrl: string;

  id: string;
  name: string;

  isVerified: boolean;
  isBlueVerified: boolean;
  verifiedType: string | null;

  profilePicture: string;
  coverPicture: string;

  description: string;
  location: string;

  followers: number;
  following: number;

  status: string;

  canDm: boolean;
  canMediaTag: boolean;

  /** e.g. "Fri Oct 30 16:54:39 +0000 2009" */
  createdAt: string;

  entities: UserEntities;

  fastFollowersCount: number;
  favouritesCount: number;

  hasCustomTimelines: boolean;
  isTranslator: boolean;

  mediaCount: number;
  statusesCount: number;

  withheldInCountries: string[];

  affiliatesHighlightedLabel: Record<string, unknown>;
  possiblySensitive: boolean;

  pinnedTweetIds: string[];

  profile_bio: Record<string, unknown>;

  isAutomated: boolean;
  automatedBy: string | null;
}

export interface UserEntities {
  description: {
    urls: EntityUrl[];
  };
  url: {
    urls: EntityUrl[];
  };
}

export interface EntityUrl {
  display_url: string;
  expanded_url: string;
  url: string;
  indices: [number, number];
}

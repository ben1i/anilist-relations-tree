export type MediaType = 'ANIME' | 'MANGA';

export type MediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC'
  | 'MANGA'
  | 'NOVEL'
  | 'ONE_SHOT';

export type MediaStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export type MediaRelation =
  | 'ADAPTATION'
  | 'PREQUEL'
  | 'SEQUEL'
  | 'PARENT'
  | 'SIDE_STORY'
  | 'CHARACTER'
  | 'SUMMARY'
  | 'ALTERNATIVE'
  | 'SPIN_OFF'
  | 'OTHER'
  | 'SOURCE'
  | 'COMPILATION'
  | 'CONTAINS';

export interface MediaTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred?: string | null;
}

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface MediaCoverImage {
  medium: string | null;
  large: string | null;
  extraLarge?: string | null;
}

export interface AniListRelationNode {
  id: number;
  idMal?: number | null;
  type: MediaType;
  title: MediaTitle;
  format: MediaFormat | null;
  episodes: number | null;
  chapters: number | null;
  volumes?: number | null;
  status: MediaStatus | null;
  seasonYear: number | null;
  season?: string | null;
  startDate?: FuzzyDate | null;
  averageScore?: number | null;
  coverImage: MediaCoverImage | null;
  siteUrl?: string | null;
}

export interface AniListRelationEdge {
  id?: number;
  relationType: MediaRelation;
  node: AniListRelationNode;
}

export interface AniListMedia extends AniListRelationNode {
  relations?: {
    edges: AniListRelationEdge[];
  };
}

export interface GraphNode {
  id: string; // numeric string
  mediaId: number;
  media: AniListMedia;
  isCurrent: boolean;
  isSelected?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  rawRelation: MediaRelation;
  displayLabel: string;
  points?: Array<{ x: number; y: number }>;
}

export interface FranchiseGraph {
  nodes: Map<number, AniListMedia>;
  rootId: number;
  mediaType: MediaType;
}

export type TitleLanguage = 'english' | 'romaji' | 'native';

export interface FilterState {
  mediaType: 'ALL' | 'ANIME' | 'MANGA';
  maxDepth: number;
  titleLanguage: TitleLanguage;
  enabledRelations: Record<string, boolean>;
  searchQuery: string;
  showCovers: boolean;
}

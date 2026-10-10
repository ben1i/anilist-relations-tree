import type { AniListMedia, FranchiseGraph } from '../types/anilist';

const GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  idMal
  type
  title {
    romaji
    english
    native
  }
  format
  episodes
  chapters
  volumes
  status
  seasonYear
  season
  startDate {
    year
    month
    day
  }
  averageScore
  coverImage {
    medium
    large
    extraLarge
  }
  siteUrl
`;

const SINGLE_MEDIA_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      ${MEDIA_FIELDS}
      relations {
        edges {
          id
          relationType
          node {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  }
`;

const BATCH_MEDIA_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids) {
        ${MEDIA_FIELDS}
        relations {
          edges {
            id
            relationType
            node {
              ${MEDIA_FIELDS}
            }
          }
        }
      }
    }
  }
`;

export interface FetchProgressCallback {
  (progress: { message: string; discovered: number; currentDepth: number; maxDepth: number }): void;
}

class AniListApiService {
  private memoryCache = new Map<number, AniListMedia>();
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private minIntervalMs = 300; // polite throttle (approx 3 req/sec max, well below 90/min)

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - timeSinceLast));
    }
    this.lastRequestTime = Date.now();
  }

  private getSessionCache(id: number): AniListMedia | null {
    try {
      const raw = sessionStorage.getItem(`anilist_media_${id}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - (data._savedAt || 0) < 3600_000) {
        return data.media as AniListMedia;
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return null;
  }

  private setSessionCache(id: number, media: AniListMedia): void {
    try {
      sessionStorage.setItem(
        `anilist_media_${id}`,
        JSON.stringify({ _savedAt: Date.now(), media })
      );
    } catch {
      // Storage might be full, safe to ignore
    }
  }

  private async fetchGraphQL<T>(query: string, variables: Record<string, unknown>, retries = 3): Promise<T> {
    // Chain onto sequential queue to avoid burst spam
    return new Promise<T>((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          await this.throttle();
          let attempt = 0;
          while (attempt < retries) {
            try {
              const res = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json'
                },
                body: JSON.stringify({ query, variables })
              });

              if (res.status === 429) {
                // Rate limited, read Retry-After header or wait with exponential backoff
                const retryAfterHeader = res.headers.get('Retry-After');
                const waitTime = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 2000 * Math.pow(2, attempt);
                console.warn(`[AniList Graph] Rate limited (429). Retrying after ${waitTime}ms...`);
                await new Promise((r) => setTimeout(r, waitTime));
                attempt++;
                continue;
              }

              if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`GraphQL request failed HTTP ${res.status}: ${errorText}`);
              }

              const json = await res.json();
              if (json.errors && json.errors.length > 0) {
                throw new Error(`GraphQL Error: ${json.errors[0].message}`);
              }

              resolve(json.data as T);
              return;
            } catch (err) {
              attempt++;
              if (attempt >= retries) {
                reject(err);
                return;
              }
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
          }
        })
        .catch(reject);
    });
  }

  /**
   * Fetch a single media item by ID with full relations
   */
  public async getMedia(id: number): Promise<AniListMedia> {
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }
    const sessionMedia = this.getSessionCache(id);
    if (sessionMedia) {
      this.memoryCache.set(id, sessionMedia);
      return sessionMedia;
    }

    const data = await this.fetchGraphQL<{ Media: AniListMedia }>(SINGLE_MEDIA_QUERY, { id });
    const media = data.Media;
    this.memoryCache.set(id, media);
    this.setSessionCache(id, media);
    return media;
  }

  /**
   * Batch fetch up to 50 media items by IDs
   */
  public async getMediaBatch(ids: number[]): Promise<AniListMedia[]> {
    const unvisitedIds = ids.filter((id) => !this.memoryCache.has(id) && !this.getSessionCache(id));

    // Restore whatever is already cached
    const results: AniListMedia[] = [];
    for (const id of ids) {
      if (this.memoryCache.has(id)) {
        results.push(this.memoryCache.get(id)!);
      } else {
        const cached = this.getSessionCache(id);
        if (cached) {
          this.memoryCache.set(id, cached);
          results.push(cached);
        }
      }
    }

    if (unvisitedIds.length === 0) {
      return results;
    }

    // Process unvisited in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < unvisitedIds.length; i += chunkSize) {
      const chunk = unvisitedIds.slice(i, i + chunkSize);
      const data = await this.fetchGraphQL<{ Page: { media: AniListMedia[] } }>(BATCH_MEDIA_QUERY, {
        ids: chunk
      });

      for (const media of data.Page.media) {
        this.memoryCache.set(media.id, media);
        this.setSessionCache(media.id, media);
        results.push(media);
      }
    }

    return results;
  }

  /**
   * Recursive BFS exploration of the connected franchise graph
   */
  public async exploreFranchiseGraph(
    rootId: number,
    maxDepth = 5,
    onProgress?: FetchProgressCallback,
    options?: {
      mediaType?: 'ANIME' | 'MANGA' | 'ALL';
      includeCharacters?: boolean;
    }
  ): Promise<FranchiseGraph> {
    const nodes = new Map<number, AniListMedia>();
    const visited = new Set<number>();
    const queue: Array<{ id: number; depth: number }> = [{ id: rootId, depth: 0 }];

    onProgress?.({
      message: 'Initializing franchise search...',
      discovered: 1,
      currentDepth: 0,
      maxDepth
    });

    // Fetch root first
    const rootMedia = await this.getMedia(rootId);
    nodes.set(rootId, rootMedia);
    visited.add(rootId);

    const filterType = options?.mediaType ?? rootMedia.type;
    const includeCharacters = options?.includeCharacters ?? false;

    // BFS by depth level
    let currentDepth = 0;

    while (queue.length > 0) {
      const currentBatch = [...queue];
      queue.length = 0; // Clear queue for next depth

      const nextLevelIdsToFetch: number[] = [];

      for (const item of currentBatch) {
        const media = nodes.get(item.id);
        if (!media || !media.relations || !media.relations.edges) continue;

        for (const edge of media.relations.edges) {
          const target = edge.node;
          if (!target) continue;

          // Never traverse CHARACTER (cameo/crossover) unless explicitly requested
          if (edge.relationType === 'CHARACTER' && !includeCharacters) {
            continue;
          }

          // Filter by media type (e.g. only Anime when exploring an Anime franchise)
          if (filterType !== 'ALL' && target.type !== filterType) {
            continue;
          }

          // Cache the minimal node data if we don't have it yet
          if (!nodes.has(target.id)) {
            nodes.set(target.id, target as AniListMedia);
          }

          // Do NOT queue OTHER relations to explore deeper: OTHER nodes are terminal leaves!
          // This prevents loose relations (e.g. exhibition shorts or commercials) from bridging into unrelated sagas
          if (edge.relationType === 'OTHER') {
            continue;
          }

          if (!visited.has(target.id) && item.depth < maxDepth) {
            visited.add(target.id);
            nextLevelIdsToFetch.push(target.id);
            queue.push({ id: target.id, depth: item.depth + 1 });
          }
        }
      }

      currentDepth++;

      if (nextLevelIdsToFetch.length > 0) {
        onProgress?.({
          message: `Exploring depth level ${currentDepth}/${maxDepth} (${nodes.size} titles found)...`,
          discovered: nodes.size,
          currentDepth,
          maxDepth
        });

        // Batch fetch their full relations
        const fullMediaList = await this.getMediaBatch(nextLevelIdsToFetch);
        for (const fullMedia of fullMediaList) {
          nodes.set(fullMedia.id, fullMedia);
        }
      }
    }

    onProgress?.({
      message: `Exploration complete (${nodes.size} titles found).`,
      discovered: nodes.size,
      currentDepth: maxDepth,
      maxDepth
    });

    return {
      nodes,
      rootId,
      mediaType: rootMedia.type
    };
  }

  public clearCache(): void {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(sessionStorage);
      for (const k of keys) {
        if (k.startsWith('anilist_media_')) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // Ignore
    }
  }
}

export const anilistApi = new AniListApiService();

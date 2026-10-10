import { computeGraphLayout } from '../graph/layout';
import { GraphRenderer } from '../graph/renderer';
import { anilistApi } from '../services/anilistApi';
import { buildGraphModel } from '../services/graphBuilder';
import type { FilterState, FranchiseGraph, TitleLanguage } from '../types/anilist';
import modalCss from './modal.css?inline';

export class RelationsModal {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private overlay!: HTMLElement;
  private viewportEl!: HTMLElement;
  private loadingOverlay!: HTMLElement;
  private loadingStatusEl!: HTMLElement;
  private franchiseTitleEl!: HTMLElement;
  private badgeCountEl!: HTMLElement;
  private filterPopoverEl!: HTMLElement;

  private renderer!: GraphRenderer;
  private currentFranchise: FranchiseGraph | null = null;
  private currentMediaId: number = 0;

  private filters: FilterState = {
    mediaType: 'ALL',
    maxDepth: 5,
    titleLanguage: 'english',
    enabledRelations: {
      SEQUEL: true,
      PREQUEL: true,
      SPIN_OFF: true,
      SIDE_STORY: true,
      ALTERNATIVE: true,
      OTHER: true,
      SUMMARY: true,
      COMPILATION: true,
      ADAPTATION: true,
      CHARACTER: false // Cameos hidden by default to avoid connecting unrelated anime
    },
    searchQuery: '',
    showCovers: false
  };

  private isOpen = false;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'anilist-relations-tree-host';
    this.host.style.display = 'none';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    this.initTemplate();
    this.bindEvents();

    document.body.appendChild(this.host);
  }

  private initTemplate(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = modalCss;
    this.shadow.appendChild(styleEl);

    const templateDoc = new DOMParser().parseFromString(`
      <div class="alt-overlay" id="alt-overlay">
        <!-- Header Toolbar -->
        <header class="alt-header">
          <div class="alt-header-left">
            <div class="alt-logo-badge">
              <div class="alt-logo-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93L9.12 14.5a3 3 0 1 0 1.83.84l2.13-4.57c.3.03.6.03.92 0l2.13 4.57a3 3 0 1 0 1.83-.84l-2.13-4.57A4 4 0 0 0 16 6a4 4 0 0 0-4-4z"/>
                </svg>
              </div>
              <span>Franchise Map</span>
            </div>
            <div class="alt-franchise-title" id="alt-franchise-title">Loading...</div>
            <div class="alt-badge-count" id="alt-badge-count">0 titles</div>
          </div>

          <div class="alt-header-center">
            <!-- Search -->
            <div class="alt-search-box">
              <svg class="alt-search-icon" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input type="text" class="alt-search-input" id="alt-search-input" placeholder="Search tree..." />
            </div>

            <!-- Media Type Filter -->
            <div class="alt-segmented-control" id="alt-type-control">
              <button class="alt-seg-btn is-active" data-type="ALL">All</button>
              <button class="alt-seg-btn" data-type="ANIME">Anime</button>
              <button class="alt-seg-btn" data-type="MANGA">Manga</button>
            </div>

            <!-- Title Language -->
            <div class="alt-segmented-control" id="alt-lang-control">
              <button class="alt-seg-btn is-active" data-lang="english">EN</button>
              <button class="alt-seg-btn" data-lang="romaji">Romaji</button>
              <button class="alt-seg-btn" data-lang="native">JP</button>
            </div>

            <!-- Depth Stepper -->
            <div class="alt-depth-control" title="Recursion depth (distance in relation hops)">
              <span>Depth:</span>
              <input type="range" class="alt-depth-slider" id="alt-depth-slider" min="1" max="6" value="5" />
              <span id="alt-depth-val" style="font-weight:700; color:#38bdf8;">5</span>
            </div>

            <!-- Relations Filter Dropdown Button -->
            <button class="alt-filter-dropdown-btn" id="alt-filter-btn">
              <span>Relations</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          </div>

          <div class="alt-header-right">
            <button class="alt-icon-btn" id="alt-btn-fit" title="Fit view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h6v2H6v4H4V4zm16 0v6h-2V6h-4V4h6zM4 20v-6h2v4h4v2H4zm16 0h-6v-2h4v-4h2v6z"/>
              </svg>
            </button>
            <button class="alt-icon-btn" id="alt-btn-zoomin" title="Zoom in (+)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            <button class="alt-icon-btn" id="alt-btn-zoomout" title="Zoom out (-)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="alt-icon-btn" id="alt-btn-fullscreen" title="Toggle fullscreen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
            <button class="alt-icon-btn close" id="alt-btn-close" title="Close (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Filter Popover -->
        <div class="alt-filter-popover" id="alt-filter-popover" style="display: none;">
          <div class="alt-filter-popover-title">Included Relation Types</div>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="SEQUEL" checked /> Sequels & Prequels
          </label>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="SPIN_OFF" checked /> Spin-offs
          </label>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="SIDE_STORY" checked /> Side Stories
          </label>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="ALTERNATIVE" checked /> Alternative Versions
          </label>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="SUMMARY" checked /> Summaries & Recaps
          </label>
          <label class="alt-filter-checkbox-label">
            <input type="checkbox" data-rel="OTHER" checked /> Other Relations
          </label>
        </div>

        <!-- Canvas Viewport -->
        <main class="alt-viewport" id="alt-viewport"></main>

        <!-- Loading Overlay -->
        <div class="alt-loading-overlay" id="alt-loading-overlay">
          <div class="alt-spinner"></div>
          <div class="alt-loading-status" id="alt-loading-status">Exploring AniList franchise tree...</div>
          <div class="alt-loading-bar-wrap">
            <div class="alt-loading-bar"></div>
          </div>
        </div>

        <!-- Legend / Shortcuts Footer -->
        <footer class="alt-footer">
          <div class="alt-legend">
            <div class="alt-legend-item">
              <span class="alt-legend-dot current"></span>
              <span>Current title</span>
            </div>
            <div class="alt-legend-item">
              <span class="alt-legend-dot normal"></span>
              <span>Related title</span>
            </div>
            <div class="alt-legend-item">
              <span class="alt-legend-dot edge"></span>
              <span>Chronological flow (Left → Right)</span>
            </div>
          </div>
          <div class="alt-shortcuts-hint">
            Drag: Pan • Scroll: Zoom • Click: Open on AniList • Esc: Close
          </div>
        </footer>
      </div>
    `, 'text/html');

    while (templateDoc.body.firstChild) {
      this.shadow.appendChild(templateDoc.body.firstChild);
    }

    // Cache elements
    this.overlay = this.shadow.getElementById('alt-overlay')!;
    this.viewportEl = this.shadow.getElementById('alt-viewport')!;
    this.loadingOverlay = this.shadow.getElementById('alt-loading-overlay')!;
    this.loadingStatusEl = this.shadow.getElementById('alt-loading-status')!;
    this.franchiseTitleEl = this.shadow.getElementById('alt-franchise-title')!;
    this.badgeCountEl = this.shadow.getElementById('alt-badge-count')!;
    this.filterPopoverEl = this.shadow.getElementById('alt-filter-popover')!;

    // Instantiate renderer
    this.renderer = new GraphRenderer({
      container: this.viewportEl
    });
  }

  private bindEvents(): void {
    // Close button
    this.shadow.getElementById('alt-btn-close')?.addEventListener('click', () => this.close());

    // Fit view
    this.shadow.getElementById('alt-btn-fit')?.addEventListener('click', () => this.renderer.fitView());

    // Zoom buttons
    this.shadow.getElementById('alt-btn-zoomin')?.addEventListener('click', () => this.renderer.zoomIn());
    this.shadow.getElementById('alt-btn-zoomout')?.addEventListener('click', () => this.renderer.zoomOut());

    // Fullscreen toggle
    this.shadow.getElementById('alt-btn-fullscreen')?.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        this.host.requestFullscreen().catch(() => {});
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Media type filter
    const typeControl = this.shadow.getElementById('alt-type-control');
    typeControl?.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('.alt-seg-btn') as HTMLElement;
      if (!btn) return;

      const newType = (btn.dataset.type as FilterState['mediaType']) || 'ALL';
      if (this.filters.mediaType === newType) return;

      typeControl.querySelectorAll('.alt-seg-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      this.filters.mediaType = newType;

      // If switching to ALL, re-explore to fetch cross-media (e.g. Manga adaptations) if needed
      if (newType === 'ALL' && this.currentMediaId) {
        this.loadingOverlay.classList.remove('is-hidden');
        this.loadingStatusEl.textContent = 'Exploring cross-media adaptations...';
        try {
          this.currentFranchise = await anilistApi.exploreFranchiseGraph(
            this.currentMediaId,
            this.filters.maxDepth,
            (progress) => {
              this.loadingStatusEl.textContent = progress.message;
            },
            { mediaType: 'ALL', includeCharacters: false }
          );
        } finally {
          this.loadingOverlay.classList.add('is-hidden');
        }
      }

      this.recomputeAndRender();
      this.renderer.fitView();
    });

    // Title language filter
    const langControl = this.shadow.getElementById('alt-lang-control');
    langControl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.alt-seg-btn') as HTMLElement;
      if (!btn) return;

      langControl.querySelectorAll('.alt-seg-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      this.filters.titleLanguage = (btn.dataset.lang as TitleLanguage) || 'english';
      this.recomputeAndRender();
    });

    // Depth slider
    const depthSlider = this.shadow.getElementById('alt-depth-slider') as HTMLInputElement;
    const depthVal = this.shadow.getElementById('alt-depth-val');
    depthSlider?.addEventListener('input', () => {
      const val = parseInt(depthSlider.value, 10);
      if (depthVal) depthVal.textContent = val.toString();
      this.filters.maxDepth = val;
      this.recomputeAndRender();
    });

    // Search input
    const searchInput = this.shadow.getElementById('alt-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      this.filters.searchQuery = q;
      if (!q) return;

      // Find first node matching query
      if (this.currentFranchise) {
        for (const [id, media] of this.currentFranchise.nodes.entries()) {
          const titleEng = (media.title?.english || '').toLowerCase();
          const titleRom = (media.title?.romaji || '').toLowerCase();
          const titleNat = (media.title?.native || '').toLowerCase();

          if (titleEng.includes(q) || titleRom.includes(q) || titleNat.includes(q)) {
            this.renderer.focusNode(id.toString());
            break;
          }
        }
      }
    });

    // Relations Filter Popover Toggle
    const filterBtn = this.shadow.getElementById('alt-filter-btn');
    filterBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = this.filterPopoverEl.style.display !== 'none';
      this.filterPopoverEl.style.display = isVisible ? 'none' : 'flex';
    });

    // Relations Filter Checkboxes
    this.filterPopoverEl.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const rel = input.dataset.rel;
      if (rel) {
        this.filters.enabledRelations[rel] = input.checked;
        if (rel === 'SEQUEL') this.filters.enabledRelations['PREQUEL'] = input.checked;
        if (rel === 'SUMMARY') this.filters.enabledRelations['COMPILATION'] = input.checked;
        this.recomputeAndRender();
      }
    });

    // Click outside to close filter popover
    this.shadow.addEventListener('click', (e) => {
      if (!this.filterPopoverEl.contains(e.target as Node) && e.target !== filterBtn) {
        this.filterPopoverEl.style.display = 'none';
      }
    });
  }

  public async open(mediaId: number): Promise<void> {
    this.currentMediaId = mediaId;
    this.isOpen = true;
    this.host.style.display = 'block';
    this.host.classList.add('is-open');
    this.overlay.style.display = 'flex';
    this.overlay.classList.add('is-open');

    // Automatically set default media type to match current page URL (/anime/ vs /manga/)
    const isManga = window.location.pathname.includes('/manga/');
    const defaultType: FilterState['mediaType'] = isManga ? 'MANGA' : 'ANIME';
    this.filters.mediaType = defaultType;

    // Update segmented control UI
    const typeControl = this.shadow.getElementById('alt-type-control');
    if (typeControl) {
      typeControl.querySelectorAll('.alt-seg-btn').forEach((b) => {
        const btn = b as HTMLElement;
        if (btn.dataset.type === defaultType) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      });
    }

    // Show loading state
    this.loadingOverlay.classList.remove('is-hidden');
    this.loadingStatusEl.textContent = 'Connecting to AniList GraphQL...';

    try {
      // Explore graph from AniList (filtered by default to current medium type and excluding character cameos)
      const franchise = await anilistApi.exploreFranchiseGraph(
        mediaId,
        this.filters.maxDepth,
        (progress) => {
          this.loadingStatusEl.textContent = progress.message;
        },
        {
          mediaType: this.filters.mediaType,
          includeCharacters: false
        }
      );

      this.currentFranchise = franchise;

      // Set header franchise name from root media
      const rootMedia = franchise.nodes.get(mediaId);
      const rootTitle =
        rootMedia?.title?.english || rootMedia?.title?.romaji || rootMedia?.title?.native || 'Franchise';
      this.franchiseTitleEl.textContent = rootTitle;
      this.franchiseTitleEl.title = rootTitle;

      this.recomputeAndRender();

      // Smooth auto-fit
      requestAnimationFrame(() => {
        this.renderer.fitView();
        // Hide loading
        this.loadingOverlay.classList.add('is-hidden');
      });
    } catch (err: unknown) {
      console.error('[AniList Graph] Failed to load franchise graph:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this.loadingStatusEl.textContent = `Error: ${msg}`;
    }
  }

  public getCurrentMediaId(): number {
    return this.currentMediaId;
  }

  public isOpenModal(): boolean {
    return this.isOpen;
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.classList.remove('is-open');
    this.overlay.style.display = 'none';
    this.host.classList.remove('is-open');
    this.host.style.display = 'none';
    this.filterPopoverEl.style.display = 'none';
    this.renderer.clear();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  private recomputeAndRender(): void {
    if (!this.currentFranchise) return;

    const { nodes, edges } = buildGraphModel(this.currentFranchise, this.filters);
    const layout = computeGraphLayout(nodes, edges);

    this.badgeCountEl.textContent = `${nodes.length} title${nodes.length !== 1 ? 's' : ''}`;
    this.renderer.setData(layout, this.filters);
  }
}

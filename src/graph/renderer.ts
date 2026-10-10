import type { FilterState, GraphEdge, GraphNode, MediaTitle, TitleLanguage } from '../types/anilist';
import { type LayoutBounds, type LayoutResult } from './layout';

export interface RendererOptions {
  container: HTMLElement;
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  onNodeHover?: (node: GraphNode | null, targetElement: HTMLElement | null) => void;
}

export class GraphRenderer {
  private container: HTMLElement;
  private canvasLayer!: HTMLElement;
  private svgLayer!: SVGSVGElement;
  private nodesContainer!: HTMLElement;
  private tooltipEl!: HTMLElement;

  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private bounds: LayoutBounds = { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };

  private panX = 0;
  private panY = 0;
  private zoom = 1.0;

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private startPanX = 0;
  private startPanY = 0;

  private titleLanguage: TitleLanguage = 'english';
  private onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  private onNodeHover?: (node: GraphNode | null, targetElement: HTMLElement | null) => void;

  constructor(options: RendererOptions) {
    this.container = options.container;
    this.onNodeClick = options.onNodeClick;
    this.onNodeHover = options.onNodeHover;

    this.initDOM();
    this.bindEvents();
  }

  private initDOM(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';
    this.container.style.backgroundColor = '#0b0c0f';

    // Outer transformed layer containing both SVG edges and HTML cards
    this.canvasLayer = document.createElement('div');
    this.canvasLayer.className = 'alt-graph-layer';
    this.canvasLayer.style.position = 'absolute';
    this.canvasLayer.style.top = '0';
    this.canvasLayer.style.left = '0';
    this.canvasLayer.style.width = '100%';
    this.canvasLayer.style.height = '100%';
    this.canvasLayer.style.transformOrigin = '0 0';
    this.canvasLayer.style.pointerEvents = 'none';

    // SVG for grid, curves and badges
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.setAttribute('class', 'alt-graph-svg');
    this.svgLayer.style.position = 'absolute';
    this.svgLayer.style.top = '0';
    this.svgLayer.style.left = '0';
    this.svgLayer.style.width = '100000px';
    this.svgLayer.style.height = '100000px';
    this.svgLayer.style.transform = 'translate(-50000px, -50000px)';
    this.svgLayer.style.pointerEvents = 'none';
    this.svgLayer.style.overflow = 'visible';

    // HTML nodes layer
    this.nodesContainer = document.createElement('div');
    this.nodesContainer.className = 'alt-graph-nodes';
    this.nodesContainer.style.position = 'absolute';
    this.nodesContainer.style.top = '0';
    this.nodesContainer.style.left = '0';
    this.nodesContainer.style.width = '100%';
    this.nodesContainer.style.height = '100%';
    this.nodesContainer.style.pointerEvents = 'none';

    this.canvasLayer.appendChild(this.svgLayer);
    this.canvasLayer.appendChild(this.nodesContainer);
    this.container.appendChild(this.canvasLayer);

    // Floating tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'alt-node-tooltip';
    this.tooltipEl.style.display = 'none';
    this.container.appendChild(this.tooltipEl);
  }

  private bindEvents(): void {
    // Pan via pointer drag
    this.container.addEventListener('pointerdown', (e) => {
      // Ignore if clicking directly on a button or link
      if ((e.target as HTMLElement).closest('.alt-node-card-btn')) return;

      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startPanX = this.panX;
      this.startPanY = this.panY;
      this.container.style.cursor = 'grabbing';
      this.hideTooltip();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.panX = this.startPanX + dx;
      this.panY = this.startPanY + dy;
      this.applyTransform();
    });

    window.addEventListener('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
      }
    });

    // Zoom via mouse wheel (centered on cursor)
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.2), 2.5);

      // Keep point under cursor stable
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.applyTransform();
      this.hideTooltip();
    }, { passive: false });
  }

  public setData(layoutResult: LayoutResult, filters: FilterState): void {
    this.nodes = layoutResult.nodes;
    this.edges = layoutResult.edges;
    this.bounds = layoutResult.bounds;
    this.titleLanguage = filters.titleLanguage;

    this.render();
  }

  public clear(): void {
    this.nodes = [];
    this.edges = [];
    while (this.nodesContainer.firstChild) {
      this.nodesContainer.removeChild(this.nodesContainer.firstChild);
    }
    while (this.svgLayer.firstChild) {
      this.svgLayer.removeChild(this.svgLayer.firstChild);
    }
    this.hideTooltip();
  }

  public render(): void {
    this.renderSVG();
    this.renderNodes();
    this.applyTransform();
  }

  private renderSVG(): void {
    // SVG definitions: dot-grid pattern
    const defs = `
      <defs>
        <pattern id="alt-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" fill="#23262f" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100000" height="100000" fill="url(#alt-dot-grid)" />
    `;

    // Map nodes by ID for fast coordinate lookup
    const nodeMap = new Map<string, GraphNode>();
    for (const node of this.nodes) {
      nodeMap.set(node.id, node);
    }

    let edgesSvg = '<g class="alt-edges-group">';

    // SVG coordinate space is shifted by 50000 to allow negative coordinates
    const OFFSET = 50000;

    for (const edge of this.edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      // Source right-edge center
      const x1 = source.x + source.width / 2 + OFFSET;
      const y1 = source.y + OFFSET;

      // Target left-edge center
      const x2 = target.x - target.width / 2 + OFFSET;
      const y2 = target.y + OFFSET;

      // Calculate cubic Bézier curve
      const dx = Math.max(x2 - x1, 40);
      const cx1 = x1 + dx * 0.45;
      const cy1 = y1;
      const cx2 = x2 - dx * 0.45;
      const cy2 = y2;

      const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

      // Midpoint on Bézier curve at t=0.5
      const midX = (x1 + 3 * cx1 + 3 * cx2 + x2) / 8;
      const midY = (y1 + 3 * cy1 + 3 * cy2 + y2) / 8;

      // Badge dimensions based on label length
      const label = edge.displayLabel;
      const badgeWidth = Math.max(label.length * 6.5 + 14, 52);
      const badgeHeight = 18;

      edgesSvg += `
        <g class="alt-edge-item" data-edge-id="${edge.id}">
          <path
            d="${pathData}"
            fill="none"
            stroke="#454b59"
            stroke-width="1.3"
            stroke-dasharray="4 4"
            class="alt-edge-line"
          />
          <g transform="translate(${midX}, ${midY})">
            <rect
              x="${-badgeWidth / 2}"
              y="${-badgeHeight / 2}"
              width="${badgeWidth}"
              height="${badgeHeight}"
              rx="3"
              ry="3"
              fill="#121316"
              stroke="#2d3039"
              stroke-width="1"
              class="alt-edge-badge-rect"
            />
            <text
              x="0"
              y="0.5"
              text-anchor="middle"
              dominant-baseline="central"
              fill="#a2a8b8"
              font-size="9px"
              font-weight="700"
              font-family="system-ui, -apple-system, sans-serif"
              letter-spacing="0.5px"
              class="alt-edge-badge-text"
            >${label}</text>
          </g>
        </g>
      `;
    }

    edgesSvg += '</g>';
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${defs}${edgesSvg}</svg>`,
      'image/svg+xml'
    );
    while (this.svgLayer.firstChild) {
      this.svgLayer.removeChild(this.svgLayer.firstChild);
    }
    while (doc.documentElement.firstChild) {
      this.svgLayer.appendChild(doc.documentElement.firstChild);
    }
  }

  private renderNodes(): void {
    while (this.nodesContainer.firstChild) {
      this.nodesContainer.removeChild(this.nodesContainer.firstChild);
    }

    for (const node of this.nodes) {
      const card = document.createElement('div');
      card.className = `alt-node-card ${node.isCurrent ? 'is-current' : ''}`;
      card.dataset.id = node.id;

      card.style.position = 'absolute';
      card.style.left = `${node.x - node.width / 2}px`;
      card.style.top = `${node.y - node.height / 2}px`;
      card.style.width = `${node.width}px`;
      card.style.height = `${node.height}px`;

      const title = this.getNodeTitle(node.media.title);
      const formatStr = this.formatMediaFormat(node.media.format);
      const countStr = this.formatCount(node.media);

      const cardInner = document.createElement('div');
      cardInner.className = 'alt-card-inner';

      const titleEl = document.createElement('div');
      titleEl.className = 'alt-card-title';
      titleEl.title = title;
      titleEl.textContent = title;

      const metaEl = document.createElement('div');
      metaEl.className = 'alt-card-meta';

      const formatEl = document.createElement('span');
      formatEl.className = 'alt-meta-format';
      formatEl.textContent = formatStr;

      const countEl = document.createElement('span');
      countEl.className = 'alt-meta-count';
      countEl.textContent = countStr;

      metaEl.appendChild(formatEl);
      metaEl.appendChild(countEl);
      cardInner.appendChild(titleEl);
      cardInner.appendChild(metaEl);
      card.appendChild(cardInner);

      // Click handler
      card.addEventListener('click', (e) => {
        if (this.onNodeClick) {
          this.onNodeClick(node, e);
        } else {
          const url = node.media.siteUrl || `https://anilist.co/${node.media.type.toLowerCase()}/${node.media.id}`;
          window.open(url, '_blank');
        }
      });

      // Hover handler
      card.addEventListener('mouseenter', () => {
        this.showTooltip(node, card);
        this.onNodeHover?.(node, card);
      });

      card.addEventListener('mouseleave', () => {
        this.hideTooltip();
        this.onNodeHover?.(null, null);
      });

      this.nodesContainer.appendChild(card);
    }
  }

  private getNodeTitle(titleObj?: MediaTitle | null): string {
    if (!titleObj) return 'Unknown Title';
    if (this.titleLanguage === 'english' && titleObj.english) return titleObj.english;
    if (this.titleLanguage === 'native' && titleObj.native) return titleObj.native;
    return titleObj.romaji || titleObj.english || titleObj.native || 'Unknown Title';
  }

  private formatMediaFormat(format: string | null): string {
    switch (format) {
      case 'TV':
        return 'TV Series';
      case 'TV_SHORT':
        return 'TV Short';
      case 'MOVIE':
        return 'Movie';
      case 'SPECIAL':
        return 'Special';
      case 'OVA':
        return 'OVA';
      case 'ONA':
        return 'ONA';
      case 'MUSIC':
        return 'Music';
      case 'MANGA':
        return 'Manga';
      case 'NOVEL':
        return 'Light Novel';
      case 'ONE_SHOT':
        return 'One Shot';
      default:
        return format || 'Media';
    }
  }

  private formatCount(media: GraphNode['media']): string {
    if (media.type === 'MANGA') {
      if (media.chapters) return `${media.chapters} Chapters`;
      if (media.volumes) return `${media.volumes} Volumes`;
      return 'Manga';
    }
    if (media.episodes !== null && media.episodes !== undefined) {
      return `${media.episodes} Episodes`;
    }
    return media.status === 'NOT_YET_RELEASED' ? 'Upcoming' : 'Unknown';
  }

  private showTooltip(node: GraphNode, targetCard: HTMLElement): void {
    const media = node.media;
    const coverUrl = media.coverImage?.large || media.coverImage?.medium;
    const score = media.averageScore ? `${media.averageScore}%` : 'N/A';
    const year = media.seasonYear || media.startDate?.year || '';
    const status = media.status ? media.status.replace(/_/g, ' ') : '';
    const title = this.getNodeTitle(media.title);

    while (this.tooltipEl.firstChild) {
      this.tooltipEl.removeChild(this.tooltipEl.firstChild);
    }

    const content = document.createElement('div');
    content.className = 'alt-tt-content';

    if (coverUrl) {
      const img = document.createElement('img');
      img.className = 'alt-tt-cover';
      img.src = coverUrl;
      img.alt = 'Cover';
      content.appendChild(img);
    }

    const details = document.createElement('div');
    details.className = 'alt-tt-details';

    const ttTitle = document.createElement('div');
    ttTitle.className = 'alt-tt-title';
    ttTitle.textContent = title;
    details.appendChild(ttTitle);

    const stats = document.createElement('div');
    stats.className = 'alt-tt-stats';

    if (year) {
      const yearTag = document.createElement('span');
      yearTag.className = 'alt-tt-tag';
      yearTag.textContent = String(year);
      stats.appendChild(yearTag);
    }

    const scoreTag = document.createElement('span');
    scoreTag.className = 'alt-tt-tag score';
    scoreTag.textContent = `★ ${score}`;
    stats.appendChild(scoreTag);

    if (status) {
      const statusTag = document.createElement('span');
      statusTag.className = 'alt-tt-tag status';
      statusTag.textContent = status;
      stats.appendChild(statusTag);
    }
    details.appendChild(stats);

    const hint = document.createElement('div');
    hint.className = 'alt-tt-hint';
    hint.textContent = 'Click to open on AniList ↗';
    details.appendChild(hint);

    content.appendChild(details);
    this.tooltipEl.appendChild(content);

    // Position tooltip relative to card
    const containerRect = this.container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();

    let left = cardRect.left - containerRect.left + cardRect.width / 2;
    let top = cardRect.top - containerRect.top - 10;

    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.transform = 'translate(-50%, -100%)';
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;

    // Prevent top clipping
    if (top < 120) {
      this.tooltipEl.style.transform = 'translate(-50%, 15px)';
      this.tooltipEl.style.top = `${cardRect.bottom - containerRect.top}px`;
    }
  }

  private hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  public fitView(): void {
    const containerW = this.container.clientWidth || 1000;
    const containerH = this.container.clientHeight || 700;

    const graphW = this.bounds.width;
    const graphH = this.bounds.height;

    const padding = 80;
    const scaleX = (containerW - padding * 2) / Math.max(graphW, 100);
    const scaleY = (containerH - padding * 2) / Math.max(graphH, 100);

    this.zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.2);

    // Center layout
    const graphCenterX = this.bounds.minX + graphW / 2;
    const graphCenterY = this.bounds.minY + graphH / 2;

    this.panX = containerW / 2 - graphCenterX * this.zoom;
    this.panY = containerH / 2 - graphCenterY * this.zoom;

    this.applyTransform();
  }

  public zoomIn(): void {
    this.setZoom(this.zoom * 1.25);
  }

  public zoomOut(): void {
    this.setZoom(this.zoom * 0.8);
  }

  public resetZoom(): void {
    this.zoom = 1.0;
    const containerW = this.container.clientWidth || 1000;
    const containerH = this.container.clientHeight || 700;
    const graphCenterX = this.bounds.minX + this.bounds.width / 2;
    const graphCenterY = this.bounds.minY + this.bounds.height / 2;
    this.panX = containerW / 2 - graphCenterX;
    this.panY = containerH / 2 - graphCenterY;
    this.applyTransform();
  }

  private setZoom(targetZoom: number): void {
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;
    const centerPointX = containerW / 2;
    const centerPointY = containerH / 2;

    const newZoom = Math.min(Math.max(targetZoom, 0.2), 2.5);
    this.panX = centerPointX - (centerPointX - this.panX) * (newZoom / this.zoom);
    this.panY = centerPointY - (centerPointY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this.applyTransform();
  }

  public focusNode(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;

    this.panX = containerW / 2 - node.x * this.zoom;
    this.panY = containerH / 2 - node.y * this.zoom;
    this.applyTransform();

    // Flash node element
    const el = this.nodesContainer.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
    if (el) {
      el.classList.add('is-focused');
      setTimeout(() => el.classList.remove('is-focused'), 2000);
    }
  }

  private applyTransform(): void {
    this.canvasLayer.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;
  }
}

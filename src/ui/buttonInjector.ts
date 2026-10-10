import type { RelationsModal } from './modal';

export class ButtonInjector {
  private modal: RelationsModal;
  private currentMediaId: number | null = null;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor(modal: RelationsModal) {
    this.modal = modal;
    this.init();
  }

  private init(): void {
    // Inject floating button style once
    this.injectGlobalStyles();

    // Initial check
    this.checkAndInject();

    // Observe DOM mutations for SPA navigations
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
        this.checkAndInject();
      }, 250);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // SPA history hooks
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      originalPushState(...args);
      setTimeout(() => this.checkAndInject(), 100);
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      originalReplaceState(...args);
      setTimeout(() => this.checkAndInject(), 100);
    };

    window.addEventListener('popstate', () => {
      setTimeout(() => this.checkAndInject(), 100);
    });

    // Keyboard shortcut Alt + R
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        const id = this.extractMediaId();
        if (id) {
          e.preventDefault();
          this.modal.open(id);
        }
      }
    });
  }

  public getActiveMediaId(): number | null {
    return this.currentMediaId;
  }

  public extractMediaId(): number | null {
    const url = window.location.pathname;
    const match = url.match(/\/(anime|manga)\/(\d+)/i);
    if (match && match[2]) {
      return parseInt(match[2], 10);
    }
    return null;
  }

  public checkAndInject(): void {
    const mediaId = this.extractMediaId();
    if (!mediaId) {
      this.currentMediaId = null;
      this.removeInjectedButtons();
      if (this.modal.isOpenModal()) {
        this.modal.close();
      }
      return;
    }

    if (this.currentMediaId !== null && this.currentMediaId !== mediaId) {
      // Changed to a different anime/manga page
      if (this.modal.isOpenModal()) {
        this.modal.close();
      }
    }

    this.currentMediaId = mediaId;

    // 1. Inject in media action bar/sidebar if found
    this.injectInActionBar(mediaId);

    // 2. Inject in relations section header if found
    this.injectInRelationsSection(mediaId);

    // 3. Inject floating trigger button (convenient quick access)
    this.injectFloatingTrigger(mediaId);
  }

  private injectInActionBar(mediaId: number): void {
    const existing = document.getElementById('alt-action-bar-btn');
    if (existing && existing.dataset.mediaId === mediaId.toString()) {
      return;
    }
    if (existing) existing.remove();

    // Look for AniList's actions container: .cover-wrap .actions, or .header-wrap .actions, or .sidebar
    const actionsContainer =
      document.querySelector('.cover-wrap .actions') ||
      document.querySelector('.sidebar .actions') ||
      document.querySelector('.sidebar .list')?.parentElement ||
      document.querySelector('.sidebar .favourite')?.parentElement ||
      document.querySelector('.header-wrap .actions') ||
      document.querySelector('.cover-wrap') ||
      document.querySelector('.header .content');

    if (!actionsContainer) return;

    const btn = document.createElement('div');
    btn.id = 'alt-action-bar-btn';
    btn.dataset.mediaId = mediaId.toString();
    btn.className = 'alt-anilist-inline-btn';
    btn.title = 'View interactive franchise relations tree';
    btn.appendChild(this.createIconSvg(16));
    const btnLabel = document.createElement('span');
    btnLabel.textContent = 'Franchise Map';
    btn.appendChild(btnLabel);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.modal.open(mediaId);
    });

    actionsContainer.appendChild(btn);
  }

  private injectInRelationsSection(mediaId: number): void {
    // Reset any legacy styles applied to .relations container
    const relationsContainer = document.querySelector('.relations') as HTMLElement | null;
    if (relationsContainer) {
      relationsContainer.style.removeProperty('display');
      relationsContainer.style.removeProperty('align-items');
      relationsContainer.style.removeProperty('justify-content');
    }

    const existing = document.getElementById('alt-relations-section-btn');
    if (existing && existing.dataset.mediaId === mediaId.toString()) {
      return;
    }
    if (existing) existing.remove();

    // Find relations section heading: .relations h2, .overview .relations h2
    const relationsHeading = (document.querySelector('.relations h2') ||
      document.querySelector('.overview .relations h2') ||
      document.querySelector('.relations .section-header')) as HTMLElement | null;

    if (!relationsHeading) return;

    const btn = document.createElement('button');
    btn.id = 'alt-relations-section-btn';
    btn.dataset.mediaId = mediaId.toString();
    btn.className = 'alt-section-badge-btn';
    btn.type = 'button';
    btn.appendChild(this.createIconSvg(14));
    const relLabel = document.createElement('span');
    relLabel.textContent = 'Interactive Tree';
    btn.appendChild(relLabel);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.modal.open(mediaId);
    });

    // Style ONLY the heading (h2) line as a flex row, NEVER its parent container!
    relationsHeading.style.display = 'flex';
    relationsHeading.style.alignItems = 'center';
    relationsHeading.style.justifyContent = 'space-between';
    relationsHeading.appendChild(btn);
  }

  private injectFloatingTrigger(mediaId: number): void {
    const existing = document.getElementById('alt-floating-trigger');
    if (existing) {
      existing.dataset.mediaId = mediaId.toString();
      return;
    }

    const floatBtn = document.createElement('button');
    floatBtn.id = 'alt-floating-trigger';
    floatBtn.dataset.mediaId = mediaId.toString();
    floatBtn.className = 'alt-floating-bubble-btn';
    floatBtn.title = 'Open franchise relations tree (Alt+R)';
    floatBtn.appendChild(this.createIconSvg(20));
    const floatLabel = document.createElement('span');
    floatLabel.className = 'alt-float-label';
    floatLabel.textContent = 'Relations';
    floatBtn.appendChild(floatLabel);

    floatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = this.extractMediaId();
      if (id) {
        this.modal.open(id);
      }
    });

    document.body.appendChild(floatBtn);
  }

  private removeInjectedButtons(): void {
    document.getElementById('alt-action-bar-btn')?.remove();

    const relBtn = document.getElementById('alt-relations-section-btn');
    if (relBtn) {
      const parent = relBtn.parentElement;
      relBtn.remove();
      if (parent) {
        parent.style.removeProperty('display');
        parent.style.removeProperty('align-items');
        parent.style.removeProperty('justify-content');
      }
    }

    const relationsContainer = document.querySelector('.relations') as HTMLElement | null;
    if (relationsContainer) {
      relationsContainer.style.removeProperty('display');
      relationsContainer.style.removeProperty('align-items');
      relationsContainer.style.removeProperty('justify-content');
    }

    document.getElementById('alt-floating-trigger')?.remove();
  }

  private createIconSvg(size: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size.toString());
    svg.setAttribute('height', size.toString());
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93L9.12 14.5a3 3 0 1 0 1.83.84l2.13-4.57c.3.03.6.03.92 0l2.13 4.57a3 3 0 1 0 1.83-.84l-2.13-4.57A4 4 0 0 0 16 6a4 4 0 0 0-4-4z'
    );
    svg.appendChild(path);
    return svg;
  }

  private injectGlobalStyles(): void {
    if (document.getElementById('alt-injected-global-styles')) return;

    const style = document.createElement('style');
    style.id = 'alt-injected-global-styles';
    style.textContent = `
      .alt-anilist-inline-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: #02a9ff;
        color: #ffffff !important;
        font-size: 13px;
        font-weight: 700;
        padding: 9px 16px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 8px;
        box-shadow: 0 2px 10px rgba(2, 169, 255, 0.35);
        transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        user-select: none;
      }
      .alt-anilist-inline-btn:hover {
        background: #2cb5ff;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(2, 169, 255, 0.5);
      }
      .alt-section-badge-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #151f2e;
        border: 1px solid #2b405f;
        color: #38bdf8;
        font-size: 11.5px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .alt-section-badge-btn:hover {
        background: #02a9ff;
        border-color: #02a9ff;
        color: #ffffff;
      }
      .alt-floating-bubble-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #0f172a;
        border: 1.5px solid #02a9ff;
        color: #ffffff;
        padding: 10px 16px;
        border-radius: 30px;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(2, 169, 255, 0.4);
        font-size: 13px;
        font-weight: 700;
        font-family: inherit;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      }
      .alt-floating-bubble-btn:hover {
        transform: scale(1.06);
        background: #02a9ff;
        box-shadow: 0 8px 25px rgba(2, 169, 255, 0.6);
      }
      .alt-float-label {
        font-size: 12px;
        letter-spacing: 0.3px;
      }
    `;
    document.head.appendChild(style);
  }
}

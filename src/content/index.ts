import { ButtonInjector } from '../ui/buttonInjector';
import { RelationsModal } from '../ui/modal';

function init(): void {
  // Ensure we are in a top-level window
  if (window.top !== window.self) return;

  const modal = new RelationsModal();
  const injector = new ButtonInjector(modal);

  // Listen for demo/preview messages
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'DEMO_OPEN' && e.data?.id) {
      modal.open(Number(e.data.id));
    }
  });

  // Listen for messages from background script (e.g. toolbar action icon click)
  const browserAPI = (globalThis as any).browser || (globalThis as any).chrome;
  if (browserAPI?.runtime?.onMessage) {
    browserAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (res: any) => void) => {
      if (message?.type === 'OPEN_RELATIONS_GRAPH') {
        const mediaId = injector.extractMediaId();
        if (mediaId) {
          modal.open(mediaId);
          sendResponse({ success: true, mediaId });
        } else {
          sendResponse({ success: false, reason: 'Page not recognized as an AniList anime or manga' });
        }
      }
      return true; // Keep channel open for async response
    });
  }

  console.log('[AniList Relations Tree] Extension loaded and active.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

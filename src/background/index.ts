// AniList Relations Tree - Background Service Worker / Script
const browserAPI = (globalThis as any).browser || (globalThis as any).chrome;

// Automatically inject into existing tabs when installed or reloaded
if (browserAPI?.runtime?.onInstalled) {
  browserAPI.runtime.onInstalled.addListener(async () => {
    try {
      const tabs = await browserAPI.tabs.query({ url: '*://anilist.co/*' });
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await browserAPI.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } catch {
            // Tab might be restricted or unloaded
          }
        }
      }
    } catch (err) {
      console.warn('[AniList Graph] Could not auto-inject into active tabs:', err);
    }
  });
}

browserAPI.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (!tab.id || !tab.url) return;

  const isAniListMedia =
    tab.url.includes('anilist.co/anime/') || tab.url.includes('anilist.co/manga/');

  if (isAniListMedia) {
    try {
      await browserAPI.tabs.sendMessage(tab.id, { type: 'OPEN_RELATIONS_GRAPH' });
    } catch {
      // Content script might need to be injected if tab was opened before extension installation
      try {
        await browserAPI.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        setTimeout(async () => {
          await browserAPI.tabs.sendMessage(tab.id, { type: 'OPEN_RELATIONS_GRAPH' });
        }, 200);
      } catch (injectionErr) {
        console.error('[AniList Graph] Error during script injection:', injectionErr);
      }
    }
  } else {
    // Open AniList if clicked from another tab
    await browserAPI.tabs.create({ url: 'https://anilist.co/search/anime' });
  }
});

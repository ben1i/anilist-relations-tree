# AniList Relations Tree (Cross-Browser WebExtension)

> **Interactive anime & manga franchise genealogy & timeline tree visualizer for AniList (Chromium & Firefox)**

This Manifest V3 browser extension adds an interactive hierarchical relationship tree directly inside anime and manga pages on [AniList](https://anilist.co). It enables fans to immediately understand complex saga chronologies, canonical seasons, sequels, prequels, spin-offs, alternative universes, recaps, and adaptations.

---

## 📋 Mozilla Add-ons (AMO) Reviewer Instructions

### 1. Build Environment & Requirements
- **Operating System:** Cross-platform (Windows 10/11, macOS 12+, or Ubuntu/Debian Linux 20.04+).
- **Node.js:** Version 18.0.0 or later (LTS recommended, download from [nodejs.org](https://nodejs.org/)).
- **npm:** Version 9.0.0 or later (included automatically with Node.js).

### 2. Step-by-Step Build Instructions
From the root directory of this unzipped source archive:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Build the Firefox extension:**
   ```bash
   npm run build:firefox
   ```
   *(Alternatively, run `npm run build` to build both Firefox and Chrome targets).*

3. **Verify the generated extension:**
   The reproducible extension files are generated into `dist/firefox/`:
   - `manifest.json` (copied from `public/manifest.firefox.json`)
   - `content.js` (compiled from `src/content/index.ts` via Vite)
   - `background.js` (compiled from `src/background/index.ts` via Vite)
   - `icons/` (copied from `public/icons/`)

4. **Package archive (optional):**
   ```bash
   npm run package
   ```
   Generates `dist/anilist-relations-tree-firefox.zip`.


## 📸 Overview & Design

Faithfully designed to match modern dark theme aesthetics:
- **Canvas Background:** Deep dark canvas with a subtle dot-grid pattern responsive to pan and zoom.
- **Media Cards (Nodes):** Anthracite rounded cards (`#141518`), subtle border, bold centered titles, and meta tags (*Format* on left, *Episode / Chapter count* on right).
- **Current Media Highlight:** The anime/manga currently open on the AniList page features an amber gold border and glow (`#f59e0b`).
- **Connections & Relation Badges:** Left-to-right dashed Bézier curves with centered badges (`SEQUEL`, `PREQUEL`, `SPIN OFF`, `ALTERNATIVE`, `OTHER`, `SIDE STORY`, `SUMMARY`, `ADAPTATION`).
- **Interactive Controls:** Cursor-centered mouse wheel zoom, pan dragging, auto-center (*Fit View*), zoom reset, fullscreen toggle, and quick keyboard shortcuts (`Esc` or `Alt + R`).
- **Integrated Filters:**
  - Media format filter: *All*, *Anime*, *Manga*.
  - Title language: *English*, *Romaji*, *Native Japanese*.
  - Recursion depth slider (*Depth 1 to 6*).
  - Instant search input with automatic node focus.
  - Dropdown menu to selectively toggle relation types (e.g. toggle spin-offs, side stories, adaptations).

---

## 📁 Project Architecture

```text
anilist-extension/
├── package.json                   # Dependencies and build scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── scripts/
│   ├── build.ts                   # Multi-target bundler (Chrome dist/chrome & Firefox dist/firefox)
│   └── generate-icons.ts          # Real PNG icon generator (16px, 48px, 128px)
├── public/
│   ├── icons/                     # Generated PNG icons
│   ├── manifest.chrome.json       # Manifest V3 for Chromium (Service Worker)
│   └── manifest.firefox.json      # Manifest V3 for Gecko (Firefox)
├── src/
│   ├── types/
│   │   ├── anilist.ts             # AniList GraphQL types, Graph & Filter models
│   │   └── vite-env.d.ts          # Vite declarations for inline CSS imports
│   ├── services/
│   │   ├── anilistApi.ts          # GraphQL client, BFS batching (id_in), cache & rate-limit handling
│   │   └── graphBuilder.ts        # Canonical edge normalization & root reachability graph pruning
│   ├── graph/
│   │   ├── layout.ts              # Hierarchical LR Dagre layout (@dagrejs/dagre)
│   │   └── renderer.ts            # Hybrid renderer (SVG curves/grid + HTML cards) with pan & zoom
│   ├── ui/
│   │   ├── modal.ts               # Fullscreen modal controller isolated in Shadow DOM
│   │   ├── modal.css              # Complete dark mode stylesheet (0 CSS leaks into AniList)
│   │   └── buttonInjector.ts      # AniList SPA route detection and button injector
│   ├── content/
│   │   └── index.ts               # Content script entrypoint
│   └── background/
│       └── index.ts               # Background service worker & toolbar action handler
├── test/
│   ├── verify-graph.ts            # Automated test on Madoka Magica franchise
│   └── test-pruning.ts            # Automated test for spin-off filtering on Evangelion
├── preview.html                   # Standalone demo testbench
└── README.md
```

---

## 🚀 Building & Compiling

### 1. Requirements
- [Node.js](https://nodejs.org/) v18 or newer.
- `npm`.

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Extension Packages
To compile both Chromium and Firefox builds:
```bash
npm run build
```
Or for a specific browser target:
```bash
npm run build:chrome    # Outputs to dist/chrome
npm run build:firefox   # Outputs to dist/firefox
```

The build script generates PNG icons (16×16, 48×48, 128×128) and bundles all code and CSS into clean, standalone scripts without external runtime dependencies.

---

## 🛠️ Browser Installation Guide

### A. Google Chrome, Edge, Brave, or Opera (Chromium)
1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Enable **"Developer mode"** in the top-right corner.
3. Click the **"Load unpacked"** button.
4. Select the project directory: `dist/chrome`.
5. The extension is now active and ready to use!

### B. Mozilla Firefox (Gecko)
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Navigate into the `dist/firefox` directory and select `manifest.json`.
4. The extension appears in your active temporary add-on list.

---

## 💡 How to Use on AniList

1. Visit any anime or manga page on AniList, such as:
   - [Neon Genesis Evangelion](https://anilist.co/anime/30)
   - [Puella Magi Madoka Magica](https://anilist.co/anime/9756)
   - [Steins;Gate](https://anilist.co/anime/9253)
   - [Fate/Zero](https://anilist.co/anime/10087)
2. Open the tree through any of these convenient methods:
   - **Action Bar Button:** Click the blue `Franchise Map` button below the media cover.
   - **Relations Section:** Click the `Interactive Tree` badge in the *Relations* section header.
   - **Floating Quick Access:** Click the floating circular bubble in the bottom-right corner.
   - **Keyboard Shortcut:** Press `Alt + R`.
   - **Browser Toolbar:** Click the extension icon in your browser toolbar.
3. The graph opens instantly thanks to intelligent BFS caching and GraphQL batching (`id_in`).
4. Interact freely:
   - Drag to pan across the timeline.
   - Scroll mouse wheel to smoothly zoom in/out.
   - Click any card to open its AniList page in a new tab.
   - Adjust recursion depth, title language, or toggle relation types in real-time.

---

## 🧪 Automated Testing

Run the included verification scripts:

```bash
# Validate Madoka Magica franchise tree structure
npx tsx test/verify-graph.ts

# Validate spin-off pruning on Evangelion
npx tsx test/test-pruning.ts
```

---

## 📄 License
MIT License.

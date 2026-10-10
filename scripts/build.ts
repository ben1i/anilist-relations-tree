import fs from 'fs';
import path from 'path';
import { build } from 'vite';

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'all';

async function buildExtension(browser: 'chrome' | 'firefox'): Promise<void> {
  const outDir = path.resolve(`dist/${browser}`);
  console.log(`\n📦 [${browser.toUpperCase()}] Compilation vers ${outDir}...`);

  // Ensure clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Build Content Script (IIFE for complete isolation and 0 external dependencies)
  console.log(`  -> Compilation de content.js...`);
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve('src/content/index.ts'),
        name: 'AniListRelationsContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      },
      rollupOptions: {
        output: {
          extend: true
        }
      },
      minify: false, // Clean readable code for debugging & review
      sourcemap: false
    }
  });

  // 2. Build Background Service Worker / Script
  console.log(`  -> Compilation de background.js...`);
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve('src/background/index.ts'),
        name: 'AniListRelationsBackground',
        formats: [browser === 'chrome' ? 'es' : 'iife'],
        fileName: () => 'background.js'
      },
      minify: false,
      sourcemap: false
    }
  });

  // 3. Copy Manifest
  const manifestSrc = path.resolve(`public/manifest.${browser}.json`);
  const manifestDest = path.join(outDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log(`  -> manifest.json copié.`);

  // 4. Copy Icons
  const iconsSrcDir = path.resolve('public/icons');
  const iconsDestDir = path.join(outDir, 'icons');
  if (fs.existsSync(iconsSrcDir)) {
    fs.mkdirSync(iconsDestDir, { recursive: true });
    for (const file of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDestDir, file));
    }
    console.log(`  -> Icônes copiées.`);
  }

  console.log(`✅ [${browser.toUpperCase()}] Build terminé avec succès !`);
}

async function run(): Promise<void> {
  // Ensure icons exist
  const iconsDir = path.resolve('public/icons');
  if (!fs.existsSync(path.join(iconsDir, 'icon-128.png'))) {
    console.log('Génération des icônes...');
    const { execSync } = await import('child_process');
    execSync('npx tsx scripts/generate-icons.ts', { stdio: 'inherit' });
  }

  if (target === 'chrome' || target === 'all') {
    await buildExtension('chrome');
  }

  if (target === 'firefox' || target === 'all') {
    await buildExtension('firefox');
  }

  console.log('\n🎉 Tout est prêt !');
}

run().catch((err) => {
  console.error('Erreur lors du build:', err);
  process.exit(1);
});

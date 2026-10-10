import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.resolve(projectRoot, 'dist');
const chromeDir = path.resolve(distDir, 'chrome');
const firefoxDir = path.resolve(distDir, 'firefox');

console.log('🔨 Compiling extension for Chrome & Firefox...');
execSync('npx tsx scripts/build.ts --target=all', { stdio: 'inherit', cwd: projectRoot });

const chromeZip = path.resolve(distDir, 'anilist-relations-tree-chrome.zip');
const firefoxZip = path.resolve(distDir, 'anilist-relations-tree-firefox.zip');

if (fs.existsSync(chromeZip)) fs.unlinkSync(chromeZip);
if (fs.existsSync(firefoxZip)) fs.unlinkSync(firefoxZip);

console.log('📦 Creating Chrome Web Store package (.zip)...');
execSync(`tar.exe -a -c -f "${chromeZip}" *`, {
  cwd: chromeDir,
  stdio: 'inherit'
});

console.log('📦 Creating Firefox Add-ons package (.zip)...');
execSync(`tar.exe -a -c -f "${firefoxZip}" *`, {
  cwd: firefoxDir,
  stdio: 'inherit'
});

console.log('\n🎉 Packages generated successfully:');
console.log(`   👉 Chrome / Chromium: ${chromeZip}`);
console.log(`   👉 Firefox / Gecko:   ${firefoxZip}\n`);

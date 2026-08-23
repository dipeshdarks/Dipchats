/**
 * Generate OG image from SVG
 * Run: node scripts/generate-og.js
 * Requires: npm install sharp (dev dependency)
 *
 * Alternatively, use https://screenshot-gateway.com to generate
 * a PNG from the SVG, or manually create a 1200x630 PNG.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'apps', 'web', 'public');

async function generate() {
  try {
    const sharp = (await import('sharp')).default;
    const svgPath = join(publicDir, 'og-image.svg');
    const pngPath = join(publicDir, 'og-image.png');

    const svg = readFileSync(svgPath);
    await sharp(svg)
      .resize(1200, 630)
      .png()
      .toFile(pngPath);

    console.log(`Generated: ${pngPath}`);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('sharp not installed. Install with: pnpm add -D sharp');
      console.log('Or use an online tool to convert og-image.svg to og-image.png (1200x630)');
    } else {
      throw err;
    }
  }
}

generate();

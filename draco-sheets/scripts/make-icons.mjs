import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
// maskable: full-bleed background with the glyph inside the safe zone
const bg = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f5132' } }).png().toBuffer();
const glyph = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp(bg).composite([{ input: glyph, top: 76, left: 76 }]).png().toFile('public/pwa-maskable-512.png');
console.log('icons ok');

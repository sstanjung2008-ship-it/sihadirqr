import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const svgPath = path.join(publicDir, 'icon.svg');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  console.log('Generating PWA Icons...');
  
  // 192x192 PNG
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512 PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // Apple Touch Icon 180x180 PNG
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // Maskable 512x512 with safe-zone margin
  const innerIcon = await sharp(svgBuffer)
    .resize(410, 410)
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 17, b: 40, alpha: 1 } // #0a1128
    }
  })
    .composite([{ input: innerIcon, top: 51, left: 51 }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // Also create icon-192.png and icon-512.png for backwards compatibility
  fs.copyFileSync(path.join(publicDir, 'pwa-192x192.png'), path.join(publicDir, 'icon-192.png'));
  fs.copyFileSync(path.join(publicDir, 'pwa-512x512.png'), path.join(publicDir, 'icon-512.png'));
  console.log('PWA icon generation complete!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

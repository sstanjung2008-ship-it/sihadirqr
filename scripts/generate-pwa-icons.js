import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const sourceFile = path.join(publicDir, 'pwa-192x192.png');
const backupSource = path.join(publicDir, 'logo-source.png');

// If backupSource doesn't exist yet, copy current uploaded file as backupSource
if (!fs.existsSync(backupSource)) {
  fs.copyFileSync(sourceFile, backupSource);
}

async function generateIcons() {
  console.log('Generating complete PWA icon set from uploaded logo...');
  
  const sourceBuffer = fs.readFileSync(backupSource);

  // 1. Standard transparent icons (Purpose: ANY)
  // 192x192 PNG
  await sharp(sourceBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✔ pwa-192x192.png generated (192x192, transparent)');

  // 512x512 PNG
  await sharp(sourceBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✔ pwa-512x512.png generated (512x512, transparent)');

  // Copy to icon-192.png and icon-512.png for backwards/alternate compatibility
  fs.copyFileSync(path.join(publicDir, 'pwa-192x192.png'), path.join(publicDir, 'icon-192.png'));
  fs.copyFileSync(path.join(publicDir, 'pwa-512x512.png'), path.join(publicDir, 'icon-512.png'));

  // 2. Maskable icons with safe zone margin (Purpose: MASKABLE)
  // Android safe zone: Logo sits in central 80% circle, safe from adaptive crop
  const maskableInner512 = await sharp(sourceBuffer)
    .resize(390, 390, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 17, b: 40, alpha: 1 } // #0a1128 theme background
    }
  })
    .composite([{ input: maskableInner512, top: 61, left: 61 }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✔ pwa-maskable-512x512.png generated (512x512 with safe-zone margin & #0a1128 bg)');

  const maskableInner192 = await sharp(sourceBuffer)
    .resize(146, 146, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 10, g: 17, b: 40, alpha: 1 } // #0a1128 theme background
    }
  })
    .composite([{ input: maskableInner192, top: 23, left: 23 }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-192x192.png'));
  console.log('✔ pwa-maskable-192x192.png generated (192x192 with safe-zone margin & #0a1128 bg)');

  // 3. Apple Touch Icon (180x180 with solid background for iOS)
  const appleInner = await sharp(sourceBuffer)
    .resize(144, 144, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 10, g: 17, b: 40, alpha: 1 } // #0a1128
    }
  })
    .composite([{ input: appleInner, top: 18, left: 18 }])
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✔ apple-touch-icon.png generated (180x180 with solid #0a1128 bg for iOS Safari)');

  // 4. Favicon 32x32 and 48x48
  await sharp(sourceBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(sourceBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('All PWA icons successfully generated!');
}

generateIcons().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});

/**
 * Exporta logo-adsense.svg a PNG 5:1 para Google AdSense (objetivo < 150 KB).
 * Requiere: npm install sharp
 * Uso: node exportar-logo-png.js
 */
const fs = require('fs');
const path = require('path');

async function exportLogo() {
  try {
    const sharp = require('sharp');
    const svgPath = path.join(__dirname, 'logo-adsense.svg');
    const outPath = path.join(__dirname, 'logo-adsense.png');
    const svg = fs.readFileSync(svgPath);

    // 5:1 = 1000x200 (buena resolución, suele quedar < 150 KB)
    await sharp(svg)
      .resize(1000, 200)
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(outPath);

    const stat = fs.statSync(outPath);
    const sizeKB = (stat.size / 1024).toFixed(1);
    console.log('Logo PNG generado:', outPath);
    console.log('Tamaño:', sizeKB, 'KB', stat.size <= 153600 ? '(OK para AdSense)' : '(comprimir a < 150 KB)');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('Instala sharp: npm install sharp');
    } else {
      console.error(e.message);
    }
  }
}

exportLogo();

/**
 * generate-sitemap.js — prediccionloteria.com
 * Uso: node generate-sitemap.js
 * Genera sitemap.xml en ./sitio/ escaneando todos los .html públicos.
 * Propiedad de Businessskore — Licencia Propietaria (NO GPL).
 */

const fs = require('fs');
const path = require('path');

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.prediccionloteria.com';
const SITE_DIR = path.join(__dirname, 'sitio');
const OUTPUT   = path.join(SITE_DIR, 'sitemap.xml');
const TODAY    = new Date().toISOString().split('T')[0];

// Páginas a EXCLUIR del sitemap (archivos de prueba, utilidades, etc.)
const EXCLUDED = new Set([
  'appcheck-test.html',
]);

// Prioridades y frecuencias por página
const PAGE_CONFIG = {
  'index.html':                              { priority: '1.0', changefreq: 'daily' },
  'analisis/index.html':                     { priority: '0.85', changefreq: 'weekly' },
  'faq.html':                                { priority: '0.8', changefreq: 'weekly' },
  'metodologia-estadistica.html':            { priority: '0.8', changefreq: 'monthly' },
  'proxima-jugada.html':                     { priority: '0.85', changefreq: 'weekly' },
  'powerball.html':                          { priority: '0.8', changefreq: 'weekly' },
  'mega-millions.html':                      { priority: '0.8', changefreq: 'weekly' },
  'millionaire-for-life.html':               { priority: '0.75', changefreq: 'weekly' },
  'pick-10.html':                            { priority: '0.75', changefreq: 'weekly' },
  'take-5.html':                             { priority: '0.75', changefreq: 'weekly' },
  'win-4.html':                              { priority: '0.75', changefreq: 'weekly' },
  'guia-lectura-resultados.html':            { priority: '0.75', changefreq: 'monthly' },
  'guia-fuentes-loteria-deportes.html':      { priority: '0.75', changefreq: 'monthly' },
  'juego-responsable.html':                  { priority: '0.7', changefreq: 'monthly' },
  'about.html':                              { priority: '0.6', changefreq: 'monthly' },
  'contacto.html':                           { priority: '0.6', changefreq: 'monthly' },
  'politica-privacidad.html':                { priority: '0.4', changefreq: 'yearly' },
  'politica-cookies.html':                   { priority: '0.4', changefreq: 'yearly' },
};

const DEFAULT_CONFIG = { priority: '0.5', changefreq: 'monthly' };
// ──────────────────────────────────────────────────────────────────────────────

function getLastMod(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString().split('T')[0];
  } catch {
    return TODAY;
  }
}

function collectHtmlFiles(dir, base = dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...collectHtmlFiles(abs, base));
    } else if (entry.isFile() && entry.name.endsWith('.html') && !EXCLUDED.has(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function buildUrl(file) {
  const rel = path.relative(SITE_DIR, file).replace(/\\/g, '/');
  const fileName = path.basename(file);
  const isIndexRoot = rel === 'index.html';
  const isIndexSub = fileName === 'index.html' && rel !== 'index.html';
  let loc;
  if (isIndexRoot) loc = `${BASE_URL}/`;
  else if (isIndexSub) loc = `${BASE_URL}/${path.dirname(rel).replace(/\\/g, '/')}/`;
  else loc = `${BASE_URL}/${rel}`;
  const config   = PAGE_CONFIG[rel] || PAGE_CONFIG[fileName] || DEFAULT_CONFIG;
  const lastmod  = getLastMod(file);

  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${config.changefreq}</changefreq>\n    <priority>${config.priority}</priority>\n  </url>`;
}

function generateSitemap() {
  try {
    // Escanear HTMLs en /sitio
    const files = collectHtmlFiles(SITE_DIR)
      .sort((a, b) => {
        const relA = path.relative(SITE_DIR, a).replace(/\\/g, '/');
        const relB = path.relative(SITE_DIR, b).replace(/\\/g, '/');
        if (relA === 'index.html') return -1;
        if (relB === 'index.html') return 1;
        const pA = parseFloat((PAGE_CONFIG[path.basename(a)] || DEFAULT_CONFIG).priority);
        const pB = parseFloat((PAGE_CONFIG[path.basename(b)] || DEFAULT_CONFIG).priority);
        return pB - pA;
      });

    const urlEntries = files.map(buildUrl).join('\n\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

${urlEntries}

</urlset>
`;

    fs.writeFileSync(OUTPUT, xml, 'utf8');
    console.log(`✅ sitemap.xml generado con ${files.length} URLs`);
    console.log(`📄 Guardado en: ${OUTPUT}`);
    console.log('\n🔗 URLs incluidas:');
    files.forEach(f => {
      const rel = path.relative(SITE_DIR, f).replace(/\\/g, '/');
      const loc = rel === 'index.html'
        ? `${BASE_URL}/`
        : (path.basename(rel) === 'index.html'
          ? `${BASE_URL}/${path.dirname(rel)}/`
          : `${BASE_URL}/${rel}`);
      console.log(`   ${loc}`);
    });
    console.log('\n📋 Próximo paso: Enviar sitemap en Google Search Console');
    console.log(`   URL: ${BASE_URL}/sitemap.xml`);

  } catch (err) {
    console.error('❌ Error generando sitemap:', err.message);
    process.exit(1);
  }
}

generateSitemap();

// scripts/aplicar-plantilla.mjs — prediccionloteria.com
// Inserta (o actualiza) la misma navegación y el mismo pie en todas las páginas secundarias de sitio/.
// Idempotente: usa marcadores <!-- NAV:START/END --> y <!-- PIE:START/END -->.
// Uso: node scripts/aplicar-plantilla.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITIO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sitio');
const EXCLUIR = new Set(['index.html', 'appcheck-test.html', '404.html']);

const L = 'text-gray-300 hover:text-cyan-300 hover:underline';
const NAV = `<!-- NAV:START -->
<header class="w-full max-w-5xl mx-auto mb-4">
  <nav aria-label="Principal" class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
    <a href="/" class="font-bold text-white hover:text-cyan-300 mr-2">prediccionloteria.com</a>
    <a href="/analisis/" class="${L}">Análisis por juego</a>
    <a href="/probabilidades-loteria.html" class="${L}">Probabilidades</a>
    <a href="/metodologia-estadistica.html" class="${L}">Metodología</a>
    <a href="/guia-fuentes-loteria-deportes.html" class="${L}">Fuentes</a>
    <a href="/faq.html" class="${L}">FAQ</a>
    <a href="/about.html" class="${L}">Acerca de</a>
    <a href="/contacto.html" class="${L}">Contacto</a>
  </nav>
</header>
<!-- NAV:END -->`;

const F = 'text-cyan-300 hover:underline';
const PIE = `<!-- PIE:START -->
<footer class="w-full max-w-5xl mx-auto mt-8 border-t border-gray-800 pt-4 pb-6 text-xs text-gray-400 text-center">
  <p class="mb-2">Solo mayores de 18 años (21+ donde la ley lo exija). La lotería es azar: este sitio no garantiza premios. Sitio independiente, sin afiliación con ninguna lotería oficial.</p>
  <p><a href="/juego-responsable.html" class="${F}">Juego responsable</a> · <a href="/terminos.html" class="${F}">Términos</a> · <a href="/politica-privacidad.html" class="${F}">Privacidad</a> · <a href="/politica-cookies.html" class="${F}">Cookies</a> · <a href="/about.html" class="${F}">Acerca de</a> · <a href="/contacto.html" class="${F}">Contacto</a></p>
</footer>
<!-- PIE:END -->`;

// Aviso suelto añadido el 2026-09-29; el pie común lo sustituye.
const AVISO_VIEJO = /<p class="text-gray-400 text-xs text-center mt-6 max-w-3xl mx-auto px-4">Solo mayores de 18 años[\s\S]*?<\/p>\n?/;

function bloque(s, ini, fin, html, insertar) {
  if (s.includes(ini)) return s.slice(0, s.indexOf(ini)) + html + s.slice(s.indexOf(fin) + fin.length);
  return insertar(s);
}

const paginas = [];
(function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(abs);
    else if (e.name.endsWith('.html')) paginas.push(abs);
  }
})(SITIO);

for (const abs of paginas) {
  const rel = path.relative(SITIO, abs).replace(/\\/g, '/');
  if (EXCLUIR.has(rel)) continue;
  let s = fs.readFileSync(abs, 'utf8');
  s = s.replace(AVISO_VIEJO, '');
  s = bloque(s, '<!-- NAV:START -->', '<!-- NAV:END -->', NAV, (t) => t.replace(/(<body[^>]*>)/, `$1\n${NAV}`));
  s = bloque(s, '<!-- PIE:START -->', '<!-- PIE:END -->', PIE, (t) => {
    const i = t.lastIndexOf('</body>');
    return t.slice(0, i) + PIE + '\n' + t.slice(i);
  });
  fs.writeFileSync(abs, s, 'utf8');
  console.log('plantilla', rel);
}

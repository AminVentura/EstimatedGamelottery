// Consent Mode v2: en toda página publicada (sitio/) con AdSense, el default denegado tiene que ejecutarse
// ANTES de cualquier script de Google (https://developers.google.com/tag-platform/security/guides/consent).
// Falla si alguna página carga adsbygoogle.js antes del bloque inline bs-consent-default.
// Ejecutar desde la raíz:  node --test tests/web/consent-order.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITIO = path.join(root, 'sitio');
const ADS = /<script\b[^>]*src=["'][^"']*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>/i;
const ADS_ALL = new RegExp(ADS.source, 'gi');
const GOOGLE_SRC = /<script\b[^>]*src=["'][^"']*(googlesyndication|googletagmanager|googletagservices|doubleclick|google-analytics)[^"']*["']/i;

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Devuelve null si está bien, o el motivo del fallo.
export function checkConsentOrder(html) {
  const ads = html.match(ADS_ALL) || [];
  if (ads.length === 0) return null;
  if (ads.length > 1) return `adsbygoogle.js aparece ${ads.length} veces`;
  const metas = html.match(/<meta[^>]+name=["']google-adsense-account["']/gi) || [];
  if (metas.length > 1) return `metaetiqueta google-adsense-account duplicada (${metas.length})`;
  const headEnd = html.search(/<\/head>/i);
  const adsAt = html.search(ADS);
  const def = html.match(/<script id="bs-consent-default">([\s\S]*?)<\/script>/i);
  if (!def) return 'falta el bloque inline bs-consent-default';
  const defAt = html.indexOf(def[0]);
  for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
    if (!new RegExp(`${key}:'denied'`).test(def[1])) return `el default no deniega ${key}`;
  }
  if (!/gtag\('consent','default'/.test(def[1])) return "el bloque no llama gtag('consent','default')";
  if (headEnd !== -1 && defAt > headEnd) return 'el default no está en el <head>';
  if (defAt > adsAt) return 'adsbygoogle.js se carga ANTES del consent default';
  if (html.search(/<script\b/i) !== defAt) return 'el consent default no es el primer script de la página';
  if (GOOGLE_SRC.test(html.slice(0, defAt))) return 'hay un script de Google antes del consent default';
  return null;
}

test('sitio/: toda página con AdSense lleva el consent default inline antes del script', () => {
  const errores = [];
  let conAds = 0;
  for (const f of htmlFiles(SITIO)) {
    const html = readFileSync(f, 'utf8');
    if (ADS.test(html)) conAds++;
    const err = checkConsentOrder(html);
    if (err) errores.push(`${path.relative(root, f)}: ${err}`);
  }
  assert.ok(conAds > 0, 'no se encontró ninguna página con AdSense en sitio/');
  assert.deepEqual(errores, []);
});

test('consent.js no inserta un segundo adsbygoogle si ya está en el HTML ni repite el default', () => {
  const js = readFileSync(path.join(SITIO, 'consent.js'), 'utf8');
  const load = js.slice(js.indexOf('function loadAdSense'), js.indexOf('createElement'));
  assert.match(load, /querySelector\('script\[src\*="pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js"\]'\)\)/);
  assert.match(js, /if \(!window\.bsConsentDefault\)/);
});

test('el verificador detecta el orden malo', () => {
  const def = "<script id=\"bs-consent-default\">gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})</script>";
  const ads = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=x"></script>';
  assert.equal(checkConsentOrder(`<html><head>${ads}${def}</head></html>`), 'adsbygoogle.js se carga ANTES del consent default');
  assert.equal(checkConsentOrder(`<html><head>${ads}</head></html>`), 'falta el bloque inline bs-consent-default');
  assert.equal(checkConsentOrder(`<html><head>${def}${ads}</head></html>`), null);
});

'use strict';
// Juegos con historial público (*_drawings) y su conjunto oficial en NY Open Data.
// field: cómo leer números principales / bola de cada fila de la fuente.

const GAMES = ['powerball', 'megamillions', 'millionaireforlife', 'pick10', 'take5day', 'take5eve', 'win4day', 'win4eve'];

const OFFICIAL_SOURCE = {
  powerball: { url: 'https://data.ny.gov/resource/d6yy-54nr.json', main: (r) => splitNums(r.winning_numbers).slice(0, 5), special: (r) => splitNums(r.winning_numbers)[5] ?? null },
  megamillions: { url: 'https://data.ny.gov/resource/5xaw-6ayf.json', main: (r) => splitNums(r.winning_numbers), special: (r) => toInt(r.mega_ball) },
  millionaireforlife: { url: 'https://data.ny.gov/resource/a4w9-a3tp.json', main: (r) => splitNums(r.winning_numbers), special: (r) => toInt(r.mill_ball) },
  pick10: { url: 'https://data.ny.gov/resource/bycu-cw7c.json', main: (r) => splitNums(r.winning_numbers), special: () => null },
  take5day: { url: 'https://data.ny.gov/resource/dg63-4siq.json', main: (r) => splitNums(r.midday_winning_numbers), special: () => null },
  take5eve: { url: 'https://data.ny.gov/resource/dg63-4siq.json', main: (r) => splitNums(r.evening_winning_numbers), special: () => null },
  win4day: { url: 'https://data.ny.gov/resource/hsys-3def.json', main: (r) => digits(r.midday_win_4), special: () => null, positional: true },
  win4eve: { url: 'https://data.ny.gov/resource/hsys-3def.json', main: (r) => digits(r.evening_win_4), special: () => null, positional: true },
};

function splitNums(s) {
  if (s == null) return [];
  return String(s).trim().split(/\s+/).filter(Boolean).map(Number);
}
function toInt(v) {
  const n = Number(v);
  return v == null || v === '' || !Number.isInteger(n) ? null : n;
}
function digits(v) {
  return v == null ? [] : String(v).padStart(4, '0').split('').map(Number);
}

module.exports = { GAMES, OFFICIAL_SOURCE };

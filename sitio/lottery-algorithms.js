// ==========================================
// ALGORITMOS DE LOTERÍA - VERSIÓN MEJORADA
// ==========================================
// NOTA: Las loterías son juegos de azar. Los algoritmos identifican patrones
// estadísticos para sugerir jugadas informadas, sin garantizar resultados.

// --- PRNG DETERMINISTA (Mulberry32) ---
// Reemplaza seededRandom(Date.now()) que era no-determinista.
function createRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Semilla fija basada en la fecha del último sorteo (determinista por sesión)
function getDataSeed(allHistoryData) {
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0) return 42;
  const last = allHistoryData[0];
  const dateStr = (last && last.data && last.data.date) ? last.data.date : 'default';
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (Math.imul(hash, 31) + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 12345;
}

// Compatibilidad interna: seededRandom ahora es siempre determinista
function seededRandom(seed) {
  return createRNG(Math.abs(seed | 0) + 1)();
}

// --- FRECUENCIA SIMPLE ---
function calculateFrequency(numbersArray, maxNumber, minNumber = 1) {
  const frequencyMap = {};
  for (let i = minNumber; i <= maxNumber; i++) frequencyMap[i] = 0;
  if (Array.isArray(numbersArray)) {
    numbersArray.forEach(num => {
      if (typeof num === 'number' && !isNaN(num) && num >= minNumber && num <= maxNumber) {
        frequencyMap[num] = (frequencyMap[num] || 0) + 1;
      }
    });
  }
  return frequencyMap;
}

function getSortedNumbers(frequencyMap, order, count) {
  return Object.entries(frequencyMap)
    .map(([number, frequency]) => ({ number: Number(number), frequency }))
    .sort((a, b) => {
      if (order === 'desc') {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        return a.number - b.number;
      } else {
        if (a.frequency !== b.frequency) return a.frequency - b.frequency;
        return a.number - b.number;
      }
    })
    .slice(0, count)
    .map(item => item.number);
}

// --- PARES ---
function calculatePairFrequency(drawings) {
  const pairFrequency = {};
  if (!Array.isArray(drawings)) return pairFrequency;
  drawings.forEach(drawing => {
    let mainNumbers = [];
    if (drawing.data && drawing.data.mainNumbers) {
      mainNumbers = Array.isArray(drawing.data.mainNumbers)
        ? drawing.data.mainNumbers
        : JSON.parse(drawing.data.mainNumbers);
    }
    for (let i = 0; i < mainNumbers.length; i++) {
      for (let j = i + 1; j < mainNumbers.length; j++) {
        const pair = [mainNumbers[i], mainNumbers[j]].sort((a, b) => a - b).join('-');
        pairFrequency[pair] = (pairFrequency[pair] || 0) + 1;
      }
    }
  });
  return pairFrequency;
}

function getSortedPairs(pairFrequency, count) {
  return Object.entries(pairFrequency)
    .map(([pair, frequency]) => ({ pair, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, count)
    .map(item => item.pair.split('-').map(Number));
}

// --- PESO TEMPORAL (sin ruido aleatorio — bug corregido) ---
// BUG ORIGINAL: añadía seededRandom(seedOffset) * 0.05 → frecuencias no reproducibles.
function pesoPorFecha(fechaSorteo) {
  const dias = (Date.now() - new Date(fechaSorteo)) / (1000 * 60 * 60 * 24);
  const diaDelMes = new Date(fechaSorteo).getDate();
  const pesoTemporal = Math.exp(-dias / 365);
  const pesoCiclico = Math.sin((diaDelMes / 30) * Math.PI) * 0.1 + 0.9;
  return pesoTemporal * pesoCiclico;
}

// --- FRECUENCIA PONDERADA POR FECHA ---
function calculateFrequencyWeighted(drawings, maxNumber, minNumber = 1, options = {}) {
  const freq = {};
  for (let i = minNumber; i <= maxNumber; i++) freq[i] = 0;
  if (!Array.isArray(drawings)) return freq;
  const useSpecial = options.useSpecial === true;
  drawings.forEach(item => {
    const dateStr = item.data && item.data.date;
    const peso = dateStr ? pesoPorFecha(dateStr) : 1;
    let mainNums = [];
    let specialNum = null;
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (!Array.isArray(mainNums)) mainNums = [];
    if (item.data && item.data.special !== undefined) specialNum = item.data.special;
    if (!useSpecial) {
      mainNums.forEach(n => {
        if (typeof n === 'number' && !isNaN(n) && n >= minNumber && n <= maxNumber)
          freq[n] = (freq[n] || 0) + peso;
      });
    } else if (typeof specialNum === 'number' && !isNaN(specialNum) && specialNum >= minNumber && specialNum <= maxNumber) {
      freq[specialNum] = (freq[specialNum] || 0) + peso;
    }
  });
  return freq;
}

// --- EMA (Exponential Moving Average) de frecuencia ---
// Sorteos más recientes tienen exponencialmente más peso. alpha ∈ [0.1, 0.3].
function calculateEMAFrequency(allHistoryData, maxNumber, minNumber = 1, alpha = 0.15) {
  const ema = {};
  for (let i = minNumber; i <= maxNumber; i++) ema[i] = 0;
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0) return ema;

  // Ordenar de más antiguo a más reciente para aplicar EMA correctamente
  const sorted = [...allHistoryData].sort((a, b) => {
    const da = (a.data && a.data.date) ? new Date(a.data.date).getTime() : 0;
    const db = (b.data && b.data.date) ? new Date(b.data.date).getTime() : 0;
    return da - db;
  });

  sorted.forEach(item => {
    let mainNums = [];
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    const appeared = new Set(mainNums.filter(n => n >= minNumber && n <= maxNumber));
    for (let n = minNumber; n <= maxNumber; n++) {
      const x = appeared.has(n) ? 1 : 0;
      ema[n] = alpha * x + (1 - alpha) * ema[n];
    }
  });
  return ema;
}

// --- ANÁLISIS DE GAP ---
// Para cada número: cuántos sorteos ha pasado desde su última aparición.
// Gap bajo = número reciente (caliente). Gap alto = número rezagado.
function calculateGapAnalysis(allHistoryData, maxNumber, minNumber = 1) {
  const gap = {};
  const total = Array.isArray(allHistoryData) ? allHistoryData.length : 0;
  for (let i = minNumber; i <= maxNumber; i++) gap[i] = total; // default: nunca visto
  if (total === 0) return gap;

  // allHistoryData[0] = más reciente
  const found = new Set();
  for (let drawIdx = 0; drawIdx < allHistoryData.length; drawIdx++) {
    const item = allHistoryData[drawIdx];
    let mainNums = [];
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    mainNums.forEach(n => {
      if (n >= minNumber && n <= maxNumber && !found.has(n)) {
        gap[n] = drawIdx;
        found.add(n);
      }
    });
    if (found.size === maxNumber - minNumber + 1) break;
  }
  return gap;
}

// --- SISTEMA DE PUNTUACIÓN ENSEMBLE ---
// Combina frecuencia, EMA, gap y Markov en un único score por número.
// Pesos: 30% frecuencia simple, 25% frecuencia ponderada, 25% EMA, 10% gap, 10% Markov.
function scoreNumbers(allHistoryData, maxNumber, minNumber = 1) {
  const scores = {};
  for (let i = minNumber; i <= maxNumber; i++) scores[i] = 0;
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0) return scores;

  const allMainNumbers = [];
  allHistoryData.forEach(item => {
    const parsed = parseDrawingData(item.data);
    parsed.mainNumbers
      .filter(x => typeof x === 'number' && x >= minNumber && x <= maxNumber)
      .forEach(x => allMainNumbers.push(x));
  });

  // 1. Frecuencia simple (normalizada 0-1) — peso 30%
  const freq = calculateFrequency(allMainNumbers, maxNumber, minNumber);
  const maxFreq = Math.max(1, ...Object.values(freq));
  for (let i = minNumber; i <= maxNumber; i++) {
    scores[i] += (freq[i] / maxFreq) * 30;
  }

  // 2. Frecuencia ponderada por fecha (normalizada) — peso 25%
  const wFreq = calculateFrequencyWeighted(allHistoryData, maxNumber, minNumber);
  const maxWFreq = Math.max(1e-10, ...Object.values(wFreq));
  for (let i = minNumber; i <= maxNumber; i++) {
    scores[i] += (wFreq[i] / maxWFreq) * 25;
  }

  // 3. EMA de recencia — peso 25%
  const ema = calculateEMAFrequency(allHistoryData, maxNumber, minNumber);
  const maxEMA = Math.max(1e-10, ...Object.values(ema));
  for (let i = minNumber; i <= maxNumber; i++) {
    scores[i] += (ema[i] / maxEMA) * 25;
  }

  // 4. Gap analysis — peso 10%
  // Bonus si el gap está cerca del intervalo esperado (ni muy caliente ni muy rezagado)
  const gap = calculateGapAnalysis(allHistoryData, maxNumber, minNumber);
  const numRange = maxNumber - minNumber + 1;
  const avgGap = allHistoryData.length / numRange;
  for (let i = minNumber; i <= maxNumber; i++) {
    const gapScore = Math.max(0, 1 - Math.abs(gap[i] - avgGap) / (avgGap + 1));
    scores[i] += gapScore * 10;
  }

  // 5. Markov: transición desde el último sorteo — peso 10%
  if (allHistoryData.length >= 2) {
    const markovMatrix = buildMarkovMatrix(allHistoryData, maxNumber, minNumber);
    const lastNumbers = parseDrawingData(allHistoryData[0].data).mainNumbers
      .filter(x => typeof x === 'number' && x >= minNumber && x <= maxNumber);
    if (lastNumbers.length > 0) {
      const markovProbs = markovProbability(markovMatrix, lastNumbers, maxNumber, minNumber);
      const maxMarkov = Math.max(1e-10, ...markovProbs.slice(minNumber, maxNumber + 1));
      for (let i = minNumber; i <= maxNumber; i++) {
        scores[i] += ((markovProbs[i] || 0) / maxMarkov) * 10;
      }
    }
  }

  return scores;
}

// --- WIN 4: 4 dígitos 0-9 por posición ---
function getMainCount(ranges) { return (ranges && ranges.mainCount) || 5; }
function getHasSpecial(ranges) { return ranges && ranges.special != null && ranges.hasSpecial !== false; }
function getMinMax(ranges) {
  const m = ranges && ranges.main;
  return m ? { min: m.min, max: m.max } : { min: 1, max: 69 };
}

function generateWin4StyleCombination(allHistoryData, ranges, order = 'desc', method = 'basic') {
  const min = getMinMax(ranges).min;
  const max = getMinMax(ranges).max;
  const positions = [[], [], [], []];
  const rng = createRNG(getDataSeed(allHistoryData));

  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0) {
    return {
      mainNumbers: Array.from({ length: 4 }, () => Math.floor(rng() * (max - min + 1)) + min),
      special: null,
      method
    };
  }
  allHistoryData.forEach(item => {
    const parsed = parseDrawingData(item.data);
    if (parsed.mainNumbers && parsed.mainNumbers.length >= 4) {
      for (let p = 0; p < 4; p++) positions[p].push(parsed.mainNumbers[p]);
    }
  });
  const mainNumbers = [];
  for (let p = 0; p < 4; p++) {
    const freq = calculateFrequency(positions[p], max, min);
    const sorted = getSortedNumbers(freq, order, 1);
    mainNumbers.push(sorted[0] != null ? sorted[0] : Math.floor(rng() * (max - min + 1)) + min);
  }
  return { mainNumbers, special: null, method };
}

// --- COMBINACIÓN BÁSICA (frecuencia, sin ajuste aleatorio — bug corregido) ---
// BUG ORIGINAL: `n + Math.floor(seededRandom(Date.now() + i) * 3)` mutaba los números calientes.
function generateBasicCombination(allHistoryData, ranges, lottery, method = 'basic') {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const isWin4 = mainCount === 4 && min === 0 && max === 9;
  const rng = createRNG(getDataSeed(allHistoryData));

  if (isWin4) return generateWin4StyleCombination(allHistoryData, ranges, 'desc', method);

  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0) {
    const mains = Array.from({ length: mainCount }, (_, i) =>
      Math.floor(createRNG(getDataSeed(allHistoryData) + i)() * (max - min + 1)) + min
    ).sort((a, b) => a - b);
    return {
      mainNumbers: mains,
      special: (hasSpecial && ranges.special)
        ? Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min
        : null,
      method
    };
  }

  const allMainNumbers = [];
  const allSpecials = [];
  const hasDates = allHistoryData.some(item => item.data && item.data.date);

  allHistoryData.forEach(item => {
    let mainNums = [];
    let specialNum = null;
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (item.data && item.data.special !== undefined) specialNum = item.data.special;
    if (Array.isArray(mainNums)) allMainNumbers.push(...mainNums);
    if (typeof specialNum === 'number' && !isNaN(specialNum)) allSpecials.push(specialNum);
  });

  const mainFreq = hasDates
    ? calculateFrequencyWeighted(allHistoryData, max, min)
    : calculateFrequency(allMainNumbers, max, min);

  // Seleccionar los mainCount números más calientes directamente (sin mutación aleatoria)
  const hotMain = getSortedNumbers(mainFreq, 'desc', mainCount);
  const finalMain = hotMain.filter(n => n >= min && n <= max);

  // Relleno determinista si faltan
  for (let i = min; i <= max && finalMain.length < mainCount; i++) {
    if (!finalMain.includes(i)) finalMain.push(i);
  }

  finalMain.sort((a, b) => a - b);

  let special = null;
  if (hasSpecial && ranges.special) {
    const specialFreq = hasDates
      ? calculateFrequencyWeighted(allHistoryData, ranges.special.max, ranges.special.min, { useSpecial: true })
      : calculateFrequency(allSpecials, ranges.special.max, ranges.special.min);
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    special = hotSpecial != null
      ? hotSpecial
      : Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
    special = Math.min(ranges.special.max, Math.max(ranges.special.min, special));
  }

  return { mainNumbers: finalMain.slice(0, mainCount), special, method };
}

// --- NÚMEROS FRÍOS ---
function generateColdNumbersCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const isWin4 = mainCount === 4 && min === 0 && max === 9;
  const rng = createRNG(getDataSeed(allHistoryData) + 1);

  if (isWin4) return generateWin4StyleCombination(allHistoryData, ranges, 'asc', 'cold-numbers');
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'cold-numbers');

  const allMainNumbers = [];
  const allSpecials = [];
  allHistoryData.forEach(item => {
    let mainNums = [];
    let specialNum = null;
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (item.data && item.data.special !== undefined) specialNum = item.data.special;
    if (Array.isArray(mainNums)) allMainNumbers.push(...mainNums);
    if (typeof specialNum === 'number' && !isNaN(specialNum)) allSpecials.push(specialNum);
  });

  const mainFreq = calculateFrequency(allMainNumbers, max, min);
  const coldMain = getSortedNumbers(mainFreq, 'asc', mainCount).filter(n => n >= min && n <= max);

  // Relleno determinista
  for (let i = min; i <= max && coldMain.length < mainCount; i++) {
    if (!coldMain.includes(i)) coldMain.push(i);
  }

  let special = null;
  if (hasSpecial && ranges.special) {
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max, ranges.special.min);
    const coldSpecial = getSortedNumbers(specialFreq, 'asc', 1)[0];
    special = coldSpecial != null
      ? coldSpecial
      : Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
  }
  return { mainNumbers: coldMain.sort((a, b) => a - b).slice(0, mainCount), special, method: 'cold-numbers' };
}

// --- MIXTA EQUILIBRADA ---
function generateMixedCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const rng = createRNG(getDataSeed(allHistoryData) + 2);

  if (mainCount === 4 && min === 0 && max === 9)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'mixed-balanced');
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'mixed-balanced');

  const allMainNumbers = [];
  const allSpecials = [];
  allHistoryData.forEach(item => {
    let mainNums = [];
    let specialNum = null;
    if (item.data && item.data.mainNumbers) {
      try {
        mainNums = Array.isArray(item.data.mainNumbers)
          ? item.data.mainNumbers
          : JSON.parse(item.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (item.data && item.data.special !== undefined) specialNum = item.data.special;
    if (Array.isArray(mainNums)) allMainNumbers.push(...mainNums);
    if (typeof specialNum === 'number' && !isNaN(specialNum)) allSpecials.push(specialNum);
  });

  const mainFreq = calculateFrequency(allMainNumbers, max, min);
  const hotCount = Math.max(1, Math.floor(mainCount * 0.6));
  const coldCount = mainCount - hotCount;

  const hotMain = getSortedNumbers(mainFreq, 'desc', hotCount).filter(n => n >= min && n <= max);
  // Fríos que no coincidan con los calientes
  const coldMain = getSortedNumbers(mainFreq, 'asc', coldCount + 5)
    .filter(n => n >= min && n <= max && !hotMain.includes(n))
    .slice(0, coldCount);

  const finalMixedMain = [...hotMain];
  for (const n of coldMain) {
    if (finalMixedMain.length >= mainCount) break;
    finalMixedMain.push(n);
  }
  // Relleno determinista
  for (let i = min; i <= max && finalMixedMain.length < mainCount; i++) {
    if (!finalMixedMain.includes(i)) finalMixedMain.push(i);
  }

  let special = null;
  if (hasSpecial && ranges.special) {
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max, ranges.special.min);
    special = getSortedNumbers(specialFreq, 'desc', 1)[0]
      || Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
  }
  return {
    mainNumbers: finalMixedMain.sort((a, b) => a - b).slice(0, mainCount),
    special,
    method: 'mixed-balanced'
  };
}

// --- PATRÓN DE REPETICIÓN ---
function generateRepeatPatternCombination(allHistoryData, ranges, lottery) {
  if (!Array.isArray(allHistoryData) || allHistoryData.length < 2) {
    return generateBasicCombination(allHistoryData, ranges, lottery, 'repeat-pattern');
  }

  const repeatMap = {};
  for (let i = 1; i < allHistoryData.length; i++) {
    const curr = parseDrawingData(allHistoryData[i - 1].data).mainNumbers;
    const next = parseDrawingData(allHistoryData[i].data).mainNumbers;
    curr.forEach(n => {
      if (next.includes(n)) repeatMap[n] = (repeatMap[n] || 0) + 1;
    });
  }

  const mostRepeated = Object.entries(repeatMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(e => Number(e[0]));

  const allMainNumbers = [];
  allHistoryData.forEach(item => {
    const nums = parseDrawingData(item.data).mainNumbers;
    allMainNumbers.push(...nums);
  });

  const mainCount = getMainCount(ranges);
  const { min, max } = getMinMax(ranges);
  const hotMain = getSortedNumbers(calculateFrequency(allMainNumbers, max, min), 'desc', mainCount + 5);

  const finalMain = [...mostRepeated];
  for (const n of hotMain) {
    if (finalMain.length >= mainCount) break;
    if (!finalMain.includes(n) && n >= min && n <= max) finalMain.push(n);
  }
  for (let i = min; i <= max && finalMain.length < mainCount; i++) {
    if (!finalMain.includes(i)) finalMain.push(i);
  }

  let special = null;
  if (getHasSpecial(ranges) && ranges.special) {
    const specials = allHistoryData
      .map(d => d.data && d.data.special)
      .filter(s => typeof s === 'number' && !isNaN(s));
    const hotSpecial = getSortedNumbers(
      calculateFrequency(specials, ranges.special.max, ranges.special.min),
      'desc', 1
    )[0];
    const rng = createRNG(getDataSeed(allHistoryData) + 3);
    special = hotSpecial != null
      ? hotSpecial
      : Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
  }
  return {
    mainNumbers: finalMain.sort((a, b) => a - b).slice(0, mainCount),
    special,
    method: 'repeat-pattern'
  };
}

// --- IA ALEATORIA OPTIMIZADA (bug de bucle infinito corregido) ---
// BUG ORIGINAL: bucle while con seededRandom(Date.now()) podía no terminar.
// CORREGIDO: candidatos ordenados por frecuencia, sin bucle aleatorio.
function generateRandomOptimizedCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const rng = createRNG(getDataSeed(allHistoryData) + 4);

  if (mainCount === 4 && min === 0 && max === 9)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'random-optimized');

  const oddEvenPatterns = analyzeOddEvenPatterns(allHistoryData);
  const sumPatterns = analyzeSumPatterns(allHistoryData);

  const defaultOddEven = `${Math.floor(mainCount / 2)}-${mainCount - Math.floor(mainCount / 2)}`;
  const oddEvenPattern = Object.keys(oddEvenPatterns).length > 0
    ? Object.keys(oddEvenPatterns).reduce((a, b) =>
        (oddEvenPatterns[a] || 0) > (oddEvenPatterns[b] || 0) ? a : b, defaultOddEven)
    : defaultOddEven;
  const [targetOdd, targetEven] = oddEvenPattern.split('-').map(Number);

  const midSum = (min + max) * mainCount / 2;
  const defaultSumKey = String(Math.floor(midSum / 50) * 50);
  const targetSumRange = Object.keys(sumPatterns).length > 0
    ? Object.keys(sumPatterns).reduce((a, b) =>
        (sumPatterns[a] || 0) > (sumPatterns[b] || 0) ? a : b, defaultSumKey)
    : defaultSumKey;
  const targetSum = parseInt(targetSumRange, 10) + 25;

  // Candidatos ordenados por frecuencia — sin bucle aleatorio
  const allMainNumbers = [];
  if (Array.isArray(allHistoryData)) {
    allHistoryData.forEach(item => {
      const nums = parseDrawingData(item.data).mainNumbers;
      allMainNumbers.push(...nums.filter(n => n >= min && n <= max));
    });
  }
  const freq = calculateFrequency(allMainNumbers, max, min);
  const odds = Array.from({ length: max - min + 1 }, (_, i) => i + min)
    .filter(n => n % 2 !== 0)
    .sort((a, b) => (freq[b] || 0) - (freq[a] || 0));
  const evens = Array.from({ length: max - min + 1 }, (_, i) => i + min)
    .filter(n => n % 2 === 0)
    .sort((a, b) => (freq[b] || 0) - (freq[a] || 0));

  const mainNumbers = [
    ...odds.slice(0, Math.min(targetOdd, odds.length)),
    ...evens.slice(0, Math.min(targetEven, evens.length))
  ];

  // Relleno si faltan por restricción de paridad
  const allByFreq = getSortedNumbers(freq, 'desc', max - min + 1);
  for (const n of allByFreq) {
    if (mainNumbers.length >= mainCount) break;
    if (!mainNumbers.includes(n)) mainNumbers.push(n);
  }

  mainNumbers.sort((a, b) => a - b);

  // Ajuste de suma: intercambiar un número para acercarse al objetivo
  const currentSum = mainNumbers.reduce((a, b) => a + b, 0);
  const diff = targetSum - currentSum;
  if (Math.abs(diff) > 15 && mainNumbers.length === mainCount) {
    for (let i = 0; i < mainNumbers.length; i++) {
      const candidate = mainNumbers[i] + diff;
      if (candidate >= min && candidate <= max && !mainNumbers.includes(candidate)) {
        if ((candidate % 2 !== 0) === (mainNumbers[i] % 2 !== 0)) {
          mainNumbers[i] = candidate;
          mainNumbers.sort((a, b) => a - b);
          break;
        }
      }
    }
  }

  let specialNum = null;
  if (hasSpecial && ranges.special) {
    specialNum = Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
  }

  return { mainNumbers: mainNumbers.slice(0, mainCount), special: specialNum, method: 'random-optimized' };
}

// --- ANÁLISIS DE PATRONES ---
function analyzeOddEvenPatterns(drawings) {
  const patterns = {};
  if (!Array.isArray(drawings)) return patterns;
  drawings.forEach(drawing => {
    let mainNums = [];
    if (drawing.data && drawing.data.mainNumbers) {
      try {
        mainNums = Array.isArray(drawing.data.mainNumbers)
          ? drawing.data.mainNumbers
          : JSON.parse(drawing.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (Array.isArray(mainNums) && mainNums.length > 0) {
      let oddCount = 0;
      mainNums.forEach(num => {
        if (typeof num === 'number' && !isNaN(num) && num % 2 !== 0) oddCount++;
      });
      const evenCount = mainNums.length - oddCount;
      const key = `${oddCount}-${evenCount}`;
      patterns[key] = (patterns[key] || 0) + 1;
    }
  });
  return patterns;
}

function analyzeConsecutivePatterns(drawings) {
  const patterns = { '0': 0, '1': 0, '2': 0, '3+': 0 };
  if (!Array.isArray(drawings)) return patterns;
  drawings.forEach(drawing => {
    let mainNums = [];
    if (drawing.data && drawing.data.mainNumbers) {
      try {
        mainNums = Array.isArray(drawing.data.mainNumbers)
          ? drawing.data.mainNumbers
          : JSON.parse(drawing.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (Array.isArray(mainNums) && mainNums.length > 0) {
      const sortedNums = [...mainNums].sort((a, b) => a - b);
      let consecutiveCount = 0;
      for (let i = 0; i < sortedNums.length - 1; i++) {
        if (sortedNums[i + 1] - sortedNums[i] === 1) consecutiveCount++;
      }
      if (consecutiveCount === 0) patterns['0']++;
      else if (consecutiveCount === 1) patterns['1']++;
      else if (consecutiveCount === 2) patterns['2']++;
      else patterns['3+']++;
    }
  });
  return patterns;
}

function analyzeSumPatterns(drawings) {
  const sumDistribution = {};
  if (!Array.isArray(drawings)) return sumDistribution;
  drawings.forEach(drawing => {
    let mainNums = [];
    if (drawing.data && drawing.data.mainNumbers) {
      try {
        mainNums = Array.isArray(drawing.data.mainNumbers)
          ? drawing.data.mainNumbers
          : JSON.parse(drawing.data.mainNumbers);
      } catch (_) { mainNums = []; }
    }
    if (Array.isArray(mainNums) && mainNums.length > 0) {
      const sum = mainNums.reduce((acc, num) =>
        acc + (typeof num === 'number' && !isNaN(num) ? num : 0), 0);
      const range = Math.floor(sum / 50) * 50;
      sumDistribution[range] = (sumDistribution[range] || 0) + 1;
    }
  });
  return sumDistribution;
}

// --- PARSEAR DATOS ---
function parseDrawingData(data) {
  let mainNumbers = [];
  if (data && data.mainNumbers) {
    if (Array.isArray(data.mainNumbers)) {
      mainNumbers = data.mainNumbers;
    } else if (typeof data.mainNumbers === 'string') {
      try {
        mainNumbers = JSON.parse(data.mainNumbers);
      } catch (e) {
        console.error("Error parsing mainNumbers:", e);
      }
    }
  }
  return { ...data, mainNumbers };
}

// --- MATRIZ DE TRANSICIONES (MARKOV) con suavizado de Laplace ---
// BUG ORIGINAL: sin suavizado → probabilidades en cero → probBase = 0 para casi todos.
function buildMarkovMatrix(allHistoryData, maxNumber, minNumber = 1) {
  const matrix = Array.from({ length: maxNumber + 1 }, () => Array(maxNumber + 1).fill(0));
  const LAPLACE = 0.1;

  for (let i = 0; i < allHistoryData.length - 1; i++) {
    const current = parseDrawingData(allHistoryData[i].data).mainNumbers;
    const next = parseDrawingData(allHistoryData[i + 1].data).mainNumbers;
    current.forEach(num => {
      next.forEach(nextNum => {
        if (num >= minNumber && num <= maxNumber && nextNum >= minNumber && nextNum <= maxNumber)
          matrix[num][nextNum]++;
      });
    });
  }

  // Normalizar con suavizado de Laplace: evita probabilidades cero
  const numStates = maxNumber - minNumber + 1;
  for (let i = minNumber; i <= maxNumber; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    const smoothedTotal = rowSum + LAPLACE * numStates;
    for (let j = minNumber; j <= maxNumber; j++) {
      matrix[i][j] = (matrix[i][j] + LAPLACE) / smoothedTotal;
    }
  }
  return matrix;
}

function markovProbability(matrix, previousNumbers, maxNumber, minNumber = 1) {
  const prob = new Array(matrix.length).fill(0);
  if (!previousNumbers || previousNumbers.length === 0) return prob;
  previousNumbers.forEach(num => {
    if (num >= minNumber && num < matrix.length) {
      for (let i = minNumber; i < matrix.length; i++) {
        prob[i] += matrix[num][i];
      }
    }
  });
  return prob.map(p => p / previousNumbers.length);
}

// --- FACTORIAL (iterativo, sin overflow) ---
function factorial(n) {
  if (n <= 0) return 1;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonProbability(lambda, k) {
  if (lambda <= 0 || k < 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// --- REGRESIÓN LOGÍSTICA ---
const weights = [0.35, 0.45, 0.15, 0.05];

function logisticProbability(features) {
  const z = features.reduce((sum, f, i) => sum + f * (weights[i] || 0), 0);
  return 1 / (1 + Math.exp(-z));
}

// --- MODELO MARKOV + POISSON + LOGÍSTICA (corregido) ---
// BUG ORIGINAL: markovProbs[n] || 0 → todo probBase = 0. Ahora usa fallback uniforme.
// BUG ORIGINAL: Poisson mal aplicado con k = frecuencia_total (muy alta → ≈ 0).
// CORREGIDO: Poisson modela el gap (sorteos desde la última aparición).
function generateMarkovPoissonLogisticCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const rng = createRNG(getDataSeed(allHistoryData) + 5);

  if (mainCount === 4 && min === 0 && max === 9)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'markov-fallback');
  if (!Array.isArray(allHistoryData) || allHistoryData.length < 2)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'markov-fallback');

  const allMainNumbers = [];
  allHistoryData.forEach(item => {
    const parsed = parseDrawingData(item.data);
    allMainNumbers.push(...parsed.mainNumbers.filter(n => n >= min && n <= max));
  });

  const markovMatrix = buildMarkovMatrix(allHistoryData, max, min);
  const lastNumbers = parseDrawingData(allHistoryData[0].data).mainNumbers
    .filter(n => n >= min && n <= max);
  const markovProbs = markovProbability(markovMatrix, lastNumbers, max, min);
  const uniformFallback = 1 / (max - min + 1);

  // Gap analysis: Poisson modela la probabilidad del gap actual
  const gapAnalysis = calculateGapAnalysis(allHistoryData, max, min);
  const avgGap = allHistoryData.length / (max - min + 1);

  const freq = calculateFrequency(allMainNumbers, max, min);
  const totalDraws = allHistoryData.length;
  const ema = calculateEMAFrequency(allHistoryData, max, min);

  const probabilidades = [];
  for (let n = min; n <= max; n++) {
    const frecNorm = (freq[n] || 0) / Math.max(1, totalDraws);
    const emaVal = ema[n] || 0;
    const paridad = 0.5; // neutral
    const decena = max > 10 ? Math.floor(n / 10) / Math.max(1, Math.floor(max / 10)) : n / Math.max(1, max);
    const features = [frecNorm * 5, emaVal * 3, paridad, decena];

    // Poisson: probabilidad del gap actual dado el intervalo esperado
    const poissonGap = poissonProbability(avgGap, Math.max(0, gapAnalysis[n]));
    // Markov con fallback uniforme (nunca será 0 gracias al suavizado Laplace)
    const markovProb = (markovProbs[n] > 0) ? markovProbs[n] : uniformFallback;

    let probBase = logisticProbability(features) * Math.max(1e-10, poissonGap) * markovProb;
    // Penalización leve si el número apareció en el último sorteo (repetición menos probable)
    if (lastNumbers.includes(n)) probBase *= 0.75;
    probabilidades.push({ numero: n, prob: probBase });
  }

  const seleccionados = probabilidades
    .sort((a, b) => b.prob - a.prob)
    .slice(0, mainCount)
    .map(item => item.numero);

  let special = null;
  if (hasSpecial && ranges.special) {
    const specialFreq = calculateFrequencyWeighted(
      allHistoryData, ranges.special.max, ranges.special.min, { useSpecial: true }
    );
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    special = hotSpecial != null
      ? hotSpecial
      : Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
    special = Math.min(ranges.special.max, Math.max(ranges.special.min, special));
  }

  return { mainNumbers: seleccionados.sort((a, b) => a - b), special, method: 'markov-poisson-logistic' };
}

// --- LÓGICA POR DÉCADAS con ponderación por fecha ---
function getDecadeRanges(minNum, maxNum) {
  const ranges = [];
  let low = minNum;
  while (low <= maxNum) {
    const high = Math.min(low + 9, maxNum);
    ranges.push([low, high]);
    low = high + 1;
  }
  return ranges;
}

function generateDecadesCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const isWin4 = mainCount === 4 && min === 0 && max === 9;
  const rng = createRNG(getDataSeed(allHistoryData) + 6);

  if (isWin4) return generateBasicCombination(allHistoryData, ranges, lottery, 'por-decenas');
  if (!Array.isArray(allHistoryData) || allHistoryData.length === 0)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'por-decenas');

  const mainFreq = calculateFrequencyWeighted(allHistoryData, max, min);
  const decadeRanges = getDecadeRanges(min, max);
  const decadeFreq = decadeRanges.map(([low, high]) => {
    let total = 0;
    for (let n = low; n <= high; n++) total += mainFreq[n] || 0;
    return { low, high, total };
  });
  decadeFreq.sort((a, b) => b.total - a.total);

  const finalMain = [];
  for (let d = 0; d < decadeFreq.length && finalMain.length < mainCount; d++) {
    const { low, high } = decadeFreq[d];
    const numsInDecade = [];
    for (let n = low; n <= high; n++) numsInDecade.push({ n, freq: mainFreq[n] || 0 });
    numsInDecade.sort((a, b) => b.freq - a.freq || a.n - b.n);
    if (numsInDecade[0] && !finalMain.includes(numsInDecade[0].n))
      finalMain.push(numsInDecade[0].n);
  }

  // Relleno determinista
  for (let i = min; i <= max && finalMain.length < mainCount; i++) {
    if (!finalMain.includes(i)) finalMain.push(i);
  }
  finalMain.sort((a, b) => a - b);

  let special = null;
  if (hasSpecial && ranges.special) {
    const sMin = ranges.special.min;
    const sMax = ranges.special.max;
    const specialFreq = calculateFrequencyWeighted(allHistoryData, sMax, sMin, { useSpecial: true });
    const specialDecades = getDecadeRanges(sMin, sMax);
    const sDecadeFreq = specialDecades.map(([low, high]) => {
      let total = 0;
      for (let n = low; n <= high; n++) total += specialFreq[n] || 0;
      return { low, high, total };
    });
    sDecadeFreq.sort((a, b) => b.total - a.total);
    const firstDecade = sDecadeFreq[0] || { low: sMin, high: sMax };
    const numsInSDecade = [];
    for (let n = firstDecade.low; n <= firstDecade.high; n++)
      numsInSDecade.push({ n, freq: specialFreq[n] || 0 });
    numsInSDecade.sort((a, b) => b.freq - a.freq || a.n - b.n);
    special = numsInSDecade[0]
      ? numsInSDecade[0].n
      : Math.floor(rng() * (sMax - sMin + 1)) + sMin;
    special = Math.min(sMax, Math.max(sMin, special));
  }

  return { mainNumbers: finalMain, special, method: 'por-decenas' };
}

// --- COMBINACIÓN CONSENSO ENSEMBLE (nueva — 8.ª estrategia) ---
// Asigna una puntuación a cada número combinando 5 señales estadísticas
// y selecciona los K números con mayor puntaje acumulado.
// Esta es la "mejor jugada" estadística basada en el historial completo.
function generateConsensusCombination(allHistoryData, ranges, lottery) {
  const mainCount = getMainCount(ranges);
  const hasSpecial = getHasSpecial(ranges);
  const { min, max } = getMinMax(ranges);
  const isWin4 = mainCount === 4 && min === 0 && max === 9;
  const rng = createRNG(getDataSeed(allHistoryData) + 7);

  if (isWin4) return generateWin4StyleCombination(allHistoryData, ranges, 'desc', 'consenso-ensemble');
  if (!Array.isArray(allHistoryData) || allHistoryData.length < 3)
    return generateBasicCombination(allHistoryData, ranges, lottery, 'consenso-ensemble');

  const scores = scoreNumbers(allHistoryData, max, min);

  const mainNumbers = Object.entries(scores)
    .map(([n, s]) => ({ n: Number(n), s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, mainCount)
    .map(x => x.n)
    .sort((a, b) => a - b);

  let special = null;
  if (hasSpecial && ranges.special) {
    const specialFreq = calculateFrequencyWeighted(
      allHistoryData, ranges.special.max, ranges.special.min, { useSpecial: true }
    );
    const emaSpecial = calculateEMAFrequency(
      allHistoryData.map(d => ({
        data: {
          date: d.data && d.data.date,
          mainNumbers: [d.data && d.data.special].filter(s => typeof s === 'number')
        }
      })),
      ranges.special.max, ranges.special.min
    );
    const specialScores = {};
    for (let i = ranges.special.min; i <= ranges.special.max; i++) {
      specialScores[i] = (specialFreq[i] || 0) * 0.5 + (emaSpecial[i] || 0) * 0.5;
    }
    const hotSpecial = Object.entries(specialScores).sort((a, b) => b[1] - a[1])[0];
    special = hotSpecial
      ? Number(hotSpecial[0])
      : Math.floor(rng() * (ranges.special.max - ranges.special.min + 1)) + ranges.special.min;
    special = Math.min(ranges.special.max, Math.max(ranges.special.min, special));
  }

  return { mainNumbers, special, method: 'consenso-ensemble' };
}

// --- MÚLTIPLES COMBINACIONES – 8 ESTRATEGIAS ---
function generateMultipleCombinations(allHistoryData, ranges, lottery) {
  return [
    generateBasicCombination(allHistoryData, ranges, lottery, 'basado-en-frecuencia'),
    generateColdNumbersCombination(allHistoryData, ranges, lottery),
    generateMixedCombination(allHistoryData, ranges, lottery),
    generateRepeatPatternCombination(allHistoryData, ranges, lottery),
    generateDecadesCombination(allHistoryData, ranges, lottery),
    generateRandomOptimizedCombination(allHistoryData, ranges, lottery),
    generateMarkovPoissonLogisticCombination(allHistoryData, ranges, lottery),
    generateConsensusCombination(allHistoryData, ranges, lottery)
  ];
}

// ==========================================
// EXPONER GLOBAL
// ==========================================
window.lotteryAlgorithms = {
  calculateFrequency,
  calculateFrequencyWeighted,
  calculateEMAFrequency,
  calculateGapAnalysis,
  scoreNumbers,
  pesoPorFecha,
  getSortedNumbers,
  calculatePairFrequency,
  getSortedPairs,
  analyzeOddEvenPatterns,
  analyzeConsecutivePatterns,
  analyzeSumPatterns,
  getDecadeRanges,
  generateBasicCombination,
  generateColdNumbersCombination,
  generateMixedCombination,
  generateRepeatPatternCombination,
  generateDecadesCombination,
  generateRandomOptimizedCombination,
  generateMarkovPoissonLogisticCombination,
  generateConsensusCombination,
  generateMultipleCombinations,
  parseDrawingData
};

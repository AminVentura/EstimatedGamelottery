/**
 * Algoritmos avanzados para predicción de lotería
 * Este archivo contiene funciones para análisis estadístico avanzado
 * que complementan el análisis de frecuencia básico existente
 */

/**
 * Analiza patrones de distribución por decenas
 * @param {Array} drawings - Historial de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @returns {Object} Distribución por decenas
 */
function analyzeDecadeDistribution(drawings, ranges) {
    const decadeDistribution = {};
    
    // Inicializar distribución por decenas
    const maxDecade = Math.floor(ranges.main.max / 10);
    for (let i = 0; i <= maxDecade; i++) {
        decadeDistribution[i] = 0;
    }
    
    // Contar números por decena
    drawings.forEach(drawing => {
        // Verificar que drawing.mainNumbers exista y sea válido
        let mainNums = [];
        
        if (drawing.mainNumbers) {
            if (typeof drawing.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.mainNumbers);
                } catch (e) {
                    console.error("Error parsing mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.mainNumbers)) {
                mainNums = drawing.mainNumbers;
            }
        } else if (drawing.data && drawing.data.mainNumbers) {
            if (typeof drawing.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.data.mainNumbers)) {
                mainNums = drawing.data.mainNumbers;
            }
        }
        
        // Verificar que mainNums sea un array válido antes de usar forEach
        if (Array.isArray(mainNums)) {
            mainNums.forEach(num => {
                const decade = Math.floor(num / 10);
                decadeDistribution[decade]++;
            });
        }
    });
    
    return decadeDistribution;
}

/**
 * Analiza patrones de números pares/impares
 * @param {Array} drawings - Historial de sorteos
 * @returns {Object} Distribución par/impar
 */
function analyzeOddEvenPatterns(drawings) {
    const patterns = { '0-5': 0, '1-4': 0, '2-3': 0, '3-2': 0, '4-1': 0, '5-0': 0 };
    
    drawings.forEach(drawing => {
        // Verificar que drawing.mainNumbers exista y sea válido
        let mainNums = [];
        
        if (drawing.mainNumbers) {
            if (typeof drawing.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.mainNumbers);
                } catch (e) {
                    console.error("Error parsing mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.mainNumbers)) {
                mainNums = drawing.mainNumbers;
            }
        } else if (drawing.data && drawing.data.mainNumbers) {
            if (typeof drawing.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.data.mainNumbers)) {
                mainNums = drawing.data.mainNumbers;
            }
        }
        
        // Verificar que mainNums sea un array válido
        if (Array.isArray(mainNums)) {
            let oddCount = 0;
            mainNums.forEach(num => {
                if (num % 2 !== 0) oddCount++;
            });
            
            const evenCount = 5 - oddCount;
            patterns[`${oddCount}-${evenCount}`]++;
        }
    });
    
    return patterns;
}

/**
 * Analiza patrones de números consecutivos
 * @param {Array} drawings - Historial de sorteos
 * @returns {Object} Patrones de consecutividad
 */
function analyzeConsecutivePatterns(drawings) {
    const patterns = { '0': 0, '1': 0, '2': 0, '3+': 0 };
    
    drawings.forEach(drawing => {
        // Verificar que drawing.mainNumbers exista y sea válido
        let mainNums = [];
        
        if (drawing.mainNumbers) {
            if (typeof drawing.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.mainNumbers);
                } catch (e) {
                    console.error("Error parsing mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.mainNumbers)) {
                mainNums = drawing.mainNumbers;
            }
        } else if (drawing.data && drawing.data.mainNumbers) {
            if (typeof drawing.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.data.mainNumbers)) {
                mainNums = drawing.data.mainNumbers;
            }
        }
        
        // Verificar que mainNums sea un array válido
        if (Array.isArray(mainNums)) {
            mainNums.sort((a, b) => a - b);
            
            let consecutiveCount = 0;
            for (let i = 0; i < mainNums.length - 1; i++) {
                if (mainNums[i+1] - mainNums[i] === 1) {
                    consecutiveCount++;
                }
            }
            
            if (consecutiveCount === 0) patterns['0']++;
            else if (consecutiveCount === 1) patterns['1']++;
            else if (consecutiveCount === 2) patterns['2']++;
            else patterns['3+']++;
        }
    });
    
    return patterns;
}

/**
 * Analiza patrones de suma de números
 * @param {Array} drawings - Historial de sorteos
 * @returns {Object} Distribución de sumas
 */
function analyzeSumPatterns(drawings) {
    const sumDistribution = {};
    
    drawings.forEach(drawing => {
        // Verificar que drawing.mainNumbers exista y sea válido
        let mainNums = [];
        
        if (drawing.mainNumbers) {
            if (typeof drawing.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.mainNumbers);
                } catch (e) {
                    console.error("Error parsing mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.mainNumbers)) {
                mainNums = drawing.mainNumbers;
            }
        } else if (drawing.data && drawing.data.mainNumbers) {
            if (typeof drawing.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(drawing.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.data.mainNumbers)) {
                mainNums = drawing.data.mainNumbers;
            }
        }
        
        // Verificar que mainNums sea un array válido
        if (Array.isArray(mainNums)) {
            const sum = mainNums.reduce((acc, num) => acc + num, 0);
            const range = Math.floor(sum / 50) * 50; // Agrupar en rangos de 50
            
            sumDistribution[range] = (sumDistribution[range] || 0) + 1;
        }
    });
    
    return sumDistribution;
}

/**
 * Analiza patrones de números repetidos en sorteos consecutivos
 * @param {Array} drawings - Historial de sorteos
 * @returns {Object} Patrones de repetición
 */
function analyzeRepeatPatterns(drawings) {
    const patterns = { '0': 0, '1': 0, '2': 0, '3+': 0 };
    
    for (let i = 1; i < drawings.length; i++) {
        // Obtener números del sorteo actual
        let current = [];
        if (drawings[i].mainNumbers) {
            if (typeof drawings[i].mainNumbers === 'string') {
                try {
                    current = JSON.parse(drawings[i].mainNumbers);
                } catch (e) {
                    console.error("Error parsing current mainNumbers:", e);
                    continue;
                }
            } else if (Array.isArray(drawings[i].mainNumbers)) {
                current = drawings[i].mainNumbers;
            }
        } else if (drawings[i].data && drawings[i].data.mainNumbers) {
            if (typeof drawings[i].data.mainNumbers === 'string') {
                try {
                    current = JSON.parse(drawings[i].data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing current data.mainNumbers:", e);
                    continue;
                }
            } else if (Array.isArray(drawings[i].data.mainNumbers)) {
                current = drawings[i].data.mainNumbers;
            }
        }
        
        // Obtener números del sorteo anterior
        let previous = [];
        if (drawings[i-1].mainNumbers) {
            if (typeof drawings[i-1].mainNumbers === 'string') {
                try {
                    previous = JSON.parse(drawings[i-1].mainNumbers);
                } catch (e) {
                    console.error("Error parsing previous mainNumbers:", e);
                    continue;
                }
            } else if (Array.isArray(drawings[i-1].mainNumbers)) {
                previous = drawings[i-1].mainNumbers;
            }
        } else if (drawings[i-1].data && drawings[i-1].data.mainNumbers) {
            if (typeof drawings[i-1].data.mainNumbers === 'string') {
                try {
                    previous = JSON.parse(drawings[i-1].data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing previous data.mainNumbers:", e);
                    continue;
                }
            } else if (Array.isArray(drawings[i-1].data.mainNumbers)) {
                previous = drawings[i-1].data.mainNumbers;
            }
        }
        
        // Verificar que ambos arrays sean válidos
        if (Array.isArray(current) && Array.isArray(previous)) {
            let repeatCount = 0;
            current.forEach(num => {
                if (previous.includes(num)) repeatCount++;
            });
            
            if (repeatCount === 0) patterns['0']++;
            else if (repeatCount === 1) patterns['1']++;
            else if (repeatCount === 2) patterns['2']++;
            else patterns['3+']++;
        }
    }
    
    return patterns;
}

/**
 * Genera combinación basada en análisis avanzado
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateAdvancedCombination(allHistoryData, ranges, lottery) {
    if (allHistoryData.length < 10) {
        // Si hay pocos datos, usar método básico
        return generateBasicCombination(allHistoryData, ranges, lottery);
    }
    
    // Análisis de patrones
    const decadeDistribution = analyzeDecadeDistribution(allHistoryData, ranges);
    const oddEvenPatterns = analyzeOddEvenPatterns(allHistoryData);
    const consecutivePatterns = analyzeConsecutivePatterns(allHistoryData);
    const sumPatterns = analyzeSumPatterns(allHistoryData);
    const repeatPatterns = analyzeRepeatPatterns(allHistoryData);
    
    // Análisis de frecuencia
    const allMainNumbers = [];
    const allSpecials = [];
    
    allHistoryData.forEach(item => {
        let mainNums = [];
        
        if (item.data && item.data.mainNumbers) {
            if (typeof item.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(item.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing item.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(item.data.mainNumbers)) {
                mainNums = item.data.mainNumbers;
            }
        }
        
        if (Array.isArray(mainNums)) {
            allMainNumbers.push(...mainNums);
        }
        
        if (item.data && item.data.special) {
            allSpecials.push(item.data.special);
        }
    });
    
    const mainFreq = calculateFrequency(allMainNumbers, ranges.main.max);
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max);
    
    // Determinar patrón de pares/impares más común
    const oddEvenPattern = Object.keys(oddEvenPatterns).reduce((a, b) => 
        oddEvenPatterns[a] > oddEvenPatterns[b] ? a : b
    );
    const [oddCount, evenCount] = oddEvenPattern.split('-').map(Number);
    
    // Determinar patrón de consecutivos más común
    const consecutivePattern = Object.keys(consecutivePatterns).reduce((a, b) => 
        consecutivePatterns[a] > consecutivePatterns[b] ? a : b
    );
    const targetConsecutive = consecutivePattern === '3+' ? 3 : parseInt(consecutivePattern);
    
    // Determinar rango de suma más común
    const targetSumRange = Object.keys(sumPatterns).reduce((a, b) => 
        sumPatterns[a] > sumPatterns[b] ? a : b
    );
    const targetSum = parseInt(targetSumRange) + 25; // Punto medio del rango
    
    // Generar combinación basada en patrones
    const hotNumbers = getSortedNumbers(mainFreq, 'desc', 15);
    const coldNumbers = getSortedNumbers(mainFreq, 'asc', 10);
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    
    // Combinación de números calientes y fríos
    const mainNumbers = [];
    
    // Añadir números según patrón par/impar
    let oddAdded = 0;
    let evenAdded = 0;
    
    // Primero, añadir algunos números calientes
    for (const num of hotNumbers) {
        if (mainNumbers.length >= 5) break;
        
        const isOdd = num % 2 !== 0;
        if ((isOdd && oddAdded < oddCount) || (!isOdd && evenAdded < evenCount)) {
            mainNumbers.push(num);
            if (isOdd) oddAdded++;
            else evenAdded++;
        }
    }
    
    // Completar con números fríos si es necesario
    for (const num of coldNumbers) {
        if (mainNumbers.length >= 5) break;
        
        const isOdd = num % 2 !== 0;
        if ((isOdd && oddAdded < oddCount) || (!isOdd && evenAdded < evenCount)) {
            mainNumbers.push(num);
            if (isOdd) oddAdded++;
            else evenAdded++;
        }
    }
    
    // Asegurar que tengamos 5 números
    while (mainNumbers.length < 5) {
        const candidates = hotNumbers.filter(num => !mainNumbers.includes(num));
        if (candidates.length > 0) {
            mainNumbers.push(candidates[0]);
        } else {
            // Si no hay más candidatos, añadir números aleatorios
            let randomNum;
            do {
                randomNum = Math.floor(Math.random() * ranges.main.max) + 1;
            } while (mainNumbers.includes(randomNum));
            mainNumbers.push(randomNum);
        }
    }
    
    // Ordenar números
    mainNumbers.sort((a, b) => a - b);
    
    // Ajustar para cumplir con patrón de consecutivos si es necesario
    let currentConsecutive = 0;
    for (let i = 0; i < mainNumbers.length - 1; i++) {
        if (mainNumbers[i+1] - mainNumbers[i] === 1) {
            currentConsecutive++;
        }
    }
    
    // Si no hay suficientes consecutivos, intentar ajustar
    if (currentConsecutive < targetConsecutive) {
        for (let i = 0; i < mainNumbers.length - 1; i++) {
            if (mainNumbers[i+1] - mainNumbers[i] > 1) {
                // Intentar reemplazar un número para crear una secuencia
                const replacement = mainNumbers[i] + 1;
                if (!mainNumbers.includes(replacement) && replacement <= ranges.main.max) {
                    // Encontrar un número para reemplazar
                    for (let j = 0; j < mainNumbers.length; j++) {
                        if (j !== i && j !== i+1) {
                            // Verificar si el reemplazo mantiene el patrón par/impar
                            const isOdd = replacement % 2 !== 0;
                            const isCurrentOdd = mainNumbers[j] % 2 !== 0;
                            
                            if (isOdd === isCurrentOdd) {
                                mainNumbers[j] = replacement;
                                mainNumbers.sort((a, b) => a - b);
                                currentConsecutive++;
                                break;
                            }
                        }
                    }
                    if (currentConsecutive >= targetConsecutive) break;
                }
            }
        }
    }
    
    // Verificar suma y ajustar si es necesario
    const currentSum = mainNumbers.reduce((acc, num) => acc + num, 0);
    const sumDiff = targetSum - currentSum;
    
    if (Math.abs(sumDiff) > 20) {
        // Intentar ajustar la suma cambiando un número
        for (let i = 0; i < mainNumbers.length; i++) {
            const currentNum = mainNumbers[i];
            const adjustment = Math.round(sumDiff / (5 - i));
            let newNum = currentNum + adjustment;
            
            // Asegurar que el nuevo número esté en el rango válido y no se duplique
            if (newNum >= ranges.main.min && newNum <= ranges.main.max && !mainNumbers.includes(newNum)) {
                // Verificar si mantiene el patrón par/impar
                const isOdd = newNum % 2 !== 0;
                const isCurrentOdd = currentNum % 2 !== 0;
                
                if (isOdd === isCurrentOdd) {
                    mainNumbers[i] = newNum;
                    mainNumbers.sort((a, b) => a - b);
                    break;
                }
            }
        }
    }
    
    return {
        mainNumbers: mainNumbers,
        special: hotSpecial,
        date: new Date().toISOString().split('T')[0],
        method: 'advanced',
        patterns: {
            oddEven: oddEvenPattern,
            consecutive: consecutivePattern,
            sumRange: targetSumRange
        }
    };
}

/**
 * Genera combinación básica basada en frecuencia (método original)
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateBasicCombination(allHistoryData, ranges, lottery) {
    const allMainNumbers = [];
    const allSpecials = [];
    
    allHistoryData.forEach(item => {
        let mainNums = [];
        
        if (item.data && item.data.mainNumbers) {
            if (typeof item.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(item.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing item.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(item.data.mainNumbers)) {
                mainNums = item.data.mainNumbers;
            }
        }
        
        if (Array.isArray(mainNums)) {
            allMainNumbers.push(...mainNums);
        }
        
        if (item.data && item.data.special) {
            allSpecials.push(item.data.special);
        }
    });
    
    const mainFreq = calculateFrequency(allMainNumbers, ranges.main.max);
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max);
    const hotMain = getSortedNumbers(mainFreq, 'desc', 5);
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    
    return {
        mainNumbers: hotMain,
        special: hotSpecial,
        date: new Date().toISOString().split('T')[0],
        method: 'basic'
    };
}

/**
 * Genera múltiples combinaciones con diferentes estrategias
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Array} Lista de combinaciones generadas
 */
function generateMultipleCombinations(allHistoryData, ranges, lottery) {
    const combinations = [];
    
    // 1. Combinación basada en análisis avanzado
    combinations.push(generateAdvancedCombination(allHistoryData, ranges, lottery));
    
    // 2. Combinación basada en números fríos (estrategia contraria)
    const coldCombination = generateColdNumbersCombination(allHistoryData, ranges, lottery);
    combinations.push(coldCombination);
    
    // 3. Combinación mixta (calientes y fríos)
    const mixedCombination = generateMixedCombination(allHistoryData, ranges, lottery);
    combinations.push(mixedCombination);
    
    // 4. Combinación basada en patrones de repetición
    const repeatCombination = generateRepeatPatternCombination(allHistoryData, ranges, lottery);
    combinations.push(repeatCombination);
    
    // 5. Combinación aleatoria optimizada
    const randomOptimizedCombination = generateRandomOptimizedCombination(allHistoryData, ranges, lottery);
    combinations.push(randomOptimizedCombination);
    
    return combinations;
}

/**
 * Genera combinación basada en números fríos
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateColdNumbersCombination(allHistoryData, ranges, lottery) {
    const allMainNumbers = [];
    const allSpecials = [];
    
    allHistoryData.forEach(item => {
        let mainNums = [];
        
        if (item.data && item.data.mainNumbers) {
            if (typeof item.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(item.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing item.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(item.data.mainNumbers)) {
                mainNums = item.data.mainNumbers;
            }
        }
        
        if (Array.isArray(mainNums)) {
            allMainNumbers.push(...mainNums);
        }
        
        if (item.data && item.data.special) {
            allSpecials.push(item.data.special);
        }
    });
    
    const mainFreq = calculateFrequency(allMainNumbers, ranges.main.max);
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max);
    const coldMain = getSortedNumbers(mainFreq, 'asc', 5);
    const coldSpecial = getSortedNumbers(specialFreq, 'asc', 1)[0];
    
    return {
        mainNumbers: coldMain,
        special: coldSpecial,
        date: new Date().toISOString().split('T')[0],
        method: 'cold'
    };
}

/**
 * Genera combinación mixta (números calientes y fríos)
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateMixedCombination(allHistoryData, ranges, lottery) {
    const allMainNumbers = [];
    const allSpecials = [];
    
    allHistoryData.forEach(item => {
        let mainNums = [];
        
        if (item.data && item.data.mainNumbers) {
            if (typeof item.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(item.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing item.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(item.data.mainNumbers)) {
                mainNums = item.data.mainNumbers;
            }
        }
        
        if (Array.isArray(mainNums)) {
            allMainNumbers.push(...mainNums);
        }
        
        if (item.data && item.data.special) {
            allSpecials.push(item.data.special);
        }
    });
    
    const mainFreq = calculateFrequency(allMainNumbers, ranges.main.max);
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max);
    const hotMain = getSortedNumbers(mainFreq, 'desc', 3);
    const coldMain = getSortedNumbers(mainFreq, 'asc', 2);
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    
    // Combinar números calientes y fríos
    const mixedMain = [...hotMain, ...coldMain].sort((a, b) => a - b);
    
    return {
        mainNumbers: mixedMain,
        special: hotSpecial,
        date: new Date().toISOString().split('T')[0],
        method: 'mixed'
    };
}

/**
 * Genera combinación basada en patrones de repetición
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateRepeatPatternCombination(allHistoryData, ranges, lottery) {
    if (allHistoryData.length < 2) {
        return generateBasicCombination(allHistoryData, ranges, lottery);
    }
    
    // Obtener los dos últimos sorteos
    const lastDrawing = allHistoryData[0];
    const previousDrawing = allHistoryData[1];
    
    let lastMain = [];
    let previousMain = [];
    
    // Extraer números del último sorteo
    if (lastDrawing.data && lastDrawing.data.mainNumbers) {
        if (typeof lastDrawing.data.mainNumbers === 'string') {
            try {
                lastMain = JSON.parse(lastDrawing.data.mainNumbers);
            } catch (e) {
                console.error("Error parsing lastDrawing.data.mainNumbers:", e);
            }
        } else if (Array.isArray(lastDrawing.data.mainNumbers)) {
            lastMain = lastDrawing.data.mainNumbers;
        }
    }
    
    // Extraer números del sorteo anterior
    if (previousDrawing.data && previousDrawing.data.mainNumbers) {
        if (typeof previousDrawing.data.mainNumbers === 'string') {
            try {
                previousMain = JSON.parse(previousDrawing.data.mainNumbers);
            } catch (e) {
                console.error("Error parsing previousDrawing.data.mainNumbers:", e);
            }
        } else if (Array.isArray(previousDrawing.data.mainNumbers)) {
            previousMain = previousDrawing.data.mainNumbers;
        }
    }
    
    // Encontrar números que se repiten entre los dos últimos sorteos
    const repeatNumbers = lastMain.filter(num => previousMain.includes(num));
    
    // Análisis de frecuencia general
    const allMainNumbers = [];
    const allSpecials = [];
    
    allHistoryData.forEach(item => {
        let mainNums = [];
        
        if (item.data && item.data.mainNumbers) {
            if (typeof item.data.mainNumbers === 'string') {
                try {
                    mainNums = JSON.parse(item.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing item.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(item.data.mainNumbers)) {
                mainNums = item.data.mainNumbers;
            }
        }
        
        if (Array.isArray(mainNums)) {
            allMainNumbers.push(...mainNums);
        }
        
        if (item.data && item.data.special) {
            allSpecials.push(item.data.special);
        }
    });
    
    const mainFreq = calculateFrequency(allMainNumbers, ranges.main.max);
    const specialFreq = calculateFrequency(allSpecials, ranges.special.max);
    
    // Generar combinación
    const mainNumbers = [];
    
    // Incluir algunos números que se repitieron recientemente
    if (repeatNumbers.length > 0) {
        mainNumbers.push(...repeatNumbers.slice(0, Math.min(2, repeatNumbers.length)));
    }
    
    // Completar con números calientes que no estén ya en la combinación
    const hotMain = getSortedNumbers(mainFreq, 'desc', 10);
    for (const num of hotMain) {
        if (mainNumbers.length >= 5) break;
        if (!mainNumbers.includes(num)) {
            mainNumbers.push(num);
        }
    }
    
    // Si aún faltan números, añadir números aleatorios
    while (mainNumbers.length < 5) {
        let randomNum;
        do {
            randomNum = Math.floor(Math.random() * ranges.main.max) + 1;
        } while (mainNumbers.includes(randomNum));
        mainNumbers.push(randomNum);
    }
    
    mainNumbers.sort((a, b) => a - b);
    const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
    
    return {
        mainNumbers: mainNumbers,
        special: hotSpecial,
        date: new Date().toISOString().split('T')[0],
        method: 'repeat-pattern',
        repeatNumbers: repeatNumbers
    };
}

/**
 * Genera combinación aleatoria optimizada
 * @param {Array} allHistoryData - Historial completo de sorteos
 * @param {Object} ranges - Rangos de números válidos
 * @param {string} lottery - Tipo de lotería
 * @returns {Object} Combinación generada
 */
function generateRandomOptimizedCombination(allHistoryData, ranges, lottery) {
    // Análisis de patrones
    const oddEvenPatterns = analyzeOddEvenPatterns(allHistoryData);
    const consecutivePatterns = analyzeConsecutivePatterns(allHistoryData);
    const sumPatterns = analyzeSumPatterns(allHistoryData);
    
    // Determinar patrones más comunes
    const oddEvenPattern = Object.keys(oddEvenPatterns).reduce((a, b) => 
        oddEvenPatterns[a] > oddEvenPatterns[b] ? a : b
    );
    const [oddCount, evenCount] = oddEvenPattern.split('-').map(Number);
    
    const consecutivePattern = Object.keys(consecutivePatterns).reduce((a, b) => 
        consecutivePatterns[a] > consecutivePatterns[b] ? a : b
    );
    const targetConsecutive = consecutivePattern === '3+' ? 3 : parseInt(consecutivePattern);
    
    const targetSumRange = Object.keys(sumPatterns).reduce((a, b) => 
        sumPatterns[a] > sumPatterns[b] ? a : b
    );
    const targetSum = parseInt(targetSumRange) + 25; // Punto medio del rango
    
    // Generar combinación aleatoria que cumpla con los patrones
    const mainNumbers = [];
    let oddAdded = 0;
    let evenAdded = 0;
    
    // Generar números aleatorios
    while (mainNumbers.length < 5) {
        let randomNum = Math.floor(Math.random() * ranges.main.max) + 1;
        
        // Verificar si no está duplicado
        if (!mainNumbers.includes(randomNum)) {
            // Verificar si cumple con el patrón par/impar
            const isOdd = randomNum % 2 !== 0;
            if ((isOdd && oddAdded < oddCount) || (!isOdd && evenAdded < evenCount)) {
                mainNumbers.push(randomNum);
                if (isOdd) oddAdded++;
                else evenAdded++;
            }
        }
    }
    
    // Ordenar números
    mainNumbers.sort((a, b) => a - b);
    
    // Ajustar para cumplir con patrón de consecutivos si es necesario
    let currentConsecutive = 0;
    for (let i = 0; i < mainNumbers.length - 1; i++) {
        if (mainNumbers[i+1] - mainNumbers[i] === 1) {
            currentConsecutive++;
        }
    }
    
    // Si no hay suficientes consecutivos, intentar ajustar
    if (currentConsecutive < targetConsecutive) {
        for (let i = 0; i < mainNumbers.length - 1; i++) {
            if (mainNumbers[i+1] - mainNumbers[i] > 1) {
                // Intentar reemplazar un número para crear una secuencia
                const replacement = mainNumbers[i] + 1;
                if (!mainNumbers.includes(replacement) && replacement <= ranges.main.max) {
                    // Encontrar un número para reemplazar
                    for (let j = 0; j < mainNumbers.length; j++) {
                        if (j !== i && j !== i+1) {
                            // Verificar si el reemplazo mantiene el patrón par/impar
                            const isOdd = replacement % 2 !== 0;
                            const isCurrentOdd = mainNumbers[j] % 2 !== 0;
                            
                            if (isOdd === isCurrentOdd) {
                                mainNumbers[j] = replacement;
                                mainNumbers.sort((a, b) => a - b);
                                currentConsecutive++;
                                break;
                            }
                        }
                    }
                    if (currentConsecutive >= targetConsecutive) break;
                }
            }
        }
    }
    
    // Verificar suma y ajustar si es necesario
    const currentSum = mainNumbers.reduce((acc, num) => acc + num, 0);
    const sumDiff = targetSum - currentSum;
    
    if (Math.abs(sumDiff) > 20) {
        // Intentar ajustar la suma cambiando un número
        for (let i = 0; i < mainNumbers.length; i++) {
            const currentNum = mainNumbers[i];
            const adjustment = Math.round(sumDiff / (5 - i));
            let newNum = currentNum + adjustment;
            
            // Asegurar que el nuevo número esté en el rango válido y no se duplique
            if (newNum >= ranges.main.min && newNum <= ranges.main.max && !mainNumbers.includes(newNum)) {
                // Verificar si mantiene el patrón par/impar
                const isOdd = newNum % 2 !== 0;
                const isCurrentOdd = currentNum % 2 !== 0;
                
                if (isOdd === isCurrentOdd) {
                    mainNumbers[i] = newNum;
                    mainNumbers.sort((a, b) => a - b);
                    break;
                }
            }
        }
    }
    
    // Generar número especial aleatorio
    const specialNum = Math.floor(Math.random() * ranges.special.max) + 1;
    
    return {
        mainNumbers: mainNumbers,
        special: specialNum,
        date: new Date().toISOString().split('T')[0],
        method: 'random-optimized',
        patterns: {
            oddEven: oddEvenPattern,
            consecutive: consecutivePattern,
            sumRange: targetSumRange
        }
    };
}

/**
 * Evalúa la precisión de las predicciones comparando con sorteos reales
 * @param {Array} predictions - Predicciones generadas
 * @param {Array} actualDrawings - Sorteos reales
 * @returns {Object} Métricas de precisión
 */
function evaluatePredictionAccuracy(predictions, actualDrawings) {
    const metrics = {
        totalPredictions: predictions.length,
        exactMatches: 0,
        mainNumberMatches: [],
        specialNumberMatches: 0,
        averageMainMatches: 0,
        averageSpecialMatches: 0
    };
    
    let totalMainMatches = 0;
    let totalSpecialMatches = 0;
    
    predictions.forEach(prediction => {
        // Encontrar el sorteo real correspondiente a la predicción
        const actualDrawing = actualDrawings.find(drawing => drawing.date === prediction.date);
        
        if (actualDrawing) {
            let actualMain = [];
            
            if (actualDrawing.mainNumbers) {
                if (typeof actualDrawing.mainNumbers === 'string') {
                    try {
                        actualMain = JSON.parse(actualDrawing.mainNumbers);
                    } catch (e) {
                        console.error("Error parsing actualDrawing.mainNumbers:", e);
                    }
                } else if (Array.isArray(actualDrawing.mainNumbers)) {
                    actualMain = actualDrawing.mainNumbers;
                }
            } else if (actualDrawing.data && actualDrawing.data.mainNumbers) {
                if (typeof actualDrawing.data.mainNumbers === 'string') {
                    try {
                        actualMain = JSON.parse(actualDrawing.data.mainNumbers);
                    } catch (e) {
                        console.error("Error parsing actualDrawing.data.mainNumbers:", e);
                    }
                } else if (Array.isArray(actualDrawing.data.mainNumbers)) {
                    actualMain = actualDrawing.data.mainNumbers;
                }
            }
                
            const actualSpecial = actualDrawing.special || actualDrawing.data.special;
            
            // Contar coincidencias de números principales
            let mainMatches = 0;
            prediction.mainNumbers.forEach(num => {
                if (actualMain.includes(num)) mainMatches++;
            });
            
            metrics.mainNumberMatches.push(mainMatches);
            totalMainMatches += mainMatches;
            
            // Verificar coincidencia de número especial
            if (prediction.special === actualSpecial) {
                metrics.specialNumberMatches++;
                totalSpecialMatches++;
            }
            
            // Verificar si es una coincidencia exacta
            if (mainMatches === 5 && prediction.special === actualSpecial) {
                metrics.exactMatches++;
            }
        }
    });
    
    // Calcular promedios
    metrics.averageMainMatches = totalMainMatches / predictions.length;
    metrics.averageSpecialMatches = totalSpecialMatches / predictions.length;
    
    return metrics;
}

// Funciones auxiliares
function calculateFrequency(numbers, max) { 
    const freq = {}; 
    for (let i = 1; i <= max; i++) {
        freq[i] = 0; 
    } 
    numbers.forEach(num => { 
        freq[num] = (freq[num] || 0) + 1; 
    }); 
    return freq; 
}

function calculatePairFrequency(drawings) { 
    const pairFreq = {}; 
    drawings.forEach(drawing => { 
        let sortedNums = [];
        
        if (drawing.mainNumbers) {
            if (typeof drawing.mainNumbers === 'string') {
                try {
                    sortedNums = JSON.parse(drawing.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.mainNumbers)) {
                sortedNums = drawing.mainNumbers;
            }
        } else if (drawing.data && drawing.data.mainNumbers) {
            if (typeof drawing.data.mainNumbers === 'string') {
                try {
                    sortedNums = JSON.parse(drawing.data.mainNumbers);
                } catch (e) {
                    console.error("Error parsing drawing.data.mainNumbers:", e);
                    return;
                }
            } else if (Array.isArray(drawing.data.mainNumbers)) {
                sortedNums = drawing.data.mainNumbers;
            }
        }
        
        if (Array.isArray(sortedNums)) {
            sortedNums.sort((a, b) => a - b); 
            for (let i = 0; i < sortedNums.length - 1; i++) { 
                for (let j = i + 1; j < sortedNums.length; j++) { 
                    const pair = `${sortedNums[i]}-${sortedNums[j]}`; 
                    pairFreq[pair] = (pairFreq[pair] || 0) + 1; 
                } 
            } 
        }
    }); 
    return pairFreq; 
}

function getSortedNumbers(freqMap, order, limit) { 
    return Object.entries(freqMap)
        .sort(([, a], [, b]) => order === 'desc' ? b - a : a - b)
        .slice(0, limit)
        .map(([num]) => parseInt(num)); 
}

function getSortedPairs(pairFreq, limit) { 
    return Object.entries(pairFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([pair]) => pair.split('-').map(Number)); 
}

// Exportar funciones para uso en otros módulos
window.lotteryAlgorithms = {
    analyzeDecadeDistribution,
    analyzeOddEvenPatterns,
    analyzeConsecutivePatterns,
    analyzeSumPatterns,
    analyzeRepeatPatterns,
    generateAdvancedCombination,
    generateBasicCombination,
    generateMultipleCombinations,
    generateColdNumbersCombination,
    generateMixedCombination,
    generateRepeatPatternCombination,
    generateRandomOptimizedCombination,
    evaluatePredictionAccuracy,
    calculateFrequency,
    calculatePairFrequency,
    getSortedNumbers,
    getSortedPairs
};
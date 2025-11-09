import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, orderBy, writeBatch, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBtNNiANCMdMILI5qiL9fF5aWhjfknUMWQ",
  authDomain: "game-lottery-b0e90.firebaseapp.com",
  projectId: "game-lottery-b0e90",
  storageBucket: "game-lottery-b0e90.firebasestorage.app",
  messagingSenderId: "192610858921",
  appId: "1:192610858921:web:7e76e398b3c5978f7b36b8"
};

// --- ID DE LA APLICACIÓN ---
const appId = "EstimatedGamelottery-app";

// --- VARIABLES GLOBALES ---
let db, auth, userId;

const powerballCollectionPath = `artifacts/${appId}/public/data/powerball_drawings`;
const cash4lifeCollectionPath = `artifacts/${appId}/public/data/cash4life_drawings`;
const megamillionsCollectionPath = `artifacts/${appId}/public/data/megamillions_drawings`;
const commentsCollectionPath = `artifacts/${appId}/public/data/lotto_comments`;

const NUM_TO_DISPLAY = 5;
let allHistoryData_pb = [];
let showAll_pb = false;
let allHistoryData_c4l = [];
let showAll_c4l = false;
let allHistoryData_mm = [];
let showAll_mm = false;
const domElements = {};

// --- FUNCIONES AUXILIARES ---

// Función para generar un ID de usuario amigable y único
function generateFriendlyId() {
    const adjectives = ["Ágil", "Azul", "Brillante", "Cálido", "Valiente", "Creativo", "Dinámico", "Elegante", "Fértil", "Gigante"];
    const animals = ["Águila", "Ballena", "Conejo", "Delfín", "Elefante", "Foca", "Gato", "Halcón", "Iguana", "Jaguar"];
    const number = Math.floor(Math.random() * 1000);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${adj}-${animal}-${number}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// --- MEJORA: Lógica de finalización más clara y robusta ---
function finalizeDrawing(date, allNumbers, ranges) {
    // 1. Filtra números que estén en los rangos válidos.
    const validNumbers = allNumbers.filter(n => 
        (n >= ranges.main.min && n <= ranges.main.max) || 
        (n >= ranges.special.min && n <= ranges.special.max)
    );
    const uniqueValidNumbers = Array.from(new Set(validNumbers)).slice(0, 6);
    
    if (uniqueValidNumbers.length < 6) {
        console.error("finalizeDrawing: No se encontraron 6 números válidos.", uniqueValidNumbers);
        return null;
    }
    
    let specialNum = null;
    let mainNumbers = [];

    // 2. Lógica mejorada para encontrar el número especial
    // Si los rangos no se solapan (como en Mega Millions), es más fácil.
    if (ranges.special.max < ranges.main.min) {
        // Encuentra el primer número que esté en el rango especial
        for (const num of uniqueValidNumbers) {
            if (validateNumber(num, ranges.special)) {
                specialNum = num;
                break;
            }
        }
        // Los demás son los principales
        mainNumbers = uniqueValidNumbers.filter(n => n !== specialNum);
    } else {
        // Para rangos que se solapan (Powerball), usa la lógica anterior
        specialNum = uniqueValidNumbers.slice(-1)[0];
        mainNumbers = uniqueValidNumbers.slice(0, 5);
    }
    
    // 3. Verificación final
    if (!specialNum || mainNumbers.length !== 5 || !validateNumber(specialNum, ranges.special) || !validateNumbers(mainNumbers, ranges.main)) {
        console.error("finalizeDrawing: Falló la validación final.", { specialNum, mainNumbers, ranges });
        return null;
    }
    
    return {
        mainNumbers: mainNumbers.sort((a, b) => a - b),
        special: specialNum,
        date: date,
        createdAt: new Date(),
        userId: userId,
    };
}

function processBlock(blockText, lottery) {
    // 1. Elimina texto basura y normaliza espacios en blanco
    const cleanBlock = blockText.replace(/(Power|Cash)\s*Play\s*\d*x?/gi, ' ')
                                     .replace(/(PB|CB|PowerBall|Cash Ball|MEGA|MEGAPLIER):?\s*/gi, ' ')
                                     .replace(/Top prize\s*\$?\d{1,3}(?:,\d{3})*(?:\s*Per\s*(?:day|week|month|year)\s*for\s*life)?/gi, ' ')
                                     .replace(/Ad ends in\s*\d+/gi, ' ')
                                     .replace(/\s+/g, ' ').trim();
    
    // 2. Busca la Fecha (patrón Mes Día, Año)
    const dateMatch = cleanBlock.match(/(\w+)\s*(\d{1,2}),\s*(\d{4})/i);
    if (!dateMatch) {
        console.error("processBlock: No se encontró una fecha válida en el bloque.", cleanBlock);
        return null;
    }
    
    const dateString = `${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`;
    const date = formatDate(dateString);
    if (!date) {
        console.error("processBlock: formatDate falló.", dateString);
        return null;
    }

    // 3. Busca los Números
    let allNumbers = [];
    const tokens = cleanBlock.split(' ').filter(t => t.length > 0);

    for (const token of tokens) {
        // Intenta parsear como número simple
        const num = parseInt(token);
        if (!isNaN(num) && num >= 1) {
            allNumbers.push(num);
            continue;
        }

        // Maneja números concatenados (ej: "10163261664")
        if (/^\d{7,}$/.test(token)) { 
             for (let i = 0; i < token.length; i += 2) {
                const subNum = parseInt(token.substring(i, i + 2));
                if (!isNaN(subNum) && subNum >= 1) {
                    allNumbers.push(subNum);
                }
            }
        }
    }
    
    // Usa la lógica principal para extraer el mejor 5 main + 1 special
    return finalizeDrawing(date, allNumbers, getLotteryRanges(lottery));
}

// --- FUNCIÓN DE ANÁLISIS (con depuración) ---
function parsePastedData(text, lottery) {
    console.log(`parsePastedData: Iniciando análisis para ${lottery}. Texto recibido:`, text);

    if (lottery === 'megamillions') {
        return parseMegaMillionsData(text);
    }
    
    // Para Powerball y Cash 4 Life, usamos la lógica anterior
    const rawLines = text.split('\n');
    const drawings = [];
    const numberRanges = getLotteryRanges(lottery);
    let currentBlock = '';

    for (const line of rawLines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) continue;
        
        const isNewDrawingStart = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/i.test(trimmedLine) || /,?\s*\w+\s*\d{1,2},\s*\d{4}/i.test(trimmedLine);
        
        if (isNewDrawingStart && currentBlock.length > 0) {
            const drawing = processBlock(currentBlock, numberRanges);
            console.log(`parsePastedData: Bloque procesado. Resultado:`, drawing);
            if (drawing) {
                drawings.push(drawing);
            } else {
                console.warn(`parsePastedData: No se pudo procesar un bloque. Se omitirá.`);
            }
            // Inicia un nuevo bloque con la línea actual
            currentBlock = trimmedLine + ' ';
        } else {
            currentBlock += trimmedLine + ' ';
        }
    }

    // Procesa el bloque final
    if (currentBlock.length > 0) {
        const drawing = processBlock(currentBlock, numberRanges);
        console.log(`parsePastedData: Último bloque procesado. Resultado:`, drawing);
        if (drawing) {
            drawings.push(drawing);
        } else {
            console.warn(`parsePastedData: No se pudo procesar el último bloque.`);
        }
    }

    console.log(`parsePastedData: Análisis completo para ${lottery}. Se encontraron ${drawings.length} sorteos.`);
    return drawings;
}

// --- NUEVA FUNCIÓN PARA MEGA MILLIONS (con depuración) ---
function parseMegaMillionsData(text) {
    console.log("parseMegaMillionsData: Iniciando análisis para Mega Millions.");
    const drawings = [];
    const numberRanges = { main: { min: 1, max: 70 }, special: { min: 1, max: 24 } };

    // 1. Encontrar todas las fechas en formato MM/DD/YYYY
    const dateRegex = /\b(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}\b/g;
    const dates = text.match(dateRegex);
    if (!dates) {
        console.error("parseMegaMillionsData: No se encontraron fechas válidas.", text);
        return [];
    }

    // 2. Encontrar todos los conjuntos de números (5 números + 1 Mega Ball)
    const numberSetRegex = /(?:\b\d{1,2}\b){5,6}/g;
    const numberSets = text.match(numberSetRegex);
    if (!dates || !numberSets || dates.length !== numberSets.length) {
        console.error("parseMegaMillionsData: El número de fechas no coincide con el número de conjuntos de números.", { dates, numberSets });
        return [];
    }

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dateStr = date.substring(0, 2) + date.substring(3, 5) + date.substring(6, 10); // Formato MM/DD/YYYY
        const formattedDate = formatDate(dateStr);
        if (!formattedDate) {
            console.warn(`parseMegaMillionsData: Fecha inválida encontrada, saltando: ${dateStr}`);
            continue;
        }

        // Buscar el conjunto de números que viene DESPUÉS de la fecha en el texto
        let numbersAfterDate = '';
        const dateIndex = text.indexOf(date);
        if (dateIndex !== -1) {
            const textAfterDate = text.substring(dateIndex + date.length);
            const firstNumberSet = textAfterDate.match(numberSetRegex);
            if (firstNumberSet) {
                numbersAfterDate = firstNumberSet[0];
            }
        }

        if (!numbersAfterDate) {
            console.warn(`parseMegaMillionsData: No se encontraron números después de la fecha ${dateStr}, saltando.`);
            continue;
        }

        // Extraer los 6 números del conjunto encontrado
        const nums = numbersAfterDate.match(/\d{1,2}/g);
        if (nums && nums.length >= 6) {
            const mainNumbers = nums.slice(0, 5).map(Number);
            const specialNum = Number(nums[5]);
            const drawing = finalizeDrawing(formattedDate, [ ...mainNumbers, specialNum ], numberRanges);
            if (drawing) {
                drawings.push(drawing);
            } else {
                console.error(`parseMegaMillionsData: finalizeDrawing falló para la fecha ${dateStr}`);
            }
        } else {
            console.error(`parseMegaMillionsData: No se encontraron 6 números válidos después de la fecha ${dateStr}.`);
        }
    }
    console.log(`parseMegaMillionsData: Análisis completo para Mega Millions. Se encontraron ${drawings.length} sorteos.`);
    return drawings;
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    initDomElements();
    setupEventListeners();
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        setLogLevel('silent');
        
        const userCredential = await signInAnonymously(auth);
        userId = userCredential.user.uid;

        let friendlyId = localStorage.getItem('friendlyUserId');
        if (!friendlyId) {
            friendlyId = generateFriendlyId();
            localStorage.setItem('friendlyUserId', friendlyId);
        }
        document.getElementById('userIdDisplay').textContent = friendlyId;

        setupRealtimeListeners();
    } catch (e) {
        console.error("Error initializing Firebase:", e);
        showMessage('Error al conectar con la base de datos. La aplicación funcionará en modo demo.', 'bg-red-500');
        document.getElementById('userIdDisplay').textContent = 'Modo Demo';
        hideLoadingSpinners();
        setupDemoMode();
    }
});

// --- CONFIGURACIÓN DE EVENT LISTENERS ---
function setupEventListeners() {
    document.querySelectorAll('.save-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const lottery = e.target.getAttribute('data-lottery');
            const section = document.getElementById(`${lottery}-section`);
            const dateInput = section.querySelector(`input[type="date"]`);
            const mainInputs = section.querySelectorAll(`input[data-type="main"]`);
            const specialInput = section.querySelector(`input[data-type="special"]`);
            const date = dateInput.value;
            const mainNumbers = Array.from(mainInputs).map(input => parseInt(input.value)).filter(n => !isNaN(n)).sort((a, b) => a - b);
            const specialNum = parseInt(specialInput.value);
            const numberRanges = getLotteryRanges(lottery);
            if (!date || mainNumbers.length !== 5 || isNaN(specialNum) || !validateNumbers(mainNumbers, numberRanges.main) || !validateNumber(specialNum, numberRanges.special)) {
                showMessage('Por favor, ingresa 5 números principales y el número especial válidos.', 'bg-red-500');
                return;
            }
            const collectionPath = getCollectionPath(lottery);
            const q = query(collection(db, collectionPath), where("date", "==", date));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                // --- MEJORA: Mensaje de error más específico ---
                showMessage(`Ya existe un sorteo guardado para la fecha: ${date}.`, 'bg-red-500');
                return;
            }
            try {
                await addDoc(collection(db, collectionPath), { mainNumbers: JSON.stringify(mainNumbers), special: specialNum, date: date, createdAt: new Date(), userId: userId });
                showMessage('Sorteo guardado correctamente.', 'bg-green-500');
                clearInputs(section);
            } catch (e) {
                console.error("Error al guardar el sorteo:", e);
                showMessage('Error al guardar el sorteo.', 'bg-red-500');
            }
        });
    });
    document.querySelectorAll('.process-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const lottery = e.target.getAttribute('data-lottery');
            const section = document.getElementById(`${lottery}-section`);
            const pastedText = section.querySelector('.paste-data-input').value;
            if (!pastedText.trim()) {
                showMessage('El campo de texto está vacío. Pega los datos de los sorteos.', 'bg-yellow-500');
                return;
            }
            showMessage('Procesando datos...', 'bg-blue-500');
            const newDrawings = parsePastedData(pastedText, lottery);
            if (newDrawings.length === 0) {
                showMessage('No se pudieron encontrar sorteos válidos en el texto. Revisa el formato.', 'bg-red-500');
                return;
            }
            const collectionPath = getCollectionPath(lottery);
            const existingDates = (await getDocs(collection(db, collectionPath))).docs.map(doc => doc.data().date);
            const drawingsToAdd = newDrawings.filter(d => !existingDates.includes(d.date));
            if (drawingsToAdd.length === 0) {
                showMessage('Todos los sorteos pegados ya existen en el historial.', 'bg-yellow-500');
                return;
            }
            const batch = writeBatch(db);
            drawingsToAdd.forEach(drawing => {
                if (Array.isArray(drawing.mainNumbers)) drawing.mainNumbers = JSON.stringify(drawing.mainNumbers);
                const newDocRef = doc(collection(db, collectionPath));
                batch.set(newDocRef, drawing);
            });
            try {
                await batch.commit();
                showMessage(`${drawingsToAdd.length} sorteos agregados correctamente.`, 'bg-green-500');
                section.querySelector('.paste-data-input').value = '';
            } catch (e) {
                console.error("Error al procesar los sorteos en lote:", e);
                showMessage('Error al procesar los sorteos.', 'bg-red-500');
            }
        });
    });
    document.querySelectorAll('.generate-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const lottery = e.target.getAttribute('data-lottery');
            const section = document.getElementById(`${lottery}-section`);
            const allHistoryData = getHistoryData(lottery);
            if (allHistoryData.length === 0) {
                showMessage('No hay datos en el historial para generar un sorteo.', 'bg-yellow-500');
                return;
            }
            section.querySelector('.analysis-results').style.display = 'none';
            const allMainNumbers = [];
            const allSpecials = [];
            const numberRanges = getLotteryRanges(lottery);
            allHistoryData.forEach(item => {
                const mainNums = typeof item.data.mainNumbers === 'string' ? JSON.parse(item.data.mainNumbers) : [];
                allMainNumbers.push(...mainNums);
                allSpecials.push(item.data.special);
            });
            const mainFreq = calculateFrequency(allMainNumbers, numberRanges.main.max);
            const specialFreq = calculateFrequency(allSpecials, numberRanges.special.max);
            const hotMain = getSortedNumbers(mainFreq, 'desc', 5);
            const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1)[0];
            const container = section.querySelector('.generated-numbers-container');
            container.innerHTML = '';
            displayCombination(container, 'Sorteo basado en análisis histórico (Frecuencia Pura):', hotMain, hotSpecial, lottery, false);
            const hybridMain = hotMain;
            const hybridSpecial = Math.floor(Math.random() * numberRanges.special.max) + 1;
            displayCombination(container, 'Sorteo basado en análisis híbrido (Hot Main + Random Special):', hybridMain, hybridSpecial, lottery, true);
        });
    });
    document.querySelectorAll('.analyze-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const lottery = e.target.getAttribute('data-lottery');
            const section = document.getElementById(`${lottery}-section`);
            const allHistoryData = getHistoryData(lottery);
            if (allHistoryData.length === 0) {
                showMessage('No hay datos en el historial para analizar.', 'bg-yellow-500');
                return;
            }
            section.querySelector('.generated-numbers-container').style.display = 'none';
            const allMainNumbers = [];
            const allSpecials = [];
            const allDrawings = [];
            const numberRanges = getLotteryRanges(lottery);
            allHistoryData.forEach(item => {
                const mainNums = typeof item.data.mainNumbers === 'string' ? JSON.parse(item.data.mainNumbers) : item.data.mainNumbers;
                allMainNumbers.push(...mainNums);
                allSpecials.push(item.data.special);
                allDrawings.push(mainNums);
            });
            const mainFreq = calculateFrequency(allMainNumbers, numberRanges.main.max);
            const specialFreq = calculateFrequency(allSpecials, numberRanges.special.max);
            const pairFreq = calculatePairFrequency(allDrawings);
            const hotMain = getSortedNumbers(mainFreq, 'desc', 10);
            const coldMain = getSortedNumbers(mainFreq, 'asc', 10);
            const hotPairs = getSortedPairs(pairFreq, 10);
            const analysisContainer = section.querySelector('.analysis-results');
            displayBalls(analysisContainer.querySelector('.hot-numbers'), hotMain, 'hot', 'main');
            displayBalls(analysisContainer.querySelector('.cold-numbers'), coldMain, 'cold', 'main');
            displayPairs(analysisContainer.querySelector('.hot-pairs'), hotPairs);
            const hotSpecial = getSortedNumbers(specialFreq, 'desc', 1);
            if (hotSpecial.length > 0) {
                const specialBallContainer = analysisContainer.querySelector('.hot-numbers');
                const specialBall = document.createElement('div');
                specialBall.textContent = hotSpecial[0];
                const specialClass = getSpecialBallClass(lottery);
                specialBall.className = `lottery-ball ${specialClass} mr-4`;
                specialBallContainer.prepend(specialBall);
            }
            analysisContainer.style.display = 'block';
        });
    });
    document.getElementById('postCommentBtn').addEventListener('click', async () => {
        const commentInput = document.getElementById('commentInput');
        const commentText = commentInput.value.trim();
        if (!commentText) {
            showMessage('El comentario no puede estar vacío.', 'bg-red-500');
            return;
        }
        try {
            await addDoc(collection(db, commentsCollectionPath), { text: commentText, userId: userId, createdAt: new Date() });
            showMessage('Comentario publicado.', 'bg-green-500');
            commentInput.value = '';
        } catch (e) {
            console.error("Error al publicar el comentario:", e);
            showMessage('Error al publicar el comentario.', 'bg-red-500');
        }
    });
    if (domElements.powerball.verMasBtn) domElements.powerball.verMasBtn.addEventListener('click', () => { showAll_pb = !showAll_pb; renderHistory('powerball'); });
    if (domElements.cash4life.verMasBtn) domElements.cash4life.verMasBtn.addEventListener('click', () => { showAll_c4l = !showAll_c4l; renderHistory('cash4life'); });
    if (domElements.megamillions.verMasBtn) domElements.megamillions.verMasBtn.addEventListener('click', () => { showAll_mm = !showAll_mm; renderHistory('megamillions'); });
}

// --- FUNCIONES DE INTERFAZ Y MANEJO DE DATOS ---
function initDomElements() {
    domElements.powerball = { historyList: document.querySelector('.history-list[data-lottery="powerball"]'), loadingSpinner: document.querySelector('.loading-history[data-lottery="powerball"]'), verMasBtn: document.getElementById('verMasBtn_pb'), verMasContainer: document.getElementById('verMasContainer_pb') };
    domElements.cash4life = { historyList: document.querySelector('.history-list[data-lottery="cash4life"]'), loadingSpinner: document.querySelector('.loading-history[data-lottery="cash4life"]'), verMasBtn: document.getElementById('verMasBtn_c4l'), verMasContainer: document.getElementById('verMasContainer_c4l') };
    domElements.megamillions = { historyList: document.querySelector('.history-list[data-lottery="megamillions"]'), loadingSpinner: document.querySelector('.loading-history[data-lottery="megamillions"]'), verMasBtn: document.getElementById('verMasBtn_mm'), verMasContainer: document.getElementById('verMasContainer_mm') };
    domElements.commentsList = document.getElementById('commentsList');
    domElements.loadingComments = document.getElementById('loadingComments');
    domElements.messageBox = document.getElementById('messageBox');
}
function getCollectionPath(lottery) {
    if (lottery === 'powerball') return powerballCollectionPath;
    if (lottery === 'cash4life') return cash4lifeCollectionPath;
    if (lottery === 'megamillions') return megamillionsCollectionPath;
    return null;
}
function getHistoryData(lottery) {
    if (lottery === 'powerball') return allHistoryData_pb;
    if (lottery === 'cash4life') return allHistoryData_c4l;
    if (lottery === 'megamillions') return allHistoryData_mm;
    return [];
}
function getLotteryRanges(lottery) {
    if (lottery === 'powerball') return { main: { min: 1, max: 69 }, special: { min: 1, max: 26 } };
    if (lottery === 'cash4life') return { main: { min: 1, max: 60 }, special: { min: 1, max: 4 } };
    if (lottery === 'megamillions') return { main: { min: 1, max: 70 }, special: { min: 1, max: 24 } };
    return null;
}
function validateNumber(num, range) { return num >= range.min && num <= range.max; }
function validateNumbers(nums, range) { return nums.every(num => validateNumber(num, range)); }
function clearInputs(section) {
    const mainInputs = section.querySelectorAll(`input[data-type="main"]`);
    const specialInput = section.querySelector(`input[data-type="special"]`);
    const dateInput = section.querySelector(`input[type="date"]`);
    mainInputs.forEach(input => input.value = '');
    specialInput.value = '';
    dateInput.value = '';
}
function setupRealtimeListeners() {
    onSnapshot(query(collection(db, powerballCollectionPath), orderBy("date", "desc")), (snapshot) => { allHistoryData_pb = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); renderHistory('powerball'); });
    onSnapshot(query(collection(db, cash4lifeCollectionPath), orderBy("date", "desc")), (snapshot) => { allHistoryData_c4l = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); renderHistory('cash4life'); });
    onSnapshot(query(collection(db, megamillionsCollectionPath), orderBy("date", "desc")), (snapshot) => { allHistoryData_mm = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); renderHistory('megamillions'); });
    onSnapshot(query(collection(db, commentsCollectionPath), orderBy("createdAt", "desc")), (snapshot) => { domElements.loadingComments.style.display = 'none'; renderComments(snapshot.docs); });
}
function setupDemoMode() {
    const demoPowerballData = [{ date: '2025-08-25', mainNumbers: JSON.stringify([1, 10, 25, 30, 45]), special: 12 }, { date: '2025-08-22', mainNumbers: JSON.stringify([5, 12, 28, 40, 55]), special: 20 }];
    const demoCash4LifeData = [{ date: '2025-08-25', mainNumbers: JSON.stringify([2, 5, 10, 15, 20]), special: 3 }, { date: '2025-08-22', mainNumbers: JSON.stringify([8, 12, 20, 35, 40]), special: 1 }];
    const demoMegaMillionsData = [{ date: '2025-08-25', mainNumbers: JSON.stringify([5, 10, 25, 35, 70]), special: 24 }, { date: '2025-08-22', mainNumbers: JSON.stringify([8, 12, 20, 35, 70]), special: 15 }];
    
    allHistoryData_pb = demoPowerballData.map(data => ({ id: `demo_${data.date}`, data }));
    allHistoryData_c4l = demoCash4LifeData.map(data => ({ id: `demo_${data.date}`, data }));
    allHistoryData_mm = demoMegaMillionsData.map(data => ({ id: `demo_${data.date}`, data }));
    
    renderHistory('powerball');
    renderHistory('cash4life');
    renderHistory('megamillions');
    
    document.querySelectorAll('.save-btn, .process-btn, #postCommentBtn').forEach(btn => { btn.disabled = true; btn.style.opacity = 0.5; btn.style.cursor = 'not-allowed'; });
    const commentsList = domElements.commentsList;
    domElements.loadingComments.style.display = 'none';
    commentsList.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-gray-300">Modo de demostración: Los datos y comentarios no se guardarán.</div>`;
}
function renderHistory(lottery) {
    const data = getHistoryData(lottery);
    const historyList = domElements[lottery].historyList;
    const loadingSpinner = domElements[lottery].loadingSpinner;
    const verMasContainer = domElements[lottery].verMasContainer;
    const showAll = lottery === 'powerball' ? showAll_pb : (lottery === 'cash4life' ? showAll_c4l : showAll_mm);
    
    loadingSpinner.style.display = 'none';
    historyList.innerHTML = '';
    
    // --- MEJORA: Siempre mostrar los últimos 5 ---
    const itemsToDisplay = data.slice(0, NUM_TO_DISPLAY);
    
    if (itemsToDisplay.length === 0) {
        historyList.innerHTML = `<p class="text-gray-400">Aún no hay sorteos guardados.</p>`;
        verMasContainer.style.display = 'none';
        return;
    }
    
    itemsToDisplay.forEach(item => {
        const drawingDate = item.data.date;
        const mainNumbers = typeof item.data.mainNumbers === 'string' ? JSON.parse(item.data.mainNumbers) : item.data.mainNumbers;
        const specialNum = item.data.special;
        const entryDiv = document.createElement('div');
        entryDiv.className = 'flex flex-wrap items-center gap-2 p-4 bg-gray-700 rounded-lg shadow-md';
        entryDiv.innerHTML = `<span class="text-gray-400 text-sm font-semibold flex-shrink-0">${drawingDate}</span><div class="flex flex-wrap gap-2 ml-auto">${mainNumbers.map(num => `<div class="lottery-ball">${num}</div>`).join('')}<div class="lottery-ball ${getSpecialBallClass(lottery)}">${specialNum}</div></div>`;
        if (item.data.userId && item.data.userId === userId) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 112 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>`;
            deleteBtn.className = 'ml-4 flex-shrink-0';
            deleteBtn.title = 'Eliminar este sorteo';
            deleteBtn.addEventListener('click', async () => { if (window.confirm('¿Estás seguro de que quieres eliminar este sorteo?')) { await deleteDoc(doc(db, getCollectionPath(lottery), item.id)); showMessage('Sorteo eliminado.', 'bg-yellow-500'); renderHistory(lottery); } });
            entryDiv.appendChild(deleteBtn);
        }
        historyList.appendChild(entryDiv);
    });
    
    // --- MEJORA: Mostrar botón "Ver más" solo si hay más de 5 ---
    if (data.length > NUM_TO_DISPLAY) {
        verMasContainer.style.display = 'block';
        domElements[lottery].verMasBtn.textContent = 'Ver más historial';
    } else {
        verMasContainer.style.display = 'none';
    }
}
function renderComments(docs) {
    const commentsList = domElements.commentsList;
    commentsList.innerHTML = '';
    if (docs.length === 0) {
        commentsList.innerHTML = `<p class="text-gray-400 text-center">No hay comentarios aún. ¡Sé el primero!</p>`;
        return;
    }
    docs.forEach(doc => {
        const comment = doc.data();
        const commentDiv = document.createElement('div');
        commentDiv.className = 'p-4 bg-gray-800 rounded-lg shadow-md';
        commentDiv.innerHTML = `<div class="flex justify-between items-center mb-2"><span class="text-sm text-gray-400 font-bold">${comment.userId.substring(0, 8)}...</span><span class="text-xs text-gray-500">${new Date(comment.createdAt.seconds * 1000).toLocaleDateString()}</span></div><p class="text-gray-300 break-words">${comment.text}</p>`;
        commentsList.appendChild(commentDiv);
    });
}
function calculateFrequency(numbers, max) { const freq = {}; for (let i = 1; i <= max; i++) freq[i] = 0; numbers.forEach(num => { freq[num] = (freq[num] || 0) + 1; }); return freq; }
function calculatePairFrequency(drawings) { const pairFreq = {}; drawings.forEach(drawing => { const sortedNums = drawing.sort((a, b) => a - b); for (let i = 0; i < sortedNums.length - 1; i++) for (let j = i + 1; j < sortedNums.length; j++) { const pair = `${sortedNums[i]}-${sortedNums[j]}`; pairFreq[pair] = (pairFreq[pair] || 0) + 1; } }); return pairFreq; }
function getSortedNumbers(freqMap, order, limit) { return Object.entries(freqMap).sort(([, a], [, b]) => order === 'desc' ? b - a : a - b).slice(0, limit).map(([num]) => parseInt(num)); }
function getSortedPairs(pairFreq, limit) { return Object.entries(pairFreq).sort(([, a], [, b]) => b - a).slice(0, limit).map(([pair]) => pair.split('-').map(Number)); }
function displayBalls(container, numbers, type, ballType) { container.innerHTML = ''; numbers.forEach(num => { const ball = document.createElement('div'); ball.textContent = num; let ballClass = ''; if (ballType === 'main') ballClass = type === 'hot' ? 'hot-number' : 'cold-number'; ball.className = `lottery-ball ${ballClass}`; container.appendChild(ball); }); }
function displayPairs(container, pairs) { container.innerHTML = ''; pairs.forEach(pair => { const pairBox = document.createElement('div'); pairBox.className = 'pair-box flex items-center gap-2'; pairBox.innerHTML = `<div class="lottery-ball lottery-ball-sm">${pair[0]}</div><div class="lottery-ball lottery-ball-sm">${pair[1]}</div>`; container.appendChild(pairBox); }); }
function displayCombination(container, title, mainNumbers, specialNumber, lottery, isRandom) { const drawingDiv = document.createElement('div'); drawingDiv.className = 'p-4 bg-gray-700 rounded-lg shadow-md'; const specialClass = getSpecialBallClass(lottery);
    drawingDiv.innerHTML = `<h4 class="text-lg font-bold mb-2">${title}</h4><div class="flex flex-wrap items-center justify-center gap-2">${mainNumbers.map(num => `<div class="lottery-ball">${num}</div>`).join('')}<div class="lottery-ball ${specialClass}">${specialNumber}</div></div>`;
    container.appendChild(drawingDiv);
    container.style.display = 'block';
}
function showMessage(message, className) { const msgBox = domElements.messageBox; msgBox.textContent = message; msgBox.className = `mt-4 p-4 text-center rounded-lg transition-colors duration-300 ${className}`; msgBox.style.display = 'block'; setTimeout(() => { msgBox.style.display = 'none'; }, 5000); }
function hideLoadingSpinners() { domElements.powerball.loadingSpinner.style.display = 'none'; domElements.cash4life.loadingSpinner.style.display = 'none'; domElements.megamillions.loadingSpinner.style.display = 'none'; domElements.loadingComments.style.display = 'none'; }
function getSpecialBallClass(lottery) {
    if (lottery === 'powerball') return 'special-ball';
    if (lottery === 'cash4life') return 'cash-ball';
    if (lottery === 'megamillions') return 'mega-ball';
    return '';
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, orderBy, writeBatch, deleteDoc, doc, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
let currentLottery = 'powerball';
let totalPredictions = 0;

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

// --- FUNCIONES DE INTERFAZ ---

function initDomElements() {
    domElements.powerball = { 
        historyList: document.querySelector('.history-list[data-lottery="powerball"]'), 
        loadingSpinner: document.querySelector('.loading-history[data-lottery="powerball"]'), 
        verMasBtn: document.getElementById('verMasBtn_pb'), 
        verMasContainer: document.getElementById('verMasContainer_pb') 
    };
    domElements.cash4life = { 
        historyList: document.querySelector('.history-list[data-lottery="cash4life"]'), 
        loadingSpinner: document.querySelector('.loading-history[data-lottery="cash4life"]'), 
        verMasBtn: document.getElementById('verMasBtn_c4l'), 
        verMasContainer: document.getElementById('verMasContainer_c4l') 
    };
    domElements.megamillions = { 
        historyList: document.querySelector('.history-list[data-lottery="megamillions"]'), 
        loadingSpinner: document.querySelector('.loading-history[data-lottery="megamillions"]'), 
        verMasBtn: document.getElementById('verMasBtn_mm'), 
        verMasContainer: document.getElementById('verMasContainer_mm') 
    };
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
    if (lottery === 'megamillions') return { main: { min: 1, max: 70 }, special: { min: 1, max: 25 } };
    return null;
}

function validateNumber(num, range) { 
    return num >= range.min && num <= range.max; 
}

function validateNumbers(nums, range) { 
    return nums.every(num => validateNumber(num, range)); 
}

function clearInputs(section) {
    const mainInputs = section.querySelectorAll(`input[data-type="main"]`);
    const specialInput = section.querySelector(`input[data-type="special"]`);
    const dateInput = section.querySelector(`input[type="date"]`);
    mainInputs.forEach(input => input.value = '');
    specialInput.value = '';
    dateInput.value = '';
}

function showMessage(message, className) { 
    const msgBox = domElements.messageBox; 
    msgBox.textContent = message; 
    msgBox.className = `mt-4 p-4 text-center rounded-lg transition-all duration-300 ${className}`; 
    msgBox.style.display = 'block'; 
    setTimeout(() => { 
        msgBox.style.display = 'none'; 
    }, 5000); 
}

function hideLoadingSpinners() { 
    domElements.powerball.loadingSpinner.style.display = 'none'; 
    domElements.cash4life.loadingSpinner.style.display = 'none'; 
    domElements.megamillions.loadingSpinner.style.display = 'none'; 
    domElements.loadingComments.style.display = 'none'; 
}

function getSpecialBallClass(lottery) { 
    if (lottery === 'powerball') return 'special-ball'; 
    if (lottery === 'cash4life') return 'cash-ball'; 
    if (lottery === 'megamillions') return 'mega-ball'; 
    return ''; 
}

function displayBalls(container, numbers, type, ballType) { 
    container.innerHTML = ''; 
    numbers.forEach(num => { 
        const ball = document.createElement('div'); 
        ball.textContent = num; 
        let ballClass = ''; 
        if (ballType === 'main') { 
            ballClass = type === 'hot' ? 'hot-number' : 'cold-number'; 
        } 
        ball.className = `lottery-ball ${ballClass}`; 
        container.appendChild(ball); 
    }); 
}

function displayPairs(container, pairs) { 
    container.innerHTML = ''; 
    pairs.forEach(pair => { 
        const pairBox = document.createElement('div'); 
        pairBox.className = 'pair-box flex items-center gap-2'; 
        pairBox.innerHTML = `
            <div class="lottery-ball lottery-ball-sm">${pair[0]}</div>
            <div class="lottery-ball lottery-ball-sm">${pair[1]}</div>
        `; 
        container.appendChild(pairBox); 
    }); 
}

function displayCombination(container, title, mainNumbers, specialNumber, lottery, isRandom) { 
    const drawingDiv = document.createElement('div'); 
    drawingDiv.className = 'generated-combination p-4 rounded-lg shadow-md mb-3'; 
    const specialClass = getSpecialBallClass(lottery); 
    drawingDiv.innerHTML = `
        <h4 class="text-md font-semibold mb-2 text-gray-300">
            <i class="fas fa-dice mr-1"></i>${title}
        </h4>
        <div class="flex flex-wrap items-center justify-center gap-2">
            ${mainNumbers.map(num => `<div class="lottery-ball">${num}</div>`).join('')}
            <div class="lottery-ball ${specialClass}">${specialNumber}</div>
        </div>
    `; 
    container.appendChild(drawingDiv); 
    container.style.display = 'block'; 
}

function renderHistory(lottery) {
    const data = getHistoryData(lottery);
    const historyList = domElements[lottery].historyList;
    const loadingSpinner = domElements[lottery].loadingSpinner;
    const verMasContainer = domElements[lottery].verMasContainer;
    const showAll = lottery === 'powerball' ? showAll_pb : (lottery === 'cash4life' ? showAll_c4l : showAll_mm);
    
    loadingSpinner.style.display = 'none';
    historyList.innerHTML = '';
    
    const itemsToDisplay = showAll ? data : data.slice(0, NUM_TO_DISPLAY);
    
    if (itemsToDisplay.length === 0) {
        historyList.innerHTML = `<p class="text-gray-400 text-center py-4">Aún no hay sorteos guardados.</p>`;
        verMasContainer.style.display = 'none';
        return;
    }
    
    itemsToDisplay.forEach(item => {
        const drawingDate = item.data.date;
        const mainNumbers = typeof item.data.mainNumbers === 'string' ? JSON.parse(item.data.mainNumbers) : item.data.mainNumbers;
        const specialNum = item.data.special;
        const entryDiv = document.createElement('div');
        entryDiv.className = 'history-item flex flex-wrap items-center gap-2 p-3 bg-gray-700 rounded-lg shadow-sm hover:bg-gray-650 transition-all duration-200';
        entryDiv.innerHTML = `
            <span class="text-gray-400 text-xs font-semibold flex-shrink-0">${drawingDate}</span>
            <div class="flex flex-wrap gap-2 ml-auto">
                ${mainNumbers.map(num => `<div class="lottery-ball">${num}</div>`).join('')}
                <div class="lottery-ball ${getSpecialBallClass(lottery)}">${specialNum}</div>
            </div>
        `;
        
        if (item.data.userId && item.data.userId === userId) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 hover:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                </svg>
            `;
            deleteBtn.className = 'ml-2 flex-shrink-0 p-1 hover:bg-gray-600 rounded transition-colors duration-200';
            deleteBtn.title = 'Eliminar este sorteo';
            deleteBtn.addEventListener('click', async () => { 
                if (window.confirm('¿Estás seguro de que quieres eliminar este sorteo?')) { 
                    await deleteDoc(doc(db, getCollectionPath(lottery), item.id)); 
                    showMessage('Sorteo eliminado.', 'bg-yellow-500'); 
                    renderHistory(lottery); 
                    updateStatistics();
                } 
            });
            entryDiv.appendChild(deleteBtn);
        }
        
        historyList.appendChild(entryDiv);
    });
    
    if (data.length > NUM_TO_DISPLAY) {
        verMasContainer.style.display = 'block';
        domElements[lottery].verMasBtn.innerHTML = showAll 
            ? '<i class="fas fa-chevron-up mr-1"></i>Ver menos' 
            : '<i class="fas fa-chevron-down mr-1"></i>Ver más';
    } else {
        verMasContainer.style.display = 'none';
    }
}

function renderComments(docs) {
    const commentsList = domElements.commentsList;
    commentsList.innerHTML = '';
    
    if (docs.length === 0) {
        commentsList.innerHTML = `<p class="text-gray-400 text-center py-4">No hay comentarios aún. ¡Sé el primero!</p>`;
        return;
    }
    
    docs.forEach(doc => {
        const comment = doc.data();
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item p-4 bg-gray-800 rounded-lg shadow-sm';
        commentDiv.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-400 font-medium">${comment.userId.substring(0, 8)}...</span>
                <span class="text-xs text-gray-500">${new Date(comment.createdAt.seconds * 1000).toLocaleDateString()}</span>
            </div>
            <p class="text-gray-300 break-words">${comment.text}</p>
        `;
        commentsList.appendChild(commentDiv);
    });
}

function updateStatistics() {
    const totalDrawings = allHistoryData_pb.length + allHistoryData_c4l.length + allHistoryData_mm.length;
    document.getElementById('totalDrawings').textContent = totalDrawings;
    document.getElementById('totalPredictions').textContent = totalPredictions;
    
    // Calcular precisión promedio (simulada)
    const avgAccuracy = totalDrawings > 0 ? Math.min(95, 60 + (totalDrawings * 0.5)) : 0;
    document.getElementById('avgAccuracy').textContent = `${avgAccuracy.toFixed(1)}%`;
}

// --- CONFIGURACIÓN DE TABS ---
function setupTabs() {
    const tabs = document.querySelectorAll('.lottery-tab');
    const sections = document.querySelectorAll('.lottery-section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const lottery = tab.getAttribute('data-lottery');
            
            // Actualizar tab activo
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Mostrar sección correspondiente
            sections.forEach(section => {
                section.classList.add('hidden');
            });
            
            const targetSection = document.getElementById(`${lottery}-section`);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                currentLottery = lottery;
            }
        });
    });
    
    // Activar primera tab por defecto
    tabs[0].click();
}

// --- CONFIGURACIÓN DE EVENT LISTENERS ---
function setupEventListeners() {
    // Save buttons
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
            
            try {
                // Verificar si ya existe un sorteo para esta fecha
                const collectionPath = getCollectionPath(lottery);
                const q = query(collection(db, collectionPath), where("date", "==", date));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    showMessage(`Ya existe un sorteo guardado para la fecha: ${date}.`, 'bg-red-500');
                    return;
                }
                
                await addDoc(collection(db, collectionPath), { 
                    mainNumbers: JSON.stringify(mainNumbers), 
                    special: specialNum, 
                    date: date, 
                    createdAt: new Date(), 
                    userId: userId 
                });
                showMessage('Sorteo guardado correctamente.', 'bg-green-500');
                clearInputs(section);
                updateStatistics();
            } catch (e) {
                console.error("Error al guardar el sorteo:", e);
                showMessage('Error al guardar el sorteo.', 'bg-red-500');
            }
        });
    });
    
    // Generate buttons
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
            const numberRanges = getLotteryRanges(lottery);
            
            // Generar múltiples combinaciones con diferentes estrategias
            const combinations = window.lotteryAlgorithms.generateMultipleCombinations(
                allHistoryData, 
                numberRanges, 
                lottery
            );
            
            const container = section.querySelector('.generated-numbers-container');
            container.innerHTML = '';
            
            // Mostrar cada combinación con su estrategia
            combinations.forEach(combination => {
                let title = '';
                
                switch(combination.method) {
                    case 'advanced':
                        title = 'Análisis Avanzado (Patrones Estadísticos)';
                        break;
                    case 'cold':
                        title = 'Estrategia de Números Fríos';
                        break;
                    case 'mixed':
                        title = 'Estrategia Mixta (Calientes y Fríos)';
                        break;
                    case 'repeat-pattern':
                        title = 'Basado en Patrones de Repetición';
                        break;
                    case 'random-optimized':
                        title = 'Aleatorio Optimizado (Basado en Patrones)';
                        break;
                    default:
                        title = 'Análisis Básico';
                }
                
                displayCombination(container, title, combination.mainNumbers, combination.special, lottery, false);
                
                // Mostrar información adicional sobre patrones si está disponible
                if (combination.patterns) {
                    const patternInfo = document.createElement('div');
                    patternInfo.className = 'text-xs text-gray-400 mt-2';
                    patternInfo.innerHTML = `
                        Patrones utilizados: 
                        Pares/Impares: ${combination.patterns.oddEven}, 
                        Consecutivos: ${combination.patterns.consecutive}, 
                        Rango de suma: ${combination.patterns.sumRange}
                    `;
                    container.lastElementChild.appendChild(patternInfo);
                }
            });
            
            container.style.display = 'block';
            totalPredictions += combinations.length;
            updateStatistics();
        });
    });
    
    // Analyze buttons
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
            
            const mainFreq = window.lotteryAlgorithms.calculateFrequency(allMainNumbers, numberRanges.main.max);
            const specialFreq = window.lotteryAlgorithms.calculateFrequency(allSpecials, numberRanges.special.max);
            const pairFreq = window.lotteryAlgorithms.calculatePairFrequency(allDrawings);
            const hotMain = window.lotteryAlgorithms.getSortedNumbers(mainFreq, 'desc', 10);
            const coldMain = window.lotteryAlgorithms.getSortedNumbers(mainFreq, 'asc', 10);
            const hotPairs = window.lotteryAlgorithms.getSortedPairs(pairFreq, 10);
            const analysisContainer = section.querySelector('.analysis-results');
            displayBalls(analysisContainer.querySelector('.hot-numbers'), hotMain, 'hot', 'main');
            displayBalls(analysisContainer.querySelector('.cold-numbers'), coldMain, 'cold', 'main');
            displayPairs(analysisContainer.querySelector('.hot-pairs'), hotPairs);
            const hotSpecial = window.lotteryAlgorithms.getSortedNumbers(specialFreq, 'desc', 1);
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
    
    // Comment button
    document.getElementById('postCommentBtn').addEventListener('click', async () => {
        const commentInput = document.getElementById('commentInput');
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            showMessage('El comentario no puede estar vacío.', 'bg-red-500');
            return;
        }
        
        try {
            await addDoc(collection(db, commentsCollectionPath), { 
                text: commentText, 
                userId: userId, 
                createdAt: new Date() 
            });
            showMessage('Comentario publicado.', 'bg-green-500');
            commentInput.value = '';
        } catch (e) {
            console.error("Error al publicar el comentario:", e);
            showMessage('Error al publicar el comentario.', 'bg-red-500');
        }
    });
    
    // Ver más buttons
    if (domElements.powerball.verMasBtn) domElements.powerball.verMasBtn.addEventListener('click', () => { showAll_pb = !showAll_pb; renderHistory('powerball'); });
    if (domElements.cash4life.verMasBtn) domElements.cash4life.verMasBtn.addEventListener('click', () => { showAll_c4l = !showAll_c4l; renderHistory('cash4life'); });
    if (domElements.megamillions.verMasBtn) domElements.megamillions.verMasBtn.addEventListener('click', () => { showAll_mm = !showAll_mm; renderHistory('megamillions'); });
}

function setupRealtimeListeners() {
    onSnapshot(query(collection(db, powerballCollectionPath), orderBy("date", "desc")), (snapshot) => { 
        allHistoryData_pb = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); 
        renderHistory('powerball'); 
        updateStatistics();
    });
    
    onSnapshot(query(collection(db, cash4lifeCollectionPath), orderBy("date", "desc")), (snapshot) => { 
        allHistoryData_c4l = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); 
        renderHistory('cash4life'); 
        updateStatistics();
    });
    
    onSnapshot(query(collection(db, megamillionsCollectionPath), orderBy("date", "desc")), (snapshot) => { 
        allHistoryData_mm = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })); 
        renderHistory('megamillions'); 
        updateStatistics();
    });
    
    onSnapshot(query(collection(db, commentsCollectionPath), orderBy("createdAt", "desc")), (snapshot) => { 
        domElements.loadingComments.style.display = 'none'; 
        renderComments(snapshot.docs); 
    });
}

function setupDemoMode() {
    const demoPowerballData = [
        { date: '2024-01-15', mainNumbers: JSON.stringify([5, 12, 23, 35, 48]), special: 16 }, 
        { date: '2024-01-10', mainNumbers: JSON.stringify([8, 19, 27, 34, 52]), special: 21 }
    ];
    const demoCash4LifeData = [
        { date: '2024-01-15', mainNumbers: JSON.stringify([3, 7, 15, 28, 42]), special: 2 }, 
        { date: '2024-01-10', mainNumbers: JSON.stringify([9, 14, 22, 31, 45]), special: 1 }
    ];
    const demoMegaMillionsData = [
        { date: '2024-01-15', mainNumbers: JSON.stringify([4, 11, 24, 33, 58]), special: 18 }, 
        { date: '2024-01-10', mainNumbers: JSON.stringify([7, 16, 25, 38, 61]), special: 22 }
    ];
    
    allHistoryData_pb = demoPowerballData.map(data => ({ id: `demo_${data.date}`, data }));
    allHistoryData_c4l = demoCash4LifeData.map(data => ({ id: `demo_${data.date}`, data }));
    allHistoryData_mm = demoMegaMillionsData.map(data => ({ id: `demo_${data.date}`, data }));
    
    renderHistory('powerball');
    renderHistory('cash4life');
    renderHistory('megamillions');
    
    document.querySelectorAll('.save-btn, #postCommentBtn').forEach(btn => { 
        btn.disabled = true; 
        btn.style.opacity = 0.5; 
        btn.style.cursor = 'not-allowed'; 
    });
    
    const commentsList = domElements.commentsList;
    domElements.loadingComments.style.display = 'none';
    commentsList.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-gray-300">Modo de demostración: Los datos y comentarios no se guardarán.</div>`;
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    initDomElements();
    setupEventListeners();
    setupTabs();
    
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
        updateStatistics();
    } catch (e) {
        console.error("Error initializing Firebase:", e);
        showMessage('Error al conectar con la base de datos. La aplicación funcionará en modo demo.', 'bg-red-500');
        document.getElementById('userIdDisplay').textContent = 'Modo Demo';
        hideLoadingSpinners();
        setupDemoMode();
    }
});
// --- CONFIGURACIÓN FIREBASE CLÁSICA (CDN) ---
const firebaseConfig = {
    apiKey: "AIzaSyDjq4rqhnuYt7I3PJoe_OuuZQo1G8L245I",
    authDomain: "trivial-atm.firebaseapp.com",
    projectId: "trivial-atm",
    storageBucket: "trivial-atm.firebasestorage.app",
    messagingSenderId: "461166180046",
    appId: "1:461166180046:web:723989976e7084ae1f429f"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- REGISTRO DEL SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            console.log('ServiceWorker registrado con éxito');
        }).catch((err) => {
            console.log('Fallo al registrar el ServiceWorker: ', err);
        });
    });
}

// --- DATOS Y CONFIGURACIÓN ---
const PLANTILLA_ATLETI = [
    "EQUIPO KOKE", "EQUIPO OBLAK", "EQUIPO GRIEZMANN", "EQUIPO GIMÉNEZ", 
    "EQUIPO JULIÁN ÁLVAREZ", "EQUIPO PUBILL", "EQUIPO LLORENTE", 
    "EQUIPO BARRIOS", "EQUIPO GIULIANO", "EQUIPO SØRLOTH", "EQUIPO CHOLO"
];

const TEAM_COLORS_BASE = [
    '#CB3524', '#272E61', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', 
    '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#eab308'
];

function hexToPastel(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
}

const GAME_QUESTIONS = [];
for (let i = 3; i <= 48; i++) { GAME_QUESTIONS.push({ id: i, type: 'pais', img: `assets/TRIVIAL DE EQUIPOS Y PAÍSES ATM F7_${i.toString().padStart(3, '0')}.png` }); }
for (let i = 49; i <= 94; i++) { GAME_QUESTIONS.push({ id: i, type: 'equipo', img: `assets/TRIVIAL DE EQUIPOS Y PAÍSES ATM F7_${i.toString().padStart(3, '0')}.png` }); }

let players = [];
let groups = [];
let currentTurnIndex = 0;
let remainingQuestions = [...GAME_QUESTIONS];
let currentQuestion = null;

const setupScreen = document.getElementById('setup-screen');
const groupRevealScreen = document.getElementById('group-reveal-screen');
const gameScreen = document.getElementById('game-screen');
const podiumScreen = document.getElementById('podium-screen');

const playerNameInput = document.getElementById('player-name');
const addPlayerBtn = document.getElementById('add-player-btn');
const playersList = document.getElementById('players-list');
const numGroupsInput = document.getElementById('num-groups');
const triggerRevealBtn = document.getElementById('trigger-reveal-btn');
const revealContainer = document.getElementById('reveal-container');
const startGameBtn = document.getElementById('start-game-btn');

const currentTeamNameEl = document.getElementById('current-team-name');
const currentTurnScoreEl = document.getElementById('current-turn-score');
const questionImageEl = document.getElementById('question-image');
const scoreBtn = document.getElementById('score-btn');
const nextTurnBtn = document.getElementById('next-turn-btn');
const endGameBtn = document.getElementById('end-game-btn');
const scoreListLeft = document.getElementById('score-list-left');
const scoreListRight = document.getElementById('score-list-right');

const scoreModal = document.getElementById('score-modal');
const scoringFields = document.getElementById('scoring-fields');
const saveScoreBtn = document.getElementById('save-score-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

window.addEventListener('beforeunload', (e) => {
    if (groups.length > 0 && !podiumScreen.classList.contains('active')) {
        e.preventDefault(); e.returnValue = 'Partida en curso.';
    }
});

// --- LÓGICA DE JUGADORES ---
addPlayerBtn.addEventListener('click', () => {
    const inputVal = playerNameInput.value.trim();
    if (inputVal) {
        const newPlayers = inputVal.split(',').map(n => n.trim()).filter(n => n !== '');
        players.push(...newPlayers);
        updatePlayersList();
        playerNameInput.value = '';
    }
});
playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPlayerBtn.click(); });

function updatePlayersList() {
    playersList.innerHTML = players.map((p, index) => `<li><span>${p}</span><button class="delete-btn" onclick="removePlayer(${index})">✕</button></li>`).join('');
}

window.removePlayer = function(index) { 
    players.splice(index, 1); 
    updatePlayersList(); 
};

// --- CREAR GRUPOS ---
triggerRevealBtn.addEventListener('click', () => {
    const numGroups = parseInt(numGroupsInput.value);
    if (players.length < numGroups) { alert('Añade al menos tantos jugadores como grupos.'); return; }
    createGroups(numGroups);
    showGroupRevealScreen();
});

function createGroups(numGroups) {
    let shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    let shuffledNames = [...PLANTILLA_ATLETI].sort(() => Math.random() - 0.5);

    groups = Array.from({ length: numGroups }, (_, i) => {
        let baseColor = TEAM_COLORS_BASE[i % TEAM_COLORS_BASE.length];
        return {
            id: i, name: shuffledNames[i], members: [], score: 0,
            color: baseColor, bgColor: hexToPastel(baseColor)
        };
    });

    shuffledPlayers.forEach((player, index) => { groups[index % numGroups].members.push(player); });
}

function showGroupRevealScreen() {
    setupScreen.classList.remove('active');
    groupRevealScreen.classList.add('active');
    revealContainer.innerHTML = '';

    groups.forEach((group, index) => {
        const membersList = group.members.map(m => `<li>${m}</li>`).join('');
        const card = document.createElement('div');
        card.className = 'reveal-card';
        card.style.animationDelay = `${index * 0.2}s`;
        card.style.borderTopColor = group.color;
        card.style.backgroundColor = group.bgColor;
        card.innerHTML = `<h3 style="color: ${group.color};">${group.name}</h3><ul>${membersList}</ul>`;
        revealContainer.appendChild(card);
    });
}

startGameBtn.addEventListener('click', () => {
    groupRevealScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    if(groups.length > 6 && window.innerWidth >= 768) {
        gameScreen.classList.add('use-both-sidebars');
    }
    
    updateSidebarScores(); 
    startTurn();
});

// --- LÓGICA DE TURNOS ---
function updateSidebarScores() {
    scoreListLeft.innerHTML = '';
    scoreListRight.innerHTML = '';
    const currentGroupId = groups[currentTurnIndex].id;
    const allInLeft = groups.length <= 6 || window.innerWidth < 768;

    groups.forEach((group, index) => {
        const isActive = group.id === currentGroupId;
        const cardHtml = `
            <div class="score-card-mini ${isActive ? 'active-turn' : ''}" 
                 style="border-left-color: ${group.color}; background-color: ${group.bgColor};">
                <span class="team-name-mini" style="color: ${group.color};">${group.name}</span>
                <span class="team-score-mini">${group.score} pts</span>
            </div>
        `;
        if (allInLeft) { scoreListLeft.innerHTML += cardHtml; } 
        else {
            if (index < Math.ceil(groups.length / 2)) { scoreListLeft.innerHTML += cardHtml; } 
            else { scoreListRight.innerHTML += cardHtml; }
        }
    });
}

function startTurn() {
    scoreBtn.classList.remove('hidden');
    nextTurnBtn.classList.add('hidden');
    
    const currentGroup = groups[currentTurnIndex];
    currentTeamNameEl.innerText = `${currentGroup.name}`;
    currentTeamNameEl.style.color = currentGroup.color; 
    currentTurnScoreEl.innerText = `(Acumulado: ${currentGroup.score} Puntos)`;
    currentTurnScoreEl.style.color = currentGroup.color;

    updateSidebarScores();

    if (remainingQuestions.length === 0) { alert('¡Se han acabado las preguntas!'); endGame(); return; }

    const qIndex = Math.floor(Math.random() * remainingQuestions.length);
    currentQuestion = remainingQuestions[qIndex];
    remainingQuestions.splice(qIndex, 1);

    questionImageEl.src = currentQuestion.img;
    questionImageEl.alt = "Cargando imagen...";
}

// --- MODAL Y PUNTUACIÓN ---
scoreBtn.addEventListener('click', () => {
    scoreModal.classList.add('active');
    scoringFields.innerHTML = ''; 
    let fields = currentQuestion.type === 'pais' 
        ? ['Nombre del País', 'Capital', 'Equipo', 'Jugador del País']
        : ['Nombre del Equipo', 'Jugador', 'País del Equipo', 'Liga'];

    fields.forEach(field => {
        scoringFields.innerHTML += `
            <div class="score-row">
                <label>${field}</label>
                <select class="score-select"><option value="0">0</option><option value="1">1</option></select>
            </div>
        `;
    });
});

closeModalBtn.addEventListener('click', () => scoreModal.classList.remove('active'));

saveScoreBtn.addEventListener('click', () => {
    const selects = document.querySelectorAll('.score-select');
    let turnPoints = 0;
    selects.forEach(select => turnPoints += parseInt(select.value));

    groups[currentTurnIndex].score += turnPoints;
    currentTurnScoreEl.innerText = `(Acumulado: ${groups[currentTurnIndex].score} Puntos)`;
    updateSidebarScores(); 
    
    scoreModal.classList.remove('active');
    scoreBtn.classList.add('hidden');
    nextTurnBtn.classList.remove('hidden');
});

nextTurnBtn.addEventListener('click', () => {
    currentTurnIndex = (currentTurnIndex + 1) % groups.length;
    startTurn();
});

endGameBtn.addEventListener('click', () => {
    if (confirm('¿Finalizar partida y ver pódium?')) endGame();
});

// --- PÓDIUM Y FIREBASE ---
function endGame() {
    gameScreen.classList.remove('active');
    podiumScreen.classList.add('active');
    
    let sortedGroups = [...groups].sort((a, b) => b.score - a.score);
    
    function setPodiumSpot(spotId, group) {
        if(group) {
            document.getElementById(`${spotId}-name`).innerText = group.name;
            document.getElementById(`${spotId}-score`).innerText = `${group.score} pts`;
            
            const badgesHtml = group.members.map(m => `<span class="player-badge ${spotId}-badge">${m}</span>`).join('');
            document.getElementById(`${spotId}-members`).innerHTML = badgesHtml;
        } else {
            document.getElementById(`spot-${spotId}`).style.display = 'none';
        }
    }

    setPodiumSpot('gold', sortedGroups[0]);
    setPodiumSpot('silver', sortedGroups[1]);
    setPodiumSpot('bronze', sortedGroups[2]);

    // Confeti
    var duration = 3 * 1000;
    var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#CB3524', '#272E61', '#FFD700'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#CB3524', '#272E61', '#FFD700'] });
        if (Date.now() < end) { requestAnimationFrame(frame); }
    }());

    // GUARDAR EN FIREBASE FIRESTORE (Compat)
    db.collection("partidas").add({
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        ganador: sortedGroups[0] ? sortedGroups[0].name : "Ninguno",
        puntosGanador: sortedGroups[0] ? sortedGroups[0].score : 0,
        equipos: sortedGroups.map(g => ({ nombre: g.name, puntos: g.score, jugadores: g.members }))
    }).then((docRef) => {
        console.log("¡Partida guardada correctamente! ID:", docRef.id);
    }).catch((error) => {
        console.error("Error al guardar en Firebase: ", error);
    });
}

document.getElementById('restart-btn').addEventListener('click', () => {
    if(confirm('¿Reiniciar todo el juego?')) location.reload(); 
});
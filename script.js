// --- CONFIGURACIÓN FIREBASE CLÁSICA (CDN) ---
const firebaseConfig = {
    apiKey: "AIzaSyDjq4rqhnuYt7I3PJoe_OuuZQo1G8L245I",
    authDomain: "trivial-atm.firebaseapp.com",
    projectId: "trivial-atm",
    storageBucket: "trivial-atm.firebasestorage.app",
    messagingSenderId: "461166180046",
    appId: "1:461166180046:web:723989976e7084ae1f429f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
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
const TEAM_COLORS_BASE = ['#CB3524', '#272E61', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#eab308'];

function hexToPastel(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
}

const GAME_QUESTIONS = [];
for (let i = 3; i <= 48; i++) { GAME_QUESTIONS.push({ id: i, type: 'pais', img: `assets/TRIVIAL DE EQUIPOS Y PAÍSES ATM F7_${i.toString().padStart(3, '0')}.png` }); }
for (let i = 49; i <= 94; i++) { GAME_QUESTIONS.push({ id: i, type: 'equipo', img: `assets/TRIVIAL DE EQUIPOS Y PAÍSES ATM F7_${i.toString().padStart(3, '0')}.png` }); }

let players = []; let groups = []; let currentTurnIndex = 0;
let remainingQuestions = [...GAME_QUESTIONS]; let currentQuestion = null;

let timerInterval;
let timeLeft = 50;
let isVARActive = false;

// --- DOM ELEMENTS ---
const setupScreen = document.getElementById('setup-screen');
const groupRevealScreen = document.getElementById('group-reveal-screen');
const gameScreen = document.getElementById('game-screen');
const podiumScreen = document.getElementById('podium-screen');

const addPlayerBtn = document.getElementById('add-player-btn');
const playerNameInput = document.getElementById('player-name');
const playersList = document.getElementById('players-list');
const triggerRevealBtn = document.getElementById('trigger-reveal-btn');
const startGameBtn = document.getElementById('start-game-btn');

const scoreBtn = document.getElementById('score-btn');
const varBtn = document.getElementById('var-btn');
const varIndicator = document.getElementById('var-indicator');
const nextTurnBtn = document.getElementById('next-turn-btn');

// --- LÓGICA JUGADORES ---
addPlayerBtn.addEventListener('click', () => {
    const inputVal = playerNameInput.value.trim();
    if (inputVal) {
        players.push(...inputVal.split(',').map(n => n.trim()).filter(n => n !== ''));
        updatePlayersList(); playerNameInput.value = '';
    }
});
playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPlayerBtn.click(); });
function updatePlayersList() {
    playersList.innerHTML = players.map((p, index) => `<li><span>${p}</span><button class="delete-btn" onclick="removePlayer(${index})">✕</button></li>`).join('');
}
window.removePlayer = function(index) { players.splice(index, 1); updatePlayersList(); };

// --- CREAR GRUPOS ---
triggerRevealBtn.addEventListener('click', () => {
    const numGroups = parseInt(document.getElementById('num-groups').value);
    if (players.length < numGroups) { alert('Faltan jugadores para rellenar los grupos.'); return; }
    
    let shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    let shuffledNames = [...PLANTILLA_ATLETI].sort(() => Math.random() - 0.5);

    groups = Array.from({ length: numGroups }, (_, i) => {
        let baseColor = TEAM_COLORS_BASE[i % TEAM_COLORS_BASE.length];
        return {
            id: i, name: shuffledNames[i], members: [], score: 0,
            color: baseColor, bgColor: hexToPastel(baseColor),
            usedVAR: false 
        };
    });

    shuffledPlayers.forEach((player, index) => { groups[index % numGroups].members.push(player); });

    setupScreen.classList.remove('active');
    groupRevealScreen.classList.add('active');
    
    const revealContainer = document.getElementById('reveal-container');
    revealContainer.innerHTML = '';
    groups.forEach((group, index) => {
        const membersList = group.members.map(m => `<li>${m}</li>`).join('');
        const card = document.createElement('div');
        card.className = 'reveal-card'; card.style.animationDelay = `${index * 0.15}s`;
        card.style.borderTopColor = group.color; card.style.backgroundColor = group.bgColor;
        card.innerHTML = `<h3 style="color: ${group.color};">${group.name}</h3><ul>${membersList}</ul>`;
        revealContainer.appendChild(card);
    });
});

startGameBtn.addEventListener('click', () => {
    groupRevealScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    if(groups.length > 6 && window.innerWidth >= 768) {
        gameScreen.classList.add('use-both-sidebars');
    }
    
    updateSidebarScores(); 
    startTurn();
});

// --- LÓGICA TURNOS Y TIEMPO ---
function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 50;
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');
    
    bar.style.width = '100%';
    bar.style.background = '#34C759'; 
    text.innerText = '50s';
    scoreBtn.disabled = false;

    timerInterval = setInterval(() => {
        timeLeft--;
        let percentage = (timeLeft / 50) * 100;
        bar.style.width = `${percentage}%`;
        text.innerText = `${timeLeft}s`;

        if (timeLeft <= 15) bar.style.background = '#FF9500'; 
        if (timeLeft <= 5) bar.style.background = '#FF3B30'; 

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('score-modal').classList.remove('active');
            
            scoreBtn.classList.add('hidden');
            varBtn.classList.add('hidden');
            nextTurnBtn.classList.remove('hidden');
            
            showRedCard();
        }
    }, 1000);
}

function updateSidebarScores() {
    const scoreListLeft = document.getElementById('score-list-left');
    const scoreListRight = document.getElementById('score-list-right');
    scoreListLeft.innerHTML = ''; scoreListRight.innerHTML = '';
    
    const currentGroupId = groups[currentTurnIndex].id;
    const allInLeft = groups.length <= 6 || window.innerWidth < 768;

    groups.forEach((group, index) => {
        const isActive = group.id === currentGroupId;
        const cardHtml = `
            <div id="card-group-${group.id}" class="score-card-mini ${isActive ? 'active-turn' : ''}" 
                 style="border-left-color: ${group.color}; background-color: ${group.bgColor};">
                <span class="team-name-mini" style="color: ${group.color};">${group.name}</span>
                <span class="team-score-mini" id="score-text-${group.id}">${group.score} pts</span>
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
    document.getElementById('current-team-name').innerText = `${currentGroup.name}`;
    document.getElementById('current-team-name').style.color = currentGroup.color; 
    document.getElementById('current-turn-score').innerText = `(Acumulado: ${currentGroup.score} Puntos)`;
    document.getElementById('current-turn-score').style.color = currentGroup.color;

    // Reset VAR
    isVARActive = false;
    varIndicator.classList.add('hidden');
    if (!currentGroup.usedVAR) {
        varBtn.classList.remove('hidden');
    } else {
        varBtn.classList.add('hidden');
    }

    updateSidebarScores();
    startTimer();

    if (remainingQuestions.length === 0) { alert('¡Fin de preguntas!'); endGame(); return; }

    const qIndex = Math.floor(Math.random() * remainingQuestions.length);
    currentQuestion = remainingQuestions[qIndex];
    remainingQuestions.splice(qIndex, 1);
    document.getElementById('question-image').src = currentQuestion.img;
}

// --- EVENTOS VAR Y PUNTUACIÓN ---
varBtn.addEventListener('click', () => {
    isVARActive = true;
    groups[currentTurnIndex].usedVAR = true;
    varBtn.classList.add('hidden');
    varIndicator.classList.remove('hidden');
});

scoreBtn.addEventListener('click', () => {
    document.getElementById('score-modal').classList.add('active');
    const scoringFields = document.getElementById('scoring-fields');
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

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('score-modal').classList.remove('active');
});

function animateFloatingScore(points, groupId) {
    const floater = document.createElement('div');
    floater.classList.add('floating-score-anim');
    floater.innerText = `+${points}`;
    document.body.appendChild(floater);

    floater.style.left = `${window.innerWidth / 2}px`;
    floater.style.top = `${window.innerHeight / 2}px`;
    floater.style.transform = `translate(-50%, -50%) scale(0.5)`;

    setTimeout(() => {
        const targetCard = document.getElementById(`card-group-${groupId}`);
        if(targetCard) {
            const rect = targetCard.getBoundingClientRect();
            floater.style.left = `${rect.left + (rect.width/2)}px`;
            floater.style.top = `${rect.top + 20}px`;
            floater.style.transform = `translate(-50%, -50%) scale(1.5)`;
            floater.style.opacity = '0';
        }
    }, 50);

    setTimeout(() => floater.remove(), 1000);
}

function showRedCard() {
    const redCard = document.getElementById('red-card-modal');
    redCard.classList.add('active');
    setTimeout(() => {
        redCard.classList.remove('active');
    }, 2500);
}

document.getElementById('save-score-btn').addEventListener('click', () => {
    clearInterval(timerInterval); 
    
    let turnPoints = 0;
    document.querySelectorAll('.score-select').forEach(sel => {
        turnPoints += parseInt(sel.value);
    });

    if (isVARActive) turnPoints *= 2;

    const currentGroup = groups[currentTurnIndex];
    currentGroup.score += turnPoints;
    
    document.getElementById('score-modal').classList.remove('active');
    scoreBtn.classList.add('hidden');
    varBtn.classList.add('hidden');
    nextTurnBtn.classList.remove('hidden');

    if (turnPoints === 0) {
        showRedCard();
    } else {
        animateFloatingScore(turnPoints, currentGroup.id);
    }

    setTimeout(() => { updateSidebarScores(); }, 800); 
});

nextTurnBtn.addEventListener('click', () => {
    currentTurnIndex = (currentTurnIndex + 1) % groups.length;
    startTurn();
});

document.getElementById('end-game-btn').addEventListener('click', () => {
    if (confirm('¿Finalizar partida y ver pódium?')) {
        endGame();
    }
});

// --- PÓDIUM Y FIREBASE ---
function endGame() {
    clearInterval(timerInterval);
    
    gameScreen.classList.remove('active');
    podiumScreen.classList.add('active');
    
    let sortedGroups = [...groups].sort((a, b) => b.score - a.score);
    
    function setPodiumSpot(spotId, group) {
        if(group) {
            document.getElementById(`${spotId}-name`).innerText = group.name;
            document.getElementById(`${spotId}-score`).innerText = `${group.score} pts`;
            document.getElementById(`${spotId}-members`).innerHTML = group.members.map(m => `<span class="player-badge ${spotId}-badge">${m}</span>`).join('');
        } else {
            document.getElementById(`spot-${spotId}`).style.display = 'none';
        }
    }

    setPodiumSpot('gold', sortedGroups[0]);
    setPodiumSpot('silver', sortedGroups[1]);
    setPodiumSpot('bronze', sortedGroups[2]);

    var end = Date.now() + 3000;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#CB3524', '#272E61', '#FFD700'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#CB3524', '#272E61', '#FFD700'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());

    db.collection("partidas").add({
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        ganador: sortedGroups[0] ? sortedGroups[0].name : "Ninguno",
        puntosGanador: sortedGroups[0] ? sortedGroups[0].score : 0,
        equipos: sortedGroups.map(g => ({ nombre: g.name, puntos: g.score, jugadores: g.members }))
    });
}

document.getElementById('restart-btn').addEventListener('click', () => {
    if(confirm('¿Reiniciar todo?')) location.reload(); 
});
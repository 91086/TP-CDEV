import { restartTimer } from './timer.js';
import { updateGameInstructions } from './main.js';

const continueButton = document.getElementById('continue-button');
const gameOverScreen = document.getElementById('game-over-screen');
const retryButton = document.getElementById('retry-btn');
const electricShockEffect = document.getElementById('electric-shock-effect');
const taskMessage = document.getElementById('task-message');
const miCanvas = document.getElementById('miCanvas');
const taskGrid = document.querySelector('.task-grid');

export let isReadyForTask = false;
export let taskActive = false;
export let taskReady = false;

let draggedElement = null; // Elemento actual que se está arrastrando
let currentWireType = null; // 'fase', 'neutro', o 'tierra'
let currentX, currentY; // Posición actual del mouse

// ORDEN DE CONEXION: Azul (Neutro), Marrón (Fase), Verde (Tierra)
const CORRECT_SEQUENCE = ['neutro', 'fase', 'tierra']; 
let currentConnections = []; // Lo que el jugador ha conectado
const WIRE_COLORS = { 'neutro': '#2888c4', 'fase': '#804000', 'tierra': '#15b763' }; 

// FUNCIÓN DE INICIALIZACIÓN: Configura listeners de arrastre
export function setupTaskListeners() {
    // 1. Obtener todos los cables arrastrables y añadir mousedown listener
    const draggables = document.querySelectorAll('.draggable');
    draggables.forEach(wire => {
        wire.addEventListener('mousedown', startDrag);
    });

    // 2. Eventos globales de mouseup y mousemove (para gestionar el arrastre en todo el documento)
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    
}

function startDrag(e) {
    if (!taskActive || e.button !== 0) return; 
    e.preventDefault(); 
    
    let target = e.target.closest('.draggable'); 
    if (!target) return; 
    
    draggedElement = target;
    currentWireType = draggedElement.dataset.wire;
    draggedElement.classList.add('dragging');

    // Registrar posición del mouse para el cálculo del desplazamiento
    currentX = e.clientX;
    currentY = e.clientY;

    const rect = draggedElement.getBoundingClientRect();

    // Asegurar que el elemento esté posicionado de forma absoluta para moverlo
    draggedElement.style.position = 'absolute';
    draggedElement.style.zIndex = '10001';
    
    // Asignar el left/top inicial basado en el rectángulo de la ventana
    draggedElement.style.left = rect.left + 'px';
    draggedElement.style.top = rect.top + 'px';
}

function drag(e) {
    if (!draggedElement) return;

    let dx = e.clientX - currentX;
    let dy = e.clientY - currentY;
    
    draggedElement.style.left = draggedElement.offsetLeft + dx + 'px';
    draggedElement.style.top = draggedElement.offsetTop + dy + 'px';
    
    currentX = e.clientX;
    currentY = e.clientY;
}

function endDrag() {
    if (!draggedElement) return;
    
    draggedElement.classList.remove('dragging');
    draggedElement.style.zIndex = ''; 

    const terminals = document.querySelectorAll('.terminal');
    let dropped = false;

    terminals.forEach(terminal => {
        if (isOverlapping(draggedElement, terminal)) {
            handleConnection(terminal);
            dropped = true;
        }
    });

    if (!dropped) {
        resetWirePosition();
    }

    draggedElement = null;
    currentWireType = null;
}

function isOverlapping(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    
    return !(
        rect1.right < rect2.left || 
        rect1.left > rect2.right || 
        rect1.bottom < rect2.top || 
        rect1.top > rect2.bottom
    );
}

function handleConnection(terminalElement) {
    
    const terminalType = terminalElement.dataset.type;

    if (currentWireType === terminalType) {        
        currentConnections.push(currentWireType);
        const connectionColor = WIRE_COLORS[currentWireType]
        terminalElement.style.backgroundColor = connectionColor;
        draggedElement.style.pointerEvents = 'none'; 
        draggedElement.style.opacity = '0.5';
        draggedElement.style.display = 'none'; 
        checkConnections(); 
    } else {
        currentConnections = []; 
        resetAllWires();
    }
}

function resetWirePosition() {
    draggedElement.style.position = 'relative'; 
    draggedElement.style.left = '0px'; 
    draggedElement.style.top = '0px';
}

function resetAllWires() {
    document.querySelectorAll('.draggable').forEach(w => {
        w.style.display = 'block';
        w.style.pointerEvents = 'auto';
        w.style.opacity = '1';
        w.style.position = 'relative'; 
        w.style.left = '0px'; 
        w.style.top = '0px';
    });
    
    document.querySelectorAll('.terminal').forEach(t => t.style.backgroundColor = '#333'); 
    
    if (taskMessage) {
        taskMessage.textContent = "Arrastre los cables a los terminales correctos. Cuidado con el orden...";
    }
}

function startOutletTask() {
    taskActive = true; 

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    if (miCanvas) {
        miCanvas.style.display = 'none';
        miCanvas.style.visibility = 'hidden';
    }

    if (taskGrid) {
        taskGrid.style.display = 'flex';
        taskGrid.style.visibility = 'visible';
    }
    
    currentConnections = [];
    resetAllWires();
}

// Verifica la secuencia y el resultado
function checkConnections() {

    // Verificar el orden parcial o completo
    let isOrderCorrectPartial = currentConnections.every((wire, index) => wire === CORRECT_SEQUENCE[index]);
    
    if (!isOrderCorrectPartial) {
        currentConnections = []; 
        resetAllWires();
        return; 
    }

    // Si no se han conectado 3 cables, sigue esperando la entrada (pero el orden parcial es correcto)
    if (currentConnections.length < CORRECT_SEQUENCE.length) {
        if (taskMessage) {
            const required = CORRECT_SEQUENCE.length - currentConnections.length;
            taskMessage.textContent = `¡Cable conectado! Faltan ${required} cable/s en el orden correcto...`;
        }
        return;
    }

    endMission(true);
}

export function endMission(success) {
    taskActive = false; 
    taskReady = false;

    if (taskGrid) {
        taskGrid.style.display = 'none';
        taskGrid.style.visibility = 'hidden';
    }

    if (miCanvas) {
        miCanvas.style.display = 'block'; 
        miCanvas.style.visibility = 'visible';
    }
    
    if (success) {
        taskReady = true;
        restartTimer();
        if (taskMessage) {
            taskMessage.textContent = "¡Misión Cumplida!";
            updateGameInstructions('tareaLista');
        }
        if (continueButton) {
            continueButton.style.display = 'block';
            document.body.requestPointerLock(); 
        }
    } else {
        showGameOverScreen();
        instructionsMessage.textContent = "";
    }
}

// Check para poder iniciar la tarea
export function checkTaskReadiness(cintaDestornilladorVisible, cascoVisible, luz) {
    const requiredSetupMet = (
        cintaDestornilladorVisible === false && 
        cascoVisible === false && 
        luz === false 
    );
    isReadyForTask = requiredSetupMet;
}

export function attemptTaskStart(luz) {

    if (luz === true) {
        triggerElectrocutionEffect();
        return false;
    }

    if (isReadyForTask) {
        updateGameInstructions("");
        startOutletTask();
        return true; 
    } else {
        return false; 
    }
}

// Efecto de electrocucion si se quiere iniciar la tarea y la termica esta encendida
function triggerElectrocutionEffect() {
    if (electricShockEffect) {
        electricShockEffect.style.display = 'block';
        electricShockEffect.style.opacity = '1';

        // Oculta el efecto después de un corto tiempo
        setTimeout(() => {
            electricShockEffect.style.opacity = '0';
            // Una vez que la transición de opacidad termina, oculta completamente
            electricShockEffect.addEventListener('transitionend', function handler() {
                electricShockEffect.style.display = 'none';
                electricShockEffect.removeEventListener('transitionend', handler);
            });
        }, 300); // Muestra el efecto por 0.3 segundos
    }
}

// Mostrar pantalla de GameOver
function showGameOverScreen() {
    if (miCanvas) {
        miCanvas.style.display = 'block'; 
        miCanvas.style.visibility = 'visible';
    }

    if (gameOverScreen) {
        gameOverScreen.style.display = 'flex';
        gameOverScreen.style.visibility = 'visible';
    }

    if (retryButton) {
        retryButton.addEventListener('click', handleRetry);
    }
}

// Recargar todo para arrancar desde 0
function handleRetry() {
    window.location.reload(); 
}

    
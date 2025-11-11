import { restartTimer } from './timer.js';
import { audioError, updateGameInstructions } from './main.js';

const gameOverScreen = document.getElementById('game-over-screen');
const retryButton = document.getElementById('retry-btn');
const electricShockEffect = document.getElementById('electric-shock-effect');
const taskMessage = document.getElementById('task-message');
const miCanvas = document.getElementById('miCanvas');
const taskGrid = document.querySelector('.task-grid');
const timerDisplay = document.querySelector('#game-timer');

export let isReadyForTask = false;
export let taskActive = false;
export let taskReady = false;

let draggedElement = null;
let currentWireType = null;
let currentX, currentY;

// ORDEN DE CONEXION: Azul (Neutro), Marrón (Fase), Verde (Tierra)
const CORRECT_SEQUENCE = ['neutro', 'fase', 'tierra']; 
let currentConnections = []; // Lo que el jugador ha conectado
const WIRE_COLORS = { 'neutro': '#2888c4', 'fase': '#804000', 'tierra': '#15b763' }; 

// FUNCIÓN DE INICIALIZACIÓN: Configura listeners de arrastre
export function setupTaskListeners() {

    // Obtener todos los cables arrastrables y añadir mousedown listener
    const draggables = document.querySelectorAll('.draggable');
    draggables.forEach(wire => {
        wire.addEventListener('mousedown', startDrag);
    });

    // Eventos globales de mouseup y mousemove (para gestionar el arrastre en todo el documento)
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    
}

// Iniciar el arrastre de los cables a los terminales
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

// Mover los cables mientras haya uno activo (draggedElement)
function drag(e) {
    if (!draggedElement) return;

    let dx = e.clientX - currentX;
    let dy = e.clientY - currentY;
    
    draggedElement.style.left = draggedElement.offsetLeft + dx + 'px';
    draggedElement.style.top = draggedElement.offsetTop + dy + 'px';
    
    currentX = e.clientX;
    currentY = e.clientY;
}

// Finalizar el arrastre de los cables a los terminales
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

// Verificar si el cable fue soltado en un terminal
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

// Si el cable fue soltado en un terminal correcto -> VERDE el terminal , sino se restablecen las conexiones
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
        audioError.play();
        currentConnections = []; 
        resetAllWires();
    }
}

// Restablecer posición de un solo cable (cuando no fue conectado a un terminal)
function resetWirePosition() {
    draggedElement.style.position = 'relative'; 
    draggedElement.style.left = '0px'; 
    draggedElement.style.top = '0px';
}

// Restablecer posición de todos los cables cable (cuando uno fue mal conectado a un terminal)
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

// INICIO de la tarea
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

// FIN de la tarea
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
            timerDisplay.textContent = "Haga clic en la pantalla para continuar"; 
            updateGameInstructions('tareaLista');
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
            timerDisplay.style.display = 'block';
            timerDisplay.textContent = "⚠️ PRECAUCIÓN: Tomacorriente bajo tensión!";
            electricShockEffect.addEventListener('transitionend', function handler() {
                electricShockEffect.style.display = 'none';
                electricShockEffect.removeEventListener('transitionend', handler);
            });
        }, 300);
    }
    showGameOverScreen();
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

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    if (retryButton) {
        retryButton.addEventListener('click', handleRetry);
    }
}

// Recargar todo para arrancar desde 0
function handleRetry() {
    window.location.reload(); 
}

    
import Stats from './libs/stats.module.js';
import { loadAssets } from './assetsLoader.js';
import { loadAudios } from './audiosLoader.js';
import { startTimer, totalSeconds } from './timer.js';
import { 
    checkTaskReadiness, 
    attemptTaskStart, 
    setupTaskListeners,
    taskActive, 
    endMission,
    taskReady
} from './taskManager.js';

// Mensajes de instrucciones de juego sobre el canvas
const instructionsMessage = document.getElementById('instructions-message');

// Crear el panel de estadísticas
const stats = new Stats();
stats.showPanel(0); // 0: fps
document.body.appendChild(stats.dom);

// Escena
const escena = new THREE.Scene();

// Luz ambiental reducida
const ambientLightOFF = new THREE.AmbientLight(0xffffff, 0.12);
escena.add(ambientLightOFF);

// Luz ambiental encendida
const ambientLightON = new THREE.AmbientLight(0xffffff, 1.5);

// Luz puntual para emergencia
const pointLight = new THREE.PointLight(0xff0000, 5, 3);
pointLight.position.set(2, 2.5, 3.8);
escena.add(pointLight);

// Luz puntual tipo "linterna" acoplada a la cámara
const flashlight = new THREE.SpotLight(0xffffff, 10, 5, Math.PI / 6, 0.3, 2);
flashlight.target.position.set(0, 0.5, -1);

// Luz puntual para "efecto chispazo"
const flashLight = new THREE.PointLight(0xffffff, 100, 1.5);
flashLight.position.set(-0.46, 1.3, -4.4);
flashLight.visible = false;

// Canvas
const canvas = document.querySelector('#miCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power', precision: 'lowp' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
renderer.setClearColor(0x000000);

// Cámara en primera persona
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 3);

// Integrar la cámara
const cameraHolder = new THREE.Object3D();
cameraHolder.add(camera);

// Posición inicial del jugador (En la puerta mas lejana al tablero electrico)
cameraHolder.position.set(-1.9, 0, -3.6); 
cameraHolder.rotation.y = -255;
escena.add(cameraHolder);

// Listener (oido de la escena)
const listener = new THREE.AudioListener();
camera.add(listener);

export let audioAlarma = null;
let audioAperturaCaja = null;
let audioCierreCaja = null;
let audioLinterna = null;
let audioChispas = null;
let audioTomarObjeto = null;

// Carga de audios
loadAudios(listener)
    .then(({aperturaCaja, cierreCaja, linterna, alarma, chispas, tomarObjeto})=> {
        audioAperturaCaja = aperturaCaja;
        audioCierreCaja = cierreCaja;
        audioLinterna = linterna;
        audioAlarma = alarma;
        audioChispas = chispas;
        audioTomarObjeto = tomarObjeto;
    })
    .catch(err => {
        console.error('Error al cargar audios:', err);
});

// Teclas usadas para animaciones
const keys = { w: false, a: false, s: false, d: false , v:false, m:false, h:false, p:false };

// Declarar mixer en scope global para actualizar en animate()
let cajaAbierta = false;
let vKeyProcessed = false;
let mKeyProcessed = false;
let cascoVisible = true;
let hKeyProcessed = false;
let luz = false;
let cintaDestornilladorVisible = true;
let cajaMixer = null;
let cajaAction = null;
let casco = null; 
let cinta = null;
let destornillador = null;

// Carga de modelos
loadAssets(escena).then(({ cajaGltf, cajaHerramientas, cascoGltf, destornilladorGltf, cintaGltf}) => {
    const clips = cajaGltf.animations || [];
    cinta = cintaGltf.scene;
    destornillador = destornilladorGltf.scene;
    casco = cascoGltf.scene;

    if (clips.length > 0) {
        cajaMixer = new THREE.AnimationMixer(cajaHerramientas);

        let clip = THREE.AnimationClip.findByName(clips, 'Take 001') || clips[0];
      
        if (clip) {
            // 1. Almacenar la acción en la variable global
            cajaAction = cajaMixer.clipAction(clip);
            
            // 2. Configurar la acción para que sea una vez y se mantenga al final
            cajaAction.loop = THREE.LoopOnce;
            cajaAction.clampWhenFinished = true;
            
            // 3. Establecer el tiempo en 0 y pausar la acción al inicio
            cajaAction.time = 0; 
            cajaAction.play();
            cajaAction.paused = true; 
            
            console.log('✓ Animación de caja configurada');
        }
    } 

}).catch(err => {
    console.error('Error inicializando assets o animaciones:', err);
});

// Animacion de la caja de herramientas
function handleToggleCaja() {
    // Verificar si la tecla 'V' está presionada y si aún no se ha procesado
    if (keys.v) {
        if (!vKeyProcessed && cajaMixer && cajaAction) {
            vKeyProcessed = true; // Marca como procesada
            updateGameInstructions('tomarHerramientas');
            if (!cajaAbierta) {
                // ESTADO: Abrir
                cajaAction.time = 0.5;
                cajaAction.paused = true;
                cajaAbierta = true;
                audioAperturaCaja.play();
            } else {
              // ESTADO: Cerrar
                cajaAction.time = -0.5;
                cajaAction.paused = false;
                cajaAbierta = false; 
                audioCierreCaja.play();
            }
        }
    } else {
        vKeyProcessed = false;
    }
}

let pKeyProcessed = false;

// Sacar cinta y destornillador de la caja de herramientas
function checkToolAction() {
    if (!cajaAbierta) {
        pKeyProcessed = false;
        return; 
    }

    // Verificar si la tecla 'P' está presionada y si aún no se ha procesado.
    if (keys.p) {
        if (!pKeyProcessed) {
            updateGameInstructions('inicioTarea');
            audioTomarObjeto.play();
            cintaDestornilladorVisible = false;
            escena.remove(cinta);
            escena.remove(destornillador);
            pKeyProcessed = true; 
        }
    } else {
        pKeyProcessed = false;
    }
}

// Animacion del casco con la linterna del casco
function handleToggleCasco() {
    // 1. Verificar si la tecla 'M' está presionada y si aún no se ha procesado
    if (keys.m) {
        if (!mKeyProcessed) {
            mKeyProcessed = true;
            cascoVisible = !cascoVisible;
            updateGameInstructions('detectarFalla');
            if (cascoVisible) {
                // ESTADO: CASCO VISIBLE (Luz apagada)
                if (casco) {
                    escena.add(casco);
                    audioLinterna.play();
                }
                camera.remove(flashlight);
                camera.remove(flashlight.target);
            } else {
                // ESTADO: CASCO OCULTO (Luz encendida)
                if (casco) {
                    escena.remove(casco);
                    audioLinterna.play();
                }
                camera.add(flashlight);
                camera.add(flashlight.target);
            }
        }
    } else {
        mKeyProcessed = false;
    }
}

// Animacion de la luz de la sala
function handleToggleLightRoom() {
    // 1. Verificar si la tecla 'H' está presionada y si aún no se ha procesado
    if (keys.h) {
        if (!hKeyProcessed) {
            hKeyProcessed = true;
            luz = !luz;
            updateGameInstructions('necesitaCasco');
            if (luz) {
                // ESTADO: TERMICA BAJA -> ALTA
                escena.remove(ambientLightOFF);
                escena.add(ambientLightON);
                audioAlarma.setLoop(false);
                audioAlarma.stop();
                // Si la tarea NO esta hay chispas y no se puede prender la luz de la sala
                if (!taskReady) { 
                    audioChispas.play();
                    escena.add(flashLight); //
                    flashLight.visible = true; //
                    setTimeout(() => {
                        escena.remove(ambientLightON);
                        escena.add(ambientLightOFF);
                        luz = false; 
                        audioAlarma.setLoop(true);
                        audioAlarma.play();
                        audioChispas.stop();
                    }, 500);
                    setTimeout(() => {
                        flashLight.visible = false;
                    }, 600);
                } else {
                    updateGameInstructions('finJuego');
                }
            } else {
                // ESTADO: TERMICA ALTA -> BAJA
                escena.remove(ambientLightON);
                escena.add(ambientLightOFF);
                audioAlarma.setLoop(true);
                audioAlarma.play();
            }
        }
    } else {
        hKeyProcessed = false;
    }
}

// Variables para Colisión
const playerRadius = 0.5; // Radio aproximado del cilindro del jugador
const playerBox = new THREE.Box3(); // Caja delimitadora para el jugador
const playerSize = new THREE.Vector3(playerRadius * 2, 1.6, playerRadius * 2); // Dimensiones del "jugador"

// Lista de cajas delimitadoras (Bounding Boxes)
const wallColliders = [
    
    // 1. PARED TRASERA
    new THREE.Box3(new THREE.Vector3(-2.8, 0, -4.2), new THREE.Vector3(2.4, 5, -4.1)), 
    
    // 2. PARED FRONTAL
    new THREE.Box3(new THREE.Vector3(-2.8, 0, 4.8), new THREE.Vector3(2.4, 5, 4.9)), 
    
    // 3. PARED DERECHA
    new THREE.Box3(new THREE.Vector3(2.3, 0, -4.2), new THREE.Vector3(2.4, 5, 4.9)), 
    
    // 4. PARED IZQUIERDA
    new THREE.Box3(new THREE.Vector3(-2.8, 0, -4.2), new THREE.Vector3(-2.7, 5, 4.9)),
    
    // 5. MESA CENTRAL
    new THREE.Box3(new THREE.Vector3(-0.8, 0, -0.8), new THREE.Vector3(0.2, 1, 0.6)),
];

// Función para actualizar la caja del jugador
function updatePlayerBox(position) {
    playerBox.setFromCenterAndSize(position, playerSize);
}

// Inicializar la caja del jugador en su posición inicial
updatePlayerBox(cameraHolder.position);

// Eventos de teclado
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

    // Presionar el Enter para iniciar la tarea y empezar a correr el temporizador
    if (e.key === 'Enter') {
        updateGameInstructions('necesitaHerramientas');
        const started = attemptTaskStart(luz);
        if (started) {
            startTimer(); // Inicia el timer solo si la tarea fue aceptada
        }
    }

    if (k in keys) {
        e.preventDefault();
        keys[k] = true;
    }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) {
    e.preventDefault();
    keys[k] = false;
  }
});

// Movimiento simple: mover el cameraHolder en el plano XZ manteniendo Y fija
const speed = 2.5; //2.5 NORMAL
const clock = new THREE.Clock();

function updateMovement(delta) {
    if (!isPointerLocked) return;
    
    // 1. Calcular el vector de movimiento base
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (keys.w) move.add(forward);
    if (keys.s) move.add(forward.clone().negate());
    if (keys.a) move.add(right.clone().negate());
    if (keys.d) move.add(right);

    // Solo procede si hay movimiento
    if (move.lengthSq() > 0) {
        move.normalize();
        const movementVector = move.clone().multiplyScalar(speed * delta);
        
        const currentPosition = cameraHolder.position.clone();
        
        // --- COLISIÓN EN EJE X ---
        
        // Calcular la posición tentativa para el movimiento en X
        const newPositionX = currentPosition.clone().add(new THREE.Vector3(movementVector.x, 0, 0));
        
        // Actualizar la caja del jugador con la posición tentativa X
        updatePlayerBox(newPositionX); 
        
        let collisionX = false;
        for (const wallBox of wallColliders) {
            if (playerBox.intersectsBox(wallBox)) {
                collisionX = true;
                break;
            }
        }
        
        // --- COLISIÓN EN EJE Z ---
        
        // Calcular la posición tentativa para el movimiento en Z
        const newPositionZ = currentPosition.clone().add(new THREE.Vector3(0, 0, movementVector.z));
        
        // Actualizar la caja del jugador con la posición tentativa Z
        updatePlayerBox(newPositionZ);
        
        let collisionZ = false;
        for (const wallBox of wallColliders) {
            if (playerBox.intersectsBox(wallBox)) {
                collisionZ = true;
                break;
            }
        }

        // --- APLICAR MOVIMIENTO ---
        
        // Mover en X solo si no colisionó en X
        if (!collisionX) {
            cameraHolder.position.x = newPositionX.x;
        }
        
        // Mover en Z solo si no colisionó en Z
        if (!collisionZ) {
            cameraHolder.position.z = newPositionZ.z;
        }
        
        // Mantener la altura fija y actualizar la caja del jugador a la posición final
        cameraHolder.position.y = 0; 
        updatePlayerBox(cameraHolder.position);
    }
}

// Mouse look
let yaw = cameraHolder.rotation.y; // Para inicar en la misma posicion que la cameraHolder
let pitch = camera.rotation.x; // Para inicar en la misma posicion que la cameraHolder
const PI_2 = Math.PI / 2;
const mouseSensitivity = 0.0025;
let isPointerLocked = false;

// Solicitar pointer lock al hacer click en el canvas
canvas.addEventListener('click', () => {
  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
  if (canvas.requestPointerLock){
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
});

// Movimiento de mouse
document.addEventListener('mousemove', (event) => {
  if (isPointerLocked) {
    yaw -= event.movementX * mouseSensitivity;
    pitch -= event.movementY * mouseSensitivity;
  } else return; // No se procesa movimiento si no hay pointer lock ni cursor sobre canvas

  // limitar pitch para no voltear la cámara
  pitch = Math.max(-PI_2 + 0.01, Math.min(PI_2 - 0.01, pitch));

  // Aplicar rotaciones: yaw al holder (gira horizontal), pitch a la cámara (giro vertical)
  cameraHolder.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// Mantener cámara a la altura de los ojos dentro del holder
camera.position.set(0, 1.6, 0);

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Carteles flotantes para teclas
const INTERACTION_DISTANCE = 1; 
const interactionLabel = document.getElementById('interaction-label');

const INTERACTABLES = {
    tablero: {
        pos: new THREE.Vector3(2, 0.5, 3.8),
        message: "Presione H\nSubir/Bajar Térmica"
    },
    caja: {
        pos: new THREE.Vector3(-1.9, 0.5, 4.3),
        message: "Presione V\nAbrir/Cerrar Caja"
    },
    cintaDestornillador: {
        pos: new THREE.Vector3(-1.9, 0.5, 4.3),
        message: "Presione P\nTomar Herramientas"
    },
    casco: {
        pos: new THREE.Vector3(2.05, -0.7, 2.7),
        message: "Presione M\nPoner/Quitar Casco"
    },
    tomacorriente: {
        pos: new THREE.Vector3(-0.46, 0.5, -3.5),
        message: "Presione Enter\nIniciar Reparación"
    }
};

// Interaccion con los carteles flotantes
function checkInteraction() {
    const gameOverScreen = document.getElementById('game-over-screen');

    // Ocultar los carteles flotantes si esta visible la pantalla de GamerOver
    if (gameOverScreen.style.visibility === 'visible'){
        if (interactionLabel) {
            interactionLabel.style.display = 'none';
        }
        return; 
    }
    
    // Ocultar los carteles flotantes si se inicio la tarea
    if (taskActive) {
        if (interactionLabel) {
            interactionLabel.style.display = 'none';
        }
        return; 
    }

    if (!cameraHolder || !interactionLabel) return; 

    let nearestInteractable = null;
    let minDistance = Infinity;

    // Iterar y encontrar el objeto más cercano que esté dentro de INTERACTION_DISTANCE
    for (const key in INTERACTABLES) {
        const item = INTERACTABLES[key];

        // Si la caja esta abierta y tiene las herramientas muestra PRESIONE 'P'
        if ((key === 'caja' && cajaAbierta && cintaDestornilladorVisible)) {
            continue; 
        }

        // Si la caja NO tiene la cinta y el destornillador muestra PRESIONE 'V'
        if (key === 'cintaDestornillador' && !cintaDestornilladorVisible) {
            continue; 
        }

        const distance = cameraHolder.position.distanceTo(item.pos);

        if (distance < minDistance && distance < INTERACTION_DISTANCE) {
            minDistance = distance;
            nearestInteractable = item;
        }
    }

    if (nearestInteractable) {
        interactionLabel.textContent = nearestInteractable.message; 
        interactionLabel.style.display = 'block';
    } else {
        interactionLabel.style.display = 'none';
    }
}

// Si la instruccion ya fue mostrada no se volvera a mostrar nuevamente
let flagIntructions = [false, false, false, false, false, false, false, false]; 

// Mensajes de instrucciones de juego
export function updateGameInstructions(messageKey) {
    if (!instructionsMessage) return;

    let messageText = "";

    switch (messageKey) {
        case 'inicioJuego': // Instruccion 0
            if(!flagIntructions[0]){
                messageText = "Intenta restablecer el circuito principal.";
                flagIntructions[0] = true;
            }
            break;
        case 'necesitaCasco': // Instruccion 1
            if(!flagIntructions[1]){
                messageText = "No puedes ver… Necesitas el equipo de seguridad.";
                flagIntructions[1] = true;
            }
            break;
        case 'detectarFalla': // Instruccion 2
            if(!flagIntructions[2]){
                messageText = "El chispazo no provino del panel. Busca el origen de la falla.";
                flagIntructions[2] = true;
            }
            break;
        case 'necesitaHerramientas': // Instruccion 3
            if(!flagIntructions[3]){
                messageText = "Busca las herramientas adecuadas.";
                flagIntructions[3] = true;
            }
            break;
        case 'tomarHerramientas': // Instruccion 4
            if(!flagIntructions[4]){
                messageText = "Un destornillador y una cinta aisladora parecen necesarios.";
                flagIntructions[4] = true;
            }
            break;
        case 'inicioTarea': // Instruccion 5
            if(!flagIntructions[5]){
                messageText = "Inicia la reparación del circuito.";
                flagIntructions[5] = true;
            }
            break;
        case 'tareaLista': // Instruccion 6
            if(!flagIntructions[6]){
                messageText = "Falla resuelta. Restablece el servicio.";
                flagIntructions[6] = true;
            }
            break;
        case 'finJuego': // Instruccion 7
            if(!flagIntructions[7]){
                messageText = "Circuito restablecido con éxito!";
                flagIntructions[7] = true;
            }
            break;
    }

    instructionsMessage.textContent = messageText;

    // Si no hay mensaje para mostrar se oculta el elemento
    if (messageText === "") {
         instructionsMessage.style.display = 'none';
    } else {
        instructionsMessage.style.display = 'block';
    }
}

// Animación
function animate() {
    requestAnimationFrame(animate); 

    checkTaskReadiness(cintaDestornilladorVisible, cascoVisible, luz);

    if (taskActive && totalSeconds <= 0) {
        endMission(false);
    }
    
    const delta = clock.getDelta();
    if (cajaMixer) {
        cajaMixer.update(delta);
    }
    
    handleToggleCaja(); 
    checkToolAction();
    handleToggleCasco();
    handleToggleLightRoom();
    updateMovement(delta);
    checkInteraction(); 

    // Llamado al panel de estadísticas de rendimiento
    stats.begin();
    renderer.render(escena, camera);
    stats.end();
}

setupTaskListeners();
animate();
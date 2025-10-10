import { loadAssets } from './assetsLoader.js';

// Escena y renderizador
const escena = new THREE.Scene();

// Luz ambiental (SOLO TEST)
const ambientLight = new THREE.AmbientLight(0xFF0000, 2);
escena.add(ambientLight);

// Luz puntual para emergencia
const pointLight = new THREE.PointLight(0xFF0000, 1, 10);
pointLight.position.set(2, 2.5, 3.8);
escena.add(pointLight);

const canvas = document.querySelector('#miCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;

// Cámara en primera persona (altura de ojos ~1.6m)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 3);

// Luz puntual tipo "linterna" acoplada a la cámara
const flashlight = new THREE.SpotLight(0xFFFFFF, 2, 5, Math.PI / 4, 0.5, 2);
flashlight.target.position.set(0, 2, -1);
flashlight.castShadow = true;
flashlight.position.set(0, 0.2, 0);

// Integrar la cámara con la linterna
const cameraHolder = new THREE.Object3D();
cameraHolder.add(camera);

// Posición inicial del jugador (En la puerta mas lejana al tablero electrico)
cameraHolder.position.set(-1.9, 0, -3.6); 
cameraHolder.rotation.y = -255;
escena.add(cameraHolder);

// Controles de movimiento WASD (V -> Abrir caja de herramientas)
const keys = { w: false, a: false, s: false, d: false , v:false, m:false};

// Declarar mixer(s) en scope global para actualizar en animate()
let cajaMixer = null;
let cajaAction = null;
let cajaAbierta = false;
let vKeyProcessed = false;
let casco = null; 
let mKeyProcessed = false;
let cascoVisible = true;

loadAssets(escena).then(({ cajaGltf, cajaHerramientas, cascoGltf}) => {
    const clips = cajaGltf.animations || [];
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

            casco = cascoGltf.scene;
            
            console.log('Animación de caja configurada.');
        } else {
            console.log('No se encontró clip "Take 001", clips disponibles:', clips.map(c => c.name));
        }
    } else {
        console.log('No hay animaciones en cajaHerramientas');
    }
}).catch(err => {
    console.error('Error inicializando assets o animaciones:', err);
});

// Animacion de la caja de herramientas
function handleToggleCaja() {
    // 1. Verificar si la tecla 'V' está presionada y si aún no se ha procesado
    if (keys.v) {
        if (!vKeyProcessed && cajaMixer && cajaAction) {
            vKeyProcessed = true; // Marca como procesada
            if (!cajaAbierta) {
                // ESTADO: Abrir
                cajaAction.time = 0.5;
                cajaAction.paused = true;
                cajaAbierta = true;
            } else {
              // ESTADO: Cerrar
                cajaAction.time = -0.5;
                cajaAction.paused = false;
                cajaAbierta = false; 
            }
        }
    } else {
        vKeyProcessed = false;
    }
}

// Animacion del casco con la linterna del casco
function handleToggleCasco() {
    // 1. Verificar si la tecla 'M' está presionada y si aún no se ha procesado
    if (keys.m) {
        if (!mKeyProcessed) {
            mKeyProcessed = true;
            cascoVisible = !cascoVisible;
            if (cascoVisible) {
                // ESTADO: CASCO VISIBLE (Luz apagada)
                if (casco) {
                    casco.visible = true; 
                }
                cameraHolder.remove(flashlight);
                cameraHolder.remove(flashlight.target);
            } else {
                // ESTADO: CASCO OCULTO (Luz encendida)
                if (casco) {
                    casco.visible = false;
                }
                cameraHolder.add(flashlight);
                cameraHolder.add(flashlight.target);
            }
        }
    } else {
        mKeyProcessed = false;
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

// Depuración de Colisiones (Helper Visual)
// Define el material para que sean visibles
const materialHelper = new THREE.MeshBasicMaterial({ 
    //color: 0x00ff00, // *TEST* // Habilitar para que sea visible
    wireframe: true, 
    transparent: true, 
    opacity: 0 // *TEST* // Darle un 0.5 para que sea visible
});

// Agrega todas las cajas de colisión a la escena para visualizarlas
wallColliders.forEach(box => {
    // 1. Obtener el tamaño y centro de la caja
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // 2. Crear una geometría y malla para visualizar la caja
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geometry, materialHelper);
    mesh.position.copy(center);
    escena.add(mesh);
});

// *TEST* // Visualizar la caja del jugador (Cubo)
//const playerHelper = new THREE.Box3Helper(playerBox, );
//playerHelper.visible = false;
//escena.add(playerHelper);

// Función para actualizar la caja del jugador
function updatePlayerBox(position) {
    playerBox.setFromCenterAndSize(position, playerSize);
}

// Inicializar la caja del jugador en su posición inicial
updatePlayerBox(cameraHolder.position);


// HUD
const hud = document.createElement('div');
hud.style.position = 'absolute';
hud.style.left = '10px';
hud.style.top = '10px';
hud.style.padding = '8px 12px';
hud.style.background = 'rgba(0,0,0,0.6)';
hud.style.color = 'white';
hud.style.fontFamily = 'sans-serif';
hud.style.zIndex = '999';
hud.style.borderRadius = '4px';
hud.innerText = `Click en la pantalla para iniciar los movimientos \n
                WASD (Para movimientos) \n
                V (Abrir/Cerrar caja de herrramientas) \n
                M (Tomar/Soltar casco)`;
document.body.appendChild(hud);

// Eventos de teclado
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
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

// Movimiento simple: : mover el cameraHolder en el plano XZ manteniendo Y fija
const speed = 5; //2.5 NORMAL
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
let yaw = 0;
let pitch = 0;
const PI_2 = Math.PI / 2;
const mouseSensitivity = 0.0025;
let isPointerLocked = false;

// Solicitar pointer lock al hacer click en el canvas
canvas.addEventListener('click', () => {
  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
  if (canvas.requestPointerLock) canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
  hud.style.display = isPointerLocked ? 'none' : 'block';
});

// Soporte para mouse-look sin pointer lock: cuando el cursor esté sobre el canvas
let mouseOverCanvas = false;
let lastMouseX = null;
let lastMouseY = null;

canvas.addEventListener('mouseenter', (e) => {
  mouseOverCanvas = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
canvas.addEventListener('mouseleave', () => {
  mouseOverCanvas = false;
  lastMouseX = null;
  lastMouseY = null;
});

document.addEventListener('mousemove', (event) => {
  if (isPointerLocked) {
    yaw -= event.movementX * mouseSensitivity;
    pitch -= event.movementY * mouseSensitivity;
  } else if (mouseOverCanvas) {
    if (lastMouseX === null) {
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      return;
    }
    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    yaw -= dx * mouseSensitivity;
    pitch -= dy * mouseSensitivity;
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

// Animación
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (cajaMixer) {
    cajaMixer.update(delta);
  }
  handleToggleCaja(); 
  handleToggleCasco();
  updateMovement(delta);
  renderer.render(escena, camera);
}

animate();
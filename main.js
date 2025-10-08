import { GLTFLoader } from './libs/GLTFLoader.js';

// Escena y renderizador
const escena = new THREE.Scene();

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
const flashlight = new THREE.PointLight(0xffffff, 1.2, 10, 2);
flashlight.castShadow = true;
flashlight.position.set(0, 1.8, 3);

// Integrar la cámara con la linterna
const cameraHolder = new THREE.Object3D();
cameraHolder.add(camera);
cameraHolder.add(flashlight);

// Posición inicial del jugador (En la puerta mas lejana al tablero electrico)
cameraHolder.position.set(0, 0, -4.5);
cameraHolder.rotation.y = -255;
escena.add(cameraHolder);

// Cargar modelo de la sala con GLTFLoader (archivo en assets/models/sala/scene.gltf)
const loader = new GLTFLoader();
loader.load(
  './assets/models/sala/scene.gltf',
  function (gltf) {
    const sala = gltf.scene;
    sala.position.set(0, 0, 0);
    sala.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
    escena.add(sala);
  },
  undefined,
  function (err) {
    console.error('Error cargando sala:', err);
  }
);

// Controles de movimiento WASD (altura fija)
const keys = { w: false, a: false, s: false, d: false };

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
hud.innerText = `Click en la pantalla para iniciar los movimientos`;
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
const speed = 2.5;
const clock = new THREE.Clock();

function updateMovement(delta) {
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

  if (move.lengthSq() > 0) {
    move.normalize();
    move.multiplyScalar(speed * delta);
    cameraHolder.position.add(move);
    cameraHolder.position.y = 0;
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
  updateMovement(delta);
  renderer.render(escena, camera);
}

animate();
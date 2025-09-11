const escena = new THREE.Scene();
escena.background = new THREE.Color("#2d78c4"); // Azul

// Importar GLTFLoader
import { GLTFLoader } from './libs/GLTFLoader.js';

// Cámara ortográfica
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 7;
const camara = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, // left
    frustumSize * aspect / 2,  // right
    frustumSize / 2,           // top
    frustumSize / -2,          // bottom
    0.1,                      // near
    1000                      // far
);
camara.position.x = 0;
camara.position.y = 0;
camara.position.z = 5;

// Renderizador
const renderizador = new THREE.WebGLRenderer({
    canvas: document.querySelector("#miCanvas"),
    antialias: true
});
renderizador.setSize(window.innerWidth, window.innerHeight);

// Agregar una luz Direccional
const luz = new THREE.DirectionalLight(0xffffff, 2);
luz.position.set(5, 5, 5);
escena.add(luz);


// Cargar el modelo GLTF
let mixer = null;
let spiderGLTF = null;
const spider = new GLTFLoader();
spider.load(
    './assets/models/spider/scene.gltf',
    function (gltf) {
        // Centrar el modelo en X y Z
        gltf.scene.position.x = 0;
        gltf.scene.position.y = 0;
        gltf.scene.position.z = 0;
        gltf.scene.rotation.x = 2;
        gltf.scene.rotation.y = 3;
        escena.add(gltf.scene);
        spiderGLTF = gltf.scene;

        // Si hay animaciones, crear el mixer y reproducir la primera
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(gltf.scene);
            gltf.animations.forEach((clip) => {
                mixer.clipAction(clip).play();
            });
        }
    },
    undefined,
    function (error) {
        console.error('Error al cargar el modelo GLTF:', error);
    }
);

// Teclas
const keysPressed = {};
window.addEventListener('keydown', function (event) {
    keysPressed[event.code] = true;
});

window.addEventListener('keyup', function (event) {
    keysPressed[event.code] = false;
});

// Animación 
let clock = new THREE.Clock();
function animar() {
    requestAnimationFrame(animar);

    // Mover el modelo en x si está cargado
    if (spiderGLTF) {
        if (keysPressed['ArrowLeft']) {
            spiderGLTF.rotation.y += 0.01;
            spiderGLTF.position.x -= 0.01; // Mover a la izquierda
        }
        if (keysPressed['ArrowRight']) {
            spiderGLTF.rotation.y -= 0.01;
            spiderGLTF.position.x += 0.01; // Mover a la derecha
        }
        if (keysPressed['ArrowUp']) {
            spiderGLTF.position.y += 0.01; // Mover hacia arriba
        }
        if (keysPressed['ArrowDown']) {
            spiderGLTF.position.y -= 0.01; // Mover hacia abajo
        }
    }

    // Actualizar animación si existe mixer
    if (mixer) {
        let delta = clock.getDelta();
        mixer.update(delta);
    }

    // Llamado al renderizador
    renderizador.render(escena, camara);
}



animar();
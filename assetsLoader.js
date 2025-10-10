import { GLTFLoader } from './libs/GLTFLoader.js';

const loader = new GLTFLoader();

async function loadGltfModel(path) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = true;
                    }
                });
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.error(`Error cargando modelo ${path}:`, error);
                reject(error);
            }
        );
    });
}

export async function loadAssets(escena) {
    console.log('Iniciando carga de assets...');

    try {
        // 1. Carga ambos modelos concurrentemente
        const [salaGltf, cajaGltf] = await Promise.all([
            loadGltfModel('./assets/models/sala/scene.gltf'),
            loadGltfModel('./assets/models/caja_herramientas/scene.gltf')
        ]);

        // 2. Configuración específica de la Sala
        const sala = salaGltf.scene;
        sala.position.set(0, 0, 0);
        sala.rotation.y = 195.3;

        // 3. Configuración específica de la Caja de Herramientas
        const cajaHerramientas = cajaGltf.scene;
        cajaHerramientas.scale.set(0.002, 0.002, 0.002); 
        cajaHerramientas.position.set(-1.9, 0.5, 4.3);
        cajaHerramientas.rotation.y = 210.5;

        // 4. Agregar a la escena
        escena.add(sala);
        escena.add(cajaHerramientas);

        console.log('Carga de assets finalizada.');

        // devolver referencias útiles (gltf completos)
        return { salaGltf, cajaGltf, sala, cajaHerramientas };

    } catch (error) {
        console.error('Fallo al cargar uno o más assets.', error);
        throw error;
    }
}
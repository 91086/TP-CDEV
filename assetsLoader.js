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
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(material => {
                                if (material.isMeshBasicMaterial || material.isMeshPhongMaterial) {
                                    
                                    const newMaterial = new THREE.MeshStandardMaterial({
                                        map: material.map,
                                        color: material.color.clone(),
                                        metalness: 0.1,  
                                        roughness: 0.8,  
                                    });
                                    child.material = newMaterial;
                                    material = newMaterial;
                                }
                                material.needsUpdate = true;
                            });
                        }
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
    console.log('Iniciando carga de modelos...');

    try {
        // 1. Carga ambos modelos concurrentemente
        const [salaGltf, cajaGltf, tableroGltf, luzEmergenciaGltf, cascoGltf, destornilladorGltf, cintaGltf] = await Promise.all([
            loadGltfModel('./assets/models/sala/scene.gltf'),
            loadGltfModel('./assets/models/caja_herramientas/scene.gltf'),
            loadGltfModel('./assets/models/tablero/scene.gltf'),
            loadGltfModel('./assets/models/luz_emergencia/scene.gltf'),
            loadGltfModel('./assets/models/casco/scene.gltf'),
            loadGltfModel('./assets/models/destornillador/scene.gltf'),
            loadGltfModel('./assets/models/cinta/scene.gltf')   
        ]);
        
        // 2. Configuración específica de la Sala
        const sala = salaGltf.scene;
        sala.receiveShadow  = true;
        sala.position.set(0, 0, 0);
        sala.rotation.y = 195.3;

        // 3. Configuración específica de la Caja de Herramientas
        const cajaHerramientas = cajaGltf.scene;
        cajaHerramientas.scale.set(0.002, 0.002, 0.002); 
        cajaHerramientas.position.set(-1.9, 0.5, 4.3);
        cajaHerramientas.rotation.y = 210.5;

        // 4. Configuración específica del tablero
        const tablero = tableroGltf.scene;
        tablero.position.set(2, 1.4, 3.8);
        tablero.rotation.y = 103.6;

         // 5. Configuración específica de la luz de emergencia
        const luzEmergencia = luzEmergenciaGltf.scene;
        luzEmergencia.scale.set(0.2, 0.2, 0.2); 
        luzEmergencia.position.set(2, 2.5, 3.8);
        luzEmergencia.rotation.y = 103.6;

        // 6. Configuración específica del casco 
        const casco = cascoGltf.scene;
        casco.position.set(2.05, -0.7, 2.7);
        casco.rotation.y = 103.6;

        // 7. Configuración específica del destornillador 
        const destornillador = destornilladorGltf.scene;
        destornillador.scale.set(1.4, 1.4, 1.4); 
        destornillador.position.set(-1.9, 0.6, 4.5);
        destornillador.rotation.y = 10

        // 8. Configuración específica de la cinta 
        const cinta = cintaGltf.scene;
        cinta.scale.set(0.07, 0.07, 0.07); 
        cinta.position.set(-2.1, 0.56, 4.5);
        cinta.rotation.z = 175
        
        // Agregar a la escena
        escena.add(sala);
        escena.add(cajaHerramientas);
        escena.add(tablero);
        escena.add(luzEmergencia);
        escena.add(casco);
        escena.add(destornillador);
        escena.add(cinta);
        
        console.log('Carga de models finalizada.');

        // Devolver referencias útiles (gltf completos)
        return { salaGltf, cajaGltf, tableroGltf, luzEmergenciaGltf, cascoGltf, destornilladorGltf, cintaGltf,
            sala, cajaHerramientas, tablero, luzEmergencia, casco, destornillador, cinta};

    } catch (error) {
        console.error('Fallo al cargar uno o más models.', error);
        throw error;
    }
}
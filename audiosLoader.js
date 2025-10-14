const audioLoader = new THREE.AudioLoader();

function loadAudioBuffer(path) {
    return new Promise((resolve, reject) => {
        audioLoader.load(
            path,
            (buffer) => resolve(buffer),
            undefined,
            (error) => {
                console.error(`Error al cargar el audio ${path}:`, error);
                reject(error);
            }
        );
    });
}

export async function loadAudios(listener) {
    console.log('Iniciando carga de audios...');

    const [cierreBuffer, aperturaBuffer, linternaBuffer, alarmaBuffer] = await Promise.all([
        loadAudioBuffer('./assets/audios/cierreCaja.ogg'),
        loadAudioBuffer('./assets/audios/aperturaCaja.ogg'),
        loadAudioBuffer('./assets/audios/linterna.m4a'),
        loadAudioBuffer('./assets/audios/alarma.m4a'),
    ]);
    
    const cierreCaja = new THREE.Audio(listener);
    const aperturaCaja = new THREE.Audio(listener);
    const linterna = new THREE.Audio(listener);
    const alarma = new THREE.Audio(listener);

    // 1. Configuracion del audio del cierre de la caja
    cierreCaja.setBuffer(cierreBuffer);
    cierreCaja.setLoop(false);
    cierreCaja.setVolume(0.3);

    // 2. Configuracion del audio de la apertura de la caja
    aperturaCaja.setBuffer(aperturaBuffer);
    aperturaCaja.setLoop(false);
    aperturaCaja.setVolume(0.3); 
    
    // 3. Configuracion del audio de la linterna del casco
    linterna.setBuffer(linternaBuffer);
    linterna.setLoop(false);
    linterna.setVolume(0.3); 
    
    // 4. Configuracion del audio de la alarma
    alarma.setBuffer(alarmaBuffer);
    alarma.setLoop(true);
    alarma.setVolume(1); 
    
    console.log(`✓ Audios cargados y configurados`);
    
    return {cierreCaja, aperturaCaja, linterna, alarma};
}
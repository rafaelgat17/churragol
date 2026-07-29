// =========================================================
// STORAGE.JS
// Gestiona el guardado y carga de Ligas, Selecciones, Equipos y
// del Perfil del jugador, usando IndexedDB (localForage).
// =========================================================

const STORAGE_KEY = "churragol_data";
const PERFIL_KEY = "churragol_perfil";

// Variables globales en memoria para que las lecturas sigan siendo sincrónicas
let cachedData = null;
let perfilCache = null;

// Estructura de datos por defecto si no hay nada guardado aún
function getDefaultData() {
    return {
        ligas: [],
        selecciones: [],
        paises: []
    };
}

// Estructura por defecto del perfil (jugador aún no creado: nombre = null)
function getDefaultPerfil() {
    return {
        nombre: null,
        bandera: null,
        nivel: 1,
        xpActual: 0,
        victorias: 0,
        empates: 0,
        derrotas: 0,
        moneda: 0
    };
}

/**
 * Inicializa el almacenamiento desde IndexedDB.
 * Si no encuentra datos guardados, lee 'datos_juego.json' como base.
 * También inicializa el perfil del jugador (nuevo).
 */
async function initStorage() {
    try {
        let data = await localforage.getItem(STORAGE_KEY);

        if (!data) {
            const rawLocal = localStorage.getItem(STORAGE_KEY);
            if (rawLocal) {
                try {
                    data = JSON.parse(rawLocal);
                    console.log("Migrando datos existentes de localStorage a IndexedDB...");
                    await localforage.setItem(STORAGE_KEY, data);
                    localStorage.removeItem(STORAGE_KEY);
                } catch (e) {
                    console.error("Error al parsear datos antiguos de localStorage:", e);
                }
            }
        }

        if (!data) {
            console.log("⚠️ No hay datos en IndexedDB/localStorage. Cargando datos_juego.json...");
            try {
                const res = await fetch("./datos_juego.json");
                if (res.ok) {
                    data = await res.json();
                    await localforage.setItem(STORAGE_KEY, data);
                    console.log("✅ ¡Base de datos inicializada con exito desde datos_juego.json!");
                } else {
                    console.error("❌ No se pudo encontrar datos_juego.json en la carpeta raíz.");
                }
            } catch (fetchErr) {
                console.error("❌ Error al leer datos_juego.json:", fetchErr);
            }
        }

        cachedData = data || getDefaultData();

        // Inicializamos también el perfil del jugador
        await initPerfil();

        return cachedData;
    } catch (err) {
        console.error("Error al inicializar IndexedDB:", err);
        cachedData = getDefaultData();
        perfilCache = getDefaultPerfil();
        return cachedData;
    }
}

// Carga los datos actuales guardados en memoria
function loadData() {
    if (!cachedData) {
        console.warn("Storage aún no inicializado. Usando datos por defecto.");
        return getDefaultData();
    }
    return cachedData;
}

// Guarda todos los datos en la caché local e inicia el guardado en IndexedDB (asíncrono)
function saveData(data) {
    cachedData = data;
    localforage.setItem(STORAGE_KEY, data).catch(err => {
        console.error("Error al guardar datos en IndexedDB:", err);
    });
}

// Genera un ID único simple para ligas/equipos
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// ---------------------------------------------------------
// PERFIL DEL JUGADOR
// ---------------------------------------------------------

async function initPerfil() {
    try {
        const perfil = await localforage.getItem(PERFIL_KEY);
        perfilCache = perfil || getDefaultPerfil();
        return perfilCache;
    } catch (err) {
        console.error("Error al inicializar el perfil:", err);
        perfilCache = getDefaultPerfil();
        return perfilCache;
    }
}

// Carga el perfil actual guardado en memoria (síncrono)
function loadPerfil() {
    if (!perfilCache) {
        console.warn("Perfil aún no inicializado. Usando datos por defecto.");
        return getDefaultPerfil();
    }
    return perfilCache;
}

// Guarda el perfil en caché local e inicia el guardado en IndexedDB
function savePerfil(perfil) {
    perfilCache = perfil;
    localforage.setItem(PERFIL_KEY, perfil).catch(err => {
        console.error("Error al guardar el perfil:", err);
    });
}

// ¿Ya se ha creado el perfil (nombre elegido) al menos una vez?
function existePerfilCreado() {
    const p = loadPerfil();
    return !!(p && p.nombre);
}

// ---------------------------------------------------------
// FUNCIONES PARA PAÍSES
// ---------------------------------------------------------

function addPais(nombre, logoBase64, colorFondo, colorBorde, continenteId) {
    const data = loadData();
    const nuevoPais = {
        id: generateId(),
        nombre: nombre,
        logo: logoBase64,
        colorFondo: colorFondo || "#1b2438",
        colorBorde: colorBorde || "#ffd600",
        continenteId: continenteId || "europa"
    };
    data.paises.push(nuevoPais);
    saveData(data);
    return nuevoPais;
}

// ---------------------------------------------------------
// FUNCIONES PARA LIGAS
// ---------------------------------------------------------

function addLiga(nombre, logoBase64, paisId) {
    const data = loadData();
    const nuevaLiga = {
        id: generateId(),
        nombre: nombre,
        logo: logoBase64,
        paisId: paisId || "espana",
        equipos: []
    };
    data.ligas.push(nuevaLiga);
    saveData(data);
    return nuevaLiga;
}

function deleteLiga(ligaId) {
    const data = loadData();
    data.ligas = data.ligas.filter(l => l.id !== ligaId);
    saveData(data);
}

function addEquipoALiga(ligaId, equipo) {
    const data = loadData();
    const liga = data.ligas.find(l => l.id === ligaId);
    if (!liga) return null;

    const nuevoEquipo = {
        id: generateId(),
        nombre: equipo.nombre,
        escudo: equipo.escudo,
        colorFondo: equipo.colorFondo,
        colorBorde: equipo.colorBorde
    };
    liga.equipos.push(nuevoEquipo);
    saveData(data);
    return nuevoEquipo;
}

function deleteEquipoDeLiga(ligaId, equipoId) {
    const data = loadData();
    const liga = data.ligas.find(l => l.id === ligaId);
    if (!liga) return;
    liga.equipos = liga.equipos.filter(e => e.id !== equipoId);
    saveData(data);
}

// ---------------------------------------------------------
// FUNCIONES PARA SELECCIONES (misma lógica que un equipo suelto)
// ---------------------------------------------------------

function addSeleccion(seleccion) {
    const data = loadData();
    const nuevaSeleccion = {
        id: generateId(),
        nombre: seleccion.nombre,
        escudo: seleccion.escudo,
        colorFondo: seleccion.colorFondo,
        colorBorde: seleccion.colorBorde,
        continenteId: seleccion.continenteId || "europa"
    };
    data.selecciones.push(nuevaSeleccion);
    saveData(data);
    return nuevaSeleccion;
}

function deleteSeleccion(seleccionId) {
    const data = loadData();
    data.selecciones = data.selecciones.filter(s => s.id !== seleccionId);
    saveData(data);
}

// ---------------------------------------------------------
// UTILIDAD: obtener TODOS los equipos jugables (ligas + selecciones)
// en un formato plano, útil para la pantalla de selección de equipos
// ---------------------------------------------------------

function getTodosLosEquiposJugables() {
    const data = loadData();
    let equipos = [];

    data.ligas.forEach(liga => {
        liga.equipos.forEach(eq => {
            equipos.push({
                ...eq,
                origen: "liga",
                origenNombre: liga.nombre
            });
        });
    });

    data.selecciones.forEach(sel => {
        equipos.push({
            ...sel,
            origen: "seleccion",
            origenNombre: "Selecciones"
        });
    });

    return equipos;
}
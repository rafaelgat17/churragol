// =========================================================
// STORAGE.JS
// Gestiona el guardado y carga de Ligas, Selecciones y Equipos
// usando IndexedDB (a través de localForage) para espacio ilimitado.
// =========================================================

const STORAGE_KEY = "churragol_data";

// Variable global en memoria para que las lecturas sigan siendo sincrónicas
let cachedData = null;

// Estructura de datos por defecto si no hay nada guardado aún
function getDefaultData() {
    return {
        ligas: [],        // [{ id, nombre, logo(base64), equipos: [...] }]
        selecciones: [],   // [{ id, nombre, escudo(base64), colorFondo, colorBorde }]
                          // (las selecciones son "equipos sueltos", sin liga)
        paises: []         // [{ id, nombre, logo(base64), colorFondo, colorBorde }]
    };
}

/**
 * Inicializa el almacenamiento desde IndexedDB.
 * Si no encuentra datos guardados, lee 'datos_juego.json' como base.
 */
async function initStorage() {
    try {
        // 1. Intentar cargar desde IndexedDB (localForage)
        let data = await localforage.getItem(STORAGE_KEY);

        // 2. Si no hay nada en IndexedDB, buscar en localStorage por retrocompatibilidad
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

        // 3. Si sigue sin haber datos, cargamos el archivo datos_juego.json de la raíz
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

        // 4. Asignar a la memoria global
        cachedData = data || getDefaultData();
        return cachedData;
    } catch (err) {
        console.error("Error al inicializar IndexedDB:", err);
        cachedData = getDefaultData();
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
        continenteId: continenteId || "europa" // Guardamos a qué continente pertenece el país
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
        escudo: equipo.escudo,       // base64
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
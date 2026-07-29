// =========================================================
// MAIN.JS
// Punto de entrada: crea el canvas, gestiona el cambio entre
// pantallas y arranca el bucle principal de renderizado
// =========================================================

// Referencia global al canvas y su contexto (usada por TODAS las pantallas)
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Convierte las coordenadas del evento de ratón (en píxeles de pantalla)
// a coordenadas reales del canvas (en píxeles internos), teniendo en
// cuenta que el canvas se muestra escalado (CSS width/height distinto
// de canvas.width/height)
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * escalaX,
        y: (e.clientY - rect.top) * escalaY
    };
}

// Registro de todas las pantallas disponibles, cada una con init/destroy/draw
const Pantallas = {
    menu: MenuScreen,
    editor: EditorScreen,
    teamSelect: TeamSelectScreen,
    game: GameScreen,
    onlineLobby: OnlineLobbyScreen,
    profile: ProfileScreen
};

let pantallaActual = null;
let nombrePantallaActual = null;

// ---------------------------------------------------------
// Cambia de una pantalla a otra, llamando a destroy() de la
// anterior e init() de la nueva, de forma ordenada
// ---------------------------------------------------------
function cambiarPantalla(nombre) {
    const nuevaPantalla = Pantallas[nombre];
    if (!nuevaPantalla) {
        console.error("Pantalla no encontrada:", nombre);
        return;
    }

    if (pantallaActual && typeof pantallaActual.destroy === "function") {
        pantallaActual.destroy();
    }

    nombrePantallaActual = nombre;
    pantallaActual = nuevaPantalla;

    if (typeof pantallaActual.init === "function") {
        pantallaActual.init();
    }
}

// ---------------------------------------------------------
// Ajusta el tamaño del canvas según el hueco disponible en pantalla,
// manteniendo una proporción fija tipo "campo de fútbol" (más ancho que alto)
// ---------------------------------------------------------
function ajustarTamanoCanvas() {
    const anchoDeseado = 960;
    const altoDeseado = 600;
    const ratio = anchoDeseado / altoDeseado;

    const maxAncho = window.innerWidth * 0.95;
    const maxAlto = window.innerHeight * 0.95;

    let ancho = maxAncho;
    let alto = ancho / ratio;

    if (alto > maxAlto) {
        alto = maxAlto;
        ancho = alto * ratio;
    }

    canvas.width = anchoDeseado;   // resolución interna fija (nitidez pixel art)
    canvas.height = altoDeseado;
    canvas.style.width = ancho + "px";   // tamaño visual en pantalla (responsive)
    canvas.style.height = alto + "px";
}

// ---------------------------------------------------------
// BUCLE PRINCIPAL DE RENDERIZADO (requestAnimationFrame)
// Se limpia el canvas y se delega el dibujo a la pantalla activa
// ---------------------------------------------------------
function bucleJuego() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pantallaActual && typeof pantallaActual.draw === "function") {
        pantallaActual.draw(ctx);
    }

    requestAnimationFrame(bucleJuego);
}

// ---------------------------------------------------------
// CARGA INICIAL DEL JSON
// ---------------------------------------------------------
async function cargarJSONBase() {
    try {
        const res = await fetch("./datos_juego.json");
        if (res.ok) {
            const data = await res.json();
            
            // Intentamos guardar tanto en localForage como en localStorage por seguridad
            if (typeof localforage !== "undefined") {
                await localforage.setItem("datos_juego", data);
            }
            localStorage.setItem("datos_juego", JSON.stringify(data));
            
            console.log("✅ JSON cargado e inyectado correctamente:", data);
            return data;
        } else {
            console.error("❌ No se encontró el archivo datos_juego.json en la raíz.");
        }
    } catch (e) {
        console.error("❌ Error al hacer fetch de datos_juego.json:", e);
    }
    return null;
}

// ---------------------------------------------------------
// ARRANQUE DEL JUEGO
// ---------------------------------------------------------
window.addEventListener("resize", ajustarTamanoCanvas);

window.addEventListener("DOMContentLoaded", async () => {
    ajustarTamanoCanvas();

    // 1. Comprobamos si hay datos guardados
    let datos = null;
    if (typeof localforage !== "undefined") {
        datos = await localforage.getItem("datos_juego");
    }
    if (!datos) {
        datos = localStorage.getItem("datos_juego");
    }

    // 2. Si no hay datos (porque borraste IndexedDB/localStorage), cargamos el JSON
    if (!datos) {
        console.log("⚠️ No se detectaron datos guardados. Intentando cargar datos_juego.json...");
        await cargarJSONBase();
    }

    // 3. Inicializamos el almacenamiento global (storage.js)
    if (typeof initStorage === "function") {
        await initStorage();
    }

    // 4. Arrancamos
    cambiarPantalla("menu");
    bucleJuego();
});
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
    game: GameScreen
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
// ARRANQUE DEL JUEGO (Asíncrono con IndexedDB)
// ---------------------------------------------------------
window.addEventListener("resize", ajustarTamanoCanvas);

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Ajustar dimensiones del canvas
    ajustarTamanoCanvas();

    // 2. Esperar a que el storage (IndexedDB) cargue los datos o migre los de localStorage
    if (typeof initStorage === "function") {
        await initStorage();
    } else {
        console.warn("initStorage no está definido. Asegúrate de cargar storage.js correctamente.");
    }

    // 3. Entrar al menú e iniciar el bucle de juego una vez cargados los datos
    cambiarPantalla("menu");
    bucleJuego();
});
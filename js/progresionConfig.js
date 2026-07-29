// =========================================================
// PROGRESIONCONFIG.JS
// Toda la configuración numérica del sistema de progreso del
// jugador: XP por nivel, puntos por resultado, y rangos.
// Si algún día hay que rebalancear el juego, se toca SOLO este
// archivo, nada más depende de estos números directamente.
// =========================================================

const XP_BASE = 50;
const XP_EXPONENTE = 1.4;

// XP necesario para pasar del nivel N al N+1
function xpNecesarioParaNivel(nivel) {
    return Math.round(XP_BASE * Math.pow(nivel, XP_EXPONENTE));
}

const PUNTOS_XP = {
    victoria: 25,
    empate: 8,
    derrota: -5
};

const MONEDA_POR_RESULTADO = {
    victoria: 15,
    empate: 5,
    derrota: 0
};

// Tramos de nivel → nombre de rango
const RANGOS = [
    { min: 1, max: 4, nombre: "Novato" },
    { min: 5, max: 9, nombre: "Aficionado" },
    { min: 10, max: 14, nombre: "Amateur" },
    { min: 15, max: 24, nombre: "Experimentado" },
    { min: 25, max: 34, nombre: "Profesional" },
    { min: 35, max: 49, nombre: "Veterano" },
    { min: 50, max: 69, nombre: "Élite" },
    { min: 70, max: Infinity, nombre: "Leyenda" }
];

function getRangoPorNivel(nivel) {
    return RANGOS.find(r => nivel >= r.min && nivel <= r.max) || RANGOS[RANGOS.length - 1];
}

// Aplica el resultado de una partida al perfil: suma victoria/empate/
// derrota, ajusta XP y moneda, y resuelve las subidas de nivel que
// hagan falta (puede subir más de un nivel de golpe si el XP alcanza).
// Devuelve el propio perfil modificado.
function aplicarResultadoAPerfil(perfil, resultado) {
    if (resultado === "victoria") perfil.victorias++;
    else if (resultado === "empate") perfil.empates++;
    else perfil.derrotas++;

    perfil.moneda = (perfil.moneda || 0) + MONEDA_POR_RESULTADO[resultado];

    perfil.xpActual += PUNTOS_XP[resultado];
    if (perfil.xpActual < 0) perfil.xpActual = 0;

    let requerido = xpNecesarioParaNivel(perfil.nivel);
    while (perfil.xpActual >= requerido) {
        perfil.xpActual -= requerido;
        perfil.nivel++;
        requerido = xpNecesarioParaNivel(perfil.nivel);
    }

    return perfil;
}

// Porcentaje de victorias sobre el total de partidos jugados (0 si no ha jugado ninguna)
function calcularPorcentajeVictorias(perfil) {
    const total = perfil.victorias + perfil.empates + perfil.derrotas;
    if (total === 0) return 0;
    return Math.round((perfil.victorias / total) * 100);
}
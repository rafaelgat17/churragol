// =========================================================
// GAME.JS
// Motor del partido: campo, fichas, balón, físicas, marcador
// (El sistema de power-ups vive en powerups.js)
// Incluye soporte para partidas 1 VS 1 online (host/invitado)
// =========================================================

// ---------------------------------------------------------
// CONSTANTES FÍSICAS Y DE JUEGO
// ---------------------------------------------------------
const FICHA_RADIO = 18;
const BALON_RADIO = 10;

const FRICCION = 0.975;
const FRICCION_HIELO = 0.993;
const VELOCIDAD_MINIMA = 0.08;
const MAX_POTENCIA_DISPARO = 26;
const DISTANCIA_MAX_ARRASTRE = 120;

const DURACION_PARTIDO = 240; // 4 minutos
const GOLES_LIMITE = 99;
const DURACION_CELEBRACION_GOL = 2.5;

const EXPLOSION_PARTICULA_VIDA = 0.45;
const EXPLOSION_PARTICULA_CANTIDAD = 22;
const EXPLOSION_PARTICULA_RADIO = 2.5;
const RESPAWN_DELAY = 0.5;
const RESPAWN_ANIM_DURACION = 0.5;

let explosionParticles = [];

const CAMPO_MARGEN_SUP = 90;
const CAMPO_MARGEN_LADOS = 60;
const CAMPO_MARGEN_INF = 30;

const PORTERIA_ALTO = 130;
const PORTERIA_PROFUNDIDAD = 50;
const POSTE_RADIO = 6;

let porteriaMultiplicadorActual = 1;

let hieloActivo = false;
let esperandoParadaTrasHielo = false;

// Balones extra del power-up MULTI_BALL
let balonesExtra = [];
let multiballActivoAnterior = false;
let balonesExtraCongelados = false;

let fichaCongelada = null; // ficha inmovilizada por FREEZE_BALL + STICKY_BALL a la vez

let penaltiState = { activo: false, equipoAtacante: null };

// ---------------------------------------------------------
// ESTADO ONLINE
// El motor sigue usando internamente "jugador" (izquierda) y
// "cpu" (derecha) para todo. El host SIEMPRE controla "jugador",
// el invitado SIEMPRE controla "cpu" (sin espejar nada visualmente).
// ---------------------------------------------------------
let modoOnline = false;
let esHostOnline = false;

// Devuelve qué lado ("jugador" o "cpu") controla la persona que
// está viendo ESTA pantalla
function getLadoLocal() {
    if (!modoOnline) return "jugador";
    return esHostOnline ? "jugador" : "cpu";
}

// ¿Es el turno de la persona que está viendo esta pantalla?
function esTurnoLocal(estado) {
    if (estado === "esperando_jugador") return getLadoLocal() === "jugador";
    if (estado === "pensando_cpu") return getLadoLocal() === "cpu";
    return false;
}

// ---------------------------------------------------------
// ENTIDAD: FICHA
// ---------------------------------------------------------
class Ficha {
    constructor(x, y, equipo, colorFondo, colorBorde, escudoImg) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radio = FICHA_RADIO;
        this.masa = 1;
        this.equipo = equipo;
        this.colorFondo = colorFondo;
        this.colorBorde = colorBorde;
        this.escudoImg = escudoImg;
        this.seleccionable = (equipo === getLadoLocal());
        this.spawnX = x;
        this.spawnY = y;
        this.ultimoDisparoMaximo = false;
        this.respawnTimer = 0;
        this.respawnAnim = 0;
        this.rainbowPower = false;
        this.enCorrillo = false;
        this.congelada = false;
    }

    estaQuieta() {
        return Math.abs(this.vx) < VELOCIDAD_MINIMA && Math.abs(this.vy) < VELOCIDAD_MINIMA;
    }

    draw(ctx) {
        if (this.respawnTimer > 0) return;

        ctx.save();

        if (this.respawnAnim > 0) {
            const progreso = 1 - this.respawnAnim / RESPAWN_ANIM_DURACION;
            const escala = 0.2 + progreso * 0.8;
            ctx.globalAlpha = Math.min(1, progreso * 1.2);
            ctx.translate(this.x, this.y);
            ctx.scale(escala, escala);
            ctx.translate(-this.x, -this.y);
        }

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radio * 0.6, this.radio * 0.9, this.radio * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fillStyle = this.colorFondo;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.colorBorde;
        ctx.stroke();

        if (this.escudoImg && this.escudoImg.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radio - 5, 0, Math.PI * 2);
            ctx.clip();
            const s = (this.radio - 5) * 2;
            ctx.drawImage(this.escudoImg, this.x - s / 2, this.y - s / 2, s, s);
            ctx.restore();
        }

        if (this.congelada) {
            ctx.save();
            ctx.strokeStyle = "#9370DB";
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radio + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }
}

// ---------------------------------------------------------
// ENTIDAD: BALÓN
// ---------------------------------------------------------
class Balon {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radio = BALON_RADIO;
        this.masa = 0.4;
        this.rotacion = 0;
        this.lastTouchedByTeam = null;
        this.isBrick = false;
        this.sticky = false;
        this.pegadoA = null;
        this.frozen = false;
        this.freezePos = null;
    }

    estaQuieto() {
        return Math.abs(this.vx) < VELOCIDAD_MINIMA && Math.abs(this.vy) < VELOCIDAD_MINIMA;
    }

    draw(ctx) {
        ctx.save();

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radio * 0.6, this.radio * 0.9, this.radio * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotacion);

        if (this.isBrick) {
            const w = this.brickAncho || this.radio * 2;
            const h = this.brickAlto || this.radio * 1.4;
            const r = 10;

            ctx.beginPath();
            ctx.moveTo(-w / 2 + r, -h / 2);
            ctx.lineTo(w / 2 - r, -h / 2);
            ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
            ctx.lineTo(w / 2, h / 2 - r);
            ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
            ctx.lineTo(-w / 2 + r, h / 2);
            ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
            ctx.lineTo(-w / 2, -h / 2 + r);
            ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
            ctx.closePath();
            ctx.fillStyle = "#f5f5f5";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#000";
            ctx.stroke();

            ctx.fillStyle = "#111";
            const filas = 2;
            const columnas = 3;
            for (let fila = 0; fila < filas; fila++) {
                for (let col = 0; col < columnas; col++) {
                    const px = -w / 2 + (w / (columnas + 1)) * (col + 1);
                    const py = -h / 2 + (h / (filas + 1)) * (fila + 1);
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radio, 0, Math.PI * 2);
            ctx.fillStyle = this.sticky ? "#fff59d" : "#f5f5f5";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#000";
            ctx.stroke();

            ctx.fillStyle = "#111";
            for (let i = 0; i < 5; i++) {
                const ang = (i / 5) * Math.PI * 2;
                const px = Math.cos(ang) * this.radio * 0.5;
                const py = Math.sin(ang) * this.radio * 0.5;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

// ---------------------------------------------------------
// DIBUJO DEL CAMPO DE FÚTBOL
// ---------------------------------------------------------
function getCampoRect() {
    return {
        x: CAMPO_MARGEN_LADOS,
        y: CAMPO_MARGEN_SUP,
        w: canvas.width - CAMPO_MARGEN_LADOS * 2,
        h: canvas.height - CAMPO_MARGEN_SUP - CAMPO_MARGEN_INF
    };
}

function dibujarRedPorteria(ctx, x, y, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    const paso = 10;
    for (let i = x; i <= x + w; i += paso) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i, y + h);
        ctx.stroke();
    }
    for (let j = y; j <= y + h; j += paso) {
        ctx.beginPath();
        ctx.moveTo(x, j);
        ctx.lineTo(x + w, j);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCampo(ctx) {
    const campo = getCampoRect();

    const franjas = 12;
    const anchoFranja = campo.w / franjas;
    const rainbowActivo = (typeof powerUpManager !== 'undefined' && powerUpManager.activeEffects)
        ? powerUpManager.activeEffects.some(efecto => efecto.id === 'RAINBOW')
        : false;
    const coloresArcoiris = ["#ff004c", "#ff9100", "#fff200", "#00ff6a", "#00c8ff", "#a259ff"];

    for (let i = 0; i < franjas; i++) {
        if (rainbowActivo) {
            ctx.fillStyle = coloresArcoiris[i % coloresArcoiris.length];
        } else if (hieloActivo) {
            ctx.fillStyle = i % 2 === 0 ? "#86d5ff" : "#5ebeff";
        } else {
            ctx.fillStyle = i % 2 === 0 ? "#00d500" : "#00aa00";
        }
        ctx.fillRect(campo.x + i * anchoFranja, campo.y, anchoFranja, campo.h);
    }

    const porterias = getPorterias();
    const altoPorteriaActual = porterias.izquierda.yBottom - porterias.izquierda.yTop;

    ctx.save();
    ctx.strokeStyle = hieloActivo ? "#c0f0ff" : "#ffd700";
    ctx.lineWidth = 4;

    ctx.strokeRect(campo.x, campo.y, campo.w, campo.h);

    ctx.beginPath();
    ctx.moveTo(campo.x + campo.w / 2, campo.y);
    ctx.lineTo(campo.x + campo.w / 2, campo.y + campo.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(campo.x + campo.w / 2, campo.y + campo.h / 2, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(campo.x + campo.w / 2, campo.y + campo.h / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffff00";
    ctx.fill();

    const areaAncho = 90;
    const areaAlto = 220;
    const areaY = campo.y + campo.h / 2 - areaAlto / 2;

    ctx.strokeRect(campo.x, areaY, areaAncho, areaAlto);
    ctx.strokeRect(campo.x + campo.w - areaAncho, areaY, areaAncho, areaAlto);

    ctx.strokeRect(campo.x - PORTERIA_PROFUNDIDAD, porterias.izquierda.yTop, PORTERIA_PROFUNDIDAD, altoPorteriaActual);
    ctx.strokeRect(campo.x + campo.w, porterias.derecha.yTop, PORTERIA_PROFUNDIDAD, altoPorteriaActual);

    ctx.restore();

    dibujarRedPorteria(ctx, campo.x - PORTERIA_PROFUNDIDAD, porterias.izquierda.yTop, PORTERIA_PROFUNDIDAD, altoPorteriaActual);
    dibujarRedPorteria(ctx, campo.x + campo.w, porterias.derecha.yTop, PORTERIA_PROFUNDIDAD, altoPorteriaActual);
}

function getPorterias() {
    const campo = getCampoRect();
    const altoPorteria = PORTERIA_ALTO * porteriaMultiplicadorActual;
    const porteriaY = campo.y + campo.h / 2 - altoPorteria / 2;

    return {
        izquierda: { xLinea: campo.x, yTop: porteriaY, yBottom: porteriaY + altoPorteria },
        derecha: { xLinea: campo.x + campo.w, yTop: porteriaY, yBottom: porteriaY + altoPorteria }
    };
}

function getAreasPenalti() {
    const campo = getCampoRect();
    const areaAncho = 90;
    const areaAlto = 220;
    const areaY = campo.y + campo.h / 2 - areaAlto / 2;
    return {
        izquierda: { x: campo.x, y: areaY, w: areaAncho, h: areaAlto },
        derecha: { x: campo.x + campo.w - areaAncho, y: areaY, w: areaAncho, h: areaAlto }
    };
}

function estaEnAreaPenalti(x, y) {
    const areas = getAreasPenalti();
    if (x >= areas.izquierda.x && x <= areas.izquierda.x + areas.izquierda.w &&
        y >= areas.izquierda.y && y <= areas.izquierda.y + areas.izquierda.h) {
        return 'izquierda';
    }
    if (x >= areas.derecha.x && x <= areas.derecha.x + areas.derecha.w &&
        y >= areas.derecha.y && y <= areas.derecha.y + areas.derecha.h) {
        return 'derecha';
    }
    return null;
}

// =========================================================
// Helpers de lectura de power-ups
// =========================================================
function tieneEfectoActivo(id) {
    return typeof powerUpManager !== 'undefined' && powerUpManager.activeEffects.some(e => e.id === id);
}
function getEfectoActivo(id) {
    if (typeof powerUpManager === 'undefined') return null;
    return powerUpManager.activeEffects.find(e => e.id === id) || null;
}

// =========================================================
// Motor de físicas
// =========================================================

function actualizarMovimiento(entidad) {
    if (entidad instanceof Balon && entidad.pegadoA) {
        const f = entidad.pegadoA;
        if (f.respawnTimer > 0 || f.respawnAnim > 0 || !entidad.sticky) {
            entidad.pegadoA = null;
        } else {
            entidad.x = f.x;
            entidad.y = f.y;
            entidad.vx = 0;
            entidad.vy = 0;
            entidad.lastTouchedByTeam = f.equipo;
            return;
        }
    }

    if (entidad instanceof Ficha && entidad.congelada) {
        entidad.vx = 0;
        entidad.vy = 0;
        return;
    }

    entidad.x += entidad.vx;
    entidad.y += entidad.vy;

    if (entidad instanceof Ficha && (entidad.respawnTimer > 0 || entidad.respawnAnim > 0)) {
        return;
    }

    const friccionActual = hieloActivo ? FRICCION_HIELO : FRICCION;
    entidad.vx *= friccionActual;
    entidad.vy *= friccionActual;

    if (estaEnBarro(entidad.x, entidad.y)) {
        entidad.vx *= 0.85;
        entidad.vy *= 0.85;
    }

    if (Math.abs(entidad.vx) < VELOCIDAD_MINIMA) entidad.vx = 0;
    if (Math.abs(entidad.vy) < VELOCIDAD_MINIMA) entidad.vy = 0;

    if (entidad instanceof Ficha && entidad.estaQuieta()) {
        entidad.ultimoDisparoMaximo = false;
    }

    if (entidad instanceof Balon) {
        const velocidad = Math.hypot(entidad.vx, entidad.vy);
        entidad.rotacion += velocidad * 0.05;

        if (entidad.estaQuieto()) {
            entidad.lastTouchedByTeam = null;
        }
    }
}

function estaEnBarro(x, y) {
    if (typeof powerUpManager === 'undefined') return false;
    return powerUpManager.activeEffects.some(effect =>
        effect.id === 'CHARCOS_BARRO' && effect.puddles &&
        effect.puddles.some(p => Math.hypot(p.x - x, p.y - y) < p.radio)
    );
}

// ---------------------------------------------------------
// Colisión entre dos entidades circulares
// ---------------------------------------------------------
function resolverColisionCirculos(a, b) {
    if (a instanceof Balon && a.pegadoA === b) return;
    if (b instanceof Balon && b.pegadoA === a) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distancia = Math.hypot(dx, dy);
    const distanciaMinima = a.radio + b.radio;

    if (distancia === 0 || distancia >= distanciaMinima) return;

    const balonSticky = (a instanceof Balon && a.sticky && !a.pegadoA) ? a
        : ((b instanceof Balon && b.sticky && !b.pegadoA) ? b : null);
    const fichaTocando = (a instanceof Ficha) ? a : (b instanceof Ficha ? b : null);
    if (balonSticky && fichaTocando) {
        const efectoSticky = getEfectoActivo('STICKY_BALL');
        const equipoSticky = efectoSticky ? efectoSticky.team : null;
        if (!equipoSticky || fichaTocando.equipo === equipoSticky) {
            balonSticky.pegadoA = fichaTocando;
            return;
        }
    }

    if (a instanceof Ficha && b instanceof Ficha && a.equipo !== b.equipo) {
        const bp = balonPartido;
        if (bp && bp.pegadoA && (bp.pegadoA === a || bp.pegadoA === b)) {
            bp.pegadoA = null;
        }
    }

    const solapamiento = distanciaMinima - distancia;
    const nx = dx / distancia;
    const ny = dy / distancia;

    const totalMasa = a.masa + b.masa;
    const empujeA = (b.masa / totalMasa) * solapamiento;
    const empujeB = (a.masa / totalMasa) * solapamiento;

    a.x -= nx * empujeA;
    a.y -= ny * empujeA;
    b.x += nx * empujeB;
    b.y += ny * empujeB;

    if (a instanceof Ficha && b instanceof Ficha && a.equipo !== b.equipo && (a.ultimoDisparoMaximo || b.ultimoDisparoMaximo)) {
        handleMaxPowerCollision(a, b);
        return;
    }

    const vRelX = b.vx - a.vx;
    const vRelY = b.vy - a.vy;
    const velocidadNormal = vRelX * nx + vRelY * ny;

    if (velocidadNormal > 0) return;

    const restitucion = 0.85;
    const impulso = -(1 + restitucion) * velocidadNormal / (1 / a.masa + 1 / b.masa);

    const impulsoX = impulso * nx;
    const impulsoY = impulso * ny;

    a.vx -= impulsoX / a.masa;
    a.vy -= impulsoY / a.masa;
    b.vx += impulsoX / b.masa;
    b.vy += impulsoY / b.masa;

    let fichaGolpeadora = null;
    let balonGolpeado = null;
    if (a instanceof Ficha && b instanceof Balon) { fichaGolpeadora = a; balonGolpeado = b; }
    else if (b instanceof Ficha && a instanceof Balon) { fichaGolpeadora = b; balonGolpeado = a; }

    if (fichaGolpeadora && balonGolpeado) {
        if (fichaGolpeadora.rainbowPower) {
            const porterias = getPorterias();
            const objetivo = fichaGolpeadora.equipo === "jugador" ? porterias.derecha : porterias.izquierda;
            const tx = objetivo.xLinea;
            const ty = (objetivo.yTop + objetivo.yBottom) / 2;
            const dx2 = tx - balonGolpeado.x;
            const dy2 = ty - balonGolpeado.y;
            const dist2 = Math.hypot(dx2, dy2) || 1;
            const velocidad = Math.max(Math.hypot(balonGolpeado.vx, balonGolpeado.vy), MAX_POTENCIA_DISPARO * 0.7);
            balonGolpeado.vx = (dx2 / dist2) * velocidad;
            balonGolpeado.vy = (dy2 / dist2) * velocidad;
        }

        balonGolpeado.lastTouchedByTeam = fichaGolpeadora.equipo;
    }
}

function handleMaxPowerCollision(a, b) {
    const zona = estaEnAreaPenalti((a.x + b.x) / 2, (a.y + b.y) / 2);
    const fichaA = a, fichaB = b;
    iniciarRespawnFicha(a);
    iniciarRespawnFicha(b);
    if (zona) {
        iniciarPenalti(zona, fichaA, fichaB);
    }
}

function iniciarRespawnFicha(ficha) {
    ficha.vx = 0;
    ficha.vy = 0;
    ficha.ultimoDisparoMaximo = false;
    ficha.respawnTimer = RESPAWN_DELAY;
    ficha.respawnAnim = 0;
    crearExplosionParticulas(ficha.x, ficha.y, ficha.colorFondo);
}

function respawnFicha(ficha, todasFichas) {
    ficha.x = ficha.spawnX;
    ficha.y = ficha.spawnY;
    ficha.vx = 0;
    ficha.vy = 0;
    ficha.respawnAnim = RESPAWN_ANIM_DURACION;
    ficha.respawnTimer = 0;
    ficha.ultimoDisparoMaximo = false;
    repelerFichasCercanas(ficha, todasFichas);
}

function repelerFichasCercanas(ficha, todasFichas) {
    const repulsion = ficha.radio * 4;
    todasFichas.forEach(otra => {
        if (otra === ficha) return;
        const dx = otra.x - ficha.x;
        const dy = otra.y - ficha.y;
        const distancia = Math.hypot(dx, dy);
        const minDist = ficha.radio + otra.radio + 4;
        if (distancia < minDist) {
            const ang = distancia === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
            otra.x = ficha.x + Math.cos(ang) * repulsion;
            otra.y = ficha.y + Math.sin(ang) * repulsion;
            const campo = getCampoRect();
            otra.x = Math.min(Math.max(otra.x, campo.x + otra.radio), campo.x + campo.w - otra.radio);
            otra.y = Math.min(Math.max(otra.y, campo.y + otra.radio), campo.y + campo.h - otra.radio);
            otra.vx = 0;
            otra.vy = 0;
        }
    });
}

function crearExplosionParticulas(x, y, color) {
    const baseColor = color || "#ffdd55";
    for (let i = 0; i < EXPLOSION_PARTICULA_CANTIDAD; i++) {
        const ang = Math.random() * Math.PI * 2;
        const velocidad = 1.8 + Math.random() * 2.4;
        explosionParticles.push({
            x,
            y,
            vx: Math.cos(ang) * velocidad,
            vy: Math.sin(ang) * velocidad,
            life: EXPLOSION_PARTICULA_VIDA + Math.random() * 0.15,
            age: 0,
            radio: EXPLOSION_PARTICULA_RADIO * (0.8 + Math.random() * 0.8),
            color: baseColor
        });
    }
}

function actualizarTimers(fichas, deltaTime) {
    explosionParticles = explosionParticles.filter(p => {
        p.age += deltaTime;
        return p.age < p.life;
    });

    fichas.forEach(ficha => {
        if (ficha.respawnTimer > 0) {
            ficha.respawnTimer -= deltaTime;
            if (ficha.respawnTimer <= 0) {
                respawnFicha(ficha, fichas);
            }
        } else if (ficha.respawnAnim > 0) {
            ficha.respawnAnim -= deltaTime;
            if (ficha.respawnAnim < 0) {
                ficha.respawnAnim = 0;
            }
        }
    });
}

function drawExplosionParticles(ctx) {
    explosionParticles.forEach(p => {
        const progreso = Math.min(1, p.age / p.life);
        const alpha = Math.max(0, 1 - progreso);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radio * (1 - progreso), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// ---------------------------------------------------------
// Colisión contra los bordes del campo
// ---------------------------------------------------------
function resolverColisionBordes(entidad) {
    const campo = getCampoRect();
    const porterias = getPorterias();
    const restitucionBorde = 0.7;

    const dentroDeAlturaPorteria = entidad.y > porterias.izquierda.yTop && entidad.y < porterias.izquierda.yBottom;

    if (entidad.x - entidad.radio < campo.x) {
        const esBalonEnPorteria = (entidad instanceof Balon) && dentroDeAlturaPorteria;
        if (!esBalonEnPorteria) {
            entidad.x = campo.x + entidad.radio;
            entidad.vx = Math.abs(entidad.vx) * restitucionBorde;
        } else if (entidad.x - entidad.radio < campo.x - PORTERIA_PROFUNDIDAD) {
            entidad.x = campo.x - PORTERIA_PROFUNDIDAD + entidad.radio;
            entidad.vx = Math.abs(entidad.vx) * restitucionBorde;
        }
    }

    if (entidad.x + entidad.radio > campo.x + campo.w) {
        const esBalonEnPorteria = (entidad instanceof Balon) && dentroDeAlturaPorteria;
        if (!esBalonEnPorteria) {
            entidad.x = campo.x + campo.w - entidad.radio;
            entidad.vx = -Math.abs(entidad.vx) * restitucionBorde;
        } else if (entidad.x + entidad.radio > campo.x + campo.w + PORTERIA_PROFUNDIDAD) {
            entidad.x = campo.x + campo.w + PORTERIA_PROFUNDIDAD - entidad.radio;
            entidad.vx = -Math.abs(entidad.vx) * restitucionBorde;
        }
    }

    if (entidad.y - entidad.radio < campo.y) {
        entidad.y = campo.y + entidad.radio;
        entidad.vy = Math.abs(entidad.vy) * restitucionBorde;
    }

    if (entidad.y + entidad.radio > campo.y + campo.h) {
        entidad.y = campo.y + campo.h - entidad.radio;
        entidad.vy = -Math.abs(entidad.vy) * restitucionBorde;
    }
}

function resolverColisionPostes(entidad) {
    const porterias = getPorterias();
    const postes = [
        { x: porterias.izquierda.xLinea, y: porterias.izquierda.yTop },
        { x: porterias.izquierda.xLinea, y: porterias.izquierda.yBottom },
        { x: porterias.derecha.xLinea, y: porterias.derecha.yTop },
        { x: porterias.derecha.xLinea, y: porterias.derecha.yBottom }
    ];

    postes.forEach(poste => {
        const dx = entidad.x - poste.x;
        const dy = entidad.y - poste.y;
        const dist = Math.hypot(dx, dy);
        const minDist = entidad.radio + POSTE_RADIO;
        if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const solape = minDist - dist;
            entidad.x += nx * solape;
            entidad.y += ny * solape;

            const vDotN = entidad.vx * nx + entidad.vy * ny;
            if (vDotN < 0) {
                entidad.vx -= 2 * vDotN * nx * 0.8;
                entidad.vy -= 2 * vDotN * ny * 0.8;
            }
        }
    });
}

function actualizarEstadoHielo(fichas, balon) {
    const hieloActivoAhora = tieneEfectoActivo('HIELO');

    if (hieloActivo && !hieloActivoAhora) {
        if (hayMovimientoFisicoReal(fichas, balon)) {
            esperandoParadaTrasHielo = true;
        }
    }
    hieloActivo = hieloActivoAhora;

    if (esperandoParadaTrasHielo && !hayMovimientoFisicoReal(fichas, balon)) {
        esperandoParadaTrasHielo = false;
    }
}

// ---------------------------------------------------------
// MULTIBALÓN
// ---------------------------------------------------------
function actualizarMultiball() {
    const activo = tieneEfectoActivo('MULTI_BALL');
    if (activo && !multiballActivoAnterior) {
        spawnBalonesExtra(3);
    } else if (!activo && multiballActivoAnterior) {
        limpiarBalonesExtra();
    }
    multiballActivoAnterior = activo;
}

function spawnBalonesExtra(cantidad) {
    const campo = getCampoRect();
    for (let i = 0; i < cantidad; i++) {
        let x, y, intentos = 0, libre;
        do {
            x = campo.x + 40 + Math.random() * (campo.w - 80);
            y = campo.y + 30 + Math.random() * (campo.h - 60);
            libre = !fichasPartido.some(f => Math.hypot(f.x - x, f.y - y) < f.radio + BALON_RADIO + 15);
            intentos++;
        } while (!libre && intentos < 20);
        const nuevo = new Balon(x, y);
        const ang = Math.random() * Math.PI * 2;
        nuevo.vx = Math.cos(ang) * 6;
        nuevo.vy = Math.sin(ang) * 6;
        balonesExtra.push(nuevo);
    }
}

function spawnBalonesExtraQuietos(cantidad) {
    const campo = getCampoRect();
    for (let i = 0; i < cantidad; i++) {
        let x, y, intentos = 0, libre;
        do {
            x = campo.x + 40 + Math.random() * (campo.w - 80);
            y = campo.y + 30 + Math.random() * (campo.h - 60);
            libre = !fichasPartido.some(f => Math.hypot(f.x - x, f.y - y) < f.radio + BALON_RADIO + 15);
            intentos++;
        } while (!libre && intentos < 20);
        balonesExtra.push(new Balon(x, y));
    }
}

function limpiarBalonesExtra() {
    balonesExtra = [];
}

function actualizarBalonesAutonomos() {
    if (balonesExtraCongelados) return;
    balonesExtra.forEach(b => {
        if (b.frozen || b.pegadoA) return;
        const vel = Math.hypot(b.vx, b.vy);
        if (vel < 2) {
            const ang = Math.random() * Math.PI * 2;
            const velocidad = 5 + Math.random() * 4;
            b.vx = Math.cos(ang) * velocidad;
            b.vy = Math.sin(ang) * velocidad;
        }
    });
}

// ---------------------------------------------------------
// FORMA DEL BALÓN (normal / grande / ladrillo)
// ---------------------------------------------------------
function aplicarFormaBalon(b) {
    if (b.pegadoA) {
        b.isBrick = false;
        b.radio = BALON_RADIO;
        b.masa = 0.4;
        return;
    }

    if (tieneEfectoActivo('GIANT_BRICK')) {
        b.isBrick = true;
        b.radio = BALON_RADIO * 2.6;
        b.masa = 5.0;
        b.brickAncho = b.radio * 2.1;
        b.brickAlto = b.radio * 1.4;
    } else if (tieneEfectoActivo('BIG_BALL')) {
        b.isBrick = false;
        b.radio = BALON_RADIO * 1.8;
        b.masa = 0.4;
    } else {
        b.isBrick = false;
        b.radio = BALON_RADIO;
        b.masa = 0.4;
    }
}

function actualizarFormaBalones() {
    aplicarFormaBalon(balonPartido);
    balonesExtra.forEach(aplicarFormaBalon);
}

// ---------------------------------------------------------
// FREEZE_BALL
// ---------------------------------------------------------
function actualizarFreezeBall() {
    const activo = tieneEfectoActivo('FREEZE_BALL');

    if (!activo) {
        if (balonPartido.frozen) balonPartido.frozen = false;
        balonesExtra.forEach(b => { b.frozen = false; });
        if (fichaCongelada) {
            fichaCongelada.congelada = false;
            fichaCongelada = null;
        }
        return;
    }

    if (balonPartido.pegadoA) {
        if (fichaCongelada !== balonPartido.pegadoA) {
            if (fichaCongelada) fichaCongelada.congelada = false;
            fichaCongelada = balonPartido.pegadoA;
            fichaCongelada.congelada = true;
        }
        balonPartido.frozen = false;
    } else {
        if (fichaCongelada) {
            fichaCongelada.congelada = false;
            fichaCongelada = null;
        }
        if (!balonPartido.frozen) {
            balonPartido.frozen = true;
            balonPartido.freezePos = { x: balonPartido.x, y: balonPartido.y };
        }
        balonPartido.x = balonPartido.freezePos.x;
        balonPartido.y = balonPartido.freezePos.y;
        balonPartido.vx = 0;
        balonPartido.vy = 0;
    }

    balonesExtra.forEach(b => {
        if (!b.frozen) {
            b.frozen = true;
            b.freezePos = { x: b.x, y: b.y };
        }
        b.x = b.freezePos.x;
        b.y = b.freezePos.y;
        b.vx = 0;
        b.vy = 0;
    });
}

// ---------------------------------------------------------
// MODO PENALTI
// ---------------------------------------------------------
function desactivarBuffsDeBalonParaPenalti() {
    if (typeof powerUpManager === 'undefined') return;
    const idsBalon = ['BIG_BALL', 'GIANT_BRICK', 'FREEZE_BALL', 'STICKY_BALL', 'MULTI_BALL'];
    powerUpManager.activeEffects = powerUpManager.activeEffects.filter(e => !idsBalon.includes(e.id));
}

function iniciarPenalti(zonaAreaGolpe, fichaA, fichaB) {
    const equipoAtacante = zonaAreaGolpe === 'izquierda' ? 'jugador' : 'cpu';
    const equipoDefensor = equipoAtacante === 'jugador' ? 'cpu' : 'jugador';
    penaltiState = { activo: true, equipoAtacante };

    desactivarBuffsDeBalonParaPenalti();

    const campo = getCampoRect();
    const centroY = campo.y + campo.h / 2;
    const puntoPenaltiX = equipoAtacante === 'jugador'
        ? campo.x + campo.w - 130
        : campo.x + 130;
    const offsetTirador = equipoAtacante === 'jugador' ? -45 : 45;
    const tiradorX = puntoPenaltiX + offsetTirador;

    const candidatas = [fichaA, fichaB];
    const portero = candidatas.find(f => f.equipo === equipoDefensor) || null;
    const tirador = candidatas.find(f => f.equipo === equipoAtacante) || null;

    if (portero) {
        portero.respawnTimer = 0;
        portero.respawnAnim = 0;
        portero.enCorrillo = false;
        portero.x = equipoDefensor === 'jugador' ? campo.x + 25 : campo.x + campo.w - 25;
        portero.y = centroY;
        portero.vx = 0;
        portero.vy = 0;
        portero.masa = 999;
    }

    if (tirador) {
        tirador.respawnTimer = 0;
        tirador.respawnAnim = 0;
        tirador.enCorrillo = false;
        tirador.x = tiradorX;
        tirador.y = centroY;
        tirador.vx = 0;
        tirador.vy = 0;
    }

    const resto = fichasPartido.filter(f => f !== portero && f !== tirador);
    const centroX = campo.x + campo.w / 2;
    const alejamiento = equipoAtacante === 'jugador' ? -1 : 1;
    resto.forEach((f, i) => {
        const ang = (i / resto.length) * Math.PI * 2;
        f.x = centroX + alejamiento * 90 + Math.cos(ang) * 70;
        f.y = centroY + Math.sin(ang) * 70;
        f.vx = 0;
        f.vy = 0;
        f.enCorrillo = true;
    });

    if (balonPartido) {
        balonPartido.pegadoA = null;
        balonPartido.frozen = false;
        balonPartido.sticky = false;
        balonPartido.isBrick = false;
        balonPartido.radio = BALON_RADIO;
        balonPartido.masa = 0.4;
        balonPartido.x = puntoPenaltiX;
        balonPartido.y = centroY;
        balonPartido.vx = 0;
        balonPartido.vy = 0;
        balonPartido.lastTouchedByTeam = null;
    }
    limpiarBalonesExtra();
    multiballActivoAnterior = false;
    balonesExtraCongelados = false;
    if (fichaCongelada) { fichaCongelada.congelada = false; fichaCongelada = null; }

    TurnoPartido.reset(equipoAtacante);
}

function finalizarPenalti() {
    if (!penaltiState.activo) return;
    penaltiState = { activo: false, equipoAtacante: null };

    const jugadorFichas = crearFormacion(SeleccionPartido.equipoJugador, true);
    const cpuFichas = crearFormacion(SeleccionPartido.equipoCPU, false);
    fichasPartido = jugadorFichas.concat(cpuFichas);
    centrarBalon();
}

// ---------------------------------------------------------
// Actualiza TODA la física de un frame (SOLO la ejecuta el host
// en modo online; en offline la ejecuta el único jugador siempre)
// ---------------------------------------------------------
function actualizarFisicas(fichas, balon, deltaTime) {
    actualizarTimers(fichas, deltaTime);

    if (typeof powerUpManager !== 'undefined') {
        const estadoPowerUps = {
            ball: balon,
            teamA: fichas.filter(f => f.equipo === 'jugador'),
            teamB: fichas.filter(f => f.equipo === 'cpu')
        };
        powerUpManager.update(deltaTime, estadoPowerUps, getCampoRect());
        porteriaMultiplicadorActual = estadoPowerUps.goalSizeMultiplier || 1;
    }

    actualizarEstadoHielo(fichas, balon);
    actualizarMultiball();
    actualizarFormaBalones();
    actualizarFreezeBall();
    actualizarBalonesAutonomos();

    fichas.forEach(f => actualizarMovimiento(f));
    actualizarMovimiento(balon);
    balonesExtra.forEach(b => actualizarMovimiento(b));

    const activos = fichas.filter(f => f.respawnTimer <= 0 && f.respawnAnim <= 0);

    for (let i = 0; i < activos.length; i++) {
        for (let j = i + 1; j < activos.length; j++) {
            resolverColisionCirculos(activos[i], activos[j]);
        }
    }

    activos.forEach(f => resolverColisionCirculos(f, balon));
    balonesExtra.forEach(extra => {
        activos.forEach(f => resolverColisionCirculos(f, extra));
    });

    const todosLosBalones = [balon, ...balonesExtra];
    for (let i = 0; i < todosLosBalones.length; i++) {
        for (let j = i + 1; j < todosLosBalones.length; j++) {
            resolverColisionCirculos(todosLosBalones[i], todosLosBalones[j]);
        }
    }

    activos.forEach(f => {
        resolverColisionBordes(f);
        resolverColisionPostes(f);
    });
    resolverColisionBordes(balon);
    resolverColisionPostes(balon);
    balonesExtra.forEach(b => {
        resolverColisionBordes(b);
        resolverColisionPostes(b);
    });
}

function hayMovimientoFisicoReal(fichas, balon) {
    if (!balon.estaQuieto()) return true;
    if (fichas.some(f => f.respawnTimer > 0 || f.respawnAnim > 0)) return true;
    return fichas.some(f => !f.estaQuieta());
}

function hayEntidadesEnMovimiento(fichas, balon) {
    if (esperandoParadaTrasHielo) return true;
    if (hieloActivo) return false;
    return hayMovimientoFisicoReal(fichas, balon);
}

// =========================================================
// Controles del jugador
// =========================================================

const ControlJugador = {
    fichaSeleccionada: null,
    arrastrando: false,
    inicioArrastreX: 0,
    inicioArrastreY: 0,
    actualArrastreX: 0,
    actualArrastreY: 0,

    reset() {
        this.fichaSeleccionada = null;
        this.arrastrando = false;
    },

    onMouseDown(mx, my, fichas, balon) {
        if (!esTurnoLocal(TurnoPartido.estado)) return;
        if (hayEntidadesEnMovimiento(fichas, balon)) return;

        const ficha = fichas.find(f => {
            if (!f.seleccionable || f.enCorrillo || f.congelada) return false;
            const dist = Math.hypot(f.x - mx, f.y - my);
            return dist <= f.radio + 6;
        });

        if (ficha) {
            this.fichaSeleccionada = ficha;
            this.arrastrando = true;
            this.inicioArrastreX = mx;
            this.inicioArrastreY = my;
            this.actualArrastreX = mx;
            this.actualArrastreY = my;
        }
    },

    onMouseMove(mx, my) {
        if (!this.arrastrando) return;
        this.actualArrastreX = mx;
        this.actualArrastreY = my;
    },

    onMouseUp() {
        if (!this.arrastrando || !this.fichaSeleccionada) {
            this.reset();
            return;
        }

        const dx = this.inicioArrastreX - this.actualArrastreX;
        const dy = this.inicioArrastreY - this.actualArrastreY;
        const distancia = Math.hypot(dx, dy);

        if (distancia > 8) {
            const distanciaClamp = Math.min(distancia, DISTANCIA_MAX_ARRASTRE);
            const potencia = (distanciaClamp / DISTANCIA_MAX_ARRASTRE) * MAX_POTENCIA_DISPARO;

            const nx = dx / distancia;
            const ny = dy / distancia;
            const vx = nx * potencia;
            const vy = ny * potencia;
            const maxima = potencia >= MAX_POTENCIA_DISPARO * 0.98;

            if (modoOnline && !esHostOnline) {
                // El invitado NO aplica el disparo localmente: lo manda
                // al host, que es quien tiene la física real
                const idx = fichasPartido.indexOf(this.fichaSeleccionada);
                OnlineManager.enviar("disparoGuest", { fichaIndex: idx, vx, vy, maxima });
            } else {
                this.fichaSeleccionada.vx = vx;
                this.fichaSeleccionada.vy = vy;
                this.fichaSeleccionada.ultimoDisparoMaximo = maxima;
                TurnoPartido.notificarDisparoJugador();
            }
        }

        this.reset();
    },

    draw(ctx) {
        if (!this.arrastrando || !this.fichaSeleccionada) return;

        const ficha = this.fichaSeleccionada;

        const dx = this.inicioArrastreX - this.actualArrastreX;
        const dy = this.inicioArrastreY - this.actualArrastreY;
        const distancia = Math.hypot(dx, dy);
        if (distancia < 4) return;

        const distanciaClamp = Math.min(distancia, DISTANCIA_MAX_ARRASTRE);
        const nx = dx / distancia;
        const ny = dy / distancia;

        const ratioPotencia = distanciaClamp / DISTANCIA_MAX_ARRASTRE;
        let color;
        if (ratioPotencia < 0.4) color = "#4caf50";
        else if (ratioPotencia < 0.75) color = "#ffeb3b";
        else color = "#f44336";

        const largoFlecha = 40 + distanciaClamp * 0.6;
        const finX = ficha.x + nx * largoFlecha;
        const finY = ficha.y + ny * largoFlecha;

        ctx.save();

        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ficha.x, ficha.y);
        ctx.lineTo(finX, finY);
        ctx.stroke();

        const anguloFlecha = Math.atan2(ny, nx);
        const tamanoPunta = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(finX, finY);
        ctx.lineTo(
            finX - tamanoPunta * Math.cos(anguloFlecha - 0.4),
            finY - tamanoPunta * Math.sin(anguloFlecha - 0.4)
        );
        ctx.lineTo(
            finX - tamanoPunta * Math.cos(anguloFlecha + 0.4),
            finY - tamanoPunta * Math.sin(anguloFlecha + 0.4)
        );
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ficha.x, ficha.y, ficha.radio + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
};

// =========================================================
// SISTEMA DE TURNOS
// En offline, "pensando_cpu" es la IA. En online, es el turno
// del rival humano (mismo estado, distinto comportamiento).
// =========================================================
const TIEMPO_PENSAMIENTO_CPU = 2;
const TIEMPO_LIMITE_JUGADOR = 5;

const TurnoPartido = {
    estado: "esperando_jugador",
    turnoSiguiente: "cpu",
    tiempoPensandoCPU: 0,
    tiempoEsperaJugador: 0,

    reset(quienEmpieza) {
        if (quienEmpieza === "cpu") {
            this.estado = "pensando_cpu";
            this.tiempoPensandoCPU = modoOnline ? TIEMPO_LIMITE_JUGADOR : TIEMPO_PENSAMIENTO_CPU;
        } else {
            this.estado = "esperando_jugador";
            this.tiempoEsperaJugador = TIEMPO_LIMITE_JUGADOR;
        }
    },

    actualizar(deltaTime, fichasPartidoParam, balonPartidoParam) {
        if (this.estado === "animando") {
            if (!hayEntidadesEnMovimiento(fichasPartidoParam, balonPartidoParam)) {
                if (penaltiState.activo) {
                    finalizarPenalti();
                }
                if (this.turnoSiguiente === "cpu") {
                    this.estado = "pensando_cpu";
                    this.tiempoPensandoCPU = modoOnline ? TIEMPO_LIMITE_JUGADOR : TIEMPO_PENSAMIENTO_CPU;
                } else {
                    this.estado = "esperando_jugador";
                    this.tiempoEsperaJugador = TIEMPO_LIMITE_JUGADOR;
                }
            }
        } else if (this.estado === "pensando_cpu") {
            this.tiempoPensandoCPU -= deltaTime;
            if (this.tiempoPensandoCPU <= 0) {
                if (modoOnline) {
                    // El rival humano no disparó a tiempo: pasa el turno igualmente
                    balonesExtraCongelados = false;
                    this.turnoSiguiente = "jugador";
                    this.estado = "animando";
                } else {
                    const fichasCPU = fichasPartido.filter(f => f.equipo === "cpu" && !f.enCorrillo);
                    ControlCPU.dispararTurno(fichasCPU, balonPartidoParam);
                    balonesExtraCongelados = false;
                    this.turnoSiguiente = "jugador";
                    this.estado = "animando";
                }
            }
        } else if (this.estado === "esperando_jugador") {
            const bloqueado = hayEntidadesEnMovimiento(fichasPartidoParam, balonPartidoParam);
            if (!bloqueado) {
                this.tiempoEsperaJugador -= deltaTime;
                if (this.tiempoEsperaJugador <= 0) {
                    ControlJugador.reset();
                    this.estado = "pensando_cpu";
                    this.tiempoPensandoCPU = modoOnline ? TIEMPO_LIMITE_JUGADOR : TIEMPO_PENSAMIENTO_CPU;
                }
            }
        }
    },

    notificarDisparoJugador() {
        this.turnoSiguiente = "cpu";
        this.estado = "animando";
        balonesExtraCongelados = false;
    }
};

// =========================================================
// ESTADO DEL PARTIDO, DETECCIÓN DE GOL Y MARCADOR
// =========================================================

const EstadoPartido = {
    golesJugador: 0,
    golesCPU: 0,
    tiempoRestante: DURACION_PARTIDO,
    fase: "jugando",
    ultimoQueMarco: null,
    timerCelebracion: 0,
    ultimoTimestamp: null,

    reset() {
        this.golesJugador = 0;
        this.golesCPU = 0;
        this.tiempoRestante = DURACION_PARTIDO;
        this.fase = "jugando";
        this.ultimoQueMarco = null;
        this.timerCelebracion = 0;
        this.ultimoTimestamp = null;
    }
};

function comprobarGol(balon) {
    if (EstadoPartido.fase !== "jugando") return null;

    const porterias = getPorterias();
    const margenGolConfirmado = 6;

    const dentroAlturaPorteria = balon.y > porterias.izquierda.yTop + 4 &&
                                   balon.y < porterias.izquierda.yBottom - 4;

    if (!dentroAlturaPorteria) return null;

    if (balon.x < porterias.izquierda.xLinea - margenGolConfirmado) {
        return "cpu";
    }

    if (balon.x > porterias.derecha.xLinea + margenGolConfirmado) {
        return "jugador";
    }

    return null;
}

function procesarGol(quienMarca) {
    if (quienMarca === "jugador") {
        EstadoPartido.golesJugador++;
    } else {
        EstadoPartido.golesCPU++;
    }

    EstadoPartido.ultimoQueMarco = quienMarca;
    EstadoPartido.fase = "celebrando_gol";
    EstadoPartido.timerCelebracion = DURACION_CELEBRACION_GOL;
}

function actualizarEstadoPartido(deltaTime) {
    if (EstadoPartido.fase === "jugando") {
        EstadoPartido.tiempoRestante -= deltaTime;

        if (EstadoPartido.tiempoRestante <= 0) {
            EstadoPartido.tiempoRestante = 0;
            EstadoPartido.fase = "finalizado";
        }

        if (EstadoPartido.golesJugador >= GOLES_LIMITE || EstadoPartido.golesCPU >= GOLES_LIMITE) {
            EstadoPartido.fase = "finalizado";
        }

    } else if (EstadoPartido.fase === "celebrando_gol") {
        EstadoPartido.timerCelebracion -= deltaTime;

        if (EstadoPartido.timerCelebracion <= 0) {
            if (EstadoPartido.golesJugador >= GOLES_LIMITE || EstadoPartido.golesCPU >= GOLES_LIMITE || EstadoPartido.tiempoRestante <= 0) {
                EstadoPartido.fase = "finalizado";
            } else {
                EstadoPartido.fase = "jugando";
                reposicionarTrasGol(EstadoPartido.ultimoQueMarco);
            }
        }
    }
}

function formatearTiempo(segundos) {
    const s = Math.max(0, Math.ceil(segundos));
    const min = Math.floor(s / 60);
    const seg = s % 60;
    return `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------
// DIBUJO DEL MARCADOR SUPERIOR
// ---------------------------------------------------------
function drawMarcador(ctx) {
    const alturaBarra = 70;

    ctx.fillStyle = "#000080";
    ctx.fillRect(0, 0, canvas.width, alturaBarra);
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, alturaBarra);
    ctx.lineTo(canvas.width, alturaBarra);
    ctx.stroke();

    const eqJugador = SeleccionPartido.equipoJugador;
    const eqCPU = SeleccionPartido.equipoCPU;

    const imgJugador = getCachedImage(eqJugador.escudo);
    drawEscudo(ctx, imgJugador && imgJugador.complete ? imgJugador : null, 20, 15, 40);
    drawRetroTextFit(ctx, eqJugador.nombre, 70, 35, 150, 10, "#fff", "left");

    const imgCPU = getCachedImage(eqCPU.escudo);
    drawEscudo(ctx, imgCPU && imgCPU.complete ? imgCPU : null, canvas.width - 60, 15, 40);
    drawRetroTextFit(ctx, eqCPU.nombre, canvas.width - 70, 35, 150, 10, "#fff", "right");

    const marcadorTexto = `${EstadoPartido.golesJugador}  -  ${EstadoPartido.golesCPU}`;
    drawRetroText(ctx, marcadorTexto, canvas.width / 2, 30, 22, "#00ffff");

    drawRetroText(ctx, formatearTiempo(EstadoPartido.tiempoRestante), canvas.width / 2, 55, 12, "#ffff00");
}

function recortarNombre(nombre, maxLen) {
    return nombre.length > maxLen ? nombre.substring(0, maxLen - 1) + "." : nombre;
}

// ---------------------------------------------------------
// CARTEL DE GOL ANIMADO
// ---------------------------------------------------------
function drawCartelGol(ctx) {
    if (EstadoPartido.fase !== "celebrando_gol") return;

    const progreso = 1 - (EstadoPartido.timerCelebracion / DURACION_CELEBRACION_GOL);

    let escala;
    if (progreso < 0.25) {
        const t = progreso / 0.25;
        escala = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - ((t - 0.7) / 0.3) * 0.15;
    } else if (progreso > 0.85) {
        const t = (progreso - 0.85) / 0.15;
        escala = 1 - t * 1;
    } else {
        escala = 1;
    }

    const alpha = progreso > 0.85 ? Math.max(0, 1 - (progreso - 0.85) / 0.15) : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centroX = canvas.width / 2;
    const centroY = canvas.height / 2;

    ctx.translate(centroX, centroY);
    ctx.scale(escala, escala);
    ctx.translate(-centroX, -centroY);

    drawRetroPanel(ctx, centroX - 180, centroY - 70, 360, 140, "#000080", "#ffff00");

    drawRetroText(ctx, "¡GOOOOL!", centroX, centroY - 25, 30, "#ff00ff");

    const nombreEquipo = EstadoPartido.ultimoQueMarco === "jugador"
        ? SeleccionPartido.equipoJugador.nombre
        : SeleccionPartido.equipoCPU.nombre;

    drawRetroText(ctx, nombreEquipo.toUpperCase(), centroX, centroY + 20, 14, "#00ffff");

    ctx.restore();
}

function drawIndicadorTurno(ctx) {
    if (EstadoPartido.fase !== "jugando") return;

    let texto = "";
    let countdown = null;

    if (TurnoPartido.estado === "esperando_jugador") {
        countdown = Math.max(0, Math.ceil(TurnoPartido.tiempoEsperaJugador));
        texto = modoOnline ? (getLadoLocal() === "jugador" ? "TU TURNO" : "TURNO RIVAL") : "TU TURNO";
    } else if (TurnoPartido.estado === "pensando_cpu") {
        countdown = Math.max(0, Math.ceil(TurnoPartido.tiempoPensandoCPU));
        texto = modoOnline
            ? (getLadoLocal() === "cpu" ? "TU TURNO" : "TURNO RIVAL")
            : "PENSANDO CPU...";
    }

    if (!texto) return;

    const size = 8;
    ctx.save();
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    const anchoTexto = ctx.measureText(texto).width;
    const textoCountdown = countdown !== null ? String(countdown) : "";
    const anchoCountdown = textoCountdown ? ctx.measureText(textoCountdown).width : 0;
    const espacio = 10;
    const anchoTotal = anchoTexto + (textoCountdown ? espacio + anchoCountdown : 0);
    ctx.restore();

    const startX = canvas.width / 2 - anchoTotal / 2;
    const y = 82;

    drawRetroText(ctx, texto, startX, y, size, "#00ffff", "left");

    if (textoCountdown) {
        drawRetroText(ctx, textoCountdown, startX + anchoTexto + espacio, y, size, "#ff0000", "left");
    }
}

function drawTemporizadorFichas(ctx) {
    if (EstadoPartido.fase !== "jugando") return;
    if (!esTurnoLocal(TurnoPartido.estado)) return;

    const tiempoRestanteTurno = TurnoPartido.estado === "esperando_jugador"
        ? TurnoPartido.tiempoEsperaJugador
        : TurnoPartido.tiempoPensandoCPU;
    const ratio = Math.max(0, Math.min(1, tiempoRestanteTurno / TIEMPO_LIMITE_JUGADOR));
    if (ratio <= 0) return;

    fichasPartido
        .filter(f => f.equipo === getLadoLocal() && f.respawnTimer <= 0 && f.respawnAnim <= 0 && !f.enCorrillo && !f.congelada)
        .forEach(f => {
            ctx.save();
            ctx.strokeStyle = "#ff2222";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radio + 6, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
}

// =========================================================
// SINCRONIZACIÓN ONLINE (host -> invitado)
// El host serializa todo el estado relevante del partido y lo
// envía por red; el invitado simplemente sobrescribe sus objetos
// locales con lo recibido.
// =========================================================

function serializarFicha(f) {
    return {
        x: f.x, y: f.y, vx: f.vx, vy: f.vy, radio: f.radio, masa: f.masa,
        respawnTimer: f.respawnTimer, respawnAnim: f.respawnAnim,
        rainbowPower: f.rainbowPower, enCorrillo: f.enCorrillo,
        congelada: f.congelada, ultimoDisparoMaximo: f.ultimoDisparoMaximo
    };
}
function aplicarFicha(f, d) {
    Object.assign(f, d);
}

function serializarBalon(b) {
    return {
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, radio: b.radio, masa: b.masa,
        isBrick: b.isBrick, brickAncho: b.brickAncho, brickAlto: b.brickAlto,
        sticky: b.sticky, frozen: b.frozen, lastTouchedByTeam: b.lastTouchedByTeam,
        pegadoAIndex: b.pegadoA ? fichasPartido.indexOf(b.pegadoA) : -1
    };
}
function aplicarBalon(b, d) {
    b.x = d.x; b.y = d.y; b.vx = d.vx; b.vy = d.vy; b.radio = d.radio; b.masa = d.masa;
    b.isBrick = d.isBrick; b.brickAncho = d.brickAncho; b.brickAlto = d.brickAlto;
    b.sticky = d.sticky; b.frozen = d.frozen; b.lastTouchedByTeam = d.lastTouchedByTeam;
    b.pegadoA = d.pegadoAIndex >= 0 ? fichasPartido[d.pegadoAIndex] : null;
}

function serializarPowerUps() {
    if (typeof powerUpManager === 'undefined') return null;
    return {
        onField: powerUpManager.activePowerUpsOnField.map(it => ({
            id: it.id, x: it.x, y: it.y, radius: it.radius,
            spawnTime: it.spawnTime, lifeSpan: it.lifeSpan
        })),
        effects: powerUpManager.activeEffects.map(e => ({
            id: e.id, team: e.team, startTime: e.startTime, duration: e.duration,
            puddles: e.puddles || null
        })),
        goalMult: porteriaMultiplicadorActual
    };
}
function aplicarPowerUps(d) {
    if (!d || typeof powerUpManager === 'undefined') return;
    powerUpManager.activePowerUpsOnField = d.onField.map(it => ({
        id: it.id, type: POWERUP_TYPES[it.id], x: it.x, y: it.y,
        radius: it.radius, spawnTime: it.spawnTime, lifeSpan: it.lifeSpan
    }));
    powerUpManager.activeEffects = d.effects.map(e => ({
        id: e.id, type: POWERUP_TYPES[e.id], team: e.team,
        startTime: e.startTime, duration: e.duration, puddles: e.puddles
    }));
    porteriaMultiplicadorActual = d.goalMult;
    hieloActivo = tieneEfectoActivo('HIELO');
}

function serializarEstadoPartido() {
    return {
        fichas: fichasPartido.map(serializarFicha),
        balon: serializarBalon(balonPartido),
        balonesExtra: balonesExtra.map(serializarBalon),
        marcador: {
            golesJugador: EstadoPartido.golesJugador,
            golesCPU: EstadoPartido.golesCPU,
            tiempoRestante: EstadoPartido.tiempoRestante,
            fase: EstadoPartido.fase,
            ultimoQueMarco: EstadoPartido.ultimoQueMarco,
            timerCelebracion: EstadoPartido.timerCelebracion
        },
        turno: {
            estado: TurnoPartido.estado,
            turnoSiguiente: TurnoPartido.turnoSiguiente,
            tiempoPensandoCPU: TurnoPartido.tiempoPensandoCPU,
            tiempoEsperaJugador: TurnoPartido.tiempoEsperaJugador
        },
        powerups: serializarPowerUps()
    };
}

function aplicarEstadoPartido(snap) {
    snap.fichas.forEach((d, i) => { if (fichasPartido[i]) aplicarFicha(fichasPartido[i], d); });
    aplicarBalon(balonPartido, snap.balon);

    if (balonesExtra.length !== snap.balonesExtra.length) {
        balonesExtra = snap.balonesExtra.map(() => new Balon(0, 0));
    }
    balonesExtra.forEach((b, i) => aplicarBalon(b, snap.balonesExtra[i]));

    Object.assign(EstadoPartido, snap.marcador);
    Object.assign(TurnoPartido, snap.turno);

    aplicarPowerUps(snap.powerups);
}

// =========================================================
// Inicialización del partido, colocación de fichas, bucle
// principal de la pantalla de juego y pantalla de fin de partido
// =========================================================

let fichasPartido = [];
let balonPartido = null;

function crearFormacion(equipo, ladoIzquierdo) {
    const campo = getCampoRect();
    const img = getCachedImage(equipo.escudo);
    const fichas = [];

    const posicionesRelativas = [
        { px: 0.08, py: 0.50 },
        { px: 0.22, py: 0.25 },
        { px: 0.22, py: 0.75 },
        { px: 0.40, py: 0.30 },
        { px: 0.40, py: 0.70 }
    ];

    posicionesRelativas.forEach(pos => {
        const px = ladoIzquierdo ? pos.px : 1 - pos.px;
        const x = campo.x + campo.w * px;
        const y = campo.y + campo.h * pos.py;

        const tipoEquipo = ladoIzquierdo ? "jugador" : "cpu";
        fichas.push(new Ficha(x, y, tipoEquipo, equipo.colorFondo, equipo.colorBorde, img));
    });

    return fichas;
}

function centrarBalon() {
    const campo = getCampoRect();
    balonPartido.x = campo.x + campo.w / 2;
    balonPartido.y = campo.y + campo.h / 2;
    balonPartido.vx = 0;
    balonPartido.vy = 0;
    balonPartido.lastTouchedByTeam = null;
    balonPartido.pegadoA = null;
    balonPartido.frozen = false;
}

function reposicionarTrasGol(quienMarco) {
    penaltiState = { activo: false, equipoAtacante: null };
    if (fichaCongelada) { fichaCongelada.congelada = false; fichaCongelada = null; }

    const jugadorFichas = crearFormacion(SeleccionPartido.equipoJugador, true);
    const cpuFichas = crearFormacion(SeleccionPartido.equipoCPU, false);
    fichasPartido = jugadorFichas.concat(cpuFichas);
    centrarBalon();

    if (tieneEfectoActivo('MULTI_BALL')) {
        balonesExtra = [];
        spawnBalonesExtraQuietos(3);
        multiballActivoAnterior = true;
        balonesExtraCongelados = true;
    } else {
        balonesExtra = [];
        multiballActivoAnterior = false;
        balonesExtraCongelados = false;
    }

    const quienSaca = quienMarco === "jugador" ? "cpu" : "jugador";
    TurnoPartido.reset(quienSaca);
}

// ---------------------------------------------------------
// PANTALLA DE JUEGO
// ---------------------------------------------------------
const GameScreen = {

    init() {
        // --- Detección del modo online (viene de teamSelect/onlineLobby) ---
        modoOnline = !!(typeof TeamSelectScreen !== 'undefined' && TeamSelectScreen.modoOnline);
        esHostOnline = modoOnline && typeof OnlineManager !== 'undefined' && OnlineManager.esHost;
        this._temporizadorRed = 0;

        if (modoOnline) {
            // El host siempre es "jugador" (izq), el invitado siempre "cpu" (der)
            const propio = SeleccionPartido.equipoJugador;
            const rival = SeleccionPartido.equipoRival;
            if (esHostOnline) {
                SeleccionPartido.equipoJugador = propio;
                SeleccionPartido.equipoCPU = rival;
            } else {
                SeleccionPartido.equipoJugador = rival;
                SeleccionPartido.equipoCPU = propio;
            }

            OnlineManager.onMensaje = (msg) => {
                if (msg.tipo === "disparoGuest" && esHostOnline) {
                    const f = fichasPartido[msg.datos.fichaIndex];
                    if (f) {
                        f.vx = msg.datos.vx;
                        f.vy = msg.datos.vy;
                        f.ultimoDisparoMaximo = msg.datos.maxima;
                    }
                    TurnoPartido.turnoSiguiente = "jugador";
                    TurnoPartido.estado = "animando";
                    balonesExtraCongelados = false;
                } else if (msg.tipo === "estadoPartido" && !esHostOnline) {
                    aplicarEstadoPartido(msg.datos);
                }
            };

            OnlineManager.onDesconectado = () => {
                alert("El rival se ha desconectado.");
                OnlineManager.desconectar();
                cambiarPantalla("menu");
            };
        }

        EstadoPartido.reset();
        ControlJugador.reset();
        ControlCPU.reset();

        if (typeof powerUpManager !== 'undefined') {
            powerUpManager.reset();
        }
        porteriaMultiplicadorActual = 1;
        hieloActivo = false;
        esperandoParadaTrasHielo = false;
        penaltiState = { activo: false, equipoAtacante: null };
        balonesExtra = [];
        multiballActivoAnterior = false;
        balonesExtraCongelados = false;
        fichaCongelada = null;

        explosionParticles = [];

        const jugadorFichas = crearFormacion(SeleccionPartido.equipoJugador, true);
        const cpuFichas = crearFormacion(SeleccionPartido.equipoCPU, false);
        fichasPartido = jugadorFichas.concat(cpuFichas);

        balonPartido = new Balon(0, 0);
        centrarBalon();

        EstadoPartido.ultimoTimestamp = performance.now();

        TurnoPartido.reset(Math.random() < 0.5 ? "jugador" : "cpu");

        canvas.addEventListener("mousedown", this.onMouseDown);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mouseup", this.onMouseUp);
    },

    destroy() {
        canvas.removeEventListener("mousedown", this.onMouseDown);
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("mouseup", this.onMouseUp);
        document.getElementById("ui-layer").innerHTML = "";
    },

    onMouseDown(e) {
        if (EstadoPartido.fase !== "jugando" || !balonPartido) return;
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;
        ControlJugador.onMouseDown(mx, my, fichasPartido, balonPartido);
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;
        ControlJugador.onMouseMove(mx, my);
    },

    onMouseUp() {
        ControlJugador.onMouseUp();
    },

    draw(ctx) {
        const ahora = performance.now();
        const deltaTime = Math.min((ahora - EstadoPartido.ultimoTimestamp) / 1000, 0.05);
        EstadoPartido.ultimoTimestamp = ahora;

        if (modoOnline && !esHostOnline) {
            // --- INVITADO: solo movimiento "de cara a la galería" ---
            // Sin colisiones entre entidades (eso lo decide el host);
            // la posición real llega por red y corrige cualquier desvío.
            if (EstadoPartido.fase === "jugando" && balonPartido) {
                fichasPartido.forEach(f => actualizarMovimiento(f));
                actualizarMovimiento(balonPartido);
                balonesExtra.forEach(b => actualizarMovimiento(b));

                fichasPartido.forEach(f => {
                    resolverColisionBordes(f);
                    resolverColisionPostes(f);
                });
                resolverColisionBordes(balonPartido);
                resolverColisionPostes(balonPartido);
                balonesExtra.forEach(b => {
                    resolverColisionBordes(b);
                    resolverColisionPostes(b);
                });
            }
        } else {
            // --- HOST u OFFLINE: física real ---
            if (EstadoPartido.fase !== "finalizado") {
                actualizarEstadoPartido(deltaTime);

                if (EstadoPartido.fase === "jugando" && balonPartido) {
                    actualizarFisicas(fichasPartido, balonPartido, deltaTime);
                    TurnoPartido.actualizar(deltaTime, fichasPartido, balonPartido);

                    const golDetectado = comprobarGol(balonPartido);
                    if (golDetectado) {
                        procesarGol(golDetectado);
                        balonPartido.vx = 0;
                        balonPartido.vy = 0;
                        ControlJugador.reset();
                    }
                }
            }

            if (modoOnline && esHostOnline) {
                this._temporizadorRed += deltaTime;
                if (this._temporizadorRed >= 0.1) {
                    this._temporizadorRed = 0;
                    OnlineManager.enviar("estadoPartido", serializarEstadoPartido());
                }
            }
        }

        drawCampo(ctx);
        drawExplosionParticles(ctx);
        if (typeof powerUpManager !== 'undefined') {
            powerUpManager.draw(ctx);
        }
        fichasPartido.forEach(f => f.draw(ctx));
        if (balonPartido) balonPartido.draw(ctx);
        balonesExtra.forEach(b => b.draw(ctx));
        ControlJugador.draw(ctx);
        drawTemporizadorFichas(ctx);
        drawIndicadorTurno(ctx);
        drawMarcador(ctx);
        if (typeof powerUpManager !== 'undefined') {
            powerUpManager.drawHUD(ctx, CAMPO_MARGEN_LADOS, canvas.height - CAMPO_MARGEN_INF + 2, canvas.width - CAMPO_MARGEN_LADOS * 2);
        }
        drawCartelGol(ctx);

        if (EstadoPartido.fase === "finalizado") {
            this.drawPantallaFin(ctx);
        }
    },

    drawPantallaFin(ctx) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centroX = canvas.width / 2;
        const centroY = canvas.height / 2;

        drawRetroPanel(ctx, centroX - 200, centroY - 130, 400, 260, "#000080", "#ffff00");

        drawRetroText(ctx, "FIN DEL PARTIDO", centroX, centroY - 90, 20, "#ffff00");

        const marcadorTexto = `${EstadoPartido.golesJugador}  -  ${EstadoPartido.golesCPU}`;
        drawRetroText(ctx, marcadorTexto, centroX, centroY - 40, 28, "#fff");

        let resultado;
        if (EstadoPartido.golesJugador > EstadoPartido.golesCPU) resultado = "¡HAS GANADO!";
        else if (EstadoPartido.golesJugador < EstadoPartido.golesCPU) resultado = "HAS PERDIDO";
        else resultado = "EMPATE";

        const colorResultado = EstadoPartido.golesJugador > EstadoPartido.golesCPU ? "#00ff00" :
                                EstadoPartido.golesJugador < EstadoPartido.golesCPU ? "#ff00ff" : "#00ffff";
        drawRetroText(ctx, resultado, centroX, centroY, 14, colorResultado);

        const btnW = 150;
        const btnH = 44;

        if (modoOnline) {
            const salirBtn = drawRetroButton(ctx, "SALIR", centroX - btnW / 2, centroY + 50, btnW, btnH, this._hoverFin === "salir");
            salirBtn.id = "salir";
            this._botonesFin = [salirBtn];
        } else {
            const repetirBtn = drawRetroButton(ctx, "REPETIR", centroX - btnW - 10, centroY + 50, btnW, btnH, this._hoverFin === "repetir");
            repetirBtn.id = "repetir";

            const salirBtn = drawRetroButton(ctx, "SALIR", centroX + 10, centroY + 50, btnW, btnH, this._hoverFin === "salir");
            salirBtn.id = "salir";

            this._botonesFin = [repetirBtn, salirBtn];
        }

        ctx.restore();

        if (!this._listenerFinRegistrado) {
            this._listenerFinRegistrado = true;

            canvas.addEventListener("mousemove", (e) => {
                if (EstadoPartido.fase !== "finalizado" || !this._botonesFin) return;
                const pos = getMousePos(e);
                const mx = pos.x;
                const my = pos.y;
                this._hoverFin = null;
                this._botonesFin.forEach(b => {
                    if (isPointInRect(mx, my, b)) this._hoverFin = b.id;
                });
            });

            canvas.addEventListener("click", (e) => {
                if (EstadoPartido.fase !== "finalizado" || !this._botonesFin) return;
                const pos = getMousePos(e);
                const mx = pos.x;
                const my = pos.y;
                this._botonesFin.forEach(b => {
                    if (isPointInRect(mx, my, b)) {
                        if (b.id === "repetir") {
                            cambiarPantalla("game");
                        } else if (b.id === "salir") {
                            if (modoOnline) {
                                OnlineManager.desconectar();
                            }
                            cambiarPantalla("menu");
                        }
                    }
                });
            });
        }
    }
};
// =========================================================
// POWERUPS.JS
// Gestión de Power-Ups: Generación, dibujado holográfico-retro,
// colisión de recogida y control de duración de los efectos.
//
// IMPORTANTE: los efectos que afectan directamente al balón
// (BIG_BALL, GIANT_BRICK, FREEZE_BALL, MULTI_BALL) YA NO mutan el
// balón desde aquí. Este archivo solo registra que el efecto está
// "activo" (con su equipo y duración); es game.js quien, cada frame,
// decide la forma/posición real del balón según qué efectos siguen
// vivos (así se resuelven bien las combinaciones con el balón
// pegajoso y el multibalón). Ver actualizarFormaBalones(),
// actualizarFreezeBall() y actualizarMultiball() en game.js.
// =========================================================

const POWERUP_TYPES = {
    RAINBOW: {
        id: 'RAINBOW',
        number: 1,
        name: '¡ARCOÍRIS!',
        color: 'rainbow',
        hudColor: '#FFD700',
        duration: 15000,
        weight: 15,
        desc: 'Velocidad y fuerza absurda para tus fichas'
    },
    HIELO: {
        id: 'HIELO',
        number: 2,
        name: 'CÉSPED HELADO',
        color: '#5EC8FF',
        duration: 25000,
        weight: 12,
        desc: 'El campo se congela: fichas y balón deslizan mucho más'
    },
    FICHAS_GRANDES: {
        id: 'FICHAS_GRANDES',
        number: 3,
        name: 'FICHAS GIGANTES',
        color: '#33CC33',
        duration: 25000,
        weight: 12,
        desc: 'Agranda las fichas de tu equipo'
    },
    FICHAS_PEQUEÑAS: {
        id: 'FICHAS_PEQUEÑAS',
        number: 4,
        name: 'ENCOGE RIVAL',
        color: '#CC2222',
        duration: 25000,
        weight: 12,
        desc: 'Encoge las fichas del equipo rival'
    },
    CHARCOS_BARRO: {
        id: 'CHARCOS_BARRO',
        number: 5,
        name: 'CHARCOS DE BARRO',
        color: '#8B5A2B',
        duration: 25000,
        weight: 12,
        desc: 'Genera charcos que ralentizan a quien pase por ellos'
    },
    BIG_BALL: {
        id: 'BIG_BALL',
        number: 6,
        name: 'BALÓN GIGANTE',
        color: '#FF66C4',
        duration: 25000,
        weight: 12,
        desc: 'Aumenta el tamaño del balón'
    },
    SHRINK_GOALS: {
        id: 'SHRINK_GOALS',
        number: 7,
        name: 'CERROJO NEGRO',
        color: '#111111',
        duration: 20000,
        weight: 12,
        desc: 'Empequeñece las porterías al mínimo'
    },
    GIANT_BRICK: {
        id: 'GIANT_BRICK',
        number: 8,
        name: 'LADRILLO GIGANTE',
        color: '#FF7A00',
        duration: 20000,
        weight: 12,
        desc: 'Balón enorme y rectangular que manda a las fichas volando'
    },
    FREEZE_BALL: {
        id: 'FREEZE_BALL',
        number: 9,
        name: 'BALÓN PARADO',
        color: '#9370DB',
        duration: 20000,
        weight: 12,
        desc: 'Inmoviliza el balón en el punto exacto'
    },
    STICKY_BALL: {
        id: 'STICKY_BALL',
        number: 10,
        name: 'BALÓN PEGAJOSO',
        color: '#FFEB3B',
        duration: 20000,
        weight: 12,
        desc: 'El balón se pega a la primera ficha de tu equipo que lo toque'
    },
    MULTI_BALL: {
        id: 'MULTI_BALL',
        number: 11,
        name: 'MULTIBALÓN',
        color: '#00BFA5',
        duration: 20000,
        weight: 12,
        desc: 'Aparecen 3 balones más, todos pueden marcar gol'
    }
};

class PowerUpManager {
    constructor() {
        this.activePowerUpsOnField = [];
        this.activeEffects = [];
        this.particles = [];

        this.spawnTimer = 0;
        this.spawnInterval = 480;
        this.maxOnField = 2;
    }

    reset() {
        this.activePowerUpsOnField = [];
        this.activeEffects = [];
        this.particles = [];
        this.spawnTimer = 0;
    }

    getRandomType() {
        const totalWeight = Object.values(POWERUP_TYPES).reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * totalWeight;

        for (const typeKey in POWERUP_TYPES) {
            const type = POWERUP_TYPES[typeKey];
            if (random < type.weight) return type;
            random -= type.weight;
        }
        return POWERUP_TYPES.RAINBOW;
    }

    spawn(fieldBounds, gameState) {
        if (this.activePowerUpsOnField.length >= this.maxOnField) return;

        const type = this.getRandomType();
        const margin = 60;
        const distanciaMinimaEntidad = 70;
        const distanciaMinimaItem = 50;
        const intentosMax = 12;

        const entidades = [...gameState.teamA, ...gameState.teamB];
        if (gameState.ball) entidades.push(gameState.ball);

        let posicion = null;
        for (let intento = 0; intento < intentosMax; intento++) {
            const x = fieldBounds.x + margin + Math.random() * (fieldBounds.w - margin * 2);
            const y = fieldBounds.y + margin + Math.random() * (fieldBounds.h - margin * 2);

            const chocaConEntidad = entidades.some(e => Math.hypot(e.x - x, e.y - y) < distanciaMinimaEntidad);
            const chocaConOtroItem = this.activePowerUpsOnField.some(item => Math.hypot(item.x - x, item.y - y) < distanciaMinimaItem);

            if (!chocaConEntidad && !chocaConOtroItem) {
                posicion = { x, y };
                break;
            }
        }

        if (!posicion) return;

        this.activePowerUpsOnField.push({
            id: type.id,
            type: type,
            x: posicion.x,
            y: posicion.y,
            radius: 16,
            spawnTime: performance.now(),
            lifeSpan: 15000
        });
    }

    update(dt, gameState, fieldBounds) {
        const now = performance.now();

        this.spawnTimer++;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawn(fieldBounds, gameState);
        }

        this.activePowerUpsOnField = this.activePowerUpsOnField.filter(item => {
            return (now - item.spawnTime) < item.lifeSpan;
        });

        this.activePowerUpsOnField.forEach(item => {
            if (Math.random() < 0.4) {
                this.particles.push({
                    x: item.x + (Math.random() - 0.5) * 24,
                    y: item.y + (Math.random() - 0.5) * 24,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: -Math.random() * 1.2,
                    size: Math.random() * 3 + 2,
                    color: item.type.color === 'rainbow' ? '#FFFF00' : item.type.color,
                    life: 1.0
                });
            }
        });

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        this.checkCollisions(gameState, fieldBounds);

        gameState.goalSizeMultiplier = 1.0;

        this.activeEffects = this.activeEffects.filter(effect => {
            const expired = (now - effect.startTime) >= effect.duration;
            if (expired) {
                this.removeEffect(effect, gameState);
            } else {
                this.applyContinuousEffect(effect, gameState);
            }
            return !expired;
        });
    }

    checkCollisions(gameState, fieldBounds) {
        const ball = gameState.ball;
        const allPlayers = [...gameState.teamA, ...gameState.teamB];

        this.activePowerUpsOnField = this.activePowerUpsOnField.filter(item => {
            let collected = false;
            let collectorTeam = null;

            const distBall = Math.hypot(ball.x - item.x, ball.y - item.y);
            if (distBall < (ball.radio + item.radius) && ball.lastTouchedByTeam) {
                collected = true;
                collectorTeam = ball.lastTouchedByTeam;
            }

            if (!collected) {
                for (const player of allPlayers) {
                    const distPlayer = Math.hypot(player.x - item.x, player.y - item.y);
                    if (distPlayer < (player.radio + item.radius)) {
                        collected = true;
                        collectorTeam = player.equipo;
                        break;
                    }
                }
            }

            if (collected) {
                this.activatePowerUp(item.type, collectorTeam, gameState, fieldBounds);
                return false;
            }

            return true;
        });
    }

    // Solo registra el efecto y su duración. La lógica instantánea de
    // los efectos ligados al balón (BIG_BALL, GIANT_BRICK, FREEZE_BALL,
    // MULTI_BALL) vive en game.js para poder coordinarse entre sí.
    activatePowerUp(type, team, gameState, fieldBounds) {
        const now = performance.now();

        const existing = this.activeEffects.find(e => e.id === type.id && e.team === team);
        if (existing) {
            existing.startTime = now;
            return;
        }

        const effect = {
            id: type.id,
            type: type,
            team: team,
            startTime: now,
            duration: type.duration
        };

        this.activeEffects.push(effect);

        if (type.id === 'CHARCOS_BARRO') {
            const cantidadCharcos = 3 + Math.floor(Math.random() * 3);
            const margin = 50;
            const puddles = [];
            for (let i = 0; i < cantidadCharcos; i++) {
                puddles.push({
                    x: fieldBounds.x + margin + Math.random() * (fieldBounds.w - margin * 2),
                    y: fieldBounds.y + margin + Math.random() * (fieldBounds.h - margin * 2),
                    radio: 35 + Math.random() * 20
                });
            }
            effect.puddles = puddles;

        } else if (type.id === 'STICKY_BALL') {
            gameState.ball.sticky = true;
        }
        // BIG_BALL, GIANT_BRICK, FREEZE_BALL y MULTI_BALL: sin lógica
        // instantánea aquí, game.js las gestiona cada frame.
    }

    applyContinuousEffect(effect, gameState) {
        const radioBase = (typeof FICHA_RADIO !== 'undefined') ? FICHA_RADIO : 18;

        if (effect.id === 'RAINBOW') {
            const targetTeam = effect.team === 'jugador' ? gameState.teamA : gameState.teamB;
            targetTeam.forEach(p => { p.rainbowPower = true; });

        } else if (effect.id === 'SHRINK_GOALS') {
            gameState.goalSizeMultiplier = 0.45;

        } else if (effect.id === 'FICHAS_GRANDES') {
            const targetTeam = effect.team === 'jugador' ? gameState.teamA : gameState.teamB;
            targetTeam.forEach(p => { p.radio = radioBase * 1.5; });

        } else if (effect.id === 'FICHAS_PEQUEÑAS') {
            const targetTeam = effect.team === 'jugador' ? gameState.teamB : gameState.teamA;
            targetTeam.forEach(p => { p.radio = radioBase * 0.6; });
        }
        // HIELO y CHARCOS_BARRO: game.js las lee directamente de activeEffects.
        // BIG_BALL, GIANT_BRICK, FREEZE_BALL, STICKY_BALL, MULTI_BALL:
        // gestionadas íntegramente en game.js.
    }

    removeEffect(effect, gameState) {
        const radioBase = (typeof FICHA_RADIO !== 'undefined') ? FICHA_RADIO : 18;

        if (effect.id === 'RAINBOW') {
            [...gameState.teamA, ...gameState.teamB].forEach(p => { p.rainbowPower = false; });

        } else if (effect.id === 'FICHAS_GRANDES') {
            const targetTeam = effect.team === 'jugador' ? gameState.teamA : gameState.teamB;
            targetTeam.forEach(p => { p.radio = radioBase; });

        } else if (effect.id === 'FICHAS_PEQUEÑAS') {
            const targetTeam = effect.team === 'jugador' ? gameState.teamB : gameState.teamA;
            targetTeam.forEach(p => { p.radio = radioBase; });

        } else if (effect.id === 'STICKY_BALL') {
            gameState.ball.sticky = false;
            gameState.ball.pegadoA = null;
        }
        // SHRINK_GOALS y CHARCOS_BARRO no necesitan limpieza explícita.
        // BIG_BALL, GIANT_BRICK, FREEZE_BALL, MULTI_BALL: game.js
        // recalcula el estado del balón cada frame, así que al dejar de
        // estar en activeEffects simplemente vuelven a la normalidad solos.
    }

    // =========================================================
    // DIBUJADO Y RENDERIZADO HOLOGRÁFICO-RETRO
    // =========================================================

    draw(ctx) {
        const time = performance.now() / 1000;

        this.activeEffects.forEach(effect => {
            if (effect.id === 'CHARCOS_BARRO' && effect.puddles) {
                effect.puddles.forEach(p => {
                    ctx.save();
                    ctx.globalAlpha = 0.85;
                    const gradient = ctx.createRadialGradient(p.x, p.y, p.radio * 0.1, p.x, p.y, p.radio);
                    gradient.addColorStop(0, "#6b4423");
                    gradient.addColorStop(1, "#3e2712");
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.ellipse(p.x, p.y, p.radio, p.radio * 0.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = "rgba(0,0,0,0.4)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                });
            }
        });

        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.restore();
        });

        this.activePowerUpsOnField.forEach(item => {
            ctx.save();

            const pulse = Math.sin(time * 8) * 3;
            const radius = item.radius + pulse;

            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.beginPath();
            ctx.arc(item.x + 4, item.y + 4, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.beginPath();
            ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
            ctx.clip();

            if (item.type.color === 'rainbow') {
                const gradient = ctx.createLinearGradient(
                    item.x - radius, item.y - radius,
                    item.x + radius, item.y + radius
                );
                gradient.addColorStop(0, '#FF0000');
                gradient.addColorStop(0.2, '#FF7F00');
                gradient.addColorStop(0.4, '#FFFF00');
                gradient.addColorStop(0.6, '#00FF00');
                gradient.addColorStop(0.8, '#0000FF');
                gradient.addColorStop(1, '#8B00FF');
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = item.type.color;
            }
            ctx.fillRect(item.x - radius, item.y - radius, radius * 2, radius * 2);

            ctx.globalAlpha = 0.22;
            ctx.fillStyle = "#ffffff";
            const desplazamiento = (time * 40) % (radius * 4) - radius * 2;
            for (let bx = -radius * 2; bx < radius * 3; bx += radius * 1.4) {
                ctx.beginPath();
                ctx.moveTo(item.x + bx + desplazamiento, item.y - radius);
                ctx.lineTo(item.x + bx + desplazamiento + radius * 0.35, item.y - radius);
                ctx.lineTo(item.x + bx + desplazamiento - radius * 0.55, item.y + radius);
                ctx.lineTo(item.x + bx + desplazamiento - radius * 0.9, item.y + radius);
                ctx.closePath();
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            const brilloGrad = ctx.createRadialGradient(
                item.x - radius * 0.4, item.y - radius * 0.5, 1,
                item.x, item.y, radius * 1.3
            );
            brilloGrad.addColorStop(0, "rgba(255,255,255,0.55)");
            brilloGrad.addColorStop(0.5, "rgba(255,255,255,0.08)");
            brilloGrad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = brilloGrad;
            ctx.fillRect(item.x - radius, item.y - radius, radius * 2, radius * 2);

            ctx.restore();

            ctx.shadowColor = "#00FFFF";
            ctx.shadowBlur = 8;
            ctx.strokeStyle = (Math.sin(time * 12) > 0) ? '#FFFFFF' : '#00FFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (item.type.id === 'SHRINK_GOALS') {
                ctx.strokeStyle = '#00FFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(item.x, item.y, radius + 4, 0, Math.PI * 2);
                ctx.stroke();
            }

            drawRetroText(ctx, String(item.type.number), item.x, item.y + 1, 14, '#FFFFFF', 'center');

            ctx.restore();
        });
    }

    // Banner con los efectos activos, centrado dentro de cada cartel y
    // limitado al ancho disponible: si hay más efectos de los que caben,
    // los sobrantes esperan su turno (no se acumulan infinitamente).
    drawHUD(ctx, x, y, anchoMax) {
        if (this.activeEffects.length === 0) return;

        const anchoBanner = 168;
        const altoBanner = 22;
        const espacio = 8;
        const disponible = anchoMax || 700;
        const maxBanners = Math.max(1, Math.floor((disponible + espacio) / (anchoBanner + espacio)));

        const visibles = this.activeEffects.slice(0, maxBanners);
        let offsetX = 0;
        const now = performance.now();

        visibles.forEach(effect => {
            const timeLeft = Math.max(0, Math.ceil((effect.duration - (now - effect.startTime)) / 1000));
            const bannerText = `${effect.type.name}: ${timeLeft}s`;

            let bgColor = effect.type.color === 'rainbow' ? (effect.type.hudColor || '#FFD700') : effect.type.color;
            if (bgColor === '#111111') bgColor = '#222244';

            drawRetroPanel(ctx, x + offsetX, y, anchoBanner, altoBanner, bgColor, '#FFFFFF', 2);
            drawRetroTextFit(ctx, bannerText, x + offsetX + anchoBanner / 2, y + altoBanner / 2, anchoBanner - 10, 8, '#FFFFFF', 'center');

            offsetX += anchoBanner + espacio;
        });
    }
}

window.PowerUpManager = PowerUpManager;
window.POWERUP_TYPES = POWERUP_TYPES;
window.powerUpManager = new PowerUpManager();
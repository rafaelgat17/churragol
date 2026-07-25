// =========================================================
// MENU.JS
// Pantalla del menú principal: Logo + botones JUGAR / EDITOR / SALIR
// =========================================================

const MenuScreen = {

    botones: [], // guardará los hitboxes de los botones dibujados
    hover: null, // qué botón está bajo el ratón ahora mismo
    patternOffset: 0,

    // Se llama una vez al entrar en esta pantalla
    init() {
        this.botones = [];
        this.hover = null;
        this.patternOffset = 0;

        // Escuchamos el movimiento y click del ratón sobre el canvas
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("click", this.onClick);
    },

    // Se llama al salir de esta pantalla (limpia los listeners)
    destroy() {
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("click", this.onClick);
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        MenuScreen.hover = null;
        MenuScreen.botones.forEach(btn => {
            if (isPointInRect(mx, my, btn)) {
                MenuScreen.hover = btn.id;
            }
        });
    },

    onClick(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        MenuScreen.botones.forEach(btn => {
            if (isPointInRect(mx, my, btn)) {
                MenuScreen.handleAction(btn.id);
            }
        });
    },

    handleAction(id) {
        if (id === "jugar") {
            cambiarPantalla("teamSelect");
        } else if (id === "editor") {
            cambiarPantalla("editor");
        } else if (id === "salir") {
            // En navegador no se puede "cerrar" la pestaña por seguridad,
            // así que mostramos un mensaje simpático en su lugar
            alert("¡Gracias por jugar a ChurraGol! Ya puedes cerrar la pestaña.");
        }
    },

    // Dibuja la pantalla completa del menú (se llama en cada frame)
    draw(ctx) {
        this.botones = [];

        // Fondo con textura simple tipo césped a rayas (estética retro)
        this.drawFondoCesped(ctx);
        this.drawMenuDecorations(ctx);

        // Letras y decoración exageradas para el menú principal
        drawRetroText(ctx, "CHURRAGOL", canvas.width / 2, 110, 64, "#ffff00");
        drawRetroText(ctx, "-- Lo mejor del deporte --", canvas.width / 2, 170, 16, "#00ffff");
        drawRetroText(ctx, "¡Todo por las weas!", canvas.width / 2, 200, 12, "#ffffff");

        // Botones centrados verticalmente
        const btnW = 240;
        const btnH = 54;
        const btnX = canvas.width / 2 - btnW / 2;
        let btnY = 290;
        const espacio = 72;

        const opciones = [
            { id: "jugar", texto: "JUGAR" },
            { id: "editor", texto: "EDITOR" },
            { id: "salir", texto: "SALIR" }
        ];

        opciones.forEach(op => {
            const hitbox = drawRetroButton(
                ctx, op.texto, btnX, btnY, btnW, btnH,
                this.hover === op.id
            );
            hitbox.id = op.id;
            this.botones.push(hitbox);
            btnY += espacio;
        });
    },

    // Fondo decorativo tipo césped a rayas verdes (simple, sin imágenes externas)
    drawFondoCesped(ctx) {
        const franjas = 14;
        const alturaFranja = canvas.height / franjas;
        for (let i = 0; i < franjas; i++) {
            ctx.fillStyle = i % 2 === 0 ? "#00c000" : "#009e00";
            ctx.fillRect(0, i * alturaFranja, canvas.width, alturaFranja);
        }

        // Patrón curioso animado sobre el césped
        const paso = 32;
        const offset = this.patternOffset;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 2;
        for (let y = -paso + (offset % paso); y < canvas.height; y += paso) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y + paso / 2);
            ctx.stroke();
        }
        for (let x = -paso + (offset % paso); x < canvas.width; x += paso) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + paso / 2, canvas.height);
            ctx.stroke();
        }

        this.patternOffset = (this.patternOffset + 0.4) % paso;
    },

    drawMenuDecorations(ctx) {
        const time = performance.now() / 1000;
        const width = canvas.width;
        const height = canvas.height;

        // Lados holográficos y líneas brillantes
        for (let i = 0; i < 4; i++) {
            const x = i % 2 === 0 ? 16 : width - 24;
            const baseY = 80 + i * 140 - (i > 1 ? 360 : 0);
            const wave = Math.sin(time * 2 + i) * 10;
            const h = 140 + ((i % 2) * 24);
            ctx.save();
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = i % 2 === 0 ? "#00ffff" : "#ff00ff";
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(x, baseY + 12);
            ctx.lineTo(x, baseY + h + wave);
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = i % 2 === 0 ? "#00ffff" : "#ff00ff";
            ctx.fillRect(x - 6, baseY + 36 + wave / 2, 12, 60);
            ctx.restore();
        }

        // Partículas holográficas en las esquinas
        const cornerPoints = [
            { x: 72, y: 72 },
            { x: width - 72, y: 72 },
            { x: 72, y: height - 72 },
            { x: width - 72, y: height - 72 }
        ];
        for (let i = 0; i < cornerPoints.length; i++) {
            const p = cornerPoints[i];
            const radius = 14 + Math.sin(time * 4 + i * 1.7) * 4;
            const alpha = 0.18 + Math.sin(time * 5 + i) * 0.08;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = i % 2 === 0 ? "#ffffff" : "#00ffff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Confeti holográfico en movimiento
        for (let k = 0; k < 10; k++) {
            const confX = ((k * 97 + time * 55) % (width - 48)) + 24;
            const confY = ((k * 67 + time * 90) % (height - 180)) + 100;
            const size = 4 + (k % 3);
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = k % 2 === 0 ? "#ff00ff" : "#00ffff";
            ctx.fillRect(confX, confY, size, size);
            ctx.restore();
        }

        // Marca de agua del creador
        ctx.save();
        ctx.font = "12px 'Courier New', monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(255,255,255,0.56)";
        ctx.fillText("© 2026 Fitrapecio", width - 14, height - 14);
        ctx.restore();
    }
};
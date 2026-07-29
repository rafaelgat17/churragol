// =========================================================
// PERFIL.JS
// Pantalla de perfil del jugador: creación (nombre + bandera)
// y vista de estadísticas (nivel, rango, XP, récord).
// Autocontenido: no depende de funciones de editor.js.
// =========================================================

// Catálogo de banderas seleccionables. Se dibujan como una chapita de
// dos colores (mismo lenguaje visual que ya usa el resto del juego
// para países/ligas), no como banderas reales pixel a pixel.
const BANDERAS_DISPONIBLES = [
    { codigo: "ES", nombre: "España", color1: "#c60b1e", color2: "#ffc400" },
    { codigo: "FR", nombre: "Francia", color1: "#0055a4", color2: "#ef4135" },
    { codigo: "DE", nombre: "Alemania", color1: "#000000", color2: "#dd0000" },
    { codigo: "IT", nombre: "Italia", color1: "#009246", color2: "#ce2b37" },
    { codigo: "PT", nombre: "Portugal", color1: "#046a38", color2: "#da291c" },
    { codigo: "GB", nombre: "Reino Unido", color1: "#012169", color2: "#c8102e" },
    { codigo: "AR", nombre: "Argentina", color1: "#75aadb", color2: "#ffffff" },
    { codigo: "BR", nombre: "Brasil", color1: "#009c3b", color2: "#ffdf00" },
    { codigo: "MX", nombre: "México", color1: "#006341", color2: "#ce1126" },
    { codigo: "US", nombre: "Estados Unidos", color1: "#3c3b6e", color2: "#b22234" },
    { codigo: "JP", nombre: "Japón", color1: "#ffffff", color2: "#bc002d" },
    { codigo: "KR", nombre: "Corea del Sur", color1: "#ffffff", color2: "#cd2e3a" },
    { codigo: "MA", nombre: "Marruecos", color1: "#c1272d", color2: "#006233" },
    { codigo: "DZ", nombre: "Argelia", color1: "#006233", color2: "#ffffff" },
    { codigo: "NG", nombre: "Nigeria", color1: "#008751", color2: "#ffffff" },
    { codigo: "SN", nombre: "Senegal", color1: "#00853f", color2: "#fdef42" },
    { codigo: "NL", nombre: "Países Bajos", color1: "#ae1c28", color2: "#21468b" },
    { codigo: "BE", nombre: "Bélgica", color1: "#fae042", color2: "#ed2939" },
    { codigo: "HR", nombre: "Croacia", color1: "#ff0000", color2: "#171796" },
    { codigo: "PL", nombre: "Polonia", color1: "#ffffff", color2: "#dc143c" },
    { codigo: "SE", nombre: "Suecia", color1: "#006aa7", color2: "#fecc02" },
    { codigo: "NO", nombre: "Noruega", color1: "#ba0c2f", color2: "#00205b" },
    { codigo: "CO", nombre: "Colombia", color1: "#fcd116", color2: "#003893" },
    { codigo: "UY", nombre: "Uruguay", color1: "#0038a8", color2: "#ffffff" },
    { codigo: "CL", nombre: "Chile", color1: "#0039a6", color2: "#d52b1e" },
    { codigo: "AU", nombre: "Australia", color1: "#00008b", color2: "#ff0000" }
];

function getBanderaPorCodigo(codigo) {
    return BANDERAS_DISPONIBLES.find(b => b.codigo === codigo) || null;
}

// Dibuja una banderita de dos colores en el canvas
function drawBandera(ctx, x, y, w, h, codigoBandera) {
    const bandera = getBanderaPorCodigo(codigoBandera);
    ctx.save();
    if (!bandera) {
        ctx.fillStyle = "#333";
        ctx.fillRect(x, y, w, h);
    } else {
        ctx.fillStyle = bandera.color1;
        ctx.fillRect(x, y, w / 2, h);
        ctx.fillStyle = bandera.color2;
        ctx.fillRect(x + w / 2, y, w / 2, h);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

const ProfileScreen = {

    botones: [],
    hover: null,
    vista: "crear", // "crear" | "estadisticas"

    init() {
        this.botones = [];
        this.hover = null;
        this.vista = existePerfilCreado() ? "estadisticas" : "crear";

        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("click", this.onClick);

        // Si aún no hay perfil, abrimos el formulario de creación directamente
        if (this.vista === "crear") {
            mostrarFormularioPerfil(false);
        }
    },

    destroy() {
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("click", this.onClick);
        document.getElementById("ui-layer").innerHTML = "";
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        ProfileScreen.hover = null;
        ProfileScreen.botones.forEach(btn => {
            if (isPointInRect(pos.x, pos.y, btn)) {
                ProfileScreen.hover = btn.id;
            }
        });
    },

    onClick(e) {
        const pos = getMousePos(e);
        ProfileScreen.botones.forEach(btn => {
            if (isPointInRect(pos.x, pos.y, btn)) {
                ProfileScreen.handleAction(btn.id);
            }
        });
    },

    handleAction(id) {
        if (id === "volver") {
            cambiarPantalla("menu");
        } else if (id === "editar_perfil") {
            mostrarFormularioPerfil(true);
        }
    },

    draw(ctx) {
        this.botones = [];

        ctx.fillStyle = "#0a0a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const volverBtn = drawRetroButton(ctx, "< VOLVER", 20, 20, 120, 36, this.hover === "volver");
        volverBtn.id = "volver";
        this.botones.push(volverBtn);

        if (this.vista === "estadisticas") {
            this.drawEstadisticas(ctx);
        } else {
            drawRetroText(ctx, "Completa tu perfil", canvas.width / 2, canvas.height / 2, 14, "#00ffff");
        }
    },

    drawEstadisticas(ctx) {
        const perfil = loadPerfil();
        const rango = getRangoPorNivel(perfil.nivel);
        const porcentaje = calcularPorcentajeVictorias(perfil);
        const xpNecesario = xpNecesarioParaNivel(perfil.nivel);

        drawRetroText(ctx, "TU PERFIL", canvas.width / 2, 70, 26, "#ffff00");

        const centerX = canvas.width / 2;
        drawBandera(ctx, centerX - 30, 110, 60, 40, perfil.bandera);
        drawRetroText(ctx, perfil.nombre || "???", centerX, 175, 20, "#ffffff");
        drawRetroText(ctx, rango.nombre.toUpperCase(), centerX, 200, 12, "#ffd700");

        drawRetroText(ctx, `NIVEL ${perfil.nivel}`, centerX, 240, 14, "#00ffff");

        const barraW = 320;
        const barraH = 22;
        const barraX = centerX - barraW / 2;
        const barraY = 260;

        drawRetroPanel(ctx, barraX, barraY, barraW, barraH, "#1a1a2e", "#666666");
        const ratio = Math.max(0, Math.min(1, perfil.xpActual / xpNecesario));
        ctx.save();
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(barraX + 3, barraY + 3, (barraW - 6) * ratio, barraH - 6);
        ctx.restore();

        drawRetroText(ctx, `${perfil.xpActual} / ${xpNecesario} XP`, centerX, barraY + barraH + 18, 10, "#ffffff");

        const statsY = 340;
        const statsW = 340;
        const statsX = centerX - statsW / 2;

        drawRetroPanel(ctx, statsX, statsY, statsW, 130, "#1a1a2e", "#444444");

        const filaY1 = statsY + 30;
        drawRetroText(ctx, `Victorias: ${perfil.victorias}`, statsX + statsW / 2, filaY1, 11, "#00ff00", "center");
        const filaY2 = statsY + 60;
        drawRetroText(ctx, `Empates: ${perfil.empates}`, statsX + statsW / 2, filaY2, 11, "#ffff00", "center");
        const filaY3 = statsY + 90;
        drawRetroText(ctx, `Derrotas: ${perfil.derrotas}`, statsX + statsW / 2, filaY3, 11, "#ff4444", "center");
        const filaY4 = statsY + 115;
        drawRetroText(ctx, `% Victorias: ${porcentaje}%`, statsX + statsW / 2, filaY4, 10, "#00ffff", "center");

        drawRetroText(ctx, `💰 ${perfil.moneda || 0}`, centerX, statsY + 160, 14, "#ffd700");

        const editBtn = drawRetroButton(ctx, "EDITAR PERFIL", centerX - 100, statsY + 190, 200, 40, this.hover === "editar_perfil");
        editBtn.id = "editar_perfil";
        this.botones.push(editBtn);
    }
};

// ---------------------------------------------------------
// FORMULARIO DE CREACIÓN/EDICIÓN DE PERFIL
// Helpers propios, autocontenidos (no dependen de editor.js)
// ---------------------------------------------------------

function limpiarUiLayerPerfil() {
    document.getElementById("ui-layer").innerHTML = "";
}

function crearCajaFormularioPerfil(titulo) {
    const uiLayer = document.getElementById("ui-layer");
    uiLayer.innerHTML = "";

    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Courier New', monospace;
    `;

    const caja = document.createElement("div");
    caja.style.cssText = `
        background: #2b2b2b; border: 3px solid #f5f5f5;
        box-shadow: 6px 6px 0px #000;
        padding: 24px; width: 340px;
        display: flex; flex-direction: column; gap: 14px;
        max-height: 85vh; overflow-y: auto;
    `;

    const tituloEl = document.createElement("h2");
    tituloEl.textContent = titulo;
    tituloEl.style.cssText = `
        color: #ffd700; font-family: 'Press Start 2P', monospace;
        font-size: 14px; margin-bottom: 10px; text-align: center;
    `;
    caja.appendChild(tituloEl);

    overlay.appendChild(caja);
    uiLayer.appendChild(overlay);

    return caja;
}

function crearInputTextoPerfil(label, valorInicial) {
    const wrapper = document.createElement("div");

    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.cssText = "color: #f5f5f5; font-size: 12px; display: block; margin-bottom: 4px;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = valorInicial || "";
    input.style.cssText = `
        width: 100%; padding: 8px; background: #1a1a1a; color: #fff;
        border: 2px solid #f5f5f5; font-family: 'Courier New', monospace; font-size: 14px;
        box-sizing: border-box;
    `;

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
}

function crearBotonesAccionPerfil(onGuardar) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: flex; gap: 10px; margin-top: 10px;";

    const btnGuardar = document.createElement("button");
    btnGuardar.textContent = "GUARDAR";
    btnGuardar.className = "retro-btn";
    btnGuardar.style.cssText += "flex: 1; font-size: 12px; padding: 10px;";
    btnGuardar.addEventListener("click", onGuardar);

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.className = "retro-btn";
    btnCancelar.style.cssText += "flex: 1; font-size: 12px; padding: 10px; background: #5a1a1a;";
    btnCancelar.addEventListener("click", () => {
        limpiarUiLayerPerfil();
        if (existePerfilCreado()) {
            ProfileScreen.vista = "estadisticas";
        }
    });

    wrapper.appendChild(btnGuardar);
    wrapper.appendChild(btnCancelar);
    return wrapper;
}

function mostrarFormularioPerfil(esEdicion) {
    const perfil = loadPerfil();
    const caja = crearCajaFormularioPerfil(esEdicion ? "EDITAR PERFIL" : "CREA TU PERFIL");

    const campoNombre = crearInputTextoPerfil("Tu nombre (máx. 14)", esEdicion ? perfil.nombre : "");
    campoNombre.input.maxLength = 14;
    caja.appendChild(campoNombre.wrapper);

    const lblBandera = document.createElement("label");
    lblBandera.textContent = "Elige tu país";
    lblBandera.style.cssText = "color:#f5f5f5;font-size:12px;display:block;margin-top:10px;margin-bottom:6px;";
    caja.appendChild(lblBandera);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(6,1fr);gap:6px;max-height:150px;overflow-y:auto;";

    let banderaSeleccionada = esEdicion ? perfil.bandera : null;
    const botonesBandera = [];

    BANDERAS_DISPONIBLES.forEach(bandera => {
        const btn = document.createElement("div");
        btn.title = bandera.nombre;
        const seleccionadaInicial = bandera.codigo === banderaSeleccionada;
        btn.style.cssText = `
            height: 28px; cursor: pointer;
            border: 2px solid ${seleccionadaInicial ? "#ffd700" : "#444"};
            background: linear-gradient(to right, ${bandera.color1} 50%, ${bandera.color2} 50%);
        `;
        btn.addEventListener("click", () => {
            banderaSeleccionada = bandera.codigo;
            botonesBandera.forEach(b => b.style.borderColor = "#444");
            btn.style.borderColor = "#ffd700";
        });
        grid.appendChild(btn);
        botonesBandera.push(btn);
    });
    caja.appendChild(grid);

    caja.appendChild(crearBotonesAccionPerfil(() => {
        const nombre = campoNombre.input.value.trim().slice(0, 14);

        if (!nombre) {
            alert("Ponle un nombre a tu perfil.");
            return;
        }
        if (!banderaSeleccionada) {
            alert("Elige un país.");
            return;
        }

        const perfilActual = loadPerfil();
        perfilActual.nombre = nombre;
        perfilActual.bandera = banderaSeleccionada;
        savePerfil(perfilActual);

        limpiarUiLayerPerfil();
        ProfileScreen.vista = "estadisticas";
    }));
}
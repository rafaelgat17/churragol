// =========================================================
// TEAMSELECT.JS
// Pantalla dividida (estilo FIFA) para elegir equipo.
// Modo offline: tú (izq) vs CPU (der, elegible).
// Modo online (detectado automáticamente si hay conexión activa):
// tú (izq) vs rival humano (der, solo lectura, sincronizado por red).
// =========================================================

// Estado global de la selección, lo leerá game.js al empezar el partido
const SeleccionPartido = {
    equipoJugador: null,
    equipoCPU: null,
    equipoRival: null // solo se usa en modo online
};

const TeamSelectScreen = {

    botones: [],
    hover: null,
    equipos: [],
    estadoIzq: "categoria",
    estadoDer: "categoria",
    ligaActualIzq: null,
    ligaActualDer: null,
    continenteIzq: null,
    continenteDer: null,
    scrollIzq: 0,
    scrollDer: 0,

    // --- Estado del modo online ---
    modoOnline: false,
    listoLocal: false,
    listoRival: false,

    init() {
        this.botones = [];
        this.hover = null;
        this.equipos = getTodosLosEquiposJugables();
        this.estadoIzq = "categoria";
        this.estadoDer = "categoria";
        this.ligaActualIzq = null;
        this.ligaActualDer = null;
        this.continenteIzq = null;
        this.continenteDer = null;
        this.scrollIzq = 0;
        this.scrollDer = 0;

        // Detección automática: si hay una conexión PeerJS abierta,
        // venimos del lobby online
        this.modoOnline = !!(typeof OnlineManager !== "undefined" && OnlineManager.conn && OnlineManager.conn.open);
        this.listoLocal = false;
        this.listoRival = false;

        if (this.modoOnline) {
            SeleccionPartido.equipoRival = null;

            OnlineManager.onMensaje = (msg) => {
                if (msg.tipo === "seleccion") {
                    SeleccionPartido.equipoRival = this.findEquipoById(msg.datos.equipoId);
                } else if (msg.tipo === "listo") {
                    this.listoRival = msg.datos.listo;
                    if (this.listoRival && OnlineManager.esHost) {
                        this.intentarEmpezar();
                    }
                } else if (msg.tipo === "empezarPartido") {
                    this.empezarPartidoOnline();
                }
            };

            OnlineManager.onDesconectado = () => {
                alert("El rival se ha desconectado.");
                OnlineManager.desconectar();
                cambiarPantalla("menu");
            };
        }

        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("click", this.onClick);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });
    },

    destroy() {
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("click", this.onClick);
        canvas.removeEventListener("wheel", this.onWheel);
        // OJO: no desconectamos aquí. Si vamos a "game", la conexión debe
        // seguir viva. Solo se corta explícitamente al pulsar "VOLVER".
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        TeamSelectScreen.hover = null;
        for (let i = TeamSelectScreen.botones.length - 1; i >= 0; i--) {
            const btn = TeamSelectScreen.botones[i];
            if (isPointInRect(mx, my, btn)) {
                TeamSelectScreen.hover = btn.id;
                break;
            }
        }
    },

    onClick(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        for (let i = TeamSelectScreen.botones.length - 1; i >= 0; i--) {
            const btn = TeamSelectScreen.botones[i];
            if (isPointInRect(mx, my, btn)) {
                TeamSelectScreen.handleAction(btn.id);
                break;
            }
        }
    },

    onWheel(e) {
        const mitad = canvas.width / 2;
        const mx = getMousePos(e).x;

        if (mx < mitad) {
            const maxScroll = TeamSelectScreen.getMaxScroll("izq");
            TeamSelectScreen.scrollIzq += e.deltaY;
            TeamSelectScreen.scrollIzq = Math.max(0, Math.min(TeamSelectScreen.scrollIzq, maxScroll));
        } else if (!TeamSelectScreen.modoOnline) {
            const maxScroll = TeamSelectScreen.getMaxScroll("der");
            TeamSelectScreen.scrollDer += e.deltaY;
            TeamSelectScreen.scrollDer = Math.max(0, Math.min(TeamSelectScreen.scrollDer, maxScroll));
        }
        e.preventDefault();
    },

    getMaxScroll(lado) {
        const data = loadData();
        const estado = lado === "izq" ? this.estadoIzq : this.estadoDer;
        const ligaActual = lado === "izq" ? this.ligaActualIzq : this.ligaActualDer;
        const continente = lado === "izq" ? this.continenteIzq : this.continenteDer;

        const espacio = 14;
        const porFila = 3;
        const cardH = 150;

        let totalItems = 0;
        let areaY = 90;

        if (estado === "ligas") {
            const paisesDelContinente = (data.paises || []).filter(p => (p.continenteId || "europa") === continente);
            const idsPaises = paisesDelContinente.map(p => p.id);
            totalItems = data.ligas.filter(liga => idsPaises.includes(liga.paisId)).length;
        } else if (estado === "selecciones") {
            const filtradas = data.selecciones.filter(s => (s.continenteId || "europa") === continente);
            totalItems = filtradas.length;
        } else if (estado === "liga_detalle") {
            const liga = data.ligas.find(l => l.id === ligaActual);
            totalItems = liga && liga.equipos ? liga.equipos.length : 0;
            areaY = 110;
        } else {
            return 0;
        }

        if (totalItems === 0) return 0;

        const areaAltura = canvas.height - areaY - 110;
        const totalFilas = Math.ceil(totalItems / porFila);
        const contentHeight = totalFilas * (cardH + espacio) - espacio + 20;

        return Math.max(0, contentHeight - areaAltura);
    },

    handleAction(id) {
        if (id === "volver") {
            if (this.modoOnline) {
                OnlineManager.desconectar();
            }
            this.estadoIzq = "categoria";
            this.estadoDer = "categoria";
            this.ligaActualIzq = null;
            this.ligaActualDer = null;
            this.continenteIzq = null;
            this.continenteDer = null;
            cambiarPantalla("menu");
        } else if (id === "jugar_partido") {
            if (SeleccionPartido.equipoJugador && SeleccionPartido.equipoCPU) {
                cambiarPantalla("game");
            }
        } else if (id === "toggle_listo") {
            if (!this.modoOnline || !SeleccionPartido.equipoJugador) return;
            this.listoLocal = !this.listoLocal;
            OnlineManager.enviar("listo", { listo: this.listoLocal });
            if (this.listoLocal) this.intentarEmpezar();
        } else if (id.startsWith("cat_izq_")) {
            const cat = id.replace("cat_izq_", "");
            this.estadoIzq = "continentes_" + cat;
            this.scrollIzq = 0;
        } else if (id.startsWith("cat_der_")) {
            if (this.modoOnline) return;
            const cat = id.replace("cat_der_", "");
            this.estadoDer = "continentes_" + cat;
            this.scrollDer = 0;
        } else if (id.startsWith("cont_izq_")) {
            const continente = id.replace("cont_izq_", "");
            this.continenteIzq = continente;
            this.estadoIzq = this.estadoIzq === "continentes_ligas" ? "ligas" : "selecciones";
            this.scrollIzq = 0;
        } else if (id.startsWith("cont_der_")) {
            if (this.modoOnline) return;
            const continente = id.replace("cont_der_", "");
            this.continenteDer = continente;
            this.estadoDer = this.estadoDer === "continentes_ligas" ? "ligas" : "selecciones";
            this.scrollDer = 0;
        } else if (id.startsWith("liga_izq_")) {
            this.estadoIzq = "liga_detalle";
            this.ligaActualIzq = id.replace("liga_izq_", "");
            this.scrollIzq = 0;
        } else if (id.startsWith("liga_der_")) {
            if (this.modoOnline) return;
            this.estadoDer = "liga_detalle";
            this.ligaActualDer = id.replace("liga_der_", "");
            this.scrollDer = 0;
        } else if (id === "back_izq") {
            this.retrocederPanel("izq");
        } else if (id === "back_der") {
            if (this.modoOnline) return;
            this.retrocederPanel("der");
        } else if (id.startsWith("team_izq_")) {
            const equipoId = id.replace("team_izq_", "");
            SeleccionPartido.equipoJugador = this.findEquipoById(equipoId);
            if (this.modoOnline) {
                this.listoLocal = false;
                OnlineManager.enviar("seleccion", { equipoId });
                OnlineManager.enviar("listo", { listo: false });
            }
        } else if (id.startsWith("team_der_")) {
            if (this.modoOnline) return;
            const equipoId = id.replace("team_der_", "");
            SeleccionPartido.equipoCPU = this.findEquipoById(equipoId);
        }
    },

    // Solo el host decide cuándo arranca de verdad la partida
    intentarEmpezar() {
        if (!OnlineManager.esHost) return;
        if (this.listoLocal && this.listoRival) {
            OnlineManager.enviar("empezarPartido", {});
            this.empezarPartidoOnline();
        }
    },

    empezarPartidoOnline() {
        cambiarPantalla("game");
    },

    retrocederPanel(lado) {
        if (lado === "izq") {
            if (this.estadoIzq === "liga_detalle") {
                this.estadoIzq = "ligas";
                this.ligaActualIzq = null;
            } else if (this.estadoIzq === "ligas") {
                this.estadoIzq = "continentes_ligas";
                this.continenteIzq = null;
            } else if (this.estadoIzq === "selecciones") {
                this.estadoIzq = "continentes_selecciones";
                this.continenteIzq = null;
            } else if (this.estadoIzq.startsWith("continentes_")) {
                this.estadoIzq = "categoria";
            }
            this.scrollIzq = 0;
        } else {
            if (this.estadoDer === "liga_detalle") {
                this.estadoDer = "ligas";
                this.ligaActualDer = null;
            } else if (this.estadoDer === "ligas") {
                this.estadoDer = "continentes_ligas";
                this.continenteDer = null;
            } else if (this.estadoDer === "selecciones") {
                this.estadoDer = "continentes_selecciones";
                this.continenteDer = null;
            } else if (this.estadoDer.startsWith("continentes_")) {
                this.estadoDer = "categoria";
            }
            this.scrollDer = 0;
        }
    },

    draw(ctx) {
        this.botones = [];
        const data = loadData();
        this.equipos = getTodosLosEquiposJugables();

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const mitad = canvas.width / 2;

        ctx.fillStyle = "#000080";
        ctx.fillRect(0, 0, mitad, canvas.height);
        ctx.fillStyle = "#800080";
        ctx.fillRect(mitad, 0, mitad, canvas.height);

        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mitad, 0);
        ctx.lineTo(mitad, canvas.height);
        ctx.stroke();

        const volverBtn = drawRetroButton(ctx, "< VOLVER", 20, 20, 110, 36, this.hover === "volver", 12);
        volverBtn.id = "volver";
        this.botones.push(volverBtn);

        drawRetroText(ctx, "TU EQUIPO", mitad / 2, 60, 16, "#ffff00");
        drawRetroText(ctx, this.modoOnline ? "EQUIPO RIVAL" : "EQUIPO CPU", mitad + mitad / 2, 60, 16, "#ffff00");

        if (data.ligas.length === 0 && data.selecciones.length === 0) {
            drawRetroText(ctx, "NO HAY EQUIPOS", mitad / 2, canvas.height / 2, 12, "#00ffff");
            drawRetroText(ctx, "CREALOS EN EL EDITOR", mitad / 2, canvas.height / 2 + 20, 10, "#00ffff");
            drawRetroText(ctx, "NO HAY EQUIPOS", mitad + mitad / 2, canvas.height / 2, 12, "#00ffff");
            drawRetroText(ctx, "CREALOS EN EL EDITOR", mitad + mitad / 2, canvas.height / 2 + 20, 10, "#00ffff");
            return;
        }

        this.drawSidePanel(ctx, 0, mitad, "izq", SeleccionPartido.equipoJugador, this.estadoIzq, this.ligaActualIzq, this.scrollIzq, data);

        if (this.modoOnline) {
            this.drawRivalPanel(ctx, mitad, mitad);
        } else {
            this.drawSidePanel(ctx, mitad, mitad, "der", SeleccionPartido.equipoCPU, this.estadoDer, this.ligaActualDer, this.scrollDer, data);
        }

        if (this.modoOnline) {
            this.drawResumenInferiorOnline(ctx);
        } else {
            this.drawResumenInferior(ctx);
        }
    },

    drawSidePanel(ctx, offsetX, ancho, lado, equipoSeleccionado, estado, ligaActual, scroll, data) {
        if (estado !== "categoria") {
            const backX = lado === "izq" ? offsetX + ancho - 110 : offsetX + 20;
            const backBtn = drawRetroButton(ctx, "ATRAS", backX, 20, 90, 32, this.hover === `back_${lado}`);
            backBtn.id = `back_${lado}`;
            this.botones.push(backBtn);
        }

        if (estado === "categoria") {
            this.drawCategoryOptions(ctx, offsetX, ancho, lado);
            return;
        }

        if (estado.startsWith("continentes_")) {
            this.drawContinentsList(ctx, offsetX, ancho, lado);
            return;
        }

        if (estado === "ligas") {
            this.drawLeagueList(ctx, offsetX, ancho, scroll, lado, data.ligas);
            return;
        }

        if (estado === "selecciones") {
            const continente = lado === "izq" ? this.continenteIzq : this.continenteDer;
            const seleccionesFiltradas = data.selecciones.filter(s => (s.continenteId || "europa") === continente);
            this.drawSelectionList(ctx, offsetX, ancho, scroll, lado, seleccionesFiltradas, equipoSeleccionado);
            return;
        }

        if (estado === "liga_detalle") {
            this.drawLeagueTeams(ctx, offsetX, ancho, scroll, lado, data.ligas, ligaActual, equipoSeleccionado);
            return;
        }
    },

    // Panel de solo lectura para el rival humano en modo online: muestra
    // el equipo que va marcando en tiempo real y si ya ha pulsado LISTO
    drawRivalPanel(ctx, offsetX, ancho) {
        const centerX = offsetX + ancho / 2;
        const centerY = canvas.height / 2 - 20;

        if (SeleccionPartido.equipoRival) {
            const eq = SeleccionPartido.equipoRival;
            const img = getCachedImage(eq.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, centerX - 60, centerY - 90, 120);
            drawWrappedCardName(ctx, eq.nombre, centerX, centerY + 30, ancho - 80, 50, 16, "#ffffff");
        } else {
            drawRetroText(ctx, "Esperando selección", centerX, centerY, 12, "#00ffff");
            drawRetroText(ctx, "del rival...", centerX, centerY + 20, 12, "#00ffff");
        }

        if (this.listoRival) {
            drawRetroText(ctx, "✓ RIVAL LISTO", centerX, centerY + 110, 12, "#00ff00");
        }
    },

    drawCategoryOptions(ctx, offsetX, ancho, lado) {
        const cardW = ancho - 40;
        const cardH = 90;
        const startX = offsetX + 20;
        const startY = 110;

        const ligasBtn = drawRetroButton(ctx, "LIGAS", startX, startY, cardW, cardH, this.hover === `cat_${lado}_ligas`);
        ligasBtn.id = `cat_${lado}_ligas`;
        this.botones.push(ligasBtn);

        const seleccionesBtn = drawRetroButton(ctx, "SELECCIONES", startX, startY + cardH + 18, cardW, cardH, this.hover === `cat_${lado}_selecciones`);
        seleccionesBtn.id = `cat_${lado}_selecciones`;
        this.botones.push(seleccionesBtn);
    },

    drawContinentsList(ctx, offsetX, ancho, lado) {
        const continentes = [
            { id: "europa", nombre: "EUROPA", color: "#0055a5" },
            { id: "america", nombre: "AMERICA", color: "#2e7d32" },
            { id: "africa", nombre: "AFRICA", color: "#e65100" },
            { id: "asia", nombre: "ASIA", color: "#c62828" },
            { id: "oceania", nombre: "OCEANIA", color: "#00838f" }
        ];

        const cardW = ancho - 40;
        const cardH = 50;
        const espacio = 12;
        const startX = offsetX + 20;
        const startY = 100;

        continentes.forEach((cont, i) => {
            const y = startY + i * (cardH + espacio);
            const btnId = `cont_${lado}_${cont.id}`;
            const isHover = this.hover === btnId;

            ctx.save();
            const colorInverso = invertColor(cont.color);
            ctx.fillStyle = isHover ? colorInverso : cont.color;
            ctx.fillRect(startX, y, cardW, cardH);

            ctx.strokeStyle = isHover ? "#ffff00" : "#ffffff";
            ctx.lineWidth = isHover ? 3 : 2;
            ctx.strokeRect(startX, y, cardW, cardH);

            const textColor = isHover ? cont.color : "#ffffff";

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            drawRetroText(ctx, cont.nombre, startX + cardW / 2, y + cardH / 2, 18, textColor);
            ctx.restore();

            this.botones.push({ x: startX, y, w: cardW, h: cardH, id: btnId });
        });
    },

    drawLeagueList(ctx, offsetX, ancho, scroll, lado, ligas) {
        const areaY = 90;
        const areaAltura = canvas.height - areaY - 110;
        const espacio = 14;
        const margen = 18;
        const porFila = 3;
        const cardW = Math.floor((ancho - margen * 2 - espacio * (porFila - 1)) / porFila);
        const cardH = 150;
        const startX = offsetX + margen;

        const data = loadData();
        const continenteSeleccionado = lado === "izq" ? this.continenteIzq : this.continenteDer;

        const paisesDelContinente = (data.paises || []).filter(p => (p.continenteId || "europa") === continenteSeleccionado);
        const idsPaises = paisesDelContinente.map(p => p.id);

        const ligasFiltradas = data.ligas.filter(liga => idsPaises.includes(liga.paisId));

        if (ligasFiltradas.length === 0) {
            drawRetroText(ctx, "NO HAY LIGAS EN ESTE CONTINENTE", offsetX + ancho / 2, canvas.height / 2, 11, "#00ffff");
            drawRetroText(ctx, "CREA LIGAS EN EL EDITOR", offsetX + ancho / 2, canvas.height / 2 + 22, 10, "#00ffff");
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, areaY, ancho, areaAltura);
        ctx.clip();

        ligasFiltradas.forEach((liga, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (cardW + espacio);
            const y = areaY + 10 + fila * (cardH + espacio) - scroll;

            if (y + cardH < areaY || y > areaY + areaAltura) return;

            drawRetroPanel(ctx, x, y, cardW, cardH, "#2b2b2b", "#f5f5f5");
            const img = getCachedImage(liga.logo);
            drawEscudo(ctx, img && img.complete ? img : null, x + cardW / 2 - 40, y + 12, 80);
            drawWrappedCardName(ctx, liga.nombre, x + cardW / 2, y + 96, cardW - 16, cardH - 100, 10, "#f5f5f5");

            const topY = Math.max(y, areaY);
            const bottomY = Math.min(y + cardH, areaY + areaAltura);
            if (bottomY > topY) {
                const hitbox = { x, y: topY, w: cardW, h: bottomY - topY, id: `liga_${lado}_${liga.id}` };
                this.botones.push(hitbox);
            }
        });

        ctx.restore();
    },

    drawSelectionList(ctx, offsetX, ancho, scroll, lado, selecciones, equipoSeleccionado) {
        const areaY = 90;
        const areaAltura = canvas.height - areaY - 110;
        const espacio = 14;
        const margen = 18;
        const porFila = 3;
        const cardW = Math.floor((ancho - margen * 2 - espacio * (porFila - 1)) / porFila);
        const cardH = 150;
        const startX = offsetX + margen;

        if (selecciones.length === 0) {
            drawRetroText(ctx, "NO HAY SELECCIONES EN ESTE CONTINENTE", offsetX + ancho / 2, canvas.height / 2, 11, "#00ffff");
            drawRetroText(ctx, "CREA SELECCIONES EN EL EDITOR", offsetX + ancho / 2, canvas.height / 2 + 22, 10, "#00ffff");
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, areaY, ancho, areaAltura);
        ctx.clip();

        selecciones.forEach((sel, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (cardW + espacio);
            const y = areaY + 10 + fila * (cardH + espacio) - scroll;

            if (y + cardH < areaY || y > areaY + areaAltura) return;

            const seleccionado = equipoSeleccionado && equipoSeleccionado.id === sel.id;
            const colorBorde = sel.colorBorde || "#f5f5f5";
            drawRetroPanel(ctx, x, y, cardW, cardH, sel.colorFondo || "#000080", colorBorde);
            if (seleccionado) {
                ctx.save();
                ctx.strokeStyle = "#ffff00";
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 4, y + 4, cardW - 8, cardH - 8);
                ctx.restore();
            }

            const img = getCachedImage(sel.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, x + cardW / 2 - 36, y + 12, 72);
            const textColor = getContrastTextColor(sel.colorFondo || "#000080");
            drawWrappedCardName(ctx, sel.nombre, x + cardW / 2, y + 88, cardW - 16, cardH - 92, 10, textColor);

            const topY = Math.max(y, areaY);
            const bottomY = Math.min(y + cardH, areaY + areaAltura);
            if (bottomY > topY) {
                const hitbox = { x, y: topY, w: cardW, h: bottomY - topY, id: `team_${lado}_${sel.id}` };
                this.botones.push(hitbox);
            }
        });

        ctx.restore();
    },

    drawLeagueTeams(ctx, offsetX, ancho, scroll, lado, ligas, ligaId, equipoSeleccionado) {
        const liga = ligas.find(l => l.id === ligaId);
        const areaY = 110;
        const areaAltura = canvas.height - areaY - 110;

        if (!liga) {
            drawRetroText(ctx, "LIGA NO ENCONTRADA", offsetX + ancho / 2, canvas.height / 2, 12, "#ff0000");
            return;
        }

        drawRetroText(ctx, liga.nombre.toUpperCase(), offsetX + ancho / 2, 90, 14, "#ffd700");

        if (!liga.equipos || liga.equipos.length === 0) {
            drawRetroText(ctx, "NO HAY EQUIPOS EN ESTA LIGA", offsetX + ancho / 2, canvas.height / 2, 12, "#00ffff");
            return;
        }

        const equiposOrdenados = liga.equipos
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));

        const espacio = 14;
        const margen = 18;
        const porFila = 3;
        const cardW = Math.floor((ancho - margen * 2 - espacio * (porFila - 1)) / porFila);
        const cardH = 150;
        const startX = offsetX + margen;

        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, areaY, ancho, areaAltura);
        ctx.clip();

        equiposOrdenados.forEach((equipo, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (cardW + espacio);
            const y = areaY + 20 + fila * (cardH + espacio) - scroll;

            if (y + cardH < areaY || y > areaY + areaAltura) return;

            const seleccionado = equipoSeleccionado && equipoSeleccionado.id === equipo.id;
            const colorBorde = equipo.colorBorde || "#f5f5f5";
            drawRetroPanel(ctx, x, y, cardW, cardH, equipo.colorFondo || "#000080", colorBorde);
            if (seleccionado) {
                ctx.save();
                ctx.strokeStyle = "#ffff00";
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 4, y + 4, cardW - 8, cardH - 8);
                ctx.restore();
            }

            const img = getCachedImage(equipo.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, x + cardW / 2 - 36, y + 12, 72);
            const textColor = getContrastTextColor(equipo.colorFondo || "#000080");
            drawWrappedCardName(ctx, equipo.nombre, x + cardW / 2, y + 88, cardW - 16, cardH - 92, 10, textColor);

            const topY = Math.max(y, areaY);
            const bottomY = Math.min(y + cardH, areaY + areaAltura);
            if (bottomY > topY) {
                const hitbox = { x, y: topY, w: cardW, h: bottomY - topY, id: `team_${lado}_${equipo.id}` };
                this.botones.push(hitbox);
            }
        });

        ctx.restore();
    },

    findEquipoById(equipoId) {
        const data = loadData();
        for (const liga of data.ligas) {
            const equipo = liga.equipos.find(e => e.id === equipoId);
            if (equipo) {
                return { ...equipo, origen: "liga", origenNombre: liga.nombre };
            }
        }
        const seleccion = data.selecciones.find(s => s.id === equipoId);
        if (seleccion) {
            return { ...seleccion, origen: "seleccion", origenNombre: "Selecciones" };
        }
        return null;
    },

    drawResumenInferior(ctx) {
        const y = canvas.height - 100;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, y, canvas.width, 100);
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        if (SeleccionPartido.equipoJugador) {
            const eq = SeleccionPartido.equipoJugador;
            const img = getCachedImage(eq.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, 60, y + 15, 60);
            drawRetroText(ctx, eq.nombre, 60 + 70, y + 45, 11, "#00ffff", "left");
        } else {
            drawRetroText(ctx, "Elige tu equipo", 60 + 70, y + 45, 10, "#00ffff", "left");
        }

        if (SeleccionPartido.equipoCPU) {
            const eq = SeleccionPartido.equipoCPU;
            const img = getCachedImage(eq.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, canvas.width - 120, y + 15, 60);
            drawRetroText(ctx, eq.nombre, canvas.width - 130, y + 45, 11, "#00ffff", "right");
        } else {
            drawRetroText(ctx, "Elige rival CPU", canvas.width - 130, y + 45, 10, "#00ffff", "right");
        }

        const listo = SeleccionPartido.equipoJugador && SeleccionPartido.equipoCPU;
        const btnW = 160;
        const btnH = 44;
        const btnX = canvas.width / 2 - btnW / 2;
        const btnY = y + 28;

        ctx.save();
        if (!listo) ctx.globalAlpha = 0.4;
        const jugarBtn = drawRetroButton(ctx, "JUGAR", btnX, btnY, btnW, btnH, this.hover === "jugar_partido" && listo);
        ctx.restore();

        if (listo) {
            jugarBtn.id = "jugar_partido";
            this.botones.push(jugarBtn);
        }
    },

    // Versión online del panel inferior: muestra tu equipo + botón LISTO,
    // y el estado ("eligiendo"/"listo") de ambos jugadores
    drawResumenInferiorOnline(ctx) {
        const y = canvas.height - 100;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, y, canvas.width, 100);
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        if (SeleccionPartido.equipoJugador) {
            const eq = SeleccionPartido.equipoJugador;
            const img = getCachedImage(eq.escudo);
            drawEscudo(ctx, img && img.complete ? img : null, 60, y + 15, 60);
            drawRetroText(ctx, eq.nombre, 60 + 70, y + 35, 11, "#00ffff", "left");
        } else {
            drawRetroText(ctx, "Elige tu equipo", 60 + 70, y + 45, 10, "#00ffff", "left");
        }

        const listoDisponible = !!SeleccionPartido.equipoJugador;
        const btnW = 180;
        const btnH = 44;
        const btnX = canvas.width / 2 - btnW / 2;
        const btnY = y + 12;
        const texto = this.listoLocal ? "✓ LISTO" : "LISTO";

        ctx.save();
        if (!listoDisponible) ctx.globalAlpha = 0.4;
        const listoBtn = drawRetroButton(ctx, texto, btnX, btnY, btnW, btnH, this.hover === "toggle_listo" && listoDisponible);
        ctx.restore();

        if (listoDisponible) {
            listoBtn.id = "toggle_listo";
            this.botones.push(listoBtn);
        }

        const estadoTexto = (this.listoLocal ? "Tú: listo" : "Tú: eligiendo") +
            "   |   " + (this.listoRival ? "Rival: listo" : "Rival: eligiendo");
        drawRetroText(ctx, estadoTexto, canvas.width / 2, y + 66, 9, "#999999");
    }
};

function invertColor(hex) {
    if (!hex) return "#ffffff";
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return "#ffffff";

    const r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16).padStart(2, '0');
    const g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16).padStart(2, '0');
    const b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16).padStart(2, '0');

    return '#' + r + g + b;
}
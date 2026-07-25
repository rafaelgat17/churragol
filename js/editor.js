// =========================================================
// EDITOR.JS
// Pantalla del editor: Ligas / Selecciones, estilo menú MAME
// PARTE 1: Navegación principal y listados
// =========================================================

// Tamaño fijo (en píxeles) al que se redimensionan SIEMPRE los logos/escudos
// antes de guardarlos, manteniendo su proporción original (aspect ratio)
const TAMANO_LOGO_LIGA = 128;
const TAMANO_ESCUDO = 128;

const DEFAULT_PAISES = [
    { id: "espana", nombre: "España", logo: null, colorFondo: "#1b2438", colorBorde: "#ffd600", continenteId: "europa" },
    { id: "francia", nombre: "Francia", logo: null, colorFondo: "#071b3b", colorBorde: "#81d4fa", continenteId: "europa" }
];

const CONTINENTES = [
    { id: "america", nombre: "AMÉRICA", color: "#2e7d32" },
    { id: "europa", nombre: "EUROPA", color: "#1565c0" },
    { id: "africa", nombre: "ÁFRICA", color: "#e65100" },
    { id: "asia", nombre: "ASIA", color: "#c62828" },
    { id: "oceania", nombre: "OCEANÍA", color: "#6a1b9a" }
];

// Caché simple de imágenes ya cargadas (para no recrear objetos Image en cada frame)
const _imageCache = {};
function getCachedImage(base64) {
    if (!base64) return null;
    if (_imageCache[base64]) return _imageCache[base64];

    const img = new Image();
    img.src = base64;
    _imageCache[base64] = img;
    return img;
}

// ---------------------------------------------------------
// Redimensiona una imagen (File del input) a un cuadrado fijo
// manteniendo su relación de aspecto (sin deformarla).
// El sobrante se queda transparente.
// Devuelve el resultado en base64 mediante un callback.
// ---------------------------------------------------------
function resizeImagenAFijo(file, tamano, callback) {
    const reader = new FileReader();

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvasAux = document.createElement("canvas");
            canvasAux.width = tamano;
            canvasAux.height = tamano;
            const ctxAux = canvasAux.getContext("2d");

            const escala = Math.min(tamano / img.width, tamano / img.height);
            const nuevoAncho = img.width * escala;
            const nuevoAlto = img.height * escala;

            const offsetX = (tamano - nuevoAncho) / 2;
            const offsetY = (tamano - nuevoAlto) / 2;

            ctxAux.clearRect(0, 0, tamano, tamano);
            ctxAux.drawImage(img, offsetX, offsetY, nuevoAncho, nuevoAlto);

            callback(canvasAux.toDataURL("image/png"));
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

// ---------------------------------------------------------
// PANTALLA DEL EDITOR
// ---------------------------------------------------------
const EditorScreen = {

    vista: "categorias",   // categorias | continentes_ligas | paises | ligas | liga_detalle | continentes_selecciones | selecciones
    ligaActualId: null,    // id de la liga que estamos viendo en detalle
    paisActualId: null,
    continenteActualId: null,
    botones: [],
    hover: null,
    patternOffset: 0,
    paises: [],
    paisScrollY: 0,
    ligaScrollY: 0,
    seleccionScrollY: 0,

    init() {
        this.vista = "categorias";
        this.ligaActualId = null;
        this.paisActualId = null;
        this.continenteActualId = null;
        this.botones = [];
        this.hover = null;
        this.patternOffset = 0;

        const savedData = loadData();
        this.paises = Array.isArray(savedData.paises) && savedData.paises.length ? savedData.paises : DEFAULT_PAISES.slice();

        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("click", this.onClick);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });
    },

    destroy() {
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("click", this.onClick);
        canvas.removeEventListener("wheel", this.onWheel);
        document.getElementById("ui-layer").innerHTML = "";
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        EditorScreen.hover = null;
        EditorScreen.botones.forEach(btn => {
            if (isPointInRect(mx, my, btn)) {
                EditorScreen.hover = btn.id;
            }
        });
    },

    onClick(e) {
        const pos = getMousePos(e);
        const mx = pos.x;
        const my = pos.y;

        for (let i = EditorScreen.botones.length - 1; i >= 0; i--) {
            const btn = EditorScreen.botones[i];
            if (isPointInRect(mx, my, btn)) {
                EditorScreen.handleAction(btn);
                break;
            }
        }
    },

    onWheel(e) {
        if (EditorScreen.vista === "paises") {
            e.preventDefault();
            const countryH = 220;
            const espacio = 30;
            const porFila = Math.floor((canvas.width - 80) / (260 + espacio));
            const paisesFiltrados = EditorScreen.paises.filter(p => (p.continenteId || "europa") === (EditorScreen.continenteActualId || "europa"));
            const totalRows = Math.ceil((paisesFiltrados.length + 1) / porFila);
            const contentHeight = totalRows * (countryH + espacio) - espacio;
            const visibleHeight = canvas.height - 110;
            const minScroll = Math.min(0, visibleHeight - contentHeight - 20);

            EditorScreen.paisScrollY = Math.max(minScroll, Math.min(0, EditorScreen.paisScrollY - e.deltaY));
            return;
        }

        if (EditorScreen.vista === "liga_detalle") {
            e.preventDefault();
            const cardH = 185;
            const espacio = 18;
            const porFila = Math.floor((canvas.width - 80) / (150 + espacio));
            const data = loadData();
            const liga = data.ligas.find(l => l.id === EditorScreen.ligaActualId);
            if (!liga) return;

            const totalItems = liga.equipos.length + 1;
            const totalRows = Math.ceil(totalItems / porFila);
            const contentHeight = totalRows * (cardH + espacio) - espacio;
            const visibleHeight = canvas.height - 110;
            const minScroll = Math.min(0, visibleHeight - contentHeight - 50);

            EditorScreen.ligaScrollY = Math.max(minScroll, Math.min(0, EditorScreen.ligaScrollY - e.deltaY));
            return;
        }

        if (EditorScreen.vista === "selecciones") {
            e.preventDefault();
            const cardH = 185;
            const espacio = 18;
            const porFila = Math.floor((canvas.width - 80) / (150 + espacio));
            const data = loadData();
            const totalItems = data.selecciones.filter(s => (s.continenteId || "europa") === (EditorScreen.continenteActualId || "europa")).length + 1;
            const totalRows = Math.ceil(totalItems / porFila);
            const contentHeight = totalRows * (cardH + espacio) - espacio;
            const visibleHeight = canvas.height - 110;
            const minScroll = Math.min(0, visibleHeight - contentHeight - 50);

            EditorScreen.seleccionScrollY = Math.max(minScroll, Math.min(0, EditorScreen.seleccionScrollY - e.deltaY));
            return;
        }
    },

handleAction(btn) {
        if (btn.id === "volver") {
            if (this.vista === "liga_detalle") {
                this.vista = "ligas";
            } else if (this.vista === "ligas") {
                this.vista = "paises";
            } else if (this.vista === "paises") {
                this.vista = "continentes_ligas";
                this.continenteActualId = null;
            } else if (this.vista === "selecciones") {
                this.vista = "continentes_selecciones";
                this.continenteActualId = null;
            } else if (this.vista === "continentes_ligas" || this.vista === "continentes_selecciones" || this.vista === "continentes") {
                this.vista = "categorias";
                this.continenteActualId = null;
            } else {
                cambiarPantalla("menu");
            }
        } else if (btn.id === "cat_ligas") {
            this.vista = "continentes_ligas";
            this.continenteActualId = null;
        } else if (btn.id === "cat_selecciones") {
            this.vista = "continentes_selecciones";
            this.continenteActualId = null;
        } else if (btn.id.startsWith("continente_")) {
            this.continenteActualId = btn.id.replace("continente_", "");
            if (this.vista === "continentes_ligas") {
                this.vista = "paises";
                this.paisScrollY = 0;
            } else {
                this.vista = "selecciones";
                this.seleccionScrollY = 0;
            }
        } else if (btn.id.startsWith("pais_")) {
            this.paisActualId = btn.id.replace("pais_", "");
            this.vista = "ligas";
        } else if (btn.id.startsWith("editpais_")) {
            const paisId = btn.id.replace("editpais_", "");
            mostrarFormularioPais(paisId);
        } else if (btn.id.startsWith("delpais_")) {
            const paisId = btn.id.replace("delpais_", "");
            if (paisId === "espana" || paisId === "francia") {
                alert("Los países base no se pueden eliminar.");
            } else if (confirm("¿Eliminar este país y sus ligas asociadas?")) {
                this.paises = this.paises.filter(p => p.id !== paisId);
                const data = loadData();
                data.paises = this.paises;
                saveData(data);
            }
        } else if (btn.id === "add_pais") {
            mostrarFormularioPais();
        } else if (btn.id === "add_liga") {
            mostrarFormularioLiga();
        } else if (btn.id === "add_seleccion") {
            mostrarFormularioSeleccion(null);
        } else if (btn.id === "add_equipo") {
            mostrarFormularioEquipo(this.ligaActualId);
        } else if (btn.id.startsWith("liga_")) {
            this.ligaActualId = btn.id.replace("liga_", "");
            this.vista = "liga_detalle";
            this.ligaScrollY = 0;
        } else if (btn.id.startsWith("editliga_")) {
            const id = btn.id.replace("editliga_", "");
            mostrarFormularioLiga(id);
        } else if (btn.id.startsWith("delliga_")) {
            const id = btn.id.replace("delliga_", "");
            if (confirm("¿Eliminar esta liga y todos sus equipos?")) {
                deleteLiga(id);
            }
        } else if (btn.id.startsWith("editequipo_")) {
            const id = btn.id.replace("editequipo_", "");
            mostrarFormularioEquipo(EditorScreen.ligaActualId, id);
        } else if (btn.id.startsWith("delequipo_")) {
            const id = btn.id.replace("delequipo_", "");
            if (confirm("¿Eliminar este equipo?")) {
                deleteEquipoDeLiga(this.ligaActualId, id);
            }
        } else if (btn.id.startsWith("editsel_")) {
            const id = btn.id.replace("editsel_", "");
            mostrarFormularioSeleccion(id);
        } else if (btn.id.startsWith("delsel_")) {
            const id = btn.id.replace("delsel_", "");
            if (confirm("¿Eliminar esta selección?")) {
                deleteSeleccion(id);
            }
        } else if (btn.id === "exportar_json") {
            exportarDatosAJuegoJSON();
        }
    },

    draw(ctx) {
        this.botones = [];

        this.drawFondoEditor(ctx);

        if (this.vista === "categorias") {
            this.drawCategorias(ctx);
        } else if (this.vista === "paises") {
            this.drawPaises(ctx);
        } else if (this.vista === "continentes" || this.vista === "continentes_ligas" || this.vista === "continentes_selecciones") {
            this.drawContinentes(ctx);
        } else if (this.vista === "ligas") {
            this.drawListado(ctx, "ligas");
        } else if (this.vista === "selecciones") {
            this.drawListado(ctx, "selecciones");
        } else if (this.vista === "liga_detalle") {
            this.drawLigaDetalle(ctx);
        }

        const volverBtn = drawRetroButton(ctx, "< VOLVER", 20, 20, 108, 32, this.hover === "volver", 12);
        volverBtn.id = "volver";
        this.botones.push(volverBtn);
    },

    drawFondoEditor(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#08141f");
        gradient.addColorStop(1, "#02101f");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const paso = 30;
        const offset = this.patternOffset;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1.5;
        for (let y = -paso + (offset % paso); y < canvas.height; y += paso) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y + paso * 0.25);
            ctx.stroke();
        }
        for (let x = -paso + (offset % paso); x < canvas.width; x += paso) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + paso * 0.25, canvas.height);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(0, 255, 255, 0.08)";
        ctx.lineWidth = 2;
        for (let x = 0; x < canvas.width; x += 120) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 80, canvas.height);
            ctx.stroke();
        }

        this.patternOffset = (this.patternOffset + 0.35) % paso;
    },

drawCategorias(ctx) {
        drawRetroText(ctx, "EDITOR", canvas.width / 2, 70, 28, "#ffff00");

        const panelW = 260;
        const panelH = 180;
        const espacio = 40;
        const totalW = panelW * 2 + espacio;
        const startX = canvas.width / 2 - totalW / 2;
        const startY = canvas.height / 2 - panelH / 2 - 20;

        drawRetroPanel(ctx, startX - 12, startY - 12, panelW + 24, panelH + 24, "#001022", "#00ffff");
        drawRetroPanel(ctx, startX + panelW + espacio - 12, startY - 12, panelW + 24, panelH + 24, "#001022", "#00ffff");

        const catLigas = drawRetroButton(ctx, "LIGAS", startX, startY, panelW, panelH, this.hover === "cat_ligas", 24);
        catLigas.id = "cat_ligas";
        this.botones.push(catLigas);

        const catSelecciones = drawRetroButton(ctx, "SELECCIONES", startX + panelW + espacio, startY, panelW, panelH, this.hover === "cat_selecciones", 20);
        catSelecciones.id = "cat_selecciones";
        this.botones.push(catSelecciones);

        // Botón para exportar los datos a datos_juego.json
        const btnExpW = 280;
        const btnExpH = 40;
        const expX = canvas.width / 2 - btnExpW / 2;
        const expY = startY + panelH + 40;

        const btnExportar = drawRetroButton(ctx, "EXPORTAR JSON", expX, expY, btnExpW, btnExpH, this.hover === "exportar_json", 14);
        btnExportar.id = "exportar_json";
        this.botones.push(btnExportar);
    },

    drawListado(ctx, tipo) {
        const data = loadData();
        if (tipo === "ligas") {
            this.drawListadoLigas(ctx, data);
            return;
        }

        const continente = CONTINENTES.find(c => c.id === this.continenteActualId);
        const items = data.selecciones
            .filter(s => (s.continenteId || "europa") === (this.continenteActualId || "europa"))
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
        const titulo = continente ? `SELECCIONES - ${continente.nombre}` : "SELECCIONES";

        drawRetroText(ctx, titulo, canvas.width / 2, 70, 22, "#ffd700");

        const areaY = 110;
        const areaAltura = canvas.height - areaY - 20;
        const cardW = 150;
        const cardH = 185;
        const espacio = 18;
        const porFila = Math.floor((canvas.width - 80) / (cardW + espacio));
        const startX = (canvas.width - (porFila * (cardW + espacio) - espacio)) / 2;
        const startY = areaY + this.seleccionScrollY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, areaY, canvas.width, areaAltura);
        ctx.clip();

        items.forEach((item, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (cardW + espacio);
            const y = startY + fila * (cardH + espacio);

            if (y + cardH < areaY || y > areaY + areaAltura) return;

            this.drawCardItem(ctx, item, x, y, cardW, cardH, tipo);
        });

        const totalItems = items.length;
        const col = totalItems % porFila;
        const fila = Math.floor(totalItems / porFila);
        const x = startX + col * (cardW + espacio);
        const y = startY + fila * (cardH + espacio);

        if (!(y + cardH < areaY || y > areaY + areaAltura)) {
            const addBtn = drawRetroButton(ctx, "+", x, y, cardW, cardH, this.hover === "add_seleccion", 24);
            addBtn.id = "add_seleccion";
            this.botones.push(addBtn);
        }

        ctx.restore();
    },

    drawListadoLigas(ctx, data) {
        const paises = this.paises;
        const paisActual = paises.find(p => p.id === this.paisActualId);
        const titulo = paisActual ? `LIGAS - ${paisActual.nombre}` : "LIGAS";

        drawRetroText(ctx, titulo, canvas.width / 2, 70, 26, "#ffd700");

        const ligas = data.ligas
            .filter(liga => (liga.paisId || this.getPaisIdParaLiga(liga)) === (this.paisActualId || "espana"))
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));
        const cardW = 150;
        const cardH = 185;
        const espacio = 18;
        const porFila = Math.floor((canvas.width - 80) / (cardW + espacio));
        const startX = (canvas.width - (porFila * (cardW + espacio) - espacio)) / 2;
        let startY = 110;

        if (ligas.length === 0) {
            drawRetroText(ctx, "No hay ligas para este país", canvas.width / 2, canvas.height / 2, 12, "#c5c5c5");
        }

        ligas.forEach((liga, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (cardW + espacio);
            const y = startY + fila * (cardH + espacio);

            this.drawCardItem(ctx, liga, x, y, cardW, cardH, "ligas");
        });

        const totalItems = ligas.length;
        const col = totalItems % porFila;
        const fila = Math.floor(totalItems / porFila);
        const x = startX + col * (cardW + espacio);
        const y = startY + fila * (cardH + espacio);

        const addBtn = drawRetroButton(ctx, "+", x, y, cardW, cardH, this.hover === "add_liga", 24);
        addBtn.id = "add_liga";
        this.botones.push(addBtn);
    },

    drawPaises(ctx) {
        const continente = CONTINENTES.find(c => c.id === this.continenteActualId);
        const titulo = continente ? `PAÍSES - ${continente.nombre}` : "PAÍSES";
        drawRetroText(ctx, titulo, canvas.width / 2, 70, 26, "#ffd700");

        const countryW = 260;
        const countryH = 220;
        const espacio = 30;
        const porFila = Math.floor((canvas.width - 80) / (countryW + espacio));
        const startX = (canvas.width - (porFila * (countryW + espacio) - espacio)) / 2;
        const areaY = 110;
        const areaAltura = canvas.height - areaY - 20;
        const startY = areaY + this.paisScrollY;
        
        // Filtramos los países para que solo aparezcan los del continente seleccionado
        const paisesDelContinente = this.paises.filter(p => (p.continenteId || "europa") === (this.continenteActualId || "europa"));
        const paisesOrdenados = paisesDelContinente.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, areaY, canvas.width, areaAltura);
        ctx.clip();

        paisesOrdenados.forEach((pais, i) => {
            const col = i % porFila;
            const fila = Math.floor(i / porFila);
            const x = startX + col * (countryW + espacio);
            const y = startY + fila * (countryH + espacio);

            if (y + countryH < areaY || y > areaY + areaAltura) return;

            drawRetroPanel(ctx, x, y, countryW, countryH, pais.colorFondo, pais.colorBorde);
            const img = getCachedImage(pais.logo);
            drawEscudo(ctx, img && img.complete ? img : null, x + 28, y + 12, 204, 108, 1);
            const textColor = getContrastTextColor(pais.colorFondo || "#000000");
// y + 155 ubica el texto centrado en el hueco inferior antes de los botones EDIT/DEL
drawRetroTextWrapped(ctx, pais.nombre, x + countryW / 2, y + 155, countryW - 24, 12, textColor);

            const hitbox = { x, y, w: countryW, h: countryH };
            hitbox.id = `pais_${pais.id}`;
            this.botones.push(hitbox);

            const editBtn = drawRetroButton(ctx, "EDIT", x + 8, y + countryH - 34, 88, 24, this.hover === `editpais_${pais.id}`, 14);
            editBtn.id = `editpais_${pais.id}`;
            this.botones.push(editBtn);

            const delBtn = drawRetroButton(ctx, "DEL", x + countryW - 96, y + countryH - 34, 88, 24, this.hover === `delpais_${pais.id}`, 14);
            delBtn.id = `delpais_${pais.id}`;
            this.botones.push(delBtn);
        });

        const total = paisesOrdenados.length;
        const addCol = total % porFila;
        const addFila = Math.floor(total / porFila);
        const addX = startX + addCol * (countryW + espacio);
        const addY = startY + addFila * (countryH + espacio);
        const addBtn = drawRetroButton(ctx, "+ PAÍS", addX, addY, countryW, countryH, this.hover === "add_pais", 18);
        addBtn.id = "add_pais";
        this.botones.push(addBtn);

        ctx.restore();
    },

    drawContinentes(ctx) {
        const esParaLigas = this.vista === "continentes_ligas";
        const tituloSeccion = esParaLigas ? "LIGAS" : "SELECCIONES";

        drawRetroText(ctx, tituloSeccion, canvas.width / 2, 70, 26, "#ffd700");
        drawRetroText(ctx, "Elige un continente", canvas.width / 2, 96, 10, "#c5c5c5");

        const btnW = 320;
        const btnH = 60;
        const espacio = 18;
        const totalAltura = CONTINENTES.length * (btnH + espacio) - espacio;
        const startX = canvas.width / 2 - btnW / 2;
        let startY = canvas.height / 2 - totalAltura / 2 + 20;

        CONTINENTES.forEach(continente => {
            const idBtn = `continente_${continente.id}`;
            const hovered = this.hover === idBtn;

            const colorFondo = hovered ? continente.color : "#1a1a1a";
            const colorBorde = hovered ? "#ffffff" : continente.color;
            const colorTexto = hovered ? "#ffffff" : continente.color;

            drawRetroPanel(ctx, startX, startY, btnW, btnH, colorFondo, colorBorde);
            drawRetroText(ctx, continente.nombre, startX + btnW / 2, startY + btnH / 2, 16, colorTexto);

            const hitbox = { x: startX, y: startY, w: btnW, h: btnH };
            hitbox.id = idBtn;
            this.botones.push(hitbox);

            startY += btnH + espacio;
        });
    },

    getPaisIdParaLiga(liga) {
        const nombre = (liga.nombre || "").toLowerCase();
        if (/laliga|la liga|primera|liga española|españa|espana/.test(nombre)) return "espana";
        if (/ligue|francia|franc/.test(nombre)) return "francia";
        return "otros";
    },

    drawCardItem(ctx, item, x, y, w, h, tipo) {
        const prefijo = tipo === "ligas" ? "liga_" : "sel_click_";
        const clickId = prefijo + item.id;
        const baseColor = tipo === "ligas" ? "#091a2d" : "#082530";
        const borderColor = tipo === "ligas" ? "#ffd700" : "#00ffff";

        drawRetroPanel(ctx, x, y, w, h, baseColor, borderColor);
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(x + 6, y + 6, w - 12, 28);
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(x + 6, y + 40, w - 12, 6);
        ctx.restore();

        const img = getCachedImage(item.logo || item.escudo);
        drawEscudo(ctx, img && img.complete ? img : null, x + w / 2 - 40, y + 32, 80);

// y + 126 centra verticalmente el nombre multilínea en la franja disponible
drawRetroTextWrapped(ctx, item.nombre, x + w / 2, y + 126, w - 16, 9, "#f5f5f5");

        ctx.save();
        ctx.fillStyle = borderColor;
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(tipo === "ligas" ? "LIGA" : "SELECCIÓN", x + 10, y + 8);
        ctx.restore();

        if (tipo === "ligas") {
            const hitboxCard = { x, y, w, h: h - 34 };
            hitboxCard.id = "liga_" + item.id;
            this.botones.push(hitboxCard);
        }

        const idEdit = tipo === "ligas" ? "editliga_" + item.id : "editsel_" + item.id;
        const idDel = tipo === "ligas" ? "delliga_" + item.id : "delsel_" + item.id;

        const editBtn = drawRetroButton(ctx, "EDIT", x + 6, y + h - 30, (w / 2) - 12, 24, this.hover === idEdit, 14, 4);
        editBtn.id = idEdit;
        this.botones.push(editBtn);

        const delBtn = drawRetroButton(ctx, "DEL", x + w / 2 + 4, y + h - 30, (w / 2) - 12, 24, this.hover === idDel, 14, 4);
        delBtn.id = idDel;
        this.botones.push(delBtn);
    },

    drawLigaDetalle(ctx) {
        const data = loadData();
        const liga = data.ligas.find(l => l.id === this.ligaActualId);
        if (!liga) {
            this.vista = "ligas";
            return;
        }

        drawRetroText(ctx, liga.nombre.toUpperCase(), canvas.width / 2, 70, 22, "#ffd700");

        const areaY = 110;
        const areaAltura = canvas.height - areaY - 20;
        const cardW = 150;
        const cardH = 185;
        const espacio = 18;
        const porFila = Math.floor((canvas.width - 80) / (cardW + espacio));
        const startY = areaY + 20 + this.ligaScrollY;

        const equiposOrdenados = liga.equipos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }));

        const itemsTotales = equiposOrdenados.length + 1;
        const totalFilas = Math.ceil(itemsTotales / porFila);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, areaY, canvas.width, areaAltura);
        ctx.clip();

        for (let fila = 0; fila < totalFilas; fila++) {
            const inicioFila = fila * porFila;
            const finFila = Math.min(inicioFila + porFila, itemsTotales);
            const itemsEnFila = finFila - inicioFila;
            const anchoFila = itemsEnFila * (cardW + espacio) - espacio;
            const startXFila = (canvas.width - anchoFila) / 2;
            const y = startY + fila * (cardH + espacio);

            if (y + cardH < areaY || y > areaY + areaAltura) continue;

            for (let col = 0; col < itemsEnFila; col++) {
                const indice = inicioFila + col;
                const x = startXFila + col * (cardW + espacio);

                if (indice < equiposOrdenados.length) {
                    this.drawEquipoCard(ctx, equiposOrdenados[indice], x, y, cardW, cardH);
                } else {
                    const addBtn = drawRetroButton(ctx, "+", x, y, cardW, cardH, this.hover === "add_equipo", 24);
                    addBtn.id = "add_equipo";
                    this.botones.push(addBtn);
                }
            }
        }

        ctx.restore();
    },

    drawEquipoCard(ctx, equipo, x, y, w, h) {
        drawRetroPanel(ctx, x, y, w, h, equipo.colorFondo || "#2b2b2b", equipo.colorBorde || "#f5f5f5");

        const img = getCachedImage(equipo.escudo);
        drawEscudo(ctx, img && img.complete ? img : null, x + w / 2 - 40, y + 26, 80);

        const colorTexto = getContrastTextColor(equipo.colorFondo || "#2b2b2b");
drawRetroTextWrapped(ctx, equipo.nombre, x + w / 2, y + 126, w - 16, 9, colorTexto);

        const idEdit = "editequipo_" + equipo.id;
        const idDel = "delequipo_" + equipo.id;

        const editBtn = drawRetroButton(ctx, "EDIT", x + 6, y + h - 30, (w / 2) - 12, 24, this.hover === idEdit, 14, 4);
        editBtn.id = idEdit;
        this.botones.push(editBtn);

        const delBtn = drawRetroButton(ctx, "DEL", x + w / 2 + 4, y + h - 30, (w / 2) - 12, 24, this.hover === idDel, 14, 4);
        delBtn.id = idDel;
        this.botones.push(delBtn);
    }
};

// =========================================================
// EDITOR.JS - PARTE 2
// Formularios emergentes: Liga, Equipo, Selección, País
// =========================================================

function cerrarFormulario() {
    document.getElementById("ui-layer").innerHTML = "";
}

function crearCajaFormulario(titulo) {
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

function crearInputTexto(label, valorInicial = "") {
    const wrapper = document.createElement("div");

    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.cssText = "color: #f5f5f5; font-size: 12px; display: block; margin-bottom: 4px;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = valorInicial;
    input.style.cssText = `
        width: 100%; padding: 8px; background: #1a1a1a; color: #fff;
        border: 2px solid #f5f5f5; font-family: 'Courier New', monospace; font-size: 14px;
    `;

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    return { wrapper, input };
}

function crearInputImagen(label, imagenActualBase64 = null) {
    const wrapper = document.createElement("div");

    const lbl = document.createElement("label");
    lbl.textContent = label;
    lbl.style.cssText = "color: #f5f5f5; font-size: 12px; display: block; margin-bottom: 4px;";

    const preview = document.createElement("img");
    preview.style.cssText = `
        width: 80px; height: 80px; object-fit: contain;
        background: #fff; border: 2px solid #000; display: block; margin-bottom: 6px;
    `;
    if (imagenActualBase64) preview.src = imagenActualBase64;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.cssText = "color: #f5f5f5; font-size: 12px;";

    let base64Resultado = imagenActualBase64;

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        resizeImagenAFijo(file, TAMANO_ESCUDO, (base64) => {
            base64Resultado = base64;
            preview.src = base64;
        });
    });

    wrapper.appendChild(lbl);
    wrapper.appendChild(preview);
    wrapper.appendChild(input);

    wrapper.getValue = () => base64Resultado;

    return wrapper;
}

function crearInputColor(label, valorInicial = "#ffffff") {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #f5f5f5;";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "color";
    input.value = valorInicial;
    input.style.cssText = "border: 2px solid #f5f5f5; background: none; width: 40px; height: 30px; cursor: pointer;";

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);

    return {
        wrapper: wrapper,
        getInput: input
    };
}

function mostrarFormularioPais(paisId = null) {
    const data = loadData();
    const paisExistente = paisId ? EditorScreen.paises.find(p => p.id === paisId) : null;

    const caja = crearCajaFormulario(paisExistente ? "EDITAR PAÍS" : "NUEVO PAÍS");

    const campoNombre = crearInputTexto("Nombre del país", paisExistente ? paisExistente.nombre : "");
    const campoLogo = crearInputImagen("Bandera/Logo", paisExistente ? paisExistente.logo : null);
    const campoColorFondo = crearInputColor("Color Fondo", paisExistente ? paisExistente.colorFondo : "#1b2438");
    const campoColorBorde = crearInputColor("Color Borde", paisExistente ? paisExistente.colorBorde : "#ffd600");

    const wrapperContinente = document.createElement("div");
    const labelContinente = document.createElement("label");
    labelContinente.textContent = "Continente";
    labelContinente.style.cssText = "color: #f5f5f5; font-size: 12px; display: block; margin-bottom: 4px;";

    const selectContinente = document.createElement("select");
    selectContinente.style.cssText = `
        width: 100%; padding: 8px; background: #1a1a1a; color: #fff;
        border: 2px solid #f5f5f5; font-family: 'Courier New', monospace; font-size: 14px;
    `;

    CONTINENTES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        selectContinente.appendChild(opt);
    });

    // Por defecto toma el continente activo en el editor si se está creando uno nuevo
    selectContinente.value = paisExistente ? (paisExistente.continenteId || "europa") : (EditorScreen.continenteActualId || "europa");

    wrapperContinente.appendChild(labelContinente);
    wrapperContinente.appendChild(selectContinente);

    caja.appendChild(campoNombre.wrapper);
    caja.appendChild(wrapperContinente);
    caja.appendChild(campoLogo);
    caja.appendChild(campoColorFondo.wrapper);
    caja.appendChild(campoColorBorde.wrapper);

    const btnCont = document.createElement("div");
    btnCont.style.cssText = "display: flex; gap: 10px; margin-top: 14px;";

    const btnGuardar = document.createElement("button");
    btnGuardar.textContent = paisExistente ? "GUARDAR" : "AÑADIR";
    btnGuardar.style.cssText = "flex: 1; padding: 10px; background: #008000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.style.cssText = "flex: 1; padding: 10px; background: #800000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    btnCancelar.onclick = cerrarFormulario;

    btnGuardar.onclick = () => {
        const nombre = campoNombre.input.value.trim();
        const logo = campoLogo.getValue();
        const colorFondo = campoColorFondo.getInput.value;
        const colorBorde = campoColorBorde.getInput.value;
        const continenteId = selectContinente.value;

        if (!nombre) {
            alert("Ponle un nombre al país.");
            return;
        }

        if (paisExistente) {
            paisExistente.nombre = nombre;
            paisExistente.logo = logo;
            paisExistente.colorFondo = colorFondo;
            paisExistente.colorBorde = colorBorde;
            paisExistente.continenteId = continenteId;
        } else {
            const nuevoPais = {
                id: generateId(),
                nombre: nombre,
                logo: logo,
                colorFondo: colorFondo,
                colorBorde: colorBorde,
                continenteId: continenteId
            };
            EditorScreen.paises.push(nuevoPais);
        }

        const dataStorage = loadData();
        dataStorage.paises = EditorScreen.paises;
        saveData(dataStorage);

        EditorScreen.paises = dataStorage.paises;
        cerrarFormulario();
    };

    btnCont.appendChild(btnGuardar);
    btnCont.appendChild(btnCancelar);
    caja.appendChild(btnCont);
}

function mostrarFormularioLiga(ligaId = null) {
    const data = loadData();
    const ligaExistente = ligaId ? data.ligas.find(l => l.id === ligaId) : null;

    const caja = crearCajaFormulario(ligaExistente ? "EDITAR LIGA" : "NUEVA LIGA");

    const campoNombre = crearInputTexto("Nombre de la liga", ligaExistente ? ligaExistente.nombre : "");
    const campoLogo = crearInputImagen("Logo de la liga", ligaExistente ? ligaExistente.logo : null);

    caja.appendChild(campoNombre.wrapper);
    caja.appendChild(campoLogo);

    const btnCont = document.createElement("div");
    btnCont.style.cssText = "display: flex; gap: 10px; margin-top: 14px;";

    const btnGuardar = document.createElement("button");
    btnGuardar.textContent = ligaExistente ? "GUARDAR" : "AÑADIR";
    btnGuardar.style.cssText = "flex: 1; padding: 10px; background: #008000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.style.cssText = "flex: 1; padding: 10px; background: #800000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    btnCancelar.onclick = cerrarFormulario;

    btnGuardar.onclick = () => {
        const nombre = campoNombre.input.value.trim();
        const logo = campoLogo.getValue();
        const paisIdActual = EditorScreen.paisActualId || "espana";

        if (!nombre) {
            alert("Ponle un nombre a la liga.");
            return;
        }
        if (!logo) {
            alert("Sube un logo para la liga.");
            return;
        }

        if (ligaExistente) {
            ligaExistente.nombre = nombre;
            ligaExistente.logo = logo;
            ligaExistente.paisId = ligaExistente.paisId || paisIdActual;
            saveData(data);
        } else {
            addLiga(nombre, logo, paisIdActual);
        }

        cerrarFormulario();
    };

    btnCont.appendChild(btnGuardar);
    btnCont.appendChild(btnCancelar);
    caja.appendChild(btnCont);
}

function mostrarFormularioEquipo(ligaId, equipoId = null) {
    const data = loadData();
    const liga = data.ligas.find(l => l.id === ligaId);
    if (!liga) return;

    const equipoExistente = equipoId ? liga.equipos.find(e => e.id === equipoId) : null;

    const caja = crearCajaFormulario(equipoExistente ? "EDITAR EQUIPO" : "NUEVO EQUIPO");

    const campoNombre = crearInputTexto("Nombre del equipo", equipoExistente ? equipoExistente.nombre : "");
    const campoEscudo = crearInputImagen("Escudo del equipo", equipoExistente ? equipoExistente.escudo : null);
    const campoColorFondo = crearInputColor("Color de fondo de la ficha", equipoExistente ? equipoExistente.colorFondo : "#e53935");
    const campoColorBorde = crearInputColor("Color del reborde de la ficha", equipoExistente ? equipoExistente.colorBorde : "#ffffff");

    caja.appendChild(campoNombre.wrapper);
    caja.appendChild(campoEscudo);
    caja.appendChild(campoColorFondo.wrapper);
    caja.appendChild(campoColorBorde.wrapper);

    const btnCont = document.createElement("div");
    btnCont.style.cssText = "display: flex; gap: 10px; margin-top: 14px;";

    const btnGuardar = document.createElement("button");
    btnGuardar.textContent = equipoExistente ? "GUARDAR" : "AÑADIR";
    btnGuardar.style.cssText = "flex: 1; padding: 10px; background: #008000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.style.cssText = "flex: 1; padding: 10px; background: #800000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    btnCancelar.onclick = cerrarFormulario;

    btnGuardar.onclick = () => {
        const nombre = campoNombre.input.value.trim();
        const escudo = campoEscudo.getValue();

        if (!nombre) {
            alert("Ponle un nombre al equipo.");
            return;
        }
        if (!escudo) {
            alert("Sube un escudo para el equipo.");
            return;
        }

        const equipoData = {
            nombre,
            escudo,
            colorFondo: campoColorFondo.getInput.value,
            colorBorde: campoColorBorde.getInput.value
        };

        if (equipoExistente) {
            Object.assign(equipoExistente, equipoData);
            saveData(data);
        } else {
            addEquipoALiga(ligaId, equipoData);
        }

        cerrarFormulario();
    };

    btnCont.appendChild(btnGuardar);
    btnCont.appendChild(btnCancelar);
    caja.appendChild(btnCont);
}

function mostrarFormularioSeleccion(seleccionId = null) {
    const data = loadData();
    const seleccionExistente = seleccionId ? data.selecciones.find(s => s.id === seleccionId) : null;

    const caja = crearCajaFormulario(seleccionExistente ? "EDITAR SELECCIÓN" : "NUEVA SELECCIÓN");

    const campoNombre = crearInputTexto("Nombre de la selección", seleccionExistente ? seleccionExistente.nombre : "");
    const campoEscudo = crearInputImagen("Escudo / Bandera", seleccionExistente ? seleccionExistente.escudo : null);
    const campoColorFondo = crearInputColor("Color de fondo", seleccionExistente ? seleccionExistente.colorFondo : "#0d47a1");
    const campoColorBorde = crearInputColor("Color del borde", seleccionExistente ? seleccionExistente.colorBorde : "#ffffff");

    caja.appendChild(campoNombre.wrapper);
    caja.appendChild(campoEscudo);
    caja.appendChild(campoColorFondo.wrapper);
    caja.appendChild(campoColorBorde.wrapper);

    const btnCont = document.createElement("div");
    btnCont.style.cssText = "display: flex; gap: 10px; margin-top: 14px;";

    const btnGuardar = document.createElement("button");
    btnGuardar.textContent = seleccionExistente ? "GUARDAR" : "AÑADIR";
    btnGuardar.style.cssText = "flex: 1; padding: 10px; background: #008000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.style.cssText = "flex: 1; padding: 10px; background: #800000; color: #fff; border: 2px solid #fff; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;";

    btnCancelar.onclick = cerrarFormulario;

    btnGuardar.onclick = () => {
        const nombre = campoNombre.input.value.trim();
        const escudo = campoEscudo.getValue();
        const continenteId = EditorScreen.continenteActualId || "europa";

        if (!nombre) {
            alert("Ponle un nombre a la selección.");
            return;
        }
        if (!escudo) {
            alert("Sube un escudo.");
            return;
        }

        const seleccionData = {
            nombre,
            escudo,
            colorFondo: campoColorFondo.getInput.value,
            colorBorde: campoColorBorde.getInput.value,
            continenteId: continenteId
        };

        if (seleccionExistente) {
            Object.assign(seleccionExistente, seleccionData);
            saveData(data);
        } else {
            addSeleccion(seleccionData);
        }

        cerrarFormulario();
    };

    btnCont.appendChild(btnGuardar);
    btnCont.appendChild(btnCancelar);
    caja.appendChild(btnCont);
}

// Renderiza texto con salto de línea (word wrap) en Canvas.
// Mantiene el tamaño de fuente legible y centra verticalmente el conjunto.
function drawRetroTextWrapped(ctx, text, x, y, maxWidth, fontSize, color = "#ffffff", lineHeight = null) {
    if (!text) return;
    
    lineHeight = lineHeight || fontSize + 4;
    
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px 'Press Start 2P', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 1. Dividir palabras y construir líneas que quepan en maxWidth
    const words = text.toString().split(" ");
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine !== "") {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    // 2. Si alguna palabra individual supera el ancho (por ser larguísima), forzar pequeña reducción
    let effectiveFontSize = fontSize;
    let maxLineWidth = 0;
    lines.forEach(l => {
        const w = ctx.measureText(l).width;
        if (w > maxLineWidth) maxLineWidth = w;
    });

    if (maxLineWidth > maxWidth) {
        const factor = maxWidth / maxLineWidth;
        effectiveFontSize = Math.max(7, Math.floor(fontSize * factor));
        ctx.font = `${effectiveFontSize}px 'Press Start 2P', monospace`;
        lineHeight = effectiveFontSize + 3;
    }

    // 3. Dibujar las líneas centradas verticalmente en 'y'
    const totalHeight = lines.length * lineHeight;
    const startY = y - (totalHeight / 2) + (lineHeight / 2);

    lines.forEach((line, index) => {
        ctx.fillText(line, x, startY + (index * lineHeight));
    });

    ctx.restore();
}

// =========================================================
// FUNCIÓN PARA EXPORTAR DATOS A JSON
// =========================================================
function exportarDatosAJuegoJSON() {
    const data = loadData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "datos_juego.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
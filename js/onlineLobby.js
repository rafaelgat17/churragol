// =========================================================
// ONLINELOBBY.JS
// Pantalla de "1 VS 1": elegir entre crear sala o unirse a una,
// mostrar el código, y esperar a que el rival se conecte.
// =========================================================

const OnlineLobbyScreen = {

    botones: [],
    hover: null,

    // vista: "elegir" | "creando" | "sala_creada" | "uniendo" | "conectado" | "error"
    vista: "elegir",

    codigoMostrado: "",
    inputCodigo: "",     // lo que el jugador va escribiendo para unirse
    mensajeError: "",

    init() {
        this.botones = [];
        this.hover = null;
        this.vista = "elegir";
        this.codigoMostrado = "";
        this.inputCodigo = "";
        this.mensajeError = "";

        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("click", this.onClick);
        window.addEventListener("keydown", this.onKeyDown);

        // Callbacks de red: si el rival se conecta o se desconecta
        // mientras estamos en esta pantalla, reaccionamos aquí
        OnlineManager.onConectado = () => {
            this.vista = "conectado";
        };
        OnlineManager.onDesconectado = () => {
            this.mensajeError = "El rival se ha desconectado.";
            this.vista = "error";
        };
    },

    destroy() {
        canvas.removeEventListener("mousemove", this.onMouseMove);
        canvas.removeEventListener("click", this.onClick);
        window.removeEventListener("keydown", this.onKeyDown);
    },

    onMouseMove(e) {
        const pos = getMousePos(e);
        OnlineLobbyScreen.hover = null;
        OnlineLobbyScreen.botones.forEach(btn => {
            if (isPointInRect(pos.x, pos.y, btn)) {
                OnlineLobbyScreen.hover = btn.id;
            }
        });
    },

    onClick(e) {
        const pos = getMousePos(e);
        OnlineLobbyScreen.botones.forEach(btn => {
            if (isPointInRect(pos.x, pos.y, btn)) {
                OnlineLobbyScreen.handleAction(btn.id);
            }
        });
    },

    // Mientras estamos en la vista "uniendo", capturamos el teclado
    // para ir escribiendo el código (sin necesidad de un <input> HTML)
    onKeyDown(e) {
        if (OnlineLobbyScreen.vista !== "uniendo") return;

        if (e.key === "Backspace") {
            OnlineLobbyScreen.inputCodigo = OnlineLobbyScreen.inputCodigo.slice(0, -1);
        } else if (e.key === "Enter") {
            OnlineLobbyScreen.confirmarUnion();
        } else if (/^[a-zA-Z0-9]$/.test(e.key) && OnlineLobbyScreen.inputCodigo.length < 4) {
            OnlineLobbyScreen.inputCodigo += e.key.toUpperCase();
        }
    },

    handleAction(id) {
        if (id === "volver") {
            if (this.vista === "elegir") {
                OnlineManager.desconectar();
                cambiarPantalla("menu");
            } else {
                OnlineManager.desconectar();
                this.vista = "elegir";
                this.inputCodigo = "";
                this.mensajeError = "";
            }
        } else if (id === "crear") {
            this.iniciarCreacionSala();
        } else if (id === "unirse") {
            this.vista = "uniendo";
            this.inputCodigo = "";
        } else if (id === "confirmar_union") {
            this.confirmarUnion();
        } else if (id === "continuar") {
            // Ambos conectados: pasamos a la selección de equipos (paso 4)
            cambiarPantalla("teamSelect");
        }
    },

    iniciarCreacionSala() {
        this.vista = "creando";
        OnlineManager.crearSala(
            (codigo) => {
                this.codigoMostrado = codigo;
                this.vista = "sala_creada";
            },
            (err) => {
                this.mensajeError = "No se pudo crear la sala. Revisa tu conexión.";
                this.vista = "error";
            }
        );
    },

    confirmarUnion() {
        if (this.inputCodigo.length < 4) return;
        this.vista = "conectando";
        OnlineManager.unirseASala(
            this.inputCodigo,
            () => {
                this.vista = "conectado";
            },
            (err) => {
                this.mensajeError = "No se encontró ninguna sala con ese código.";
                this.vista = "error";
            }
        );
    },

    draw(ctx) {
        this.botones = [];

        // Fondo oscuro simple
        ctx.fillStyle = "#0a0a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawRetroText(ctx, "1 VS 1", canvas.width / 2, 80, 36, "#ffff00");

        const volverBtn = drawRetroButton(ctx, "< VOLVER", 20, 20, 120, 36, this.hover === "volver");
        volverBtn.id = "volver";
        this.botones.push(volverBtn);

        if (this.vista === "elegir") {
            this.drawVistaElegir(ctx);
        } else if (this.vista === "creando") {
            drawRetroText(ctx, "Creando sala...", canvas.width / 2, canvas.height / 2, 16, "#ffffff");
        } else if (this.vista === "sala_creada") {
            this.drawVistaSalaCreada(ctx);
        } else if (this.vista === "uniendo") {
            this.drawVistaUniendo(ctx);
        } else if (this.vista === "conectando") {
            drawRetroText(ctx, "Conectando...", canvas.width / 2, canvas.height / 2, 16, "#ffffff");
        } else if (this.vista === "conectado") {
            this.drawVistaConectado(ctx);
        } else if (this.vista === "error") {
            this.drawVistaError(ctx);
        }
    },

    drawVistaElegir(ctx) {
        const btnW = 280;
        const btnH = 60;
        const btnX = canvas.width / 2 - btnW / 2;

        const crearBtn = drawRetroButton(ctx, "CREAR SALA", btnX, 220, btnW, btnH, this.hover === "crear");
        crearBtn.id = "crear";
        this.botones.push(crearBtn);

        const unirseBtn = drawRetroButton(ctx, "UNIRSE A SALA", btnX, 300, btnW, btnH, this.hover === "unirse");
        unirseBtn.id = "unirse";
        this.botones.push(unirseBtn);
    },

    drawVistaSalaCreada(ctx) {
        drawRetroText(ctx, "Comparte este código con tu rival:", canvas.width / 2, 200, 14, "#ffffff");

        const cajaW = 260;
        const cajaH = 90;
        drawRetroPanel(ctx, canvas.width / 2 - cajaW / 2, 230, cajaW, cajaH, "#1a1a2e", "#ffd700");
        drawRetroText(ctx, this.codigoMostrado, canvas.width / 2, 230 + cajaH / 2, 40, "#ffd700");

        drawRetroText(ctx, "Esperando a que se una un rival...", canvas.width / 2, 350, 12, "#00ffff");
    },

    drawVistaUniendo(ctx) {
        drawRetroText(ctx, "Introduce el código de la sala:", canvas.width / 2, 200, 14, "#ffffff");

        const cajaW = 220;
        const cajaH = 70;
        const cajaX = canvas.width / 2 - cajaW / 2;
        const cajaY = 230;
        drawRetroPanel(ctx, cajaX, cajaY, cajaW, cajaH, "#1a1a2e", "#00ffff");

        const textoMostrado = this.inputCodigo + (Math.floor(performance.now() / 400) % 2 === 0 ? "_" : "");
        drawRetroText(ctx, textoMostrado, canvas.width / 2, cajaY + cajaH / 2, 28, "#ffffff");

        const confirmarBtn = drawRetroButton(ctx, "CONECTAR", canvas.width / 2 - 100, 330, 200, 50, this.hover === "confirmar_union");
        confirmarBtn.id = "confirmar_union";
        this.botones.push(confirmarBtn);

        drawRetroText(ctx, "(escribe el código y pulsa Enter o Conectar)", canvas.width / 2, 400, 10, "#999999");
    },

    drawVistaConectado(ctx) {
        drawRetroText(ctx, "¡Rival conectado!", canvas.width / 2, 220, 20, "#00ff00");

        const continuarBtn = drawRetroButton(ctx, "CONTINUAR", canvas.width / 2 - 110, 280, 220, 54, this.hover === "continuar");
        continuarBtn.id = "continuar";
        this.botones.push(continuarBtn);
    },

    drawVistaError(ctx) {
        drawRetroText(ctx, "⚠ ERROR", canvas.width / 2, 200, 20, "#ff4444");
        drawRetroTextFit(ctx, this.mensajeError, canvas.width / 2, 240, canvas.width - 100, 12, "#ffffff");
        drawRetroText(ctx, "Pulsa VOLVER para reintentar", canvas.width / 2, 300, 10, "#999999");
    }
};
// =========================================================
// ONLINE.JS
// Capa de red con PeerJS: crear sala, unirse a sala, y enviar/
// recibir mensajes entre los dos jugadores.
//
// De momento (paso 2 del roadmap) esto NO tiene pantalla propia
// todavía; solo expone las funciones que usará onlineLobby.js
// más adelante, y deja trazas en consola para probar que
// funciona la conexión.
// =========================================================

const OnlineManager = {
    peer: null,       // objeto Peer de PeerJS (nuestra propia conexión)
    conn: null,        // la conexión con el otro jugador, una vez establecida
    esHost: false,      // true si nosotros hemos creado la sala
    codigoSala: null,   // código de sala (nuestro ID de peer si somos host)
    onMensaje: null,    // callback que se llama con cada mensaje recibido
    onConectado: null,  // callback que se llama cuando la conexión se abre
    onDesconectado: null, // callback que se llama si el rival se desconecta

    // Genera un código corto y fácil de compartir (ej: "H7K2")
    generarCodigoSala() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (0/O, 1/I)
        let codigo = "";
        for (let i = 0; i < 4; i++) {
            codigo += chars[Math.floor(Math.random() * chars.length)];
        }
        return codigo;
    },

    // Crea una sala nueva: nosotros seremos el host. El ID del peer
    // es directamente el código de sala, con un prefijo fijo para
    // evitar colisiones con otros usos públicos del broker de PeerJS.
    crearSala(callbackListo, callbackError) {
        this.esHost = true;
        this.codigoSala = this.generarCodigoSala();
        const idCompleto = "churragol-" + this.codigoSala;

        this.peer = new Peer(idCompleto);

        this.peer.on("open", () => {
            console.log("[Online] Sala creada con código:", this.codigoSala);
            if (callbackListo) callbackListo(this.codigoSala);
        });

        this.peer.on("connection", (conn) => {
            console.log("[Online] Un jugador se ha unido a la sala");
            this.conn = conn;
            this.configurarConexion();
        });

        this.peer.on("error", (err) => {
            console.error("[Online] Error de PeerJS (host):", err);
            if (callbackError) callbackError(err);
        });
    },

    // Se une a una sala existente usando su código
    unirseASala(codigo, callbackListo, callbackError) {
        this.esHost = false;
        this.codigoSala = codigo.toUpperCase();
        const idCompleto = "churragol-" + this.codigoSala;

        this.peer = new Peer(); // ID aleatorio, no nos hace falta uno fijo

        this.peer.on("open", () => {
            console.log("[Online] Intentando conectar con la sala:", this.codigoSala);
            this.conn = this.peer.connect(idCompleto, { reliable: true });
            this.configurarConexion();

            this.conn.on("open", () => {
                console.log("[Online] Conectado al host");
                if (callbackListo) callbackListo();
            });
        });

        this.peer.on("error", (err) => {
            console.error("[Online] Error de PeerJS (invitado):", err);
            if (callbackError) callbackError(err);
        });
    },

    // Prepara los listeners de datos/cierre para una conexión ya creada
    configurarConexion() {
        this.conn.on("data", (mensaje) => {
            console.log("[Online] Mensaje recibido:", mensaje);
            if (this.onMensaje) this.onMensaje(mensaje);
        });

        this.conn.on("close", () => {
            console.log("[Online] El rival se ha desconectado");
            if (this.onDesconectado) this.onDesconectado();
        });

        this.conn.on("open", () => {
            if (this.onConectado) this.onConectado();
        });
    },

    // Envía un mensaje al otro jugador. `tipo` identifica de qué trata
    // (ej: "seleccionEquipo", "disparo", "stateUpdate"...) y `datos`
    // lleva la información concreta de ese mensaje.
    enviar(tipo, datos) {
        if (!this.conn || !this.conn.open) {
            console.warn("[Online] No se puede enviar, la conexión no está abierta");
            return;
        }
        this.conn.send({ tipo, datos });
    },

    // Cierra la conexión y libera el peer por completo (usar al salir
    // de la partida online, sea host o invitado)
    desconectar() {
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.esHost = false;
        this.codigoSala = null;
    }
};
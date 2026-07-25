// =========================================================
// AI.JS
// Toma de decisiones estratégica e impacto físico exacto
// para la CPU (Juego de Chapas)
// =========================================================

const ControlCPU = {
    reset() {
        // Método por compatibilidad
    },

    dispararTurno(fichasCPU, balon, fichasJugador) {
        const campo = getCampoRect();
        const porterias = getPorterias();

        if (!fichasCPU || fichasCPU.length === 0 || !balon) return;

        // Asumimos que la CPU ataca hacia la portería derecha o izquierda según su rol
        // Por defecto en teamSelect: CPU ataca portería izquierda (xLinea menor) o derecha.
        // Asumimos portería rival = derecha (ajustar si la CPU es jugador 1)
        const porteriaRival = porterias.derecha || { xLinea: campo.x + campo.w, yTop: campo.y + campo.h * 0.35, yBottom: campo.y + campo.h * 0.65 };
        const porteriaPropia = porterias.izquierda || { xLinea: campo.x, yTop: campo.y + campo.h * 0.35, yBottom: campo.y + campo.h * 0.65 };

        const yCentroRival = (porteriaRival.yTop + porteriaRival.yBottom) / 2;
        const yCentroPropio = (porteriaPropia.yTop + porteriaPropia.yBottom) / 2;

        // 1. EVALUAR ESTADO DE JUEGO (Distancia del balón a porterías)
        const distBalonRival = Math.hypot(balon.x - porteriaRival.xLinea, balon.y - yCentroRival);
        const distBalonPropia = Math.hypot(balon.x - porteriaPropia.xLinea, balon.y - yCentroPropio);

        let fichaElegida = null;
        let objetivoFinalX = 0;
        let objetivoFinalY = 0;
        let potenciaProporcional = 0.8;

        // -------------------------------------------------------------
        // CASO A: TIRO A PUERTA (Ataque)
        // -------------------------------------------------------------
        if (distBalonRival < campo.w * 0.55) {
            // Buscamos la mejor chapa para tirar a puerta
            fichaElegida = this.obtenerMejorChapa(fichasCPU, balon);

            // Variamos el tiro entre palo superior, centro o palo inferior
            const variacionY = (Math.random() - 0.5) * (porteriaRival.yBottom - porteriaRival.yTop) * 0.7;
            objetivoFinalX = porteriaRival.xLinea;
            objetivoFinalY = yCentroRival + variacionY;
            potenciaProporcional = 0.9 + Math.random() * 0.1; // Disparo fuerte
        } 
        // -------------------------------------------------------------
        // CASO B: PELIGRO EN ÁREA PROPIA (Defensa / Despeje)
        // -------------------------------------------------------------
        else if (distBalonPropia < campo.w * 0.35) {
            // Elegimos la chapa más cercana al balón o a la línea defensiva
            fichaElegida = this.obtenerMejorChapa(fichasCPU, balon);

            // Despejar hacia campo rival (bandas para evitar rebotes centrales)
            objetivoFinalX = campo.x + campo.w * 0.75;
            objetivoFinalY = balon.y < campo.y + campo.h / 2 
                ? campo.y + campo.h * 0.85 
                : campo.y + campo.h * 0.15;
            potenciaProporcional = 0.85;
        } 
        // -------------------------------------------------------------
        // CASO C: CONSTRUCCIÓN / AVANCE EN MIDFIELD
        // -------------------------------------------------------------
        else {
            fichaElegida = this.obtenerMejorChapa(fichasCPU, balon);

            // Avanzar el balón hacia zona de peligro en campo rival
            objetivoFinalX = porteriaRival.xLinea - 80;
            objetivoFinalY = yCentroRival + (Math.random() - 0.5) * 100;
            potenciaProporcional = 0.65 + Math.random() * 0.2;
        }

        if (!fichaElegida) return;

        // -------------------------------------------------------------
        // CÁLCULO FÍSICO DEL PUNTO DE IMPACTO
        // -------------------------------------------------------------
        // Para que el balón vaya hacia (objetivoFinalX, objetivoFinalY),
        // la chapa debe golpear en la parte TRASERA del balón.
        
        const radioChapa = fichaElegida.radio || 15;
        const radioBalon = balon.radio || 10;
        const distanciaContacto = radioChapa + radioBalon;

        // Vector Unitario desde el Balón hacia el Objetivo
        const dirObjX = objetivoFinalX - balon.x;
        const dirObjY = objetivoFinalY - balon.y;
        const distObj = Math.hypot(dirObjX, dirObjY) || 1;
        const uObjX = dirObjX / distObj;
        const uObjY = dirObjY / distObj;

        // El punto exacto donde la chapa debe estar en el momento del impacto:
        const puntoImpactoX = balon.x - uObjX * distanciaContacto;
        const puntoImpactoY = balon.y - uObjY * distanciaContacto;

        // Vector desde la Chapa hasta el Punto de Impacto
        const tiroX = puntoImpactoX - fichaElegida.x;
        const tiroY = puntoImpactoY - fichaElegida.y;
        const distTiro = Math.hypot(tiroX, tiroY) || 1;

        // Añadir una pequeña imprecisión lógica (máx 3px de margen) para simular imperfección humana
        const errorHumanoX = (Math.random() - 0.5) * 3;
        const errorHumanoY = (Math.random() - 0.5) * 3;

        const nx = (tiroX / distTiro);
        const ny = (tiroY / distTiro);

        // Aplicar la velocidad final
        const maxVel = typeof MAX_POTENCIA_DISPARO !== 'undefined' ? MAX_POTENCIA_DISPARO : 18;
        const potenciaFinal = maxVel * potenciaProporcional;

        fichaElegida.vx = (nx * potenciaFinal) + errorHumanoX;
        fichaElegida.vy = (ny * potenciaFinal) + errorHumanoY;
    },

    // Devuelve la chapa que mejor ángulo y distancia tiene respecto al balón
    obtenerMejorChapa(fichas, balon) {
        let mejorChapa = null;
        let menorPuntuacion = Infinity;

        fichas.forEach(f => {
            const dist = Math.hypot(f.x - balon.x, f.y - balon.y);
            
            // Priorizamos distancia, pero evitamos fichas que estén "delante" del balón interrumpiendo el tiro
            let puntuacion = dist;
            
            if (puntuacion < menorPuntuacion) {
                menorPuntuacion = puntuacion;
                mejorChapa = f;
            }
        });

        return mejorChapa;
    }
};
// =========================================================
// RENDER.JS
// Funciones de dibujo reutilizables con estética retro/pixel
// Se usan tanto en el menú como en el editor y en el partido
// =========================================================

// Dibuja un rectángulo con borde estilo "retro" (sin bordes redondeados,
// con sombra dura tipo 2000, sin gradientes suaves)
function drawRetroPanel(ctx, x, y, w, h, colorFondo = "#000080", colorBorde = "#ffff00", shadowOffset = 6) {
    ctx.save();

    // Sombra dura (offset configurable, sin blur, para look pixelado)
    ctx.fillStyle = "#000";
    ctx.fillRect(x + shadowOffset, y + shadowOffset, w, h);

    // Panel principal
    ctx.fillStyle = colorFondo;
    ctx.fillRect(x, y, w, h);

    // Borde
    ctx.strokeStyle = colorBorde;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
}

// Dibuja texto con estilo retro (fuente pixelada, con sombra tipo 8-bit)
function drawRetroText(ctx, text, x, y, size = 20, color = "#ffff00", align = "center") {
    ctx.save();
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    // Sombra del texto (efecto retro tipo consola)
    ctx.fillStyle = "#000";
    ctx.fillText(text, x + 3, y + 3);

    // Texto principal
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    ctx.restore();
}

// Dibuja el escudo de un equipo (imagen) dentro de un rectángulo blanco
// con reborde negro, manteniendo la proporción de la imagen.
function drawEscudo(ctx, imagen, x, y, width = 40, height = width, padding = 4) {
    ctx.save();

    // Fondo blanco
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, width, height);

    // Reborde negro
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    if (imagen && imagen.complete && imagen.width > 0) {
        const margen = padding;
        const availableW = width - margen * 2;
        const availableH = height - margen * 2;
        const escala = Math.min(availableW / imagen.width, availableH / imagen.height, 1);
        const imgW = imagen.width * escala;
        const imgH = imagen.height * escala;
        const offsetX = x + (width - imgW) / 2;
        const offsetY = y + (height - imgH) / 2;
        ctx.drawImage(imagen, offsetX, offsetY, imgW, imgH);
    }

    ctx.restore();
}

// Dibuja un botón retro clickable y devuelve su "hitbox" para detectar clicks
function drawRetroButton(ctx, text, x, y, w, h, hovered = false, textSize = 14, shadowOffset = 6) {
    const time = performance.now() / 1000;
    const colorFondo = hovered ? "#ff00ff" : "#000080";
    const colorTexto = hovered ? "#ffff00" : "#ffffff";
    const borderColor = hovered ? (Math.sin(time * 8) > 0 ? "#ffffff" : "#00ffff") : "#ffff00";
    const glowAlpha = hovered ? 0.18 + Math.sin(time * 10) * 0.08 : 0;
    const textBounce = hovered ? Math.sin(time * 12) * 1.5 : 0;

    drawRetroPanel(ctx, x, y, w, h, colorFondo, borderColor, shadowOffset);

    if (hovered) {
        ctx.save();
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 4, y + 4, w - 8, 6);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        ctx.restore();
    }

    drawRetroText(ctx, text, x + w / 2, y + h / 2 + textBounce, textSize, colorTexto);

    return { x, y, w, h }; // hitbox para comprobar colisión con el ratón
}

// Comprueba si un punto (ej. posición del ratón) está dentro de un hitbox
function isPointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w &&
           py >= rect.y && py <= rect.y + rect.h;
}

// Convierte un color hexadecimal a RGBA de forma segura (soporta #RGB, #RRGGBB y fallback)
function hexToRGBA(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha})`;
    let c = hex.replace('#', '').trim();
    if (c === "rainbow") return `rgba(255, 255, 255, ${alpha})`;
    if (c.length === 3) c = c.split('').map(char => char + char).join('');
    if (c.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
    
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Dibuja texto reduciendo el tamaño de letra automáticamente hasta que
// quepa entero en el ancho disponible (optimizado para evitar bucles pesados)
function drawRetroTextFit(ctx, text, x, y, maxWidth, maxSize, color = "#ffff00", align = "center") {
    const minSize = 6;
    const normalizedColor = color.toString().trim().toLowerCase();
    const drawShadow = normalizedColor !== "#000000" && normalizedColor !== "black";

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    // Medimos con el tamaño máximo
    ctx.font = `${maxSize}px 'Press Start 2P', monospace`;
    const textWidth = ctx.measureText(text).width;
    
    // Calculamos el tamaño proporcional de golpe
    let size = maxSize;
    if (textWidth > maxWidth && textWidth > 0) {
        size = Math.max(minSize, Math.floor(maxSize * (maxWidth / textWidth)));
    }

    ctx.font = `${size}px 'Press Start 2P', monospace`;
    if (drawShadow) {
        ctx.fillStyle = "#000";
        ctx.fillText(text, x + 2, y + 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    ctx.restore();
    return size;
}

// Devuelve negro o blanco según cuál se lea mejor sobre un color de fondo dado
function getContrastTextColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return "#ffffff";
    let c = hexColor.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(char => char + char).join('');
    if (c.length !== 6) return "#ffffff";

    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminancia > 0.6 ? "#000000" : "#ffffff";
}

// Escribe un texto en varias líneas dentro de un área fija (para nombres
// largos de equipos/ligas), sin agrandar el contenedor. Reduce el tamaño
// de letra solo si hace falta para que todas las líneas quepan en el alto
// disponible; si con el tamaño mínimo sigue sin caber, recorta la última
// línea con puntos suspensivos.
function drawWrappedCardName(ctx, text, cx, areaTop, maxWidth, maxHeight, maxSize, color) {
    const minSize = 7;
    let size = maxSize;
    let lineas = [];

    while (size >= minSize) {
        ctx.font = `${size}px 'Press Start 2P', monospace`;
        lineas = wrapTextByWidth(ctx, text, maxWidth);
        const lineHeight = size * 1.5;
        const alturaTotal = lineas.length * lineHeight;
        if (alturaTotal <= maxHeight) break;
        size -= 1;
    }

    ctx.font = `${size}px 'Press Start 2P', monospace`;
    const lineHeight = size * 1.5;
    let alturaTotal = lineas.length * lineHeight;

    const maxLineas = Math.max(1, Math.floor(maxHeight / lineHeight));
    if (lineas.length > maxLineas) {
        lineas = lineas.slice(0, maxLineas);
        let ultima = lineas[maxLineas - 1];
        while (ctx.measureText(ultima + "...").width > maxWidth && ultima.length > 1) {
            ultima = ultima.slice(0, -1);
        }
        lineas[maxLineas - 1] = ultima + "...";
        alturaTotal = lineas.length * lineHeight;
    }

    const startY = areaTop + Math.max(0, (maxHeight - alturaTotal) / 2) + lineHeight / 2;

    lineas.forEach((linea, i) => {
        drawRetroText(ctx, linea, cx, startY + i * lineHeight, size, color);
    });
}

// Parte un texto en líneas que quepan en maxWidth, usando el font ya
// establecido en ctx. Si una sola palabra es más ancha que maxWidth,
// la corta letra a letra.
function wrapTextByWidth(ctx, text, maxWidth) {
    const palabras = text.split(" ");
    const lineas = [];
    let lineaActual = "";

    palabras.forEach(palabra => {
        const pruebaLinea = lineaActual ? lineaActual + " " + palabra : palabra;
        if (ctx.measureText(pruebaLinea).width <= maxWidth) {
            lineaActual = pruebaLinea;
        } else {
            if (lineaActual) lineas.push(lineaActual);
            if (ctx.measureText(palabra).width > maxWidth) {
                let trozo = "";
                for (const letra of palabra) {
                    const pruebaTrozo = trozo + letra;
                    if (ctx.measureText(pruebaTrozo).width > maxWidth && trozo) {
                        lineas.push(trozo);
                        trozo = letra;
                    } else {
                        trozo = pruebaTrozo;
                    }
                }
                lineaActual = trozo;
            } else {
                lineaActual = palabra;
            }
        }
    });
    if (lineaActual) lineas.push(lineaActual);
    return lineas;
}
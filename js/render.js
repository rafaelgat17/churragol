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
function drawRetroText(ctx, text, x, y, size = 20, color = "#f5f5f5", align = "center") {
    ctx.save();
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    // Sombra del texto (efecto retro tipo consola). Se omite si el texto
    // ya es negro, porque la sombra negra se confunde con la letra.
    if (!esColorNegro(color)) {
        ctx.fillStyle = "#000";
        ctx.fillText(text, x + 3, y + 3);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    ctx.restore();
}

// Comprueba si un color es negro (o casi), para decidir si tiene
// sentido dibujarle una sombra negra detrás
function esColorNegro(color) {
    if (!color) return false;
    const c = color.toString().toLowerCase().trim();
    return c === "#000" || c === "#000000" || c === "black" || c === "rgb(0,0,0)";
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
function drawRetroTextFit(ctx, text, x, y, maxWidth, maxSize, color = "#f5f5f5", align = "center") {
    let size = maxSize;
    const minSize = 6;

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    while (size > minSize) {
        ctx.font = `${size}px 'Press Start 2P', monospace`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 1;
    }

    ctx.font = `${size}px 'Press Start 2P', monospace`;
    if (!esColorNegro(color)) {
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
// largos de equipos/ligas), sin agrandar el contenedor.
// Prioridad: 1) el tamaño más grande que quepa en alto SIN partir
// ninguna palabra por la mitad. 2) Si ni al tamaño mínimo cabe entera
// una palabra, se parte, pero repartida de forma equilibrada entre
// las líneas que hagan falta (no "casi toda la palabra" + "una letra").
function drawWrappedCardName(ctx, text, cx, areaTop, maxWidth, maxHeight, maxSize, color) {
    const minSize = 7;
    let size = maxSize;
    let lineas = [];
    let mejorSize = minSize;
    let mejorLineas = null;

    for (size = maxSize; size >= minSize; size--) {
        ctx.font = `${size}px 'Press Start 2P', monospace`;
        lineas = wrapTextByWidth(ctx, text, maxWidth);
        const rompioPalabra = wrapTextByWidth.rompioPalabra;
        const lineHeight = size * 1.5;
        const alturaTotal = lineas.length * lineHeight;

        if (alturaTotal <= maxHeight) {
            mejorSize = size;
            mejorLineas = lineas;
            if (!rompioPalabra) break; // el más grande sin partir palabras: nos quedamos con este
        }
    }

    size = mejorSize;
    lineas = mejorLineas || lineas;
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
// establecido en ctx. Si una palabra sola no cabe en una línea, se
// reparte equilibradamente (ver wrapWordEvenly) en vez de rellenar
// la primera línea al máximo y dejar una letra suelta al final.
function wrapTextByWidth(ctx, text, maxWidth) {
    const palabras = text.split(" ");
    const lineas = [];
    let lineaActual = "";
    let rompioAlgunaPalabra = false;

    palabras.forEach(palabra => {
        const pruebaLinea = lineaActual ? lineaActual + " " + palabra : palabra;
        if (ctx.measureText(pruebaLinea).width <= maxWidth) {
            lineaActual = pruebaLinea;
        } else {
            if (lineaActual) lineas.push(lineaActual);
            if (ctx.measureText(palabra).width > maxWidth) {
                rompioAlgunaPalabra = true;
                const subLineas = wrapWordEvenly(ctx, palabra, maxWidth);
                lineas.push(...subLineas.slice(0, -1));
                lineaActual = subLineas[subLineas.length - 1];
            } else {
                lineaActual = palabra;
            }
        }
    });
    if (lineaActual) lineas.push(lineaActual);

    wrapTextByWidth.rompioPalabra = rompioAlgunaPalabra;
    return lineas;
}

// Reparte una palabra demasiado larga en tantas líneas como haga falta,
// intentando que todas midan aproximadamente lo mismo (en vez de llenar
// la primera al máximo y dejar los últimos caracteres sueltos)
function wrapWordEvenly(ctx, word, maxWidth) {
    const anchoTotal = ctx.measureText(word).width;
    const numLineas = Math.max(1, Math.ceil(anchoTotal / maxWidth));
    const objetivoPorLinea = Math.ceil(word.length / numLineas);

    const lineas = [];
    let index = 0;
    while (index < word.length) {
        let fin = Math.min(word.length, index + objetivoPorLinea);
        let trozo = word.slice(index, fin);
        while (ctx.measureText(trozo).width > maxWidth && trozo.length > 1) {
            trozo = trozo.slice(0, -1);
        }
        if (trozo.length === 0) trozo = word[index];
        lineas.push(trozo);
        index += trozo.length;
    }
    return lineas;
}
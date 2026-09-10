import { legendLetter, ELEMENT_KINDS, KIND_COLORS, roomNameFits } from './bastionGeometry';

// A legend turns element names into short keys drawn on the map, with the full names
// listed in a box. Facilities take letters (A, B, C…) and come first; hallways and
// stairs take numbers (1, 2, 3…), are marked `minor`, and are listed after the
// facilities in smaller text. The viewer panel and the exported PNG both build their
// entries here, so the two always agree.

// Base metrics, in pixels at Roll20's default 70px square. Everything scales from these.
const BASE = {
    pad: 10,
    lineH: 16,
    minorLineH: 13,
    fontSize: 12,
    minorFontSize: 10,
    titleSize: 13,
    titleGap: 6,
    groupGap: 4,
    keyGap: 6,
    swatchPad: 2,      // grows the swatch a touch past the key glyph
    radius: 6,
};

const named = (r) => (r.name || '').trim();
const fallbackName = (r) =>
    named(r) || (r.kind === ELEMENT_KINDS.hallway ? 'Hallway' : 'Stairs');

// The swatch mirrors how the element is painted on the map: its own color when it
// has one, otherwise the default for its kind.
const swatchColor = (r) => r.color || KIND_COLORS[r.kind] || '#8888aa';

// Black or white key glyph, whichever stays legible on that swatch.
function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1a1a' : '#fff';
}

const byPosition = (a, b) => (a.originY - b.originY) || (a.originX - b.originX);

// Build the entry list from the elements on ONE floor — callers pass the rooms for the
// floor being shown, so a legend never lists something the viewer cannot see.
export function buildLegend(rooms, {
    onlyLongNames = false,
    includeHallways = false,
    includeStairs = false,
} = {}) {
    const facilities = rooms
        .filter((r) => (r.kind === ELEMENT_KINDS.special || r.kind === ELEMENT_KINDS.basic) && named(r))
        // When the DM only wants the overflow listed, rooms whose name is fully
        // readable on the map keep it and stay out of the legend.
        .filter((r) => (onlyLongNames ? !roomNameFits(r.name, r.cells) : true))
        .sort(byPosition);

    // Stairs are counted first, then hallways, numbered continuously across both.
    const stairs = includeStairs
        ? rooms.filter((r) => r.kind === ELEMENT_KINDS.stairs).sort(byPosition) : [];
    const halls = includeHallways
        ? rooms.filter((r) => r.kind === ELEMENT_KINDS.hallway).sort(byPosition) : [];
    const minors = [...stairs, ...halls];

    const entries = [
        ...facilities.map((r, i) => ({
            key: legendLetter(i), name: named(r), clientKey: r.clientKey, minor: false,
            color: swatchColor(r), hatch: false,
        })),
        ...minors.map((r, i) => ({
            key: String(i + 1), name: fallbackName(r), clientKey: r.clientKey, minor: true,
            color: swatchColor(r), hatch: r.kind === ELEMENT_KINDS.stairs,
        })),
    ];

    const letterByKey = {};
    for (const e of entries) letterByKey[e.clientKey] = e.key;
    return { entries, letterByKey };
}

function metrics(scale) {
    const m = {};
    for (const k of Object.keys(BASE)) m[k] = BASE[k] * scale;
    return m;
}

const rowH = (m, e) => (e.minor ? m.minorLineH : m.lineH);

// Box size for a legend at this scale, so callers can clamp it inside the image.
export function measureLegend(ctx, entries, scale) {
    if (!entries || entries.length === 0) return { w: 0, h: 0 };
    const m = metrics(scale);
    ctx.save();
    ctx.font = `bold ${m.titleSize}px system-ui, sans-serif`;
    let widest = ctx.measureText('Legend').width;
    let h = m.pad * 2 + m.titleSize + m.titleGap;
    let sawMinor = false;

    for (const e of entries) {
        const fs = e.minor ? m.minorFontSize : m.fontSize;
        const sw = fs + m.swatchPad * 2;
        ctx.font = `${fs}px system-ui, sans-serif`;
        const w = sw + m.keyGap + ctx.measureText(e.name).width;
        if (w > widest) widest = w;
        if (e.minor && !sawMinor) { sawMinor = true; h += m.groupGap; }
        h += rowH(m, e);
    }
    ctx.restore();
    return { w: Math.ceil(widest + m.pad * 2), h: Math.ceil(h) };
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Draw the legend with its top-left at (x, y). Returns the box it occupied.
export function drawLegend(ctx, { entries, x, y, scale = 1, translucent = true }) {
    if (!entries || entries.length === 0) return { w: 0, h: 0 };
    const m = metrics(scale);
    const box = measureLegend(ctx, entries, scale);

    ctx.save();
    ctx.fillStyle = translucent ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.97)';
    ctx.strokeStyle = translucent ? 'rgba(17,17,17,0.45)' : 'rgba(17,17,17,0.7)';
    ctx.lineWidth = Math.max(1, scale);
    roundRect(ctx, x, y, box.w, box.h, m.radius);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(17,17,17,0.85)';
    ctx.font = `bold ${m.titleSize}px system-ui, sans-serif`;
    ctx.fillText('Legend', x + m.pad, y + m.pad);

    let ty = y + m.pad + m.titleSize + m.titleGap;
    let sawMinor = false;
    for (const e of entries) {
        if (e.minor && !sawMinor) { sawMinor = true; ty += m.groupGap; }
        const fs = e.minor ? m.minorFontSize : m.fontSize;
        const sw = fs + m.swatchPad * 2;

        // Swatch in the element's own color, with the key sitting on top of it, so a
        // reader can match a legend row to a block on the map at a glance.
        ctx.fillStyle = e.color || '#8888aa';
        roundRect(ctx, x + m.pad, ty, sw, sw, Math.max(1, 2 * scale));
        ctx.fill();
        if (e.hatch) {
            // Stairs read as hatching on the map; mirror that here.
            ctx.save();
            ctx.beginPath();
            roundRect(ctx, x + m.pad, ty, sw, sw, Math.max(1, 2 * scale));
            ctx.clip();
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = Math.max(1, scale);
            for (let i = -1; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(x + m.pad + (i * sw) / 2, ty + sw);
                ctx.lineTo(x + m.pad + ((i + 2) * sw) / 2, ty);
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.strokeStyle = 'rgba(17,17,17,0.55)';
        ctx.lineWidth = Math.max(1, scale * 0.8);
        roundRect(ctx, x + m.pad, ty, sw, sw, Math.max(1, 2 * scale));
        ctx.stroke();

        ctx.font = `bold ${fs * 0.85}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = readableOn(e.color);
        ctx.fillText(e.key, x + m.pad + sw / 2, ty + m.swatchPad + fs * 0.1);
        ctx.textAlign = 'left';

        ctx.font = `${fs}px system-ui, sans-serif`;
        ctx.fillStyle = e.minor ? 'rgba(34,34,34,0.7)' : 'rgba(34,34,34,0.9)';
        ctx.fillText(e.name, x + m.pad + sw + m.keyGap, ty + m.swatchPad + fs * 0.1);
        ty += rowH(m, e);
    }
    ctx.restore();
    return box;
}

// Paint a legend onto its own canvas, sized to fit. The viewer puts this on the Konva
// stage as an image, which means the exporter picks it up for free — one painter, and
// the map you place is the map you get.
export function renderLegendToCanvas(entries, { scale = 1, translucent = true, pixelRatio = 2 } = {}) {
    if (!entries || entries.length === 0) return null;
    const probe = document.createElement('canvas').getContext('2d');
    const box = measureLegend(probe, entries, scale);
    if (box.w <= 0 || box.h <= 0) return null;

    const cv = document.createElement('canvas');
    cv.width = Math.ceil(box.w * pixelRatio);
    cv.height = Math.ceil(box.h * pixelRatio);
    const ctx = cv.getContext('2d');
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawLegend(ctx, { entries, x: 0, y: 0, scale, translucent });
    // Callers draw it at box.w × box.h; the extra pixels are just for sharpness.
    cv.__boxW = box.w;
    cv.__boxH = box.h;
    return cv;
}

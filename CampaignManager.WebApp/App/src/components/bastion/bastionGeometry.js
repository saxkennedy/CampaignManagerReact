// Shared geometry helpers for the bastion builder.
// A room's shape is a set of grid cells stored as [dx, dy] offsets relative to the
// room's origin (OriginX, OriginY). The DMG space sizes map to fixed square budgets.

export const CELL = 24; // pixels per grid square at zoom 1

export const SPACE_SQUARES = { cramped: 4, roomy: 16, vast: 36 };

export const ELEMENT_KINDS = {
    special: 'special',
    basic: 'basic',
    hallway: 'hallway',
    door: 'door',
    entry: 'entry',
    stairs: 'stairs',
};

// Default palette colors per kind (rooms can override via `color`).
export const KIND_COLORS = {
    special: '#8e6bb0',
    basic: '#6b8fb0',
    hallway: '#b0a06b',
    door: '#7a5230',
    entry: '#2e7d32',
    stairs: '#546e7a',
};

export function squaresFor(size) {
    return SPACE_SQUARES[size] || 4;
}

// A square (or near-square) polyomino filling `count` cells, returned as [dx,dy] list.
export function defaultRectCells(count) {
    const side = Math.max(1, Math.round(Math.sqrt(count)));
    const cells = [];
    let placed = 0;
    for (let y = 0; y < side && placed < count; y++) {
        for (let x = 0; x < side && placed < count; x++) {
            cells.push([x, y]);
            placed++;
        }
    }
    // remainder (non-perfect squares) spills onto an extra row
    let x = 0, y = side;
    while (placed < count) {
        cells.push([x, y]);
        x++; placed++;
    }
    return cells;
}

export function defaultCellsForKind(kind, size) {
    switch (kind) {
        case ELEMENT_KINDS.special:
        case ELEMENT_KINDS.basic:
            return defaultRectCells(squaresFor(size));
        case ELEMENT_KINDS.hallway:
            return [[0, 0], [1, 0], [2, 0]]; // 1x3 corridor, freely reshaped
        case ELEMENT_KINDS.stairs:
            return [[0, 0], [1, 0], [0, 1], [1, 1]]; // 2x2 landing
        case ELEMENT_KINDS.door:
        case ELEMENT_KINDS.entry:
        default:
            return [[0, 0]]; // single-cell marker
    }
}

// Bounding size (in cells) of a cell set.
export function cellBounds(cells) {
    if (!cells || cells.length === 0) return { w: 1, h: 1 };
    let maxX = 0, maxY = 0;
    for (const [x, y] of cells) {
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return { w: maxX + 1, h: maxY + 1 };
}


// Parse a room's stored GeometryJson string into { cells, target? }.
export function parseGeometry(geometryJson) {
    if (!geometryJson) return { cells: [[0, 0]] };
    try {
        const g = JSON.parse(geometryJson);
        if (Array.isArray(g)) return { cells: g };
        return { cells: Array.isArray(g.cells) ? g.cells : [[0, 0]], target: g.target, side: g.side };
    } catch {
        return { cells: [[0, 0]] };
    }
}

export function stringifyGeometry(cells, extra = {}) {
    return JSON.stringify({ cells, ...extra });
}

// Derive a facility's hireling capacity for a room of the given space size.
// HirelingsJson shapes observed in the catalog:
//   [{"exact":1}]                                        -> flat count
//   [{"exact":1,"space":"roomy"},{"exact":2,"space":"vast"}] -> count varies by size
//   [{"min":2}]                                          -> "at least N" (can grow)
// Returns { max, unbounded }: `max` = slot count to show; `unbounded` = a min-type
// entry, meaning the room may hold more than `max` (players can add beyond it).
export function hirelingCapacity(hirelingsJson, spaceSize) {
    if (!hirelingsJson) return { max: 0, unbounded: false };
    let arr;
    try { arr = JSON.parse(hirelingsJson); } catch { return { max: 0, unbounded: false }; }
    if (!Array.isArray(arr) || arr.length === 0) return { max: 0, unbounded: false };
    // Prefer an entry matching this room's size; else a size-less entry; else the first.
    const sized = arr.find((e) => e && e.space === spaceSize);
    const generic = arr.find((e) => e && e.space == null);
    const pick = sized || generic || arr[0];
    if (!pick) return { max: 0, unbounded: false };
    if (typeof pick.exact === 'number') return { max: pick.exact, unbounded: false };
    if (typeof pick.min === 'number') return { max: pick.min, unbounded: true };
    return { max: 0, unbounded: false };
}

// Facilities may allow one or several sizes (basic facilities list all three).
export function parseAllowedSizes(spaceJson) {
    if (!spaceJson) return [];
    try {
        const s = JSON.parse(spaceJson);
        if (Array.isArray(s)) return s.filter((x) => SPACE_SQUARES[x]);
        return [];
    } catch {
        return [];
    }
}

let uidCounter = 0;
// Stable client-side key for a room until the server assigns a real Id.
export function newClientKey() {
    uidCounter += 1;
    return `tmp_${Date.now()}_${uidCounter}`;
}

// Distinct room fills; each new facility room cycles to the next one.
export const ROOM_COLORS = [
    '#8e6bb0', '#3f7cac', '#c65b7c', '#2a9d8f', '#e08e45',
    '#6a8532', '#b0563f', '#5c6bc0', '#00897b', '#8d6e63',
];

export const SIDES = ['N', 'E', 'S', 'W'];

// Doors/entries are edge markers (a line on one side of a cell), not area.
export function isAreaKind(kind) {
    return kind !== ELEMENT_KINDS.door && kind !== ELEMENT_KINDS.entry;
}

// Absolute occupied cells for the area elements on a floor (excluding one room).
export function buildOccupancy(rooms, floorLevel, excludeKey) {
    const occ = new Set();
    for (const r of rooms) {
        if (r.floorLevel !== floorLevel) continue;
        if (r.clientKey === excludeKey) continue;
        if (!isAreaKind(r.kind)) continue;
        for (const [dx, dy] of r.cells) occ.add(`${r.originX + dx},${r.originY + dy}`);
    }
    return occ;
}

// Would a cell set at (ox, oy) sit fully in-bounds and clear of `occ`?
export function fits(cells, ox, oy, occ, maxW, maxH) {
    for (const [dx, dy] of cells) {
        const x = ox + dx, y = oy + dy;
        if (x < 0 || y < 0 || x >= maxW || y >= maxH) return false;
        if (occ.has(`${x},${y}`)) return false;
    }
    return true;
}

// Top-left-most origin where `cells` fits, scanning rows then columns.
export function firstFit(cells, occ, maxW, maxH) {
    const b = cellBounds(cells);
    for (let y = 0; y + b.h <= maxH; y++) {
        for (let x = 0; x + b.w <= maxW; x++) {
            if (fits(cells, x, y, occ, maxW, maxH)) return { x, y };
        }
    }
    return null;
}

// The filled cell to park a room's hireling marker on: the bottom-right-most filled
// cell in reading order. That keeps it clear of the name pill, which anchors near the
// shape's centroid — they only collide in a single-cell room, where nothing else fits.
export function hirelingAnchorCell(cells) {
    if (!cells || cells.length === 0) return [0, 0];
    let best = cells[0];
    for (const [x, y] of cells) {
        if (y > best[1] || (y === best[1] && x > best[0])) best = [x, y];
    }
    return best;
}

// Legend keys: A..Z, then AA, AB, …
export function legendLetter(index) {
    let n = index + 1, s = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

// ---------- room name layout ----------
// Names wrap across lines when the wrapped block still fits inside the room, and fall
// back to a single ellipsised line when even one word is too wide for the space. A 4×4
// "Artificer's Forge" wraps onto two lines; a 2×2 "Cabinet of Curiosities" cannot fit
// "Cabinet" on a line at all, so it stays "Ca…" and leans on hover and the legend.
export const NAME_FS = 11;
export const NAME_PADX = 6;
export const NAME_PADY = 3;
export const NAME_LINE_H = 13;

// Konva renders these with its default Arial face, so we measure against the very
// same font instead of guessing from character counts — a bold string runs wider
// than a per-character estimate, which is what left "Artificer's…" clipped inside a
// pill that was supposedly wide enough. Measurements are cached; rooms re-render on
// every drag frame.
export const NAME_FONT = 'Arial, sans-serif';

let measureCtx = null;
const widthCache = new Map();

function textWidth(s) {
    const str = s || '';
    const hit = widthCache.get(str);
    if (hit !== undefined) return hit;

    let w;
    if (typeof document === 'undefined') {
        w = str.length * NAME_FS * 0.58;   // no DOM (tests): fall back to the estimate
    } else {
        if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
        measureCtx.font = `bold ${NAME_FS}px ${NAME_FONT}`;
        w = measureCtx.measureText(str).width;
    }
    if (widthCache.size > 500) widthCache.clear();
    widthCache.set(str, w);
    return w;
}

export function layoutRoomLabel(name, cells) {
    const b = cellBounds(cells);
    const roomW = b.w * CELL, roomH = b.h * CELL;
    const maxPillW = Math.max(CELL - 4, roomW - 4);
    const maxPillH = Math.max(NAME_FS + NAME_PADY * 2, roomH - 4);
    const inner = maxPillW - NAME_PADX * 2;

    const label = String(name || '');
    const words = label.split(/\s+/).filter(Boolean);

    // Greedy wrap, but only when every word can stand on a line of its own — otherwise
    // wrapping just moves the truncation around without showing more of the name.
    let wrappedLines = [];
    if (words.length > 1 && words.every((w) => textWidth(w) <= inner)) {
        let cur = words[0];
        for (let i = 1; i < words.length; i++) {
            const next = `${cur} ${words[i]}`;
            if (textWidth(next) <= inner) cur = next;
            else { wrappedLines.push(cur); cur = words[i]; }
        }
        wrappedLines.push(cur);
    }

    const fitsWrapped = wrappedLines.length > 1
        && wrappedLines.length * NAME_LINE_H + NAME_PADY * 2 <= maxPillH;

    const lines = fitsWrapped ? wrappedLines : [label];
    const widest = Math.max(...lines.map(textWidth));
    const pillW = Math.min(Math.ceil(widest) + 1 + NAME_PADX * 2, maxPillW);
    const pillH = lines.length === 1
        ? NAME_FS + NAME_PADY * 2
        : lines.length * NAME_LINE_H + NAME_PADY * 2;

    return { text: lines.join('\n'), lines, pillW, pillH, wrapped: fitsWrapped, roomW, roomH };
}

// Where to center a room's label, in (fractional) cell coordinates.
//
// Snapping to a filled cell's CENTRE quietly biases every even-sized room up and to
// the left: in a 4x4 the centroid sits at (2,2), equidistant
// from the cells centered on 1.5 and 2.5, and the scan picks the first — half a square
// off in both axes. So use the true centroid whenever it actually lands on a filled
// square, and only fall back to the nearest filled cell for concave shapes where the
// centroid drops into a hole.
export function labelAnchorPoint(cells) {
    if (!cells || cells.length === 0) return [0.5, 0.5];
    let cx = 0, cy = 0;
    for (const [x, y] of cells) { cx += x + 0.5; cy += y + 0.5; }
    cx /= cells.length; cy /= cells.length;

    const overFilled = cells.some(([x, y]) => cx >= x && cx <= x + 1 && cy >= y && cy <= y + 1);
    if (overFilled) return [cx, cy];

    let best = cells[0], bestD = Infinity;
    for (const [x, y] of cells) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [x, y]; }
    }
    return [best[0] + 0.5, best[1] + 0.5];
}

// True when the whole name is actually readable on the map — either it fits on one
// line, or it wrapped and every line fitted. Drives the "only list names that don't
// fit" legend option, so the two can never disagree about what "fits" means.
export function roomNameFits(name, cells) {
    const lay = layoutRoomLabel(name, cells);
    if (lay.wrapped) return true;
    return textWidth(name) <= lay.pillW - NAME_PADX * 2;
}

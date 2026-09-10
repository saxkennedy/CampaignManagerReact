import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Line, Group, Text, Circle, Path, Image as KonvaImage } from 'react-konva';
import {
    Box, Paper, Typography, Button, IconButton, Stack, Divider, TextField,
    List, ListItemButton, ListItemText, Alert, CircularProgress, Chip, MenuItem,
    Select, FormControl, InputLabel, Tooltip, ToggleButton, ToggleButtonGroup, InputAdornment,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
    Menu, FormControlLabel, Checkbox, Slider,
} from '@mui/material';
import BastionService from '../../api/BastionService';
import BastionFacilityService from '../../api/BastionFacilityService';
import {
    CELL, KIND_COLORS, ELEMENT_KINDS, ROOM_COLORS, SIDES, defaultCellsForKind, cellBounds,
    parseGeometry, stringifyGeometry, parseAllowedSizes, squaresFor, newClientKey,
    isAreaKind, buildOccupancy, fits, firstFit, labelAnchorPoint, hirelingCapacity, hirelingAnchorCell,
    layoutRoomLabel, NAME_FS, NAME_PADX, NAME_PADY, NAME_LINE_H, NAME_FONT,
} from './bastionGeometry';
import RoomActivityPane from './RoomActivityPane';
import MyActionsDialog from './MyActionsDialog';
import FacilityDetail from './FacilityDetail';
import BastionBankPanel from './BastionBankPanel';
import RoomHirelings from './RoomHirelings';
import CampaignHirelings from './CampaignHirelings';
import BastionExportDialog, { DEFAULT_EXPORT_OPTS, pickExportScale } from './BastionExportDialog';
import { buildLegend, renderLegendToCanvas } from './bastionLegend';
import { SCISSOR_CURSOR } from './cursors';
import HirelingService from '../../api/HirelingService';
import ConfirmDialog from '../utilities/ConfirmDialog';
import { getAdminCapabilities, getCampaignName } from '../campaign/campaignPermissions';
import useDocumentTitle, { SITE_TITLE, titleFrom } from '../utilities/useDocumentTitle';

const clone = (o) => JSON.parse(JSON.stringify(o));

// Bastion-level view settings, stored as JSON on the bastion row.
const DEFAULT_LEGEND_BOX = { x: 0.5, y: 0.5, scale: 1 };   // cells from the board origin
const DEFAULT_SETTINGS = {
    showLegend: false,
    legendIncludeHallways: false,
    legendIncludeStairs: false,
    legendBox: { ...DEFAULT_LEGEND_BOX },
    hideGridLines: false,
    legendOnlyLongNames: false,
    legendOpacity: 0.85,
};

function parseSettings(settingsJson) {
    if (!settingsJson) return { ...DEFAULT_SETTINGS };
    try {
        const s = JSON.parse(settingsJson);
        return {
            showLegend: !!s?.showLegend,
            legendIncludeHallways: !!s?.legendIncludeHallways,
            legendIncludeStairs: !!s?.legendIncludeStairs,
            legendOnlyLongNames: !!s?.legendOnlyLongNames,
            hideGridLines: !!s?.hideGridLines,
            legendBox: {
                x: Number.isFinite(s?.legendBox?.x) ? s.legendBox.x : DEFAULT_LEGEND_BOX.x,
                y: Number.isFinite(s?.legendBox?.y) ? s.legendBox.y : DEFAULT_LEGEND_BOX.y,
                scale: Math.min(4, Math.max(0.5, Number(s?.legendBox?.scale) || 1)),
            },
            legendOpacity: Math.min(1, Math.max(0.2, Number(s?.legendOpacity) || 0.85)),
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

// Save a rendered PNG. Chromium browsers get a real Save-As dialog through the File
// System Access API, so the player picks the folder; everywhere else this falls back
// to an ordinary download into the browser's downloads folder.
async function savePng(blob, fileName) {
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
            });
            const w = await handle.createWritable();
            await w.write(blob);
            await w.close();
            return 'saved';
        } catch (e) {
            if (e?.name === 'AbortError') return 'cancelled';
            // Anything else (no permission, unsupported context) falls through.
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
}

function toClientRoom(r) {
    const geo = parseGeometry(r.geometryJson);
    return {
        clientKey: newClientKey(),
        id: r.id ?? null,
        kind: r.kind,
        bastionFacilityId: r.bastionFacilityId ?? null,
        name: r.name ?? null,
        spaceSize: r.spaceSize ?? null,
        floorLevel: r.floorLevel ?? 0,
        originX: r.originX ?? 0,
        originY: r.originY ?? 0,
        cells: geo.cells,
        side: geo.side ?? (isAreaKind(r.kind) ? null : 'N'),
        target: geo.target ?? null,
        color: r.color ?? null,
        maxConcurrentActivities: r.maxConcurrentActivities ?? null,
    };
}

function toSaveRoom(r) {
    const extra = {};
    if (r.kind === ELEMENT_KINDS.stairs && r.target != null) extra.target = r.target;
    if ((r.kind === ELEMENT_KINDS.door || r.kind === ELEMENT_KINDS.entry) && r.side) extra.side = r.side;
    return {
        id: r.id ?? undefined,
        clientKey: r.clientKey,
        kind: r.kind,
        bastionFacilityId: r.bastionFacilityId ?? null,
        name: r.name ?? null,
        spaceSize: r.spaceSize ?? null,
        floorLevel: r.floorLevel,
        originX: r.originX,
        originY: r.originY,
        geometryJson: stringifyGeometry(r.cells, extra),
        color: r.color ?? null,
        maxConcurrentActivities: r.maxConcurrentActivities ?? null,
    };
}

// [x1,y1,x2,y2] for a marker line on one side of the cell at (0,0).
function sideLinePoints(side) {
    switch (side) {
        case 'N': return [0, 0, CELL, 0];
        case 'S': return [0, CELL, CELL, CELL];
        case 'E': return [CELL, 0, CELL, CELL];
        case 'W': default: return [0, 0, 0, CELL];
    }
}

// Diagonal-bar hatch across a set of cells — the visual signature for stairs.
function stairsHatch(cells, stroke, strokeWidth) {
    const segs = [
        [0, CELL, CELL, 0],
        [CELL / 2, CELL, CELL, CELL / 2],
        [0, CELL / 2, CELL / 2, 0],
    ];
    const lines = [];
    cells.forEach(([dx, dy], ci) => {
        const ox = dx * CELL, oy = dy * CELL;
        segs.forEach((s, si) => lines.push(
            <Line key={`sh${ci}_${si}`} points={[ox + s[0], oy + s[1], ox + s[2], oy + s[3]]}
                stroke={stroke} strokeWidth={strokeWidth} listening={false} />
        ));
    });
    return lines;
}


// Material "person" glyph on a 24x24 viewBox — drawn as vectors so it stays crisp in
// the PNG export at any scale.
const PERSON_PATH = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';

// A hireling marker parked on one square of a room: a light disc so it reads over any
// room fill, the person glyph, and a count when more than one hireling lives there.
function HirelingMarker({ cell, count, absent, onEnter, onLeave, listening }) {
    const [dx, dy] = cell;
    const ox = dx * CELL, oy = dy * CELL;
    const s = (CELL * 0.62) / 24;
    const glyph = CELL * 0.62;
    return (
        <Group x={ox} y={oy} listening={listening}
            onMouseEnter={onEnter} onMouseLeave={onLeave} onTap={onEnter}>
            <Circle x={CELL / 2} y={CELL / 2} radius={CELL * 0.42}
                fill={absent ? 'rgba(245,245,245,0.85)' : 'rgba(255,255,255,0.92)'}
                stroke="rgba(17,17,17,0.75)" strokeWidth={1} />
            <Path data={PERSON_PATH} scaleX={s} scaleY={s}
                x={CELL / 2 - glyph / 2} y={CELL / 2 - glyph / 2}
                fill={absent ? '#9e9e9e' : '#2b2b2b'} listening={false} />
            {count > 1 && (
                <>
                    <Circle x={CELL - 4} y={4} radius={6} fill="#c62828" stroke="#fff" strokeWidth={1} listening={false} />
                    <Text text={String(count)} x={CELL - 10} y={0} width={12} height={9}
                        fontSize={9} fontStyle="bold" fill="#fff" align="center" verticalAlign="middle" listening={false} />
                </>
            )}
        </Group>
    );
}
export default function BastionBuilder({ user }) {
    const { bastionId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState(null);
    const [facilities, setFacilities] = useState([]);

    // Named once the bastion loads; until then the tab keeps the site title
    // rather than flashing a placeholder.
    useDocumentTitle(meta?.name ? titleFrom(meta.name, getCampaignName(user, meta.campaignId) || SITE_TITLE) : null);

    const [doc, setDoc] = useState({ rooms: [], floors: [{ level: 0, name: 'Ground Floor' }], settings: { ...DEFAULT_SETTINGS } });
    const docRef = useRef(doc);
    useEffect(() => { docRef.current = doc; }, [doc]);

    const pastRef = useRef([]);
    const futureRef = useRef([]);
    const [, forceHist] = useState(0);
    const bumpHist = () => forceHist((v) => v + 1);

    const [activeFloor, setActiveFloor] = useState(0);
    const [selectedKey, setSelectedKey] = useState(null);
    const [tool, setTool] = useState('select');
    const [confirmFloor, setConfirmFloor] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewAsPlayer, setViewAsPlayer] = useState(false);
    const [floorDialog, setFloorDialog] = useState(null); // { mode:'add'|'rename', level, name }
    const [hoverLabel, setHoverLabel] = useState(null);   // { text, x, y } — full-name tooltip
    const [myActionsOpen, setMyActionsOpen] = useState(false); // player planned-history dialog
    const [detailsOpen, setDetailsOpen] = useState(true);      // facility-details side pane (player)
    const [hirelingsOpen, setHirelingsOpen] = useState(false); // campaign hirelings dialog
    const [confirmLeave, setConfirmLeave] = useState(false);   // unsaved-changes guard

    const [hirelingsByRoom, setHirelingsByRoom] = useState({}); // roomId -> hirelings standing there

    // export / crop
    const [exportOpen, setExportOpen] = useState(false);
    const [exportStep, setExportStep] = useState('method');       // 'method' | 'save'
    const [exportRect, setExportRect] = useState(null);           // { x, y, w, h } in cells
    const [exportBusy, setExportBusy] = useState(false);
    const [exportError, setExportError] = useState('');
    const [cropMode, setCropMode] = useState(false);
    const [cropDraft, setCropDraft] = useState(null);             // live crop box, in cells
    const [renderForExport, setRenderForExport] = useState(null); // { hideGrid } while capturing
    const cropStartRef = useRef(null);
    const cropPointerRef = useRef(null);
    const cropBoxRef = useRef(null);            // mirrors cropDraft for the mouse-up read
    const [settingsAnchor, setSettingsAnchor] = useState(null); // Settings dropdown
    const [exportOpts, setExportOpts] = useState({ ...DEFAULT_EXPORT_OPTS });
    const [previewCanvas, setPreviewCanvas] = useState(null);   // cached map layer of the preview
    const [liveOpacity, setLiveOpacity] = useState(null);       // slider value mid-drag, before it is committed
    const selectedKeyRef = useRef(null);                        // read during export without re-binding it
    const legendImgRef = useRef(null);                          // scaled live while resizing
    const legendHandleRef = useRef(null);
    useEffect(() => { selectedKeyRef.current = selectedKey; }, [selectedKey]);

    // placement
    const [pending, setPending] = useState(null);   // { kind, facility, spaceSize, cells }
    const [ghost, setGhost] = useState(null);        // { x, y }
    const dragItemRef = useRef(null);
    const colorIndexRef = useRef(0);

    // palette filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const containerRef = useRef(null);
    const [size, setSize] = useState({ w: 800, h: 600 });
    const stageRef = useRef(null);
    const [view, setView] = useState({ scale: 1, x: 40, y: 40 });

    const canWrite = meta?.accessLevel === 'Manage' || meta?.accessLevel === 'Owner';
    // effective editing capability — a Write user can preview the read-only player view
    const editing = canWrite && !viewAsPlayer;
    const isDm = !!meta && getAdminCapabilities(user, meta.campaignId).canManagePersonas;
    const enterPlayerView = () => { setViewAsPlayer(true); setPending(null); setGhost(null); setTool('select'); setSelectedKey(null); };

    // ---------- load ----------
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [b, fac] = await Promise.all([
                    BastionService.getBastion(bastionId),
                    BastionFacilityService.listFacilities().catch(() => []),
                ]);
                if (!active) return;
                setMeta({ name: b.name, maxWidth: b.maxWidth, maxHeight: b.maxHeight, accessLevel: b.accessLevel, campaignId: b.campaignId });
                const floors = (b.floors && b.floors.length) ? b.floors : [{ level: 0, name: 'Ground Floor' }];
                setDoc({ rooms: (b.rooms || []).map(toClientRoom), floors, settings: parseSettings(b.settingsJson) });
                setActiveFloor(floors[0].level);
                setFacilities(Array.isArray(fac) ? fac : []);
                colorIndexRef.current = (b.rooms || []).length;
            } catch (e) {
                if (active) setError(e.message || 'Failed to load bastion.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [bastionId]);

    // ---------- stage sizing ----------
    // The container is only mounted once `loading` is false, so we (re)attach a
    // ResizeObserver after loading finishes — this measures the real laid-out box
    // on first paint (fixing the initial cut-off) and on every later resize.
    useEffect(() => {
        if (loading) return;
        const el = containerRef.current;
        if (!el) return;
        const measure = () => setSize({ w: el.clientWidth, h: Math.max(400, el.clientHeight) });
        measure();
        // one more tick after layout settles, then observe
        const raf = requestAnimationFrame(measure);
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }, [loading]);

    // ---------- history ----------
    const mutate = useCallback((updater) => {
        pastRef.current.push(clone(docRef.current));
        if (pastRef.current.length > 100) pastRef.current.shift();
        futureRef.current = [];
        setDoc((d) => updater(clone(d)));
        setDirty(true);
        bumpHist();
    }, []);

    const undo = useCallback(() => {
        if (!pastRef.current.length) return;
        futureRef.current.push(clone(docRef.current));
        setDoc(pastRef.current.pop());
        setDirty(true);
        bumpHist();
    }, []);

    const redo = useCallback(() => {
        if (!futureRef.current.length) return;
        pastRef.current.push(clone(docRef.current));
        setDoc(futureRef.current.pop());
        setDirty(true);
        bumpHist();
    }, []);

    // ---------- placement helpers ----------
    const pointerToCell = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return null;
        const p = stage.getPointerPosition();
        if (!p) return null;
        return {
            x: Math.floor(((p.x - view.x) / view.scale) / CELL),
            y: Math.floor(((p.y - view.y) / view.scale) / CELL),
        };
    }, [view]);

    const makePending = (kind, facility) => {
        const spaceSize = (kind === 'special' || kind === 'basic') ? (parseAllowedSizes(facility?.spaceJson)[0] || 'cramped') : null;
        return { kind, facility: facility || null, spaceSize, cells: defaultCellsForKind(kind, spaceSize) };
    };

    const tryPlace = (kind, facility, ox, oy) => {
        if (!meta) return false;
        const spaceSize = (kind === 'special' || kind === 'basic') ? (parseAllowedSizes(facility?.spaceJson)[0] || 'cramped') : null;
        const cells = defaultCellsForKind(kind, spaceSize);
        if (isAreaKind(kind)) {
            const occ = buildOccupancy(docRef.current.rooms, activeFloor, null);
            if (!fits(cells, ox, oy, occ, meta.maxWidth, meta.maxHeight)) return false;
        } else if (ox < 0 || oy < 0 || ox >= meta.maxWidth || oy >= meta.maxHeight) {
            return false;
        }
        const color = (kind === 'special' || kind === 'basic')
            ? ROOM_COLORS[colorIndexRef.current++ % ROOM_COLORS.length] : null;
        const room = {
            clientKey: newClientKey(), id: null, kind,
            bastionFacilityId: facility?.id ?? null,
            name: facility?.name ?? null,
            spaceSize, floorLevel: activeFloor,
            originX: ox, originY: oy,
            cells, side: isAreaKind(kind) ? null : 'N',
            target: kind === 'stairs' ? activeFloor + 1 : null,
            color, maxConcurrentActivities: null,
        };
        mutate((d) => { d.rooms.push(room); return d; });
        setSelectedKey(room.clientKey);
        return true;
    };

    const autoPlace = (kind, facility) => {
        const spaceSize = (kind === 'special' || kind === 'basic') ? (parseAllowedSizes(facility?.spaceJson)[0] || 'cramped') : null;
        const cells = defaultCellsForKind(kind, spaceSize);
        if (isAreaKind(kind)) {
            const occ = buildOccupancy(docRef.current.rooms, activeFloor, null);
            const spot = firstFit(cells, occ, meta.maxWidth, meta.maxHeight);
            if (!spot) { setError('No free space on this floor for that shape.'); return; }
            tryPlace(kind, facility, spot.x, spot.y);
        } else {
            tryPlace(kind, facility, 0, 0);
        }
    };

    const beginPending = (kind, facility) => {
        if (!editing) return;
        setPending((p) => (p && p.kind === kind && (p.facility?.id ?? null) === (facility?.id ?? null)) ? null : makePending(kind, facility));
        setGhost(null);
    };

    const placeFromPending = () => {
        const c = ghost || pointerToCell();
        if (!c || !pending) return;
        if (tryPlace(pending.kind, pending.facility, c.x, c.y)) { setPending(null); setGhost(null); }
    };

    const paletteHandlers = (kind, facility) => ({
        draggable: editing,
        onDragStart: () => { dragItemRef.current = { kind, facility }; },
        onClick: () => beginPending(kind, facility),
        onDoubleClick: () => { setPending(null); setGhost(null); autoPlace(kind, facility); },
    });

    // ---------- element ops ----------
    // View settings ride along with the bastion document, so toggling one marks the
    // board dirty and is persisted by the next Save.
    const setSetting = (key, value) => mutate((d) => {
        d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), [key]: value };
        return d;
    });

    const toggleSetting = (key) => mutate((d) => {
        d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), [key]: !(d.settings || {})[key] };
        return d;
    });

    const updateSelected = (patch) => {
        mutate((d) => { const r = d.rooms.find((x) => x.clientKey === selectedKey); if (r) Object.assign(r, patch); return d; });
    };
    const deleteSelected = () => {
        if (!selectedKey) return;
        mutate((d) => { d.rooms = d.rooms.filter((x) => x.clientKey !== selectedKey); return d; });
        setSelectedKey(null);
    };
    const moveRoom = (clientKey, originX, originY) => {
        mutate((d) => { const r = d.rooms.find((x) => x.clientKey === clientKey); if (r) { r.originX = originX; r.originY = originY; } return d; });
    };
    const toggleCellForSelected = (absX, absY) => {
        const sel = docRef.current.rooms.find((x) => x.clientKey === selectedKey);
        if (!sel || !isAreaKind(sel.kind)) return;
        if (absX < 0 || absY < 0 || absX >= meta.maxWidth || absY >= meta.maxHeight) return;
        const dx = absX - sel.originX, dy = absY - sel.originY;
        const has = sel.cells.some(([cx, cy]) => cx === dx && cy === dy);
        const budget = (sel.kind === 'special' || sel.kind === 'basic') ? squaresFor(sel.spaceSize) : Infinity;
        const occ = buildOccupancy(docRef.current.rooms, activeFloor, selectedKey);
        mutate((d) => {
            const r = d.rooms.find((x) => x.clientKey === selectedKey);
            if (!r) return d;
            if (has) {
                if (r.cells.length > 1) r.cells = r.cells.filter(([cx, cy]) => !(cx === dx && cy === dy));
            } else if (r.cells.length < budget && dx >= 0 && dy >= 0 && !occ.has(`${absX},${absY}`)) {
                r.cells = [...r.cells, [dx, dy]];
            }
            return d;
        });
    };

    // ---------- floors ----------
    const openAddFloor = () => {
        const level = Math.max(...doc.floors.map((f) => f.level)) + 1;
        setFloorDialog({ mode: 'add', level, name: `Floor ${level}` });
    };
    const openRenameFloor = (level) => {
        const f = doc.floors.find((x) => x.level === level);
        setFloorDialog({ mode: 'rename', level, name: f?.name || '' });
    };
    const commitFloorDialog = () => {
        const fd = floorDialog;
        if (!fd) return;
        const name = (fd.name || '').trim() || (fd.mode === 'add' ? `Floor ${fd.level}` : 'Floor');
        if (fd.mode === 'add') {
            mutate((d) => { d.floors = [...d.floors, { level: fd.level, name }].sort((a, b) => a.level - b.level); return d; });
            setActiveFloor(fd.level);
        } else {
            mutate((d) => { const f = d.floors.find((x) => x.level === fd.level); if (f) f.name = name; return d; });
        }
        setFloorDialog(null);
    };
    // Ask before deleting a floor that still has elements; delete empty ones immediately.
    const requestDeleteFloor = (level) => {
        if (doc.floors.length <= 1) { setError('A bastion must have at least one floor.'); return; }
        const count = doc.rooms.filter((r) => r.floorLevel === level).length;
        if (count > 0) setConfirmFloor(level);
        else deleteFloor(level);
    };
    const deleteFloor = (level) => {
        const remaining = doc.floors.filter((f) => f.level !== level);
        mutate((d) => {
            d.floors = d.floors.filter((f) => f.level !== level);
            d.rooms = d.rooms.filter((r) => r.floorLevel !== level);
            return d;
        });
        if (remaining.length) setActiveFloor(remaining[0].level);
        setConfirmFloor(null);
    };

    // ---------- save ----------
    const save = async () => {
        if (!canWrite) return;
        setSaving(true); setError('');
        try {
            const payload = {
                name: meta.name, maxWidth: meta.maxWidth, maxHeight: meta.maxHeight,
                floors: doc.floors.map((f) => ({ level: f.level, name: f.name })),
                rooms: doc.rooms.map(toSaveRoom),
                settingsJson: JSON.stringify(doc.settings || DEFAULT_SETTINGS),
            };
            const res = await BastionService.saveBastion(bastionId, payload);

            // Flush hirelings that were queued against rooms before they had a server Id.
            const idMap = new Map((res.roomIdMap || []).map((m) => [m.clientKey, m.id]));
            for (const r of docRef.current.rooms) {
                const pend = r.pendingHirelings;
                if (!pend || pend.length === 0) continue;
                const serverRoomId = r.id || idMap.get(r.clientKey);
                if (!serverRoomId) continue;
                for (const p of pend) {
                    try {
                        if (p.kind === 'pool') await HirelingService.updateHireling(p.id, { bastionRoomId: serverRoomId });
                        else await HirelingService.createHireling(meta.campaignId, { name: p.name, role: p.role || undefined, bastionRoomId: serverRoomId });
                    } catch { /* leave the rest; surfaced on next open */ }
                }
            }

            setDoc((d) => ({ ...d, rooms: (res.rooms || []).map(toClientRoom), floors: res.floors || d.floors, settings: parseSettings(res.settingsJson) || d.settings }));
            colorIndexRef.current = (res.rooms || []).length;
            pastRef.current = []; futureRef.current = [];
            setSelectedKey(null); setDirty(false);
            loadHirelings(); // room assignments flushed above may have moved people
        } catch (e) {
            setError(e.message || 'Save failed.');
        } finally { setSaving(false); }
    };

    // ---------- keyboard ----------
    useEffect(() => {
        const onKey = (e) => {
            if (!editing) return;
            // Don't hijack keys while typing in a field (e.g. Backspace in the hireling name box).
            const t = e.target;
            const tag = t?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
            if (e.key === 'Escape') { setPending(null); setGhost(null); return; }
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
            else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKey) { e.preventDefault(); deleteSelected(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line
    }, [editing, selectedKey, undo, redo]);

    // ---------- warn on leaving with unsaved changes ----------
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const leaveToBastions = () => {
        if (dirty) setConfirmLeave(true);
        else navigate(`/campaigns/${meta.campaignId}/bastions`);
    };

    // ---------- hirelings shown on the map ----------
    // One roster fetch per bastion, re-pulled whenever the hirelings dialog closes or a
    // save flushes room assignments, so the markers track who is actually standing where.
    const loadHirelings = useCallback(async () => {
        if (!meta?.campaignId) return;
        try {
            const resp = await HirelingService.listCampaignHirelings(meta.campaignId);
            const byRoom = {};
            for (const h of resp?.hirelings || []) {
                if (!h.bastionRoomId) continue;
                const k = String(h.bastionRoomId);
                (byRoom[k] = byRoom[k] || []).push(h);
            }
            setHirelingsByRoom(byRoom);
        } catch { /* markers simply don't appear */ }
    }, [meta?.campaignId]);

    useEffect(() => { loadHirelings(); }, [loadHirelings]);

    // ---------- export ----------
    const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const openExport = () => {
        setPending(null); setGhost(null);
        setExportError(''); setExportRect(null); setExportStep('method'); setExportOpen(true);
    };
    const cancelExport = () => {
        setExportOpen(false); setCropMode(false); setCropDraft(null); cropBoxRef.current = null;
        cropStartRef.current = null;
        setExportStep('method'); setExportRect(null); setExportError('');
    };
    const pickWholeMap = () => {
        setExportRect({ x: 0, y: 0, w: meta.maxWidth, h: meta.maxHeight });
        setExportStep('save');
    };
    const pickCrop = () => {
        setExportOpen(false); setCropDraft(null); cropBoxRef.current = null; cropStartRef.current = null; setCropMode(true);
    };

    // Pointer position in (fractional) grid cells.
    const pointerToCellFloat = useCallback(() => {
        const stage = stageRef.current;
        const p = stage?.getPointerPosition();
        if (!p) return null;
        return { x: ((p.x - view.x) / view.scale) / CELL, y: ((p.y - view.y) / view.scale) / CELL };
    }, [view]);

    // Whole-square crop box anchored on the cell the drag started in, growing toward the
    // pointer. `square` (Shift) locks the two sides equal, clamped to the board edge in
    // whichever direction the drag is heading.
    const cropRectFrom = useCallback((start, cur, square) => {
        const maxW = meta.maxWidth, maxH = meta.maxHeight;
        const ax = Math.max(0, Math.min(Math.floor(start.x), maxW - 1));
        const ay = Math.max(0, Math.min(Math.floor(start.y), maxH - 1));
        const bx = Math.max(0, Math.min(Math.floor(cur.x), maxW - 1));
        const by = Math.max(0, Math.min(Math.floor(cur.y), maxH - 1));
        let w = Math.abs(bx - ax) + 1, h = Math.abs(by - ay) + 1;
        if (square) {
            const roomX = bx >= ax ? maxW - ax : ax + 1;
            const roomY = by >= ay ? maxH - ay : ay + 1;
            const side = Math.max(1, Math.min(Math.max(w, h), roomX, roomY));
            w = side; h = side;
        }
        return { x: bx >= ax ? ax : ax - w + 1, y: by >= ay ? ay : ay - h + 1, w, h };
    }, [meta]);

    // Keep the ref in step with the state so mouse-up can read the final box without
    // reaching into a state updater.
    const setCropBox = useCallback((box) => { cropBoxRef.current = box; setCropDraft(box); }, []);

    const updateCropDraft = useCallback((shiftKey) => {
        const start = cropStartRef.current, cur = cropPointerRef.current;
        if (!start || !cur) return;
        setCropBox(cropRectFrom(start, cur, shiftKey));
    }, [cropRectFrom]);

    // Esc leaves crop mode; Shift re-shapes the box mid-drag without needing a move.
    useEffect(() => {
        if (!cropMode) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') { cancelExport(); return; }
            if (e.key === 'Shift') updateCropDraft(true);
        };
        const onKeyUp = (e) => { if (e.key === 'Shift') updateCropDraft(false); };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
        // eslint-disable-next-line
    }, [cropMode, updateCropDraft]);

    // Konva writes cursor styles onto its own container on hover, so the scissors have
    // to be set there too or a passing label would clear them.
    useEffect(() => {
        const st = stageRef.current;
        if (!st) return;
        st.container().style.cursor = cropMode ? SCISSOR_CURSOR : 'default';
    }, [cropMode]);

    const beginCrop = () => {
        const c = pointerToCellFloat();
        if (!c) return;
        cropStartRef.current = c; cropPointerRef.current = c;
        setCropBox(cropRectFrom(c, c, false));
    };
    const dragCrop = (e) => {
        if (!cropStartRef.current) return;
        const c = pointerToCellFloat();
        if (!c) return;
        cropPointerRef.current = c;
        setCropBox(cropRectFrom(cropStartRef.current, c, !!e?.evt?.shiftKey));
    };
    const finishCrop = () => {
        if (!cropStartRef.current) return;
        cropStartRef.current = null;
        const box = cropBoxRef.current;
        cropBoxRef.current = null;
        setCropDraft(null);
        if (!box) return;
        setExportRect(box);
        setCropMode(false);
        setExportStep('save');
        setExportOpen(true);
    };



    // ---------- canvas events ----------
    const onWheel = (e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        const oldScale = view.scale;
        const pointer = stage.getPointerPosition();
        const mp = { x: (pointer.x - view.x) / oldScale, y: (pointer.y - view.y) / oldScale };
        const dir = e.evt.deltaY > 0 ? -1 : 1;
        const scale = Math.min(4, Math.max(0.15, oldScale * (dir > 0 ? 1.1 : 1 / 1.1)));
        setView({ scale, x: pointer.x - mp.x * scale, y: pointer.y - mp.y * scale });
    };
    const onStageMouseMove = (e) => {
        if (cropMode) { dragCrop(e); return; }
        if (!pending) return;
        const c = pointerToCell();
        if (c && (!ghost || ghost.x !== c.x || ghost.y !== c.y)) setGhost(c);
    };
    const onStageClick = (e) => {
        const isEmpty = e.target === e.target.getStage();
        if (pending) { placeFromPending(); return; }
        if (tool === 'paint' && selectedKey) { const c = pointerToCell(); if (c) toggleCellForSelected(c.x, c.y); return; }
        if (isEmpty) setSelectedKey(null);
    };
    const onDrop = (e) => {
        e.preventDefault();
        const item = dragItemRef.current; dragItemRef.current = null;
        if (!item || !editing || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const px = e.clientX - rect.left, py = e.clientY - rect.top;
        const cx = Math.floor(((px - view.x) / view.scale) / CELL);
        const cy = Math.floor(((py - view.y) / view.scale) / CELL);
        tryPlace(item.kind, item.facility, cx, cy);
    };

    // ---------- derived ----------
    const roomsOnFloor = useMemo(() => doc.rooms.filter((r) => r.floorLevel === activeFloor), [doc.rooms, activeFloor]);

    // The legend the viewer/editor is showing. Scoped to the floor on screen, so it
    // never lists something you cannot see.
    const viewerLegend = useMemo(() => (doc.settings?.showLegend
        ? buildLegend(roomsOnFloor, {
            includeHallways: !!doc.settings.legendIncludeHallways,
            includeStairs: !!doc.settings.legendIncludeStairs,
            onlyLongNames: !!doc.settings.legendOnlyLongNames,
        })
        : { entries: [], letterByKey: {} }), [doc.settings, roomsOnFloor]);

    const legendBox = doc.settings?.legendBox || DEFAULT_LEGEND_BOX;
    // Live while the slider is moving, committed value otherwise.
    const legendOpacity = liveOpacity ?? (doc.settings?.legendOpacity ?? 0.85);

    // Painted opaque; the transparency lives on the Konva node so the slider is instant
    // and the exported image inherits exactly what is on screen.
    // Handle x -> scale factor for the image group, clamped so the legend stays
    // between half and four times its natural size.
    const legendFactorFor = (handleX) => {
        if (!legendImage) return 1;
        const raw = (handleX + 7) / Math.max(1, legendImage.__boxW);
        const target = Math.min(4, Math.max(0.5, legendBox.scale * raw));
        return target / legendBox.scale;
    };

    const legendImage = useMemo(
        () => renderLegendToCanvas(viewerLegend.entries, { scale: legendBox.scale, translucent: false }),
        [viewerLegend.entries, legendBox.scale]
    );

    // While exporting, the render follows the export legend; otherwise the viewer one.
    // Keys replace names only while a legend is actually on screen (or in the export).
    const legendVisible = viewerLegend.entries.length > 0;
    const activeKeyByRoom = legendVisible ? viewerLegend.letterByKey : {};
    // stairs on the floor directly above/below — ghosted onto this floor so their landings line up
    const adjacentStairs = useMemo(
        () => doc.rooms.filter((r) => r.kind === ELEMENT_KINDS.stairs && (r.floorLevel === activeFloor - 1 || r.floorLevel === activeFloor + 1)),
        [doc.rooms, activeFloor]
    );
    const selected = doc.rooms.find((r) => r.clientKey === selectedKey) || null;
    const selectedFacility = selected?.bastionFacilityId ? facilities.find((f) => f.id === selected.bastionFacilityId) : null;

    const gridLines = useMemo(() => {
        if (!meta) return [];
        const lines = [];
        const w = meta.maxWidth, h = meta.maxHeight;
        for (let x = 0; x <= w; x++) lines.push(<Line key={`v${x}`} points={[x * CELL, 0, x * CELL, h * CELL]} stroke="#d8ccae" strokeWidth={1} listening={false} />);
        for (let y = 0; y <= h; y++) lines.push(<Line key={`h${y}`} points={[0, y * CELL, w * CELL, y * CELL]} stroke="#d8ccae" strokeWidth={1} listening={false} />);
        return lines;
    }, [meta]);

    const facilityPalette = useMemo(() => {
        const q = search.trim().toLowerCase();
        return facilities.filter((f) => {
            if (f.facilityType !== 'special' && f.facilityType !== 'basic') return false;
            if (typeFilter === 'basic' && f.facilityType !== 'basic') return false;
            if (typeFilter === 'special' && f.facilityType !== 'special') return false;
            if (q && !(f.name || '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [facilities, search, typeFilter]);

    const ghostOk = useMemo(() => {
        if (!pending || !ghost || !meta) return false;
        if (!isAreaKind(pending.kind)) return ghost.x >= 0 && ghost.y >= 0 && ghost.x < meta.maxWidth && ghost.y < meta.maxHeight;
        const occ = buildOccupancy(doc.rooms, activeFloor, null);
        return fits(pending.cells, ghost.x, ghost.y, occ, meta.maxWidth, meta.maxHeight);
    }, [pending, ghost, meta, doc.rooms, activeFloor]);

    const renderMapCanvas = useCallback(async ({ rect, pxPerSquare, hideGrid }) => {
        const stage = stageRef.current;
        if (!stage || !rect) return null;
        const prev = { w: size.w, h: size.h, scale: view.scale, x: view.x, y: view.y };
        const keepSelected = selectedKeyRef.current;
        try {
            setSelectedKey(null);
            setRenderForExport({ hideGrid });
            await nextPaint();

            const s = pxPerSquare / CELL;
            stage.size({ width: rect.w * pxPerSquare, height: rect.h * pxPerSquare });
            stage.scale({ x: s, y: s });
            stage.position({ x: -rect.x * pxPerSquare, y: -rect.y * pxPerSquare });
            stage.draw();

            // Copy off Konva's canvas — it reuses that buffer on the next draw.
            const src = stage.toCanvas({ pixelRatio: 1 });
            const out = document.createElement('canvas');
            out.width = src.width; out.height = src.height;
            out.getContext('2d').drawImage(src, 0, 0);
            return out;
        } finally {
            stage.size({ width: prev.w, height: prev.h });
            stage.scale({ x: prev.scale, y: prev.scale });
            stage.position({ x: prev.x, y: prev.y });
            stage.draw();
            setRenderForExport(null);
            setSelectedKey(keepSelected);
        }
    }, [size, view]);

    // Preview scale: big enough to read, small enough to redraw on every option change.
    // Fixed, high export resolution — the user is told how to size their Roll20 page,
    // not asked to pick pixels.
    const exportPx = useMemo(() => pickExportScale(exportRect), [exportRect]);

    const previewPx = useMemo(() => {
        if (!exportRect) return 12;
        return Math.max(4, Math.min(40, Math.floor(720 / Math.max(exportRect.w, exportRect.h))));
    }, [exportRect]);

    // The preview is the real export render, just at a smaller scale — legend included,
    // since the legend is a stage object. Re-rendered whenever an option changes it.
    useEffect(() => {
        if (!exportOpen || exportStep !== 'save' || !exportRect) { setPreviewCanvas(null); return; }
        let cancelled = false;
        (async () => {
            const c = await renderMapCanvas({
                rect: exportRect,
                pxPerSquare: previewPx,
                hideGrid: !exportOpts.includeGrid,
            });
            if (!cancelled) setPreviewCanvas(c);
        })();
        return () => { cancelled = true; };
    }, [exportOpen, exportStep, exportRect, previewPx, exportOpts.includeGrid,
        legendImage, legendOpacity, renderMapCanvas]);

    const runExport = async ({ fileName }) => {
        if (!exportRect) return;
        setExportBusy(true); setExportError('');
        try {
            const map = await renderMapCanvas({
                rect: exportRect,
                pxPerSquare: exportPx,
                hideGrid: !exportOpts.includeGrid,
            });
            if (!map) throw new Error('Nothing to render.');


            const blob = await new Promise((res, rej) =>
                map.toBlob((b) => (b ? res(b) : rej(new Error('The browser could not render that image.'))), 'image/png'));

            const how = await savePng(blob, fileName);
            if (how !== 'cancelled') cancelExport();
        } catch (e) {
            setExportError(e?.message || 'Export failed.');
        } finally {
            setExportBusy(false);
        }
    };

    if (loading) return <Box sx={{ pt: 10, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
    if (error && !meta) return <Box sx={{ pt: 10, px: 3 }}><Alert severity="error">{error}</Alert></Box>;

    return (
        <Box sx={{ pt: { xs: 7, sm: 8 }, height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <Paper square sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" onClick={leaveToBastions}>← Bastions</Button>
                <Typography variant="h6" sx={{ mr: 1 }}>{meta.name}</Typography>
                <Chip size="small" label={meta.accessLevel} color={canWrite ? 'primary' : 'default'} />
                {pending && <Chip size="small" color="info" label={`Placing ${pending.facility?.name || pending.kind} — click board (Esc to cancel)`} onDelete={() => { setPending(null); setGhost(null); }} />}
                {viewAsPlayer && <Chip size="small" color="secondary" label="👁 Player view — read-only preview" />}
                {cropMode && <Chip size="small" color="info" label="Drag a box to crop — hold Shift to keep it square, Esc to cancel" onDelete={cancelExport} />}
                <Button size="small" onClick={() => setMyActionsOpen(true)}>My Actions</Button>
                <BastionBankPanel bastionId={bastionId} compact />
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={() => setHirelingsOpen(true)}>Hirelings</Button>
                <Button size="small" onClick={openExport}>Export…</Button>
                {canWrite && (
                    <>
                        <Button size="small" onClick={(e) => setSettingsAnchor(e.currentTarget)}>Settings</Button>
                        <Menu anchorEl={settingsAnchor} open={!!settingsAnchor} onClose={() => setSettingsAnchor(null)}>
                            <Box sx={{ px: 2, py: 0.5 }}>
                                <Typography variant="overline" color="text.secondary">Board</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <FormControlLabel
                                        control={<Checkbox size="small" checked={!!doc.settings?.hideGridLines}
                                            onChange={() => toggleSetting('hideGridLines')} />}
                                        label="Hide grid lines" />
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="overline" color="text.secondary">Legend</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <FormControlLabel
                                        control={<Checkbox size="small" checked={!!doc.settings?.showLegend}
                                            onChange={() => toggleSetting('showLegend')} />}
                                        label="Show legend" />
                                    {doc.settings?.showLegend && (
                                        <Box sx={{ pl: 3 }}>
                                            <FormControlLabel
                                                control={<Checkbox size="small" checked={!!doc.settings?.legendIncludeStairs}
                                                    onChange={() => toggleSetting('legendIncludeStairs')} />}
                                                label="Include stairs" />
                                            <FormControlLabel
                                                control={<Checkbox size="small" checked={!!doc.settings?.legendIncludeHallways}
                                                    onChange={() => toggleSetting('legendIncludeHallways')} />}
                                                label="Include hallways" />
                                            <FormControlLabel
                                                control={<Checkbox size="small" checked={!!doc.settings?.legendOnlyLongNames}
                                                    onChange={() => toggleSetting('legendOnlyLongNames')} />}
                                                label="Only list names too long to fit" />
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5, ml: 4 }}>
                                                Rooms whose name already fits keep it printed on the map.
                                            </Typography>
                                            <Box sx={{ pt: 1, pr: 1 }}>
                                                <Typography variant="caption" color="text.secondary">Transparency</Typography>
                                                <Slider size="small" min={0.2} max={1} step={0.05}
                                                    value={legendOpacity}
                                                    onChange={(_, v) => setLiveOpacity(v)}
                                                    onChangeCommitted={(_, v) => { setLiveOpacity(null); setSetting('legendOpacity', v); }}
                                                    valueLabelDisplay="auto"
                                                    valueLabelFormat={(v) => `${Math.round(v * 100)}%`} />
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Menu>
                    </>
                )}
                {canWrite && (
                    <>
                        {editing && (
                            <>
                                <ToggleButtonGroup size="small" exclusive value={tool} onChange={(_, v) => v && setTool(v)}>
                                    <ToggleButton value="select">Select / Move</ToggleButton>
                                    <ToggleButton value="paint" disabled={!selected || !isAreaKind(selected.kind)}>Edit Shape</ToggleButton>
                                </ToggleButtonGroup>
                                <Tooltip title="Undo (Ctrl+Z)"><span><IconButton size="small" onClick={undo} disabled={!pastRef.current.length}>⤺</IconButton></span></Tooltip>
                                <Tooltip title="Redo (Ctrl+Y)"><span><IconButton size="small" onClick={redo} disabled={!futureRef.current.length}>⤻</IconButton></span></Tooltip>
                                <Button size="small" variant="contained" onClick={save} disabled={saving || !dirty}>
                                    {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                                </Button>
                            </>
                        )}
                        <Tooltip title={viewAsPlayer ? 'Return to editing' : 'Preview exactly what a player with read access sees'}>
                            <Button size="small" color="secondary" variant={viewAsPlayer ? 'contained' : 'outlined'}
                                onClick={() => (viewAsPlayer ? setViewAsPlayer(false) : enterPlayerView())}>
                                {viewAsPlayer ? 'Exit Player View' : 'View as Player'}
                            </Button>
                        </Tooltip>
                    </>
                )}
            </Paper>

            {error && <Alert severity="warning" sx={{ borderRadius: 0 }} onClose={() => setError('')}>{error}</Alert>}

            <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {editing && (
                    <Paper square sx={{ width: 250, overflowY: 'auto', p: 1, borderRight: '1px solid #ddd' }}>
                        <Typography variant="overline">Structure</Typography>
                        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mb: 1 }}>
                            {[ELEMENT_KINDS.hallway, ELEMENT_KINDS.door, ELEMENT_KINDS.entry, ELEMENT_KINDS.stairs].map((k) => (
                                <Chip key={k} label={k} size="small" {...paletteHandlers(k, null)}
                                    variant={pending && pending.kind === k && !pending.facility ? 'filled' : 'outlined'}
                                    sx={{ bgcolor: KIND_COLORS[k], color: 'white', textTransform: 'capitalize', cursor: 'grab' }} />
                            ))}
                        </Stack>
                        <Divider sx={{ my: 1 }} />
                        <TextField size="small" fullWidth placeholder="Search facilities…" value={search}
                            onChange={(e) => setSearch(e.target.value)} sx={{ mb: 1 }}
                            InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }} />
                        <ToggleButtonGroup size="small" exclusive fullWidth value={typeFilter}
                            onChange={(_, v) => v && setTypeFilter(v)} sx={{ mb: 1 }}>
                            <ToggleButton value="all">All</ToggleButton>
                            <ToggleButton value="basic">Basic</ToggleButton>
                            <ToggleButton value="special">Special</ToggleButton>
                        </ToggleButtonGroup>
                        <List dense disablePadding>
                            {facilityPalette.map((f) => (
                                <ListItemButton key={f.id} {...paletteHandlers(f.facilityType, f)}
                                    selected={pending?.facility?.id === f.id}
                                    sx={{ borderRadius: 1, cursor: 'grab' }}>
                                    <ListItemText primary={f.name}
                                        secondary={`${f.facilityType}${f.levelRequired ? ` · L${f.levelRequired}` : ''}`}
                                        primaryTypographyProps={{ fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
                                </ListItemButton>
                            ))}
                            {facilityPalette.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>No matches.</Typography>}
                        </List>
                    </Paper>
                )}

                <Box ref={containerRef}
                    sx={{ flex: 1, minWidth: 0, position: 'relative', bgcolor: '#f3ecd8',
                        cursor: cropMode ? SCISSOR_CURSOR : 'default' }}
                    onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                    <Stage
                        ref={stageRef}
                        width={size.w} height={size.h}
                        scaleX={view.scale} scaleY={view.scale} x={view.x} y={view.y}
                        draggable={tool === 'select' && !pending && !cropMode}
                        onWheel={onWheel} onMouseMove={onStageMouseMove} onClick={onStageClick}
                        onMouseDown={(e) => { if (cropMode) { e.evt.preventDefault(); beginCrop(); } }}
                        onMouseUp={() => { if (cropMode) finishCrop(); }}
                        onDragEnd={(e) => { if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() })); }}
                    >
                        <Layer>
                            <Rect x={0} y={0} width={meta.maxWidth * CELL} height={meta.maxHeight * CELL} fill="#faf5e6" stroke="#b9a97e" strokeWidth={2} listening={false} />
                            {!(renderForExport ? renderForExport.hideGrid : doc.settings?.hideGridLines) && gridLines}
                        </Layer>
                        <Layer>
                            {/* ghosted stairs from the floor above/below, so vertical connectors line up */}
                            {!renderForExport && adjacentStairs.map((r) => {
                                const above = r.floorLevel > activeFloor;
                                const fname = doc.floors.find((f) => f.level === r.floorLevel)?.name || `Floor ${r.floorLevel}`;
                                return (
                                    <Group key={`ghost_${r.clientKey}`} x={r.originX * CELL} y={r.originY * CELL} opacity={0.3} listening={false}>
                                        {r.cells.map(([dx, dy], i) => (
                                            <Rect key={i} x={dx * CELL} y={dy * CELL} width={CELL} height={CELL}
                                                fill={KIND_COLORS.stairs} stroke="#546e7a" strokeWidth={1} dash={[4, 3]} />
                                        ))}
                                        {stairsHatch(r.cells, 'rgba(0,0,0,0.4)', 1.5)}
                                        <Text text={`${above ? '↑' : '↓'} ${fname}`} x={3} y={3} fontSize={10} fontStyle="bold" fill="#263238" />
                                    </Group>
                                );
                            })}
                            {roomsOnFloor.map((r) => {
                                const isSel = r.clientKey === selectedKey;
                                const color = r.color || KIND_COLORS[r.kind] || '#8888aa';
                                const b = cellBounds(r.cells);
                                const marker = !isAreaKind(r.kind);
                                return (
                                    <Group key={r.clientKey} x={r.originX * CELL} y={r.originY * CELL}
                                        listening={tool === 'select'}
                                        draggable={editing && tool === 'select' && !cropMode}
                                        onClick={(e) => { e.cancelBubble = true; setSelectedKey(r.clientKey); }}
                                        onTap={(e) => { e.cancelBubble = true; setSelectedKey(r.clientKey); }}
                                        onDragEnd={(e) => {
                                            const nx = Math.round(e.target.x() / CELL), ny = Math.round(e.target.y() / CELL);
                                            const parkAt = (cx, cy) => {
                                                e.target.position({ x: cx * CELL, y: cy * CELL });
                                                e.target.getLayer().batchDraw();
                                            };
                                            if (isAreaKind(r.kind)) {
                                                const occ = buildOccupancy(docRef.current.rooms, activeFloor, r.clientKey);
                                                if (!fits(r.cells, nx, ny, occ, meta.maxWidth, meta.maxHeight)) { parkAt(r.originX, r.originY); return; }
                                            } else if (nx < 0 || ny < 0 || nx >= meta.maxWidth || ny >= meta.maxHeight) {
                                                parkAt(r.originX, r.originY); return;
                                            }
                                            // Always park on the grid. When a drag lands back on the cell it started
                                            // from, originX/originY do not change, so react-konva never re-applies
                                            // x/y and the element keeps the loose pixel offset the drag left behind.
                                            parkAt(nx, ny);
                                            if (nx !== r.originX || ny !== r.originY) moveRoom(r.clientKey, nx, ny);
                                        }}
                                    >
                                        {marker ? (
                                            <>
                                                <Line points={sideLinePoints(r.side || 'N')} stroke={color} strokeWidth={6} hitStrokeWidth={16} lineCap="round" />
                                                {isSel && <Rect x={0} y={0} width={CELL} height={CELL} stroke="#111" dash={[4, 4]} listening={false} />}
                                            </>
                                        ) : (
                                            <>
                                                {r.cells.map(([dx, dy], i) => (
                                                    <Rect key={i} x={dx * CELL} y={dy * CELL} width={CELL} height={CELL}
                                                        fill={color} opacity={0.85}
                                                        stroke={renderForExport ? undefined : (isSel ? '#111' : '#00000033')}
                                                        strokeWidth={renderForExport ? 0 : (isSel ? 2 : 1)} />
                                                ))}
                                                {!renderForExport && r.kind === ELEMENT_KINDS.stairs && stairsHatch(r.cells, 'rgba(0,0,0,0.45)', 2)}
                                                {r.name && r.kind !== ELEMENT_KINDS.hallway && r.kind !== ELEMENT_KINDS.stairs && (() => {
                                                    const letter = activeKeyByRoom[r.clientKey];
                                                    const labelText = letter || r.name;
                                                    // Wraps across lines when the block still fits the room, else one ellipsised line.
                                                    const lay = layoutRoomLabel(labelText, r.cells);
                                                    // anchor the pill over a real filled square nearest the shape centroid
                                                    const [ax, ay] = labelAnchorPoint(r.cells);
                                                    const ccx = ax * CELL, ccy = ay * CELL;
                                                    // centre on the anchor square, then clamp within the room bounds
                                                    const px = Math.round(Math.min(Math.max(ccx - lay.pillW / 2, 2), Math.max(2, lay.roomW - lay.pillW - 2)));
                                                    const py = Math.round(Math.min(Math.max(ccy - lay.pillH / 2, 2), Math.max(2, lay.roomH - lay.pillH - 2)));
                                                    return (
                                                        <Group listening={tool === 'select' && !cropMode}
                                                            onMouseEnter={(e) => {
                                                                const stage = e.target.getStage();
                                                                const p = stage.getPointerPosition();
                                                                stage.container().style.cursor = 'help';
                                                                setHoverLabel({ text: r.name, x: p.x, y: p.y });
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.getStage().container().style.cursor = 'default';
                                                                setHoverLabel(null);
                                                            }}>
                                                            <Rect x={px} y={py} width={lay.pillW} height={lay.pillH}
                                                                cornerRadius={(NAME_FS + NAME_PADY * 2) / 2}
                                                                fill="rgba(17,17,17,0.82)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                                                            <Text text={lay.text} x={px + NAME_PADX} y={py + NAME_PADY} width={lay.pillW - NAME_PADX * 2}
                                                                fontSize={NAME_FS} fontFamily={NAME_FONT} lineHeight={NAME_LINE_H / NAME_FS}
                                                                fontStyle="bold" fill="#fff" align="center"
                                                                ellipsis={!lay.wrapped} wrap="none" />
                                                        </Group>
                                                    );
                                                })()}
                                                {(() => {
                                                    // Hallways and stairs are only ever marked when a legend is showing, and
                                                    // only with their legend number — never a name.
                                                    if (r.kind !== ELEMENT_KINDS.hallway && r.kind !== ELEMENT_KINDS.stairs) return null;
                                                    const key = activeKeyByRoom[r.clientKey];
                                                    if (!key) return null;
                                                    const FS = 10;
                                                    const roomW = b.w * CELL, roomH = b.h * CELL;
                                                    // same float-fit as the name pill: centre on a real filled square, then clamp
                                                    const [ax, ay] = labelAnchorPoint(r.cells);
                                                    const ccx = ax * CELL, ccy = ay * CELL;
                                                    const boxW = Math.min(Math.ceil(key.length * FS * 0.7) + 4, Math.max(CELL - 2, roomW - 2));
                                                    const px = Math.round(Math.min(Math.max(ccx - boxW / 2, 1), Math.max(1, roomW - boxW - 1)));
                                                    const py = Math.round(Math.min(Math.max(ccy - FS / 2, 1), Math.max(1, roomH - FS - 1)));
                                                    return (
                                                        <Text text={key} x={px} y={py} width={boxW} align="center"
                                                            fontSize={FS} fontStyle="bold" fill="rgba(30,30,30,0.72)"
                                                            ellipsis wrap="none" listening={false} />
                                                    );
                                                })()}
                                                {(() => {
                                                    // Live roster UI, not map art — the PNG export leaves these out.
                                                    if (renderForExport) return null;
                                                    const crew = (r.id && hirelingsByRoom[String(r.id)]) || [];
                                                    if (crew.length === 0) return null;
                                                    const names = crew.map((h) => `${h.name}${h.isAbsent ? ' (away)' : ''}`).join(', ');
                                                    return (
                                                        <HirelingMarker
                                                            cell={hirelingAnchorCell(r.cells)}
                                                            count={crew.length}
                                                            absent={crew.every((h) => h.isAbsent)}
                                                            listening={!cropMode}
                                                            onEnter={(e) => {
                                                                const stage = e.target.getStage();
                                                                const p = stage.getPointerPosition();
                                                                stage.container().style.cursor = 'help';
                                                                setHoverLabel({ text: names, x: p.x, y: p.y });
                                                            }}
                                                            onLeave={(e) => {
                                                                e.target.getStage().container().style.cursor = 'default';
                                                                setHoverLabel(null);
                                                            }}
                                                        />
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </Group>
                                );
                            })}

                            {/* placement ghost */}
                            {pending && ghost && (
                                <Group x={ghost.x * CELL} y={ghost.y * CELL} opacity={0.5} listening={false}>
                                    {isAreaKind(pending.kind)
                                        ? pending.cells.map(([dx, dy], i) => (
                                            <Rect key={i} x={dx * CELL} y={dy * CELL} width={CELL} height={CELL} fill={ghostOk ? '#2e7d32' : '#c62828'} />
                                        ))
                                        : <Line points={sideLinePoints('N')} stroke={ghostOk ? '#2e7d32' : '#c62828'} strokeWidth={6} lineCap="round" />}
                                </Group>
                            )}
                            
                            {/* crop marquee — whole squares only, so the export lines up with Roll20 */}
                            {cropMode && cropDraft && (
                                <Group listening={false}>
                                    <Rect x={cropDraft.x * CELL} y={cropDraft.y * CELL}
                                        width={cropDraft.w * CELL} height={cropDraft.h * CELL}
                                        fill="rgba(21,101,192,0.14)" stroke="#1565c0"
                                        strokeWidth={2 / view.scale} dash={[6 / view.scale, 4 / view.scale]} />
                                    <Text text={`${cropDraft.w} × ${cropDraft.h}`}
                                        x={cropDraft.x * CELL} y={cropDraft.y * CELL - 16 / view.scale}
                                        width={cropDraft.w * CELL} align="center"
                                        fontSize={12 / view.scale} fontStyle="bold" fill="#0d47a1" />
                                </Group>
                            )}
                        </Layer>
                        
                        {/* Legend: its own layer above the rooms. It is not a grid element — it never
                            takes occupancy, so it can sit over anything without blocking placement. */}
                        <Layer>
                            {legendVisible && legendImage && (
                                <Group
                                    x={legendBox.x * CELL} y={legendBox.y * CELL}
                                    opacity={legendOpacity}
                                    draggable={editing && !cropMode && !renderForExport}
                                    onDragEnd={(e) => setSetting('legendBox', {
                                        ...legendBox, x: e.target.x() / CELL, y: e.target.y() / CELL,
                                    })}
                                >
                                    {/* The image sits in its own group so the resize handle, a sibling, is not
                                        itself scaled while dragging. */}
                                    <Group ref={legendImgRef}>
                                        <KonvaImage image={legendImage} width={legendImage.__boxW} height={legendImage.__boxH} />
                                    </Group>
                                    {editing && !cropMode && !renderForExport && (
                                        <Rect
                                            ref={legendHandleRef}
                                            x={legendImage.__boxW - 7} y={legendImage.__boxH - 7}
                                            width={12} height={12} cornerRadius={2}
                                            fill="#1565c0" stroke="#fff" strokeWidth={1}
                                            draggable
                                            onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'nwse-resize'; }}
                                            onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }}
                                            dragBoundFunc={function (pos) { return pos; }}
                                            onDragMove={(e) => {
                                                e.cancelBubble = true;
                                                // Resize live by transforming the node — no React render, no canvas
                                                // repaint — so the handle tracks the pointer instead of lagging it.
                                                const f = legendFactorFor(e.target.x());
                                                legendImgRef.current?.scale({ x: f, y: f });
                                                e.target.position({ x: legendImage.__boxW * f - 7, y: legendImage.__boxH * f - 7 });
                                                e.target.getLayer()?.batchDraw();
                                            }}
                                            onDragEnd={(e) => {
                                                e.cancelBubble = true;
                                                // Commit once: the canvas is then repainted at the new scale, crisply.
                                                const f = legendFactorFor(e.target.x());
                                                legendImgRef.current?.scale({ x: 1, y: 1 });
                                                setSetting('legendBox', { ...legendBox, scale: legendBox.scale * f });
                                            }}
                                        />
                                    )}
                                </Group>
                            )}
                        </Layer>
                    </Stage>

                    <Paper sx={{ position: 'absolute', top: 8, right: 8, p: 0.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            {doc.floors.map((f) => (
                                <Button key={f.level} size="small" variant={f.level === activeFloor ? 'contained' : 'text'}
                                    onClick={() => { setActiveFloor(f.level); setSelectedKey(null); }}>{f.name}</Button>
                            ))}
                            {editing && <IconButton size="small" onClick={() => openRenameFloor(activeFloor)} title="Rename current floor">✎</IconButton>}
                            {editing && <IconButton size="small" onClick={openAddFloor} title="Add floor">＋</IconButton>}
                            {editing && doc.floors.length > 1 && (
                                <IconButton size="small" color="error" onClick={() => requestDeleteFloor(activeFloor)} title="Delete current floor">🗑</IconButton>
                            )}
                        </Stack>
                    </Paper>

                    {hoverLabel && (
                        <Box sx={{
                            position: 'absolute', left: hoverLabel.x + 14, top: hoverLabel.y + 14,
                            px: 1, py: 0.5, maxWidth: 260, bgcolor: 'rgba(17,17,17,0.92)', color: '#fff',
                            borderRadius: 1, fontSize: 12, lineHeight: 1.3, pointerEvents: 'none', zIndex: 10,
                            boxShadow: 3,
                        }}>
                            {hoverLabel.text}
                        </Box>
                    )}
                </Box>

                {selected && (editing ? (
                    <Paper square sx={{ width: 260, overflowY: 'auto', p: 2, borderLeft: '1px solid #ddd' }}>
                        <Stack spacing={2}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{selected.kind}</Typography>
                                    {selectedFacility && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{selectedFacility.name}</Typography>}
                                </Box>
                                <TextField label="Label" size="small" value={selected.name || ''} onChange={(e) => updateSelected({ name: e.target.value })} />

                                {(selected.kind === 'special' || selected.kind === 'basic') && (
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Size</InputLabel>
                                        <Select label="Size" value={selected.spaceSize || 'cramped'}
                                            onChange={(e) => { const s = e.target.value; updateSelected({ spaceSize: s, cells: defaultCellsForKind(selected.kind, s) }); }}>
                                            {(selectedFacility ? parseAllowedSizes(selectedFacility.spaceJson) : ['cramped', 'roomy', 'vast'])
                                                .map((s) => <MenuItem key={s} value={s}>{s} ({squaresFor(s)} sq)</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                )}

                                {(selected.kind === 'door' || selected.kind === 'entry') && (
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Side</InputLabel>
                                        <Select label="Side" value={selected.side || 'N'} onChange={(e) => updateSelected({ side: e.target.value })}>
                                            {SIDES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                )}

                                <FormControl size="small" fullWidth>
                                    <InputLabel>Floor</InputLabel>
                                    <Select label="Floor" value={selected.floorLevel} onChange={(e) => updateSelected({ floorLevel: e.target.value })}>
                                        {doc.floors.map((f) => <MenuItem key={f.level} value={f.level}>{f.name}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                {selected.kind === 'stairs' && (
                                    <FormControl size="small" fullWidth>
                                        <InputLabel>Leads to</InputLabel>
                                        <Select label="Leads to" value={selected.target ?? ''} onChange={(e) => updateSelected({ target: e.target.value })}>
                                            {doc.floors.map((f) => <MenuItem key={f.level} value={f.level}>{f.name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                )}

                                <TextField label="Color" size="small" type="color" value={selected.color || KIND_COLORS[selected.kind] || '#8888aa'}
                                    onChange={(e) => updateSelected({ color: e.target.value })} sx={{ '& input': { p: 0.5, height: 32 } }} />

                                {isAreaKind(selected.kind) && (
                                    <Typography variant="caption" color="text.secondary">
                                        {selected.cells.length} squares. Use “Edit Shape” then click cells to reshape.
                                    </Typography>
                                )}

                                {selectedFacility && (() => {
                                    const cap = hirelingCapacity(selectedFacility.hirelingsJson, selected.spaceSize);
                                    if (!(cap.max > 0 || cap.unbounded)) return null;
                                    return (
                                        <>
                                            <Divider />
                                            <RoomHirelings
                                                roomId={selected.id}
                                                campaignId={meta.campaignId}
                                                capacity={cap}
                                                canManage={isDm}
                                                pending={selected.pendingHirelings || []}
                                                onPendingChange={(list) => mutate((d) => {
                                                    const rr = d.rooms.find((x) => x.clientKey === selected.clientKey);
                                                    if (rr) rr.pendingHirelings = list;
                                                    return d;
                                                })}
                                            />
                                        </>
                                    );
                                })()}

                                <Button color="error" size="small" onClick={deleteSelected}>Delete</Button>
                        </Stack>
                    </Paper>
                ) : selectedFacility && selected.id ? (
                    <Box sx={{ display: 'flex', minHeight: 0 }}>
                        {detailsOpen && (
                            <Paper square sx={{ width: 320, overflowY: 'auto', p: 2, borderLeft: '1px solid #ddd', bgcolor: '#fbf7ec' }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{selectedFacility.name}</Typography>
                                    <IconButton size="small" onClick={() => setDetailsOpen(false)} title="Hide details">✕</IconButton>
                                </Stack>
                                <FacilityDetail facility={selectedFacility} showName={false} />
                            </Paper>
                        )}
                        <Paper square sx={{ width: 360, overflowY: 'auto', borderLeft: '1px solid #ddd' }}>
                            <RoomActivityPane
                                roomId={selected.id}
                                roomName={selected.name}
                                bastionId={bastionId}
                                facility={selectedFacility}
                                maxConcurrent={selected.maxConcurrentActivities || 1}
                                detailsOpen={detailsOpen}
                                onToggleDetails={() => setDetailsOpen((v) => !v)}
                            />
                        </Paper>
                    </Box>
                ) : (
                    <Paper square sx={{ width: 260, overflowY: 'auto', p: 2, borderLeft: '1px solid #ddd' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{selected.name || selected.kind}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {selected.id ? 'Nothing to use here.' : 'Save the bastion to use this room.'}
                        </Typography>
                    </Paper>
                ))}
            </Box>

            <Dialog open={confirmFloor != null} onClose={() => setConfirmFloor(null)}>
                <DialogTitle>Delete floor?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {(() => {
                            const f = doc.floors.find((x) => x.level === confirmFloor);
                            const n = doc.rooms.filter((r) => r.floorLevel === confirmFloor).length;
                            return `“${f?.name}” has ${n} element${n === 1 ? '' : 's'}. Deleting the floor removes ${n === 1 ? 'it' : 'them'}. (You can still undo until you save.)`;
                        })()}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmFloor(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => deleteFloor(confirmFloor)}>Delete floor</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!floorDialog} onClose={() => setFloorDialog(null)}>
                <DialogTitle>{floorDialog?.mode === 'add' ? 'Add floor' : 'Rename floor'}</DialogTitle>
                <DialogContent>
                    <TextField autoFocus fullWidth size="small" label="Floor name" sx={{ mt: 1 }}
                        value={floorDialog?.name || ''}
                        onChange={(e) => setFloorDialog((fd) => ({ ...fd, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitFloorDialog(); }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFloorDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={commitFloorDialog}>{floorDialog?.mode === 'add' ? 'Add' : 'Save'}</Button>
                </DialogActions>
            </Dialog>

            {myActionsOpen && (
                <MyActionsDialog
                    open={myActionsOpen}
                    bastionId={bastionId}
                    myUserId={user?.Id}
                    onClose={() => setMyActionsOpen(false)}
                />
            )}

            {hirelingsOpen && (
                <CampaignHirelings
                    open={hirelingsOpen}
                    campaignId={meta.campaignId}
                    bastionId={bastionId}
                    bastionName={meta.name}
                    onClose={() => { setHirelingsOpen(false); loadHirelings(); }}
                />
            )}

            <BastionExportDialog
                open={exportOpen}
                step={exportStep}
                rect={exportRect}
                bastionName={meta.name}
                floorName={doc.floors.find((f) => f.level === activeFloor)?.name}
                busy={exportBusy}
                pxPerSquare={exportPx}
                error={exportError}
                opts={exportOpts}
                onOptsChange={setExportOpts}
                previewCanvas={previewCanvas}
                onPickWhole={pickWholeMap}
                onPickCrop={pickCrop}
                onCancel={cancelExport}
                onExport={runExport}
            />
            
            <ConfirmDialog
                open={confirmLeave}
                title="Leave without saving?"
                message="You have unsaved changes to this bastion. Leaving now discards them."
                confirmLabel="Leave"
                confirmColor="error"
                onConfirm={() => { setDirty(false); setConfirmLeave(false); navigate(`/campaigns/${meta.campaignId}/bastions`); }}
                onClose={() => setConfirmLeave(false)}
            />
        </Box>
    );
}

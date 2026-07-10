import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Line, Group, Text } from 'react-konva';
import {
    Box, Paper, Typography, Button, IconButton, Stack, Divider, TextField,
    List, ListItemButton, ListItemText, Alert, CircularProgress, Chip, MenuItem,
    Select, FormControl, InputLabel, Tooltip, ToggleButton, ToggleButtonGroup, InputAdornment,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import BastionService from '../../api/BastionService';
import BastionFacilityService from '../../api/BastionFacilityService';
import {
    CELL, KIND_COLORS, ELEMENT_KINDS, ROOM_COLORS, SIDES, defaultCellsForKind, cellBounds,
    parseGeometry, stringifyGeometry, parseAllowedSizes, squaresFor, newClientKey,
    isAreaKind, buildOccupancy, fits, firstFit, labelAnchorCell, hirelingCapacity,
} from './bastionGeometry';
import RoomActivityPane from './RoomActivityPane';
import MyActionsDialog from './MyActionsDialog';
import FacilityDetail from './FacilityDetail';
import BastionBankPanel from './BastionBankPanel';
import RoomHirelings from './RoomHirelings';
import CampaignHirelings from './CampaignHirelings';
import HirelingService from '../../api/HirelingService';
import ConfirmDialog from '../utilities/ConfirmDialog';
import { getAdminCapabilities } from '../campaign/campaignPermissions';

const clone = (o) => JSON.parse(JSON.stringify(o));

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

export default function BastionBuilder({ user }) {
    const { bastionId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState(null);
    const [facilities, setFacilities] = useState([]);

    const [doc, setDoc] = useState({ rooms: [], floors: [{ level: 0, name: 'Ground Floor' }] });
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
                setDoc({ rooms: (b.rooms || []).map(toClientRoom), floors });
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

            setDoc((d) => ({ ...d, rooms: (res.rooms || []).map(toClientRoom), floors: res.floors || d.floors }));
            colorIndexRef.current = (res.rooms || []).length;
            pastRef.current = []; futureRef.current = [];
            setSelectedKey(null); setDirty(false);
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
    const onStageMouseMove = () => {
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
                <Button size="small" onClick={() => setMyActionsOpen(true)}>My Actions</Button>
                <BastionBankPanel bastionId={bastionId} compact />
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={() => setHirelingsOpen(true)}>Hirelings</Button>
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

                <Box ref={containerRef} sx={{ flex: 1, minWidth: 0, position: 'relative', bgcolor: '#f3ecd8' }}
                    onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                    <Stage
                        ref={stageRef}
                        width={size.w} height={size.h}
                        scaleX={view.scale} scaleY={view.scale} x={view.x} y={view.y}
                        draggable={tool === 'select' && !pending}
                        onWheel={onWheel} onMouseMove={onStageMouseMove} onClick={onStageClick}
                        onDragEnd={(e) => { if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() })); }}
                    >
                        <Layer>
                            <Rect x={0} y={0} width={meta.maxWidth * CELL} height={meta.maxHeight * CELL} fill="#faf5e6" stroke="#b9a97e" strokeWidth={2} listening={false} />
                            {gridLines}
                        </Layer>
                        <Layer>
                            {/* ghosted stairs from the floor above/below, so vertical connectors line up */}
                            {adjacentStairs.map((r) => {
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
                                        draggable={editing && tool === 'select'}
                                        onClick={(e) => { e.cancelBubble = true; setSelectedKey(r.clientKey); }}
                                        onTap={(e) => { e.cancelBubble = true; setSelectedKey(r.clientKey); }}
                                        onDragEnd={(e) => {
                                            const nx = Math.round(e.target.x() / CELL), ny = Math.round(e.target.y() / CELL);
                                            if (isAreaKind(r.kind)) {
                                                const occ = buildOccupancy(docRef.current.rooms, activeFloor, r.clientKey);
                                                if (!fits(r.cells, nx, ny, occ, meta.maxWidth, meta.maxHeight)) {
                                                    e.target.position({ x: r.originX * CELL, y: r.originY * CELL }); e.target.getLayer().batchDraw(); return;
                                                }
                                            } else if (nx < 0 || ny < 0 || nx >= meta.maxWidth || ny >= meta.maxHeight) {
                                                e.target.position({ x: r.originX * CELL, y: r.originY * CELL }); e.target.getLayer().batchDraw(); return;
                                            }
                                            moveRoom(r.clientKey, nx, ny);
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
                                                        fill={color} opacity={0.85} stroke={isSel ? '#111' : '#00000033'} strokeWidth={isSel ? 2 : 1} />
                                                ))}
                                                {r.kind === ELEMENT_KINDS.stairs && stairsHatch(r.cells, 'rgba(0,0,0,0.45)', 2)}
                                                {r.name && (() => {
                                                    const FS = 11, PADX = 6, PADY = 3;
                                                    const roomW = b.w * CELL, roomH = b.h * CELL;
                                                    // anchor the pill over a real filled square nearest the shape centroid
                                                    const [ax, ay] = labelAnchorCell(r.cells);
                                                    const ccx = (ax + 0.5) * CELL, ccy = (ay + 0.5) * CELL;
                                                    const estW = Math.ceil(r.name.length * FS * 0.58) + PADX * 2;
                                                    const pillW = Math.min(estW, Math.max(CELL - 4, roomW - 4));
                                                    const pillH = FS + PADY * 2;
                                                    // center on the anchor square, then clamp within the room's bounds
                                                    const px = Math.round(Math.min(Math.max(ccx - pillW / 2, 2), roomW - pillW - 2));
                                                    const py = Math.round(Math.min(Math.max(ccy - pillH / 2, 2), roomH - pillH - 2));
                                                    return (
                                                        <Group listening={tool === 'select'}
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
                                                            <Rect x={px} y={py} width={pillW} height={pillH} cornerRadius={pillH / 2}
                                                                fill="rgba(17,17,17,0.82)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                                                            <Text text={r.name} x={px + PADX} y={py + PADY} width={pillW - PADX * 2}
                                                                fontSize={FS} fontStyle="bold" fill="#fff" align="center" ellipsis wrap="none" />
                                                        </Group>
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
                    onClose={() => setHirelingsOpen(false)}
                />
            )}

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

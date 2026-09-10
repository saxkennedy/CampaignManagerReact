import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, Paper, Divider, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControlLabel, Checkbox,
} from '@mui/material';
import { WIDE_DIALOG_PROPS } from './dialogSizing';

// Roll20's default grid is 70px per square, so exporting at that scale drops the
// image straight onto a page whose size matches the square counts shown below.
export const ROLL20_PX_PER_SQUARE = 70;

// Keep exports inside something a browser canvas will actually produce.
const MAX_SIDE = 8000;

export const DEFAULT_EXPORT_OPTS = {
    includeGrid: true,
};

// One D&D square is 5 feet — the number a Roll20 page is actually configured with.
export const FEET_PER_SQUARE = 5;

// No scale picker: always export as crisply as the region allows, preferring 2x
// Roll20's 70px grid and stepping down only when the image would get unwieldy.
export function pickExportScale(rect) {
    if (!rect) return 140;
    for (const px of [140, 100, 70]) {
        if (rect.w * px <= MAX_SIDE && rect.h * px <= MAX_SIDE) return px;
    }
    return 70;
}



const sanitize = (s) => (s || '').replace(/[\\/:*?"<>|]/g, '').trim();

// Two-step export: pick whole-map or a cropped area, then name the file and check the
// preview. The legend itself is configured under Settings in the builder — here you only
// choose whether to include it.
export default function BastionExportDialog({
    open, step, rect, bastionName, floorName, busy, error,
    opts, onOptsChange, previewCanvas, pxPerSquare,
    onPickWhole, onPickCrop, onCancel, onExport,
}) {
    const [fileName, setFileName] = useState('');
    const canvasRef = useRef(null);

    // Seed the name from the bastion + floor the first time the save step opens.
    useEffect(() => {
        if (step !== 'save') return;
        setFileName((cur) => cur || sanitize(`${bastionName || 'bastion'}-${floorName || 'floor'}`).replace(/\s+/g, '-').toLowerCase());
    }, [step, bastionName, floorName]);

    const out = useMemo(() => {
        if (!rect) return null;
        const w = rect.w * pxPerSquare, h = rect.h * pxPerSquare;
        return { w, h, tooBig: w > MAX_SIDE || h > MAX_SIDE };
    }, [rect, pxPerSquare]);

    const set = (patch) => onOptsChange({ ...opts, ...patch });

    // The preview is the export render itself — legend included, since the legend
    // lives on the stage — so there is nothing to composite here.
    const paint = useCallback(() => {
        const cv = canvasRef.current;
        if (!cv || !previewCanvas) return;
        cv.width = previewCanvas.width;
        cv.height = previewCanvas.height;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(previewCanvas, 0, 0);
    }, [previewCanvas]);

    useEffect(() => { paint(); }, [paint]);

    const submit = () => {
        const name = sanitize(fileName) || 'bastion';
        onExport({ fileName: name.toLowerCase().endsWith('.png') ? name : `${name}.png` });
    };

    const methodBody = (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                Export the current floor as a PNG sized to a whole number of grid squares, ready to
                drop in as a Roll20 map background.
            </Typography>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Whole map</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Everything on this floor, edge to edge.
                </Typography>
                <Button variant="contained" onClick={onPickWhole}>Export whole map</Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Crop an area</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Drag a box on the map to pick the area. The box always snaps to whole squares.
                </Typography>
                <Alert severity="info" icon={false} sx={{ py: 0.25, mb: 1.5 }}>
                    Hold <strong>Shift</strong> while dragging to keep the crop square. <strong>Esc</strong> cancels.
                </Alert>
                <Button variant="outlined" onClick={onPickCrop}>Crop an area…</Button>
            </Paper>
        </Stack>
    );

    const saveBody = (
        <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* preview */}
            <Box sx={{
                flex: 1, minWidth: 0, minHeight: 240, bgcolor: '#efe7d2', borderRadius: 1,
                border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', p: 1,
            }}>
                {previewCanvas ? (
                    <canvas ref={canvasRef} style={{
                        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
                    }} />
                ) : (
                    <Typography variant="body2" color="text.secondary">Rendering preview…</Typography>
                )}
            </Box>

            {/* options */}
            <Stack spacing={2} sx={{ width: { xs: '100%', md: 330 }, flexShrink: 0, overflowY: 'auto' }}>
                {rect && (
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Set your Roll20 page to</Typography>
                        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                            {rect.w * FEET_PER_SQUARE} ft × {rect.h * FEET_PER_SQUARE} ft
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {rect.w} × {rect.h} squares, at {FEET_PER_SQUARE} ft per square
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                            In Roll20, open the page settings and enter those dimensions with the grid
                            left at {FEET_PER_SQUARE} ft. Drop this image in as the background and it
                            lines up cell for cell — no stretching needed.
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color={out?.tooBig ? 'error' : 'text.secondary'}>
                            Exporting at {pxPerSquare} px per square — {out?.w} × {out?.h} px
                            {out?.tooBig && ' — that is very large; crop a smaller area.'}
                        </Typography>
                    </Paper>
                )}

                <TextField
                    size="small" label="File name" value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !busy && !out?.tooBig) submit(); }}
                    helperText=".png is added for you"
                    InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">.png</Typography> }}
                />


                <FormControlLabel
                    control={<Checkbox size="small" checked={opts.includeGrid} onChange={(e) => set({ includeGrid: e.target.checked })} />}
                    label="Draw the grid into the image"
                />

                <Typography variant="caption" color="text.secondary">
                    Your browser will ask where to save. If it doesn't, the file goes to your
                    downloads folder.
                </Typography>
            </Stack>
        </Box>
    );

    return (
        <Dialog open={open} onClose={busy ? undefined : onCancel}
            {...(step === 'save' ? WIDE_DIALOG_PROPS : { maxWidth: 'sm', fullWidth: true })}>
            <DialogTitle>{step === 'method' ? 'Export bastion as PNG' : 'Save your map'}</DialogTitle>
            <DialogContent dividers sx={step === 'save' ? { display: 'flex', flexDirection: 'column' } : undefined}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {step === 'method' ? methodBody : saveBody}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={busy}>Cancel</Button>
                {step === 'save' && (
                    <Button variant="contained" onClick={submit} disabled={busy || !!out?.tooBig}>
                        {busy ? 'Rendering…' : 'Save PNG'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

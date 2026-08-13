import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Link as MuiLink } from '@mui/material';
import PotionLoader from './PotionLoader';

// Google links come in a few shapes. Docs are proxied through our API so we can
// restyle them to match the app; Sheets/Slides/Drive files are rendered with
// Google's own preview, which keeps their formatting (tabs, frozen headers,
// charts) intact. All of them require the file to be viewable by link.
const parseGoogleLink = (raw) => {
    let u;
    try {
        u = new URL(raw);
    } catch {
        return null;
    }

    const host = u.hostname.toLowerCase();
    if (!host.endsWith('google.com')) return null;

    const parts = u.pathname.split('/').filter(Boolean);
    const dIdx = parts.findIndex((p) => p === 'd');
    if (dIdx < 0) return null;

    // /document/d/e/<id>/pub is the "published to web" form
    const id = parts[dIdx + 1] === 'e' ? parts[dIdx + 2] : parts[dIdx + 1];
    if (!id) return null;

    const kind = parts[0]?.toLowerCase();
    const gid = u.hash.match(/gid=([0-9]+)/)?.[1] || u.searchParams.get('gid');

    if (kind === 'document') return { kind: 'document', id };
    if (kind === 'spreadsheets') return { kind: 'spreadsheets', id, gid };
    if (kind === 'presentation') return { kind: 'presentation', id };
    if (kind === 'file') return { kind: 'file', id };
    return null;
};

// Google-hosted preview URL for the formats we don't proxy.
const previewUrlFor = (link) => {
    switch (link.kind) {
        case 'spreadsheets':
            return `https://docs.google.com/spreadsheets/d/${link.id}/preview${link.gid ? `?gid=${link.gid}` : ''
                }`;
        case 'presentation':
            return `https://docs.google.com/presentation/d/${link.id}/preview`;
        case 'file':
            return `https://drive.google.com/file/d/${link.id}/preview`;
        default:
            return null;
    }
};

// Content flagged editable embeds Google's own editor instead. Whether the viewer
// can actually save is decided by Drive's sharing settings on the file, not here.
// Drive files (PDFs, images) have no editor, so they stay on the preview path.
const editUrlFor = (link) => {
    if (!['document', 'spreadsheets', 'presentation'].includes(link.kind)) return null;
    const gid = link.kind === 'spreadsheets' && link.gid ? `#gid=${link.gid}` : '';
    return `https://docs.google.com/${link.kind}/d/${link.id}/edit?rm=embedded${gid}`;
};

const ContentViewer = ({ url, title = 'Document', topOffset = 64, style, editable = false }) => {
    const [html, setHtml] = useState(null);
    const [error, setError] = useState(null);
    // Frames paint white before their first content frame. Hold the loader over
    // the panel until onLoad fires so that flash never reaches the user.
    const [frameLoaded, setFrameLoaded] = useState(false);

    const panelBg = '#F2E8D5'; // matches the injected document background exactly

    const link = useMemo(() => parseGoogleLink(url), [url]);
    const frameUrl = useMemo(() => {
        if (!link) return null;
        return (editable && editUrlFor(link)) || previewUrlFor(link);
    }, [link, editable]);

    useEffect(() => {
        let active = true;
        setError(null);
        setHtml(null);
        setFrameLoaded(false);

        if (!link) {
            setError('Unsupported link');
            return;
        }

        // Anything rendered by Google directly needs no proxying.
        if (frameUrl) return;

        (async () => {
            try {
                const resp = await fetch(`/api/doc-html/${link.id}`);
                if (!resp.ok) throw new Error('Fetch failed');
                // Styling is applied by the API so the doc's own CSS stays intact.
                const text = await resp.text();
                if (active) setHtml(text);
            } catch {
                if (active) setError('Unable to load document.');
            }
        })();

        return () => {
            active = false;
        };
    }, [link, frameUrl]);

    const isFramed = !!frameUrl;

    // The frame fills the panel and fades in once it has painted.
    const frameStyle = {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        backgroundColor: panelBg,
        transition: 'opacity .3s ease',
    };

    return (
        <Box
            sx={{
                height: `calc(100vh - ${topOffset}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                p: { xs: 1.5, sm: 2 },
                width: '100%',
                background: panelBg,
            }}
            style={style}
        >
            {/* Header */}
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid rgba(0,0,0,0.08)',
                    backgroundColor: '#F2E8D5',
                    backdropFilter: 'blur(1px)',
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>
            </Box>

            {/* Viewer panel. The frame is layered under an overlay rather than
                swapped in, so nothing white is ever briefly visible. */}
            <Box
                sx={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 1.5,
                    border: '1px solid rgba(92,69,20,0.25)',
                    boxShadow: 1,
                    backgroundColor: panelBg,
                }}
            >
                {error && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                        <Typography color="text.secondary">
                            {error}{' '}
                            <MuiLink href={url} target="_blank" rel="noopener noreferrer">
                                Open directly
                            </MuiLink>
                        </Typography>
                    </Box>
                )}

                {!error && isFramed && (
                    <iframe
                        title="Content Viewer"
                        src={frameUrl}
                        onLoad={() => setFrameLoaded(true)}
                        style={{ ...frameStyle, opacity: frameLoaded ? 1 : 0 }}
                        allowFullScreen
                    />
                )}

                {!error && !isFramed && html && (
                    <iframe
                        title="Content Viewer"
                        srcDoc={html}
                        onLoad={() => setFrameLoaded(true)}
                        style={{ ...frameStyle, opacity: frameLoaded ? 1 : 0 }}
                        // Scripts stay blocked; popups are allowed so links inside the
                        // document can open in a new tab.
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                    />
                )}

                {!error && !frameLoaded && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: panelBg,
                        }}
                    >
                        <PotionLoader label="Distilling your manuscript…" minHeight={300} size={210} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default ContentViewer;

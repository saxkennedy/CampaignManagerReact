import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Link as MuiLink } from '@mui/material';
import PotionLoader from './PotionLoader'; 

const ContentViewer = ({ url, title = 'Document', topOffset = 64, style }) => {
    const [html, setHtml] = useState(null);
    const [error, setError] = useState(null);

    const panelBg = 'rgba(255,255,255,0.45)';

    // Extract Google Doc ID
    const docId = useMemo(() => {
        try {
            const u = new URL(url);
            const parts = u.pathname.split('/').filter(Boolean);
            const idx = parts.findIndex((p) => p === 'd');
            return idx >= 0 ? parts[idx + 1] : null;
        } catch {
            return null;
        }
    }, [url]);

    useEffect(() => {
        let active = true;
        setError(null);
        setHtml(null);
        if (!docId) {
            setError('Unsupported link');
            return;
        }

        (async () => {
            try {
                const resp = await fetch(`/api/doc-html/${docId}`);
                if (!resp.ok) throw new Error('Fetch failed');
                let text = await resp.text();

                // Inject basic style to make the doc background transparent
                const inject = `
          <style>
            html { justify-items: center; }
            body > * { margin-left: auto; margin-right: auto; max-width: 100%; }
            body { padding: 12px; background: transparent !important; margin: 0; }
          </style>`.trim();

                if (/<head[^>]*>/i.test(text)) {
                    text = text.replace(/<head[^>]*>/i, (m) => m + inject);
                } else if (/<body[^>]*>/i.test(text)) {
                    text = text.replace(/<body([^>]*)>/i, (m, attrs) => `<body${attrs}>${inject}`);
                } else {
                    text = inject + text;
                }

                if (active) setHtml(text);
            } catch (e) {
                if (active) setError('Unable to load document.');
            }
        })();

        return () => {
            active = false;
        };
    }, [docId]);

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

            {/* Viewer panel */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: 1.5,
                    boxShadow: 1,
                    backgroundColor: panelBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {error && (
                    <Box sx={{ p: 2 }}>
                        <Typography color="text.secondary">
                            {error}{' '}
                            <MuiLink href={url} target="_blank" rel="noopener noreferrer">
                                Open directly
                            </MuiLink>
                        </Typography>
                    </Box>
                )}

                {!error && !html && (
                    <PotionLoader label="Distilling your manuscript…" minHeight={300} />
                )}

                {!error && html && (
                    <iframe
                        title="Content Viewer"
                        srcDoc={html}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        sandbox=""
                    />
                )}
            </Box>
        </Box>
    );
};

export default ContentViewer;

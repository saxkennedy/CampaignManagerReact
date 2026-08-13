// Dark-fantasy palette for the app chrome (top nav + campaign sidebar).
//
// This extends the gold-on-near-black treatment the Dashboard hero already uses
// (#fbe7a1 → #b8862f over #0b0a14, set in Cinzel) so the chrome and the landing
// page read as one design rather than two. Content surfaces stay parchment —
// campaign documents are meant to look like documents.

export const soulslike = {
    void: '#0b0a08',       // deepest ground
    iron: '#14110c',       // bar / panel background
    ironLight: '#1c1811',  // raised panel
    ember: '#2a2318',      // hover fill
    gold: '#c8a44d',
    goldBright: '#e8c873',
    goldPale: '#fbe7a1',
    // Darker golds for text and outlines on light surfaces — #c8a44d on parchment
    // is too low-contrast to read.
    goldDeep: '#8a6a22',
    goldInk: '#5c4514',
    parchment: '#cbb994',  // muted body text on dark
    vellum: '#F2E8D5',     // light work surface
    edge: 'rgba(200,164,77,0.38)',
    edgeSoft: 'rgba(200,164,77,0.16)',
    edgeInk: 'rgba(92,69,20,0.30)', // hairline on light surfaces
};

export const displayFont = `'Cinzel', ui-serif, Georgia, serif`;

const s = soulslike;

// Top bar background: a shallow vertical gradient reads as forged metal rather
// than flat paint, with a gold hairline separating it from the page.
export const appBarSx = {
    background: `linear-gradient(180deg, ${s.ironLight} 0%, ${s.iron} 55%, ${s.void} 100%)`,
    borderBottom: `1px solid ${s.edge}`,
    boxShadow: '0 2px 14px rgba(0,0,0,0.55)',
};

export const topNavButtonSx = {
    flexGrow: 1,
    color: s.parchment,
    fontFamily: displayFont,
    fontWeight: 700,
    fontSize: '0.9rem',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    borderRadius: 0,
    py: 1.1,
    borderBottom: '2px solid transparent',
    transition: 'color .18s, border-color .18s, background-color .18s',
    '&:hover': {
        color: s.goldPale,
        backgroundColor: 'rgba(200,164,77,0.08)',
        borderBottomColor: s.gold,
    },
};

// Secondary strip that drops out of the top bar.
export const drawerPanelSx = {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    p: 2,
    background: `linear-gradient(180deg, ${s.void} 0%, ${s.iron} 100%)`,
    borderTop: `1px solid ${s.edgeSoft}`,
};

export const drawerOptionSx = {
    m: 1,
    px: 2.5,
    color: s.goldBright,
    borderColor: s.edge,
    fontFamily: displayFont,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'none',
    borderRadius: 1,
    '&:hover': {
        borderColor: s.gold,
        backgroundColor: 'rgba(200,164,77,0.12)',
        color: s.goldPale,
    },
};

export const menuPaperSx = {
    backgroundColor: s.iron,
    color: s.parchment,
    border: `1px solid ${s.edge}`,
    '& .MuiMenuItem-root:hover': {
        backgroundColor: s.ember,
        color: s.goldPale,
    },
};

// --- campaign sidebar -------------------------------------------------------

export const sidebarSx = {
    width: 'fit-content',
    minWidth: 260,
    maxWidth: 400,
    p: 1.5,
    borderRadius: 2,
    alignSelf: 'flex-start',
    background: `linear-gradient(180deg, ${s.ironLight} 0%, ${s.iron} 100%)`,
    border: `1px solid ${s.edge}`,
    boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
    boxSizing: 'border-box',
};

// Primary action — filled gold, dark text. Carries the weight the old orange had.
export const sidebarPrimarySx = {
    mb: 1,
    borderRadius: 1,
    backgroundColor: s.gold,
    color: s.void,
    border: `1px solid ${s.goldBright}`,
    '& .MuiListItemText-primary': {
        fontFamily: displayFont,
        fontWeight: 700,
        letterSpacing: '0.06em',
    },
    '&:hover': { backgroundColor: s.goldBright },
    '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: s.goldPale },
};

export const sidebarOutlinedSx = {
    mb: 1,
    borderRadius: 1,
    color: s.goldBright,
    border: `1px solid ${s.edge}`,
    '& .MuiListItemText-primary': {
        fontFamily: displayFont,
        fontWeight: 600,
        letterSpacing: '0.05em',
    },
    '&:hover': { backgroundColor: 'rgba(200,164,77,0.12)', borderColor: s.gold },
};

export const sidebarMutedSx = {
    ...sidebarOutlinedSx,
    color: s.parchment,
    border: `1px solid ${s.edgeSoft}`,
};

// Tree rows. Selected gets a gold rail on the left rather than a fill, so the
// highlight survives at any nesting depth without muddying the text.
export const treeItemSx = {
    borderRadius: 1,
    color: s.parchment,
    borderLeft: '2px solid transparent',
    '& .MuiListItemText-primary': { fontSize: '0.92rem' },
    '&:hover': { backgroundColor: 'rgba(200,164,77,0.10)', color: s.goldPale },
    '&.Mui-selected, &.Mui-selected:hover': {
        backgroundColor: 'rgba(200,164,77,0.16)',
        borderLeftColor: s.gold,
        color: s.goldPale,
    },
};

export const treeDisabledSx = {
    color: 'rgba(203,185,148,0.45)',
    '& .MuiListItemText-primary': { fontSize: '0.92rem' },
};

// --- shared controls --------------------------------------------------------

// Filled gold. Reads as the primary action on either surface.
export const goldButtonSx = {
    backgroundColor: s.gold,
    color: s.void,
    fontFamily: displayFont,
    fontWeight: 700,
    letterSpacing: '0.06em',
    border: `1px solid ${s.goldBright}`,
    '&:hover': { backgroundColor: s.goldBright },
    '&.Mui-disabled': {
        backgroundColor: 'rgba(200,164,77,0.35)',
        color: 'rgba(0,0,0,0.45)',
    },
};

// Outlined gold for use on the light work surface.
export const goldOutlineButtonSx = {
    color: s.goldDeep,
    borderColor: s.edgeInk,
    fontFamily: displayFont,
    fontWeight: 600,
    letterSpacing: '0.04em',
    '&:hover': { borderColor: s.goldDeep, backgroundColor: 'rgba(138,106,34,0.10)' },
};

// Text fields sitting on a dark panel. The autofill override matters — Chrome
// paints its own near-white fill and would punch a hole in the panel.
export const darkFieldSx = {
    '& .MuiOutlinedInput-root': {
        color: s.goldPale,
        backgroundColor: 'rgba(0,0,0,0.28)',
        '& fieldset': { borderColor: s.edge },
        '&:hover fieldset': { borderColor: s.gold },
        '&.Mui-focused fieldset': { borderColor: s.goldBright },
    },
    '& .MuiInputLabel-root': { color: s.parchment },
    '& .MuiInputLabel-root.Mui-focused': { color: s.goldBright },
    '& input:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 100px ${s.iron} inset`,
        WebkitTextFillColor: s.goldPale,
        caretColor: s.goldPale,
    },
};

// --- login ------------------------------------------------------------------

export const authCardSx = {
    background: `linear-gradient(180deg, ${s.ironLight} 0%, ${s.iron} 100%)`,
    border: `1px solid ${s.edge}`,
    borderRadius: 3,
    boxShadow: '0 18px 50px rgba(0,0,0,0.75)',
    p: { xs: 3, sm: 6 },
    width: { xs: '100%', sm: 440 },
    mx: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
};

// Same gilt treatment as the Dashboard hero.
export const authTitleSx = {
    fontFamily: displayFont,
    fontWeight: 900,
    letterSpacing: '0.04em',
    lineHeight: 1.15,
    textAlign: 'center',
    mb: 2,
    background: `linear-gradient(180deg, ${s.goldPale} 0%, ${s.goldBright} 45%, #b8862f 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.75))',
};

// Full-bleed art behind the auth screens. Plain style object, not sx.
export const authBgStyle = {
    backgroundImage: 'url("/img/LoginBackground.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: s.void,
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

// Body copy inside an auth card.
export const authBodySx = { color: s.parchment, textAlign: 'center', mb: 2 };

// react-router <Link> takes a plain style object, not sx.
export const authLinkStyle = {
    color: s.goldBright,
    textDecorationColor: 'rgba(200,164,77,0.5)',
};

export const authSubtitleSx = {
    fontFamily: displayFont,
    color: s.parchment,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontSize: '0.8rem',
    mb: 3,
};

// --- campaign administration ------------------------------------------------

// Dark gold-framed shell; the work surface inside stays light because forms and
// documents are content, and content is parchment in this design.
export const adminCardSx = {
    backgroundColor: s.iron,
    border: `1px solid ${s.edge}`,
    borderRadius: 2,
    overflow: 'hidden',
    boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
};

export const adminHeaderSx = {
    background: `linear-gradient(180deg, ${s.ironLight} 0%, ${s.iron} 100%)`,
    '& .MuiCardHeader-title': {
        fontFamily: displayFont,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: s.goldBright,
    },
    '& .MuiCardHeader-subheader': { color: 'rgba(203,185,148,0.65)', fontSize: '0.78rem' },
};

export const adminTabsSx = {
    px: 2,
    backgroundColor: s.iron,
    borderTop: `1px solid ${s.edgeSoft}`,
    '& .MuiTab-root': {
        fontFamily: displayFont,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: s.parchment,
    },
    '& .MuiTab-root.Mui-selected': { color: s.goldPale },
    '& .MuiTabs-indicator': { backgroundColor: s.gold, height: 3 },
};

export const adminBodySx = { p: 2, backgroundColor: s.vellum };

// Rows in the admin content tree.
export const adminRowSx = (isChild) => ({
    border: '1px solid',
    borderColor: s.edgeInk,
    borderLeft: `3px solid ${isChild ? 'rgba(138,106,34,0.35)' : s.goldDeep}`,
    borderRadius: 1,
    p: 1,
    backgroundColor: isChild ? 'rgba(138,106,34,0.07)' : 'rgba(255,255,255,0.45)',
});

export const adminChevronSx = (isOpen) => ({
    p: 0.25,
    color: s.goldDeep,
    border: `1px solid ${s.edgeInk}`,
    borderRadius: 1,
    transition: 'transform .18s ease, border-color .18s, background-color .18s',
    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
    '&:hover': { borderColor: s.goldDeep, backgroundColor: 'rgba(138,106,34,0.12)' },
});

// Expand/collapse affordance: a real bordered button, not a bare glyph.
export const chevronButtonSx = (isOpen) => ({
    ml: 1,
    p: 0.25,
    color: s.gold,
    border: `1px solid ${s.edgeSoft}`,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    transition: 'transform .18s ease, border-color .18s, background-color .18s',
    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
    '&:hover': {
        borderColor: s.gold,
        backgroundColor: s.ember,
        color: s.goldPale,
    },
});

// Bastion dialogs carry rosters, activity lists and per-player logs. Letting MUI size
// them to their content leaves a small box floating in a large screen, and makes the
// dialog jump around as data loads in. These props pin them to a stable box — all but
// ~10% of the viewport on desktop, edge-to-edge on phones — and let the body scroll
// inside instead of the dialog resizing.
export const WIDE_DIALOG_PROPS = {
    maxWidth: false,
    fullWidth: true,
    PaperProps: {
        sx: {
            width: { xs: '100%', md: '90vw' },
            maxWidth: { xs: '100%', md: '90vw' },
            height: { xs: '100%', md: '90vh' },
            maxHeight: { xs: '100%', md: '90vh' },
            m: { xs: 0, md: 4 },
        },
    },
};

// CSS has no scissors cursor keyword, so we ship a tiny inline SVG and fall back to a
// crosshair wherever a custom cursor can't be loaded. The white under-stroke keeps the
// blades visible over both the pale board and a dark room fill.
const SCISSORS_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
    '<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/>',
    '<path d="M8 16 19 4"/><path d="M16 16 5 4"/>',
    '</g>',
    '<g fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/>',
    '<path d="M8 16 19 4"/><path d="M16 16 5 4"/>',
    '</g></svg>',
].join('');

// Hotspot at the blade crossing rather than the icon corner, so the square you cut from
// is the square under the pivot.
export const SCISSOR_CURSOR =
    `url("data:image/svg+xml;utf8,${encodeURIComponent(SCISSORS_SVG)}") 12 10, crosshair`;

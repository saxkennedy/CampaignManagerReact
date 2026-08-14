// Browser tab titles.
//
// index.html ships a bare site title; without anything setting document.title
// per page every tab reads as the raw URL, which is unusable once a few
// campaign documents are open side by side.
import React from 'react';

export const SITE_TITLE = 'Campaign Manager';

// Tabs truncate hard and from the right, so the most identifying part goes
// first and the context trails behind where it can be cut without loss.
export const titleFrom = (...parts) => parts.filter(Boolean).join(' — ');

// A falsy title leaves document.title untouched. That lets a page hold its
// peace until the name it wants has actually loaded, rather than flashing a
// placeholder, and lets the route-level fallback stand where a page has
// nothing better to say.
export default function useDocumentTitle(title) {
    React.useEffect(() => {
        if (title) document.title = title;
    }, [title]);
}

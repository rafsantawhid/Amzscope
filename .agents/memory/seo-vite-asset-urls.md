---
name: Vite SEO asset URLs
description: Vite build behavior for SPA SEO tags when the production domain is not known yet.
---

Root-relative or dot-relative canonical link URLs in an SPA HTML shell can be interpreted as file assets by Vite and fail production builds with an EISDIR error when the target resolves to a directory.

**Why:** The app must keep the production origin configurable until deployment, but Vite still processes some HTML URL attributes during bundling.

**How to apply:** Keep generic description and social metadata in index.html, avoid unresolved canonical link hrefs in the Vite shell, and create/update the canonical URL at runtime from the current origin and route.
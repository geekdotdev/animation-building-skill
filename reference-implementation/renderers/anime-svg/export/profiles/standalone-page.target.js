// Target profile: one self-contained HTML page that opens from a file or any static host, with anime.js
// inlined so it needs no network. Data only.
export default {
  target: 'standalone-page',
  description: 'A full page: doctype, the diagram, its CSS and one script with anime.js inlined.',
  packaging: 'page',
  assets: { anime: 'inline' },
  gestures: 'live',
  behavior: { mode: 'user-driven', toggle: true },
  presentation: {
    'diagram-width': '100%',
    'diagram-max-width': '1400px',
    'diagram-margin': '1.5rem auto',
  },
  reasons: {
    'diagram-width': "There is no 720px column to break out of, so fill the page.",
    'diagram-max-width': 'Stops it growing past a comfortable size on a wide screen.',
    'diagram-margin': 'Centered on the page.',
  },
  unverified: [],
};

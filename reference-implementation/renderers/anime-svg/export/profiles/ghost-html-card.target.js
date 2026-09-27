// Target profile: the example project's diagram 5 pasted into a Ghost blog's HTML card. Data only.
// The reasons are from examples/nats-nkey-demo/ghost-export.md, where they were first recorded.
export default {
  target: 'ghost-html-card',
  description: 'One HTML fragment (markup, style, module script) pasted into a Ghost HTML card.',
  packaging: 'fragment',
  assets: { anime: 'cdn' },        // the CDN URL is built from the app's anime.js version
  gestures: 'live',                // a Ghost post is a live page, so clicks work
  behavior: { mode: 'user-driven', toggle: true },
  presentation: {
    'diagram-width': '100%',
    'diagram-max-width': '1400px',
    'diagram-margin': '1.5rem auto',
    'log-width': '640px',
    'log-max-height': '150px',
    'log-padding': '0.5rem 0.7rem',
    'log-font-size': '1.1rem',
    'log-color': '#000',
    'replay-padding': '0.55rem 1.4rem',
    'replay-font-size': '1.1rem',
    'toggle-font-size': '1.1rem',
  },
  reasons: {
    'diagram-width': "The app's breakout (1.5x a 720px column) assumes a column that a Ghost post doesn't have; fill the post's content column instead.",
    'diagram-max-width': 'Tested at 1250px; stops it growing past a comfortable size on a wide screen.',
    'diagram-margin': 'Centered in the content column, with the spacing the post text has.',
    'log-width': "The SVG scales with the container and page text doesn't, so the log is wider to match a bigger diagram.",
    'log-max-height': 'Taller for the same reason.',
    'log-padding': 'Larger to match the larger text.',
    'log-font-size': 'The original 0.8rem reads as tiny next to a diagram this much bigger.',
    'log-color': 'Ghost themes style paragraphs (colour, sometimes opacity); force plain black.',
    'replay-padding': "The button doesn't scale with the SVG, so it read as tiny.",
    'replay-font-size': 'Sized to match the log text.',
    'toggle-font-size': 'Sized to match the Replay button beside it.',
  },
  unverified: [
    "Whether Ghost's HTML card preserves the module script and the CDN import.",
    'Whether a given theme overrides the sizes.',
  ],
};

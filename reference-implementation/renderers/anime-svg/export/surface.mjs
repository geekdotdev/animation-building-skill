// Copyright (c) 2026 Charlie Federspiel
// SPDX-License-Identifier: MIT
// The parameter surface: the presentation parameters a target profile may set, and the CSS each one
// controls (core/delivery-targets.md, "Parameterizing an export"). A profile sets a subset of these,
// each with a reason. Any other name is an error.
//
// Each entry lists the rules the parameter drives. `sel` is appended to the diagram's root selector
// (`#diagram-<diagram-label>`, so a host page's `p` or `button` rules can't win), `prop` is the CSS property.
// `mustExist` names a class that has to occur in the exported diagram, CSS or interpreter: a parameter
// whose target isn't there is an error, not silently ignored. `constant` adds a fixed declaration.
export const SURFACE = {
  "diagram-width": { rules: [{ sel: "", prop: "width" }], mustExist: "diagram" },
  "diagram-max-width": { rules: [{ sel: "", prop: "max-width" }], mustExist: "diagram" },
  "diagram-margin": { rules: [{ sel: "", prop: "margin" }], mustExist: "diagram" },
  "log-width": { rules: [{ sel: " .diagram-log", prop: "width" }], mustExist: "diagram-log" },
  "log-max-height": { rules: [{ sel: " .diagram-log", prop: "max-height" }], mustExist: "diagram-log" },
  "log-padding": { rules: [{ sel: " .diagram-log", prop: "padding" }], mustExist: "diagram-log" },
  "log-font-size": { rules: [{ sel: " .diagram-log", prop: "font-size" }], mustExist: "diagram-log" },
  // A host theme often styles paragraphs (colour, sometimes opacity), so the paragraphs are set too.
  "log-color": {
    rules: [
      { sel: " .diagram-log", prop: "color" },
      { sel: " .diagram-log p", prop: "color" },
      { sel: " .diagram-log p", prop: "opacity", constant: "1" },
    ],
    mustExist: "diagram-log",
  },
  "replay-padding": { rules: [{ sel: " .diagram-footer .diagram-replay", prop: "padding" }], mustExist: "diagram-replay" },
  "replay-font-size": { rules: [{ sel: " .diagram-footer .diagram-replay", prop: "font-size" }], mustExist: "diagram-replay" },
  // The interpreter sets this label's size inline, so only `!important` can override it.
  "toggle-font-size": { rules: [{ sel: " .diagram-mode-toggle", prop: "font-size", important: true }], mustExist: "diagram-mode-toggle" },
};

// Behavior parameters (a JSON config, not CSS). `replay: false` hides the Replay button. `pace` is a factor on every
// duration and delay (2 is twice as slow, 0.5 twice as fast), set on the exported copy of the descriptor as
// `settings.paceMultiplier`.
export const BEHAVIOR_KEYS = ["mode", "toggle", "replay", "pace"];

# Changelog

## 0.6.0 (2026-10-12)

- Bundled with HA Phase Map 0.7, which loads it by itself. Loading the card a second time (also
  from a dashboard resource) keeps the first copy instead of failing with "already defined".
- **Phase colours in the visual editor** (a colour picker per phase, under *Phase colours*).
  Only colours that differ from the defaults are written to the YAML.
- Automated tests (`node --test test/*.test.js`) for the layout model and the drawing: sub-panels,
  dashed unverified phases, one-meter loads, moved loads, average mode, Swedish, escaping, the
  colour conversion and double loading. Run in CI.
- Issue templates.

## 0.5.0 (unreleased)

- **Unverified phases are dashed.** A conductor to a phase the load has never been seen
  drawing from (HA Phase Map 0.6) is drawn dashed with an open dot, with a tooltip. A 3-phase
  charger used by a 1-phase car shows L1 solid and L2, L3 dashed.

## 0.4.0 (unreleased)

- A multi-phase load with only one meter (HA Phase Map 0.5) says how its power is counted
  ("1 meter, all on L1" or "1 meter, split equally") instead of showing a per-phase split that
  was never measured.

## 0.3.0 (unreleased)

- **Sub-panels.** A meter with meters behind it (a garage's incoming meter) gets its own
  set of buses below the main diagram, fed from its box by a dashed line: its loads hang off
  its phases exactly like on the main buses, multi-phase loads cross with arcs, and each
  phase ends with **Other**, what the meter measures beyond them. Nested further, the same
  repeats. Replaces the list under the box from 0.2.0.
- A load whose phase check suspects another phase (HA Phase Map 0.3) is marked "⚠ L3?",
  with a tooltip.

## 0.2.0 (unreleased)

- Meters behind other meters (HA Phase Map 0.2): a box with meters behind it is wider and
  lists them underneath, indented by depth, with dots in the colours of the phases they use
  and their power, followed by **Other**, what the parent measures beyond them. Works in live
  and average mode. Full names show as a tooltip when they are shortened.

## 0.1.0 (unreleased)

First version: the phase bus diagram for HA Phase Map, live or averaged over N days, with a
visual editor, light/dark theme support, estimated loads, multi-phase loads with crossing
arcs, and detector chips. English and Swedish labels.

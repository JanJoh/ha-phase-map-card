# Changelog

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

// A live payload like HA Phase Map 0.6 sends: a garage with meters behind it, a 3-phase charger
// with a 1-phase car, a charger with one total meter, a moved kettle and an estimated sauna.
const phases = (o) => o;
module.exports.live = () => ({
  entry_id: "e1", title: "Main fuse", phases_order: ["L1", "L2", "L3"], voltage: 230, fuse_a: 20, margin_a: 1,
  phases: phases({
    L1: { current_a: 19.5, unmetered_a: 0.9, headroom_a: 0.5 },
    L2: { current_a: 11.7, unmetered_a: 0.6, headroom_a: 8.3 },
    L3: { current_a: 9.0, unmetered_a: -0.4, headroom_a: 11 },
  }),
  loads: [
    { id: "dish", name: "Dish<washer>", phases: ["L2"], parent: null, estimated: false, w: { L2: 2070 } },
    { id: "kettle", name: "Kettle", phases: ["L2"], parent: null, estimated: false, w: { L2: 0 },
      phase_check: { phase: "L2", agree: 0, disagree: 5, events: 5, suspected: "L3" } },
    { id: "ev", name: "EV charger", phases: ["L1", "L2", "L3"], parent: null, estimated: false,
      w: { L1: 2024, L2: 0, L3: 0 }, verified: ["L1"] },
    { id: "chg", name: "Charger|(total meter)", phases: ["L1", "L2", "L3"], parent: null, estimated: false,
      w: { L1: 1610, L2: 0, L3: 0 }, verified: ["L1", "L2", "L3"], meter: { draw: "L1" } },
    { id: "sauna", name: "Sauna", phases: ["L1", "L2", "L3"], parent: null, estimated: true, estimated_w: 8000,
      w: {} },
    { id: "garage", name: "Garage|incoming", phases: ["L1", "L2", "L3"], parent: null, estimated: false,
      w: { L1: 60, L2: 1540, L3: 1010 }, rest_w: { L1: 60, L2: 40, L3: 10 }, verified: ["L1", "L2", "L3"] },
    { id: "cee", name: "CEE outlet", phases: ["L1", "L2", "L3"], parent: "garage", estimated: false,
      w: { L1: 0, L2: 0, L3: 0 }, verified: [] },
    { id: "fan", name: "Fan heater", phases: ["L2"], parent: "garage", estimated: false, w: { L2: 1500 } },
    { id: "wh", name: "Water heater|garage", phases: ["L3"], parent: "garage", estimated: false, w: { L3: 1000 } },
  ],
  detectors: [{ name: "Sauna running", on: false }],
});
module.exports.average = () => ({
  days: 10,
  phases: { L1: { total_w: 2900, unmetered_w: 434 }, L2: { total_w: 3116, unmetered_w: 36 }, L3: { total_w: 876, unmetered_w: null } },
  loads: [
    { id: "dish", w: { L2: 120 } }, { id: "kettle", w: { L2: 9 } }, { id: "ev", w: { L1: 137, L2: 0, L3: 0 } },
    { id: "chg", w: { L1: 50, L2: 0, L3: 0 } },
    { id: "garage", w: { L1: 21, L2: 30, L3: 12 }, rest_w: { L1: 21, L2: 5, L3: 2 } },
    { id: "cee", w: { L1: 0, L2: 0, L3: 0 } }, { id: "fan", w: { L2: 25 } }, { id: "wh", w: { L3: 10 } },
  ],
});

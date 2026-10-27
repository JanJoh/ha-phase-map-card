const test = require("node:test");
const assert = require("node:assert/strict");
require("./dom-shim");
const { PhaseBusCard, PhaseBusCardEditor, splitName, fmtW } = require("../dist/phase-bus-card.js");
const fixture = require("./fixture");

function card(config = {}, lang = "en") {
  const c = new PhaseBusCard();
  c.setConfig({ mode: "live", ...config });
  c._hass = { locale: { language: lang } };
  c._live = fixture.live();
  return c;
}

const count = (s, needle) => s.split(needle).length - 1;

test("the garage gets a panel of its own, fed from its box", () => {
  const c = card();
  const m = c._model();
  assert.equal(m.panels.length, 2);
  const garage = m.panels[1];
  assert.equal(garage.feeder, "garage");
  assert.deepEqual(garage.phases, ["L1", "L2", "L3"]);
  assert.deepEqual(garage.rows.L2.map((r) => r.name), ["Fan heater", "Other"]);
  assert.deepEqual(garage.multi.map((r) => r.id), ["cee"]);
  // children are not drawn on the main buses again
  assert.ok(!m.panels[0].rows.L2.some((r) => r.id === "fan"));
  const svg = c._svg(m);
  assert.equal(count(svg, 'class="feed"'), 1);
  assert.match(svg, />Other</);
});

test("unverified phases are dashed, estimated loads keep their own dashes", () => {
  const svg = card()._svg(card()._model());
  // EV: L2 + L3 unverified; CEE: all three. The sauna is estimated, not unverified.
  assert.equal(count(svg, "cond unv"), 5);
  assert.equal(count(svg, 'class="unv-dot"'), 5);
  assert.equal(count(svg, "cond est"), 3);
  assert.match(svg, /L2: no current seen here yet \(unverified\)/);
});

test("a one-meter load says how it is counted; a moved load is marked", () => {
  const svg = card()._svg(card()._model());
  assert.match(svg, /1 meter, all on L1/);
  assert.match(svg, /⚠ L3\?/);
  assert.match(svg, /Seems to be on L3, not L2/);
  assert.match(svg, /all on L1/);                       // the per-phase metered EV
});

test("names are escaped and numbers are always finite", () => {
  const svg = card()._svg(card()._model());
  assert.match(svg, /Dish&lt;washer&gt;/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  assert.ok(Number(w) > 600 && Number(h) > 600);
});

test("a phase close to the fuse is flagged; negative unmetered shows as 0 W", () => {
  const c = card();
  const m = c._model();
  assert.equal(m.panels[0].warn.L1, true);
  assert.equal(m.panels[0].warn.L2, false);
  assert.equal(m.panels[0].rows.L3.at(-1).total, 0);
});

test("average mode uses the averages, including the parent's rest", () => {
  const c = card({ mode: "average", days: 10 });
  c._avg = fixture.average();
  const m = c._model();
  const garage = m.panels[1];
  assert.equal(garage.rows.L2.at(-1).total, 5);
  assert.equal(m.panels[0].rows.L3.at(-1).total, null);       // no average available → "–"
  const svg = c._svg(m);
  assert.match(svg, /≈ 2900 W average/);
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test("Swedish labels", () => {
  const svg = card({}, "sv")._svg(card({}, "sv")._model());
  assert.match(svg, />Huvudsäkring</);
  assert.match(svg, />Övrigt</);
  assert.match(svg, /1 mätare, allt på L1/);
});

test("without meters behind other meters there is one panel and no feeder", () => {
  const c = card();
  c._live.loads = c._live.loads.filter((l) => !l.parent);
  const svg = c._svg(c._model());
  assert.equal(count(svg, 'class="feed"'), 0);
});

test("splitName and fmtW", () => {
  assert.deepEqual(splitName("Heat pump|compressor"), ["Heat pump", "compressor"]);
  assert.deepEqual(splitName("Kettle"), ["Kettle"]);
  assert.equal(splitName("Dehumidifier basement storage").length, 2);
  assert.equal(fmtW(12345), "12.3 kW");
  assert.equal(fmtW(null), "–");
});

test("editor colours round-trip between #hex and [r, g, b]", () => {
  const form = PhaseBusCardEditor.toForm({ type: "custom:phase-bus-card", colors: { L2: "#112233" } });
  assert.deepEqual(form.colors.L2, [17, 34, 51]);
  assert.deepEqual(form.colors.L1, [184, 98, 42]);              // the default
  const back = PhaseBusCardEditor.fromForm({ type: "custom:phase-bus-card" }, form);
  assert.deepEqual(back.colors, { L2: "#112233" });             // defaults are not written out
  const none = PhaseBusCardEditor.fromForm({ colors: { L1: "#000000" } }, PhaseBusCardEditor.toForm({}));
  assert.equal(none.colors, undefined);
});

test("loading the card twice does not throw", () => {
  delete require.cache[require.resolve("../dist/phase-bus-card.js")];
  assert.doesNotThrow(() => require("../dist/phase-bus-card.js"));
});

test("multi-phase loads show each phase's reading at its junction, in the phase colour", () => {
  const c = card();
  const svg = c._svg(c._model());
  // EV (L1) and the garage (L1, L2, L3); not the one-meter charger, the idle CEE outlet or the sauna
  assert.equal(count(svg, 'class="jw"'), 4);
  assert.match(svg, new RegExp(`class="jw"[^>]*style="fill:${c._color("L2", 1)}">${fmtW(1540)}<`));
});

test("the per-phase split in a box is coloured by phase", () => {
  const c = card();
  c._live.loads.push({ id: "hp", name: "Heat pump", phases: ["L1", "L2", "L3"], parent: null, estimated: false,
    w: { L1: 34, L2: 0, L3: 480 }, verified: ["L1", "L3"] });
  const svg = c._svg(c._model());
  const line = /<text class="nm small split"[^>]*>(.*?)<\/text>/.exec(svg);
  assert.ok(line, "split line drawn");
  assert.match(line[1], new RegExp(`<tspan style="fill:${c._color("L1", 0)}">L1 34</tspan>`));
  assert.match(line[1], new RegExp(`<tspan style="fill:${c._color("L3", 2)}">L3 480</tspan>`));
  assert.match(line[1], /class="sep"> · </);
});

test("a detector is drawn as a load, and what it sees is taken out of Unmetered", () => {
  const c = card();
  c._live.phases.L1.unmetered_a = 9.0;                  // 2070 W unmetered, 1840 W of it the sauna
  c._live.detectors = [{ id: "det", name: "Bastun", phases: ["L1", "L2", "L3"], on: true,
    w: { L1: 1840, L2: 1840, L3: 1840 }, power_w: 5520 }];
  const m = c._model();
  const det = m.panels[0].multi.find((r) => r.id === "det_det");
  assert.ok(det && det.detected);
  assert.equal(m.panels[0].multi.at(-1), det);          // after the metered loads
  const rest = m.panels[0].rows.L1.find((r) => r.rest);
  assert.equal(Math.round(rest.total), 230);
  const svg = c._svg(m);
  assert.match(svg, />5520 W</);
  assert.match(svg, /detected · running/);
  assert.match(svg, /estimated by the detector/);
  assert.equal(count(svg, "cond est"), 6);              // the estimated sauna and the detector
  assert.match(svg, /class="jw"[^>]*>1840 W</);
});

test("a detector that is off shows 0 W; in average mode it stays a chip", () => {
  const c = card();
  c._live.detectors = [{ id: "det", name: "Bastun", phases: ["L1", "L2", "L3"], on: false,
    w: { L1: 0, L2: 0, L3: 0 }, power_w: 0 }];
  const svg = c._svg(c._model());
  assert.match(svg, /detected · not running/);
  assert.match(svg, /class="w zero"[^>]*>0 W</);
  const a = card({ mode: "average" });
  a._live.detectors = c._live.detectors;
  a._avg = fixture.average();
  const m = a._model();
  assert.ok(!m.panels[0].multi.some((r) => r.detected));
});

test("payloads from before 0.9 (detectors without phases) still draw", () => {
  const svg = card()._svg(card()._model());
  assert.doesNotMatch(svg, /detected/);
});

test("boxes with an entity open its more-info dialog", () => {
  const c = card();
  const svg = c._svg(c._model());
  assert.match(svg, /<g class="hit" data-entity="sensor\.dishwasher" tabindex="0" role="button" aria-label="Dish&lt;washer&gt;">/);
  assert.match(svg, /data-entity="sensor\.ev_l1"/);                                  // multi-phase box
  assert.match(svg, /data-entity="sensor\.main_fuse_l1_unmetered_current"/);         // Unmetered on L1
  assert.equal(count(svg, 'class="hit"'), 3);   // the estimated sauna, Other and loads without ids stay plain
  assert.equal(count(svg, "<g "), count(svg, "</g>"));

  c.connectedCallback();
  const click = c.shadowRoot.listeners.click;
  let prevented = false;
  click({ composedPath: () => [{}, { dataset: { entity: "sensor.dishwasher" } }], preventDefault: () => { prevented = true; } });
  assert.equal(c.dispatched.length, 1);
  assert.equal(c.dispatched[0].type, "hass-more-info");
  assert.deepEqual(c.dispatched[0].detail, { entityId: "sensor.dishwasher" });
  assert.ok(prevented && c.dispatched[0].bubbles && c.dispatched[0].composed);
  click({ composedPath: () => [{ dataset: {} }], preventDefault: () => {} });       // the bus, not a box
  assert.equal(c.dispatched.length, 1);
  c.shadowRoot.listeners.keydown({ key: "Enter", composedPath: () => [{ dataset: { entity: "sensor.ev_l1" } }], preventDefault: () => {} });
  c.shadowRoot.listeners.keydown({ key: "a", composedPath: () => [{ dataset: { entity: "sensor.ev_l1" } }], preventDefault: () => {} });
  assert.deepEqual(c.dispatched.map((e) => e.detail.entityId), ["sensor.dishwasher", "sensor.ev_l1"]);
});

test("a detector box opens its power sensor", () => {
  const c = card();
  c._live.detectors = [{ id: "s1", name: "Sauna running", phases: ["L1", "L2", "L3"], on: true,
    w: { L1: 2000, L2: 2000, L3: 2000 }, power_w: 6000, entity_id: "sensor.sauna_running_power" }];
  assert.match(c._svg(c._model()), /data-entity="sensor\.sauna_running_power"/);
});

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

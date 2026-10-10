/*
 * Phase Bus Card for HA Phase Map
 * https://github.com/JanJoh/ha-phase-map-card
 *
 * A single-line diagram: the main fuse, one bus per phase, every load branching off the
 * phase it is on, with live or average power. Needs the HA Phase Map integration
 * (https://github.com/JanJoh/ha-phase-map).
 *
 * MIT License
 */

const CARD_VERSION = "0.1.0";

const DEFAULT_COLORS = { L1: "#b8622a", L2: "#3a7fc1", L3: "#4f8f36" };
const ESTIMATED_COLOR = "#8a5cc2";

// Layout constants (same as the prototype generator)
const BUS_GAP = 180;           // vertical distance between buses
const BUS_TOP = 64;
const BW = 92, BH = 58, GAP = 6, X0 = 168;
const TP_W = 112, TP_H = 104, TP_GAP = 4, TP_SP = 13, HOP_R = 5.5;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtW(w, kwFrom = 10000) {
  if (w === null || w === undefined || Number.isNaN(w)) return "–";
  if (Math.abs(w) >= kwFrom) return `${+(w / 1000).toFixed(1)} kW`;
  return `${Math.round(w)} W`;
}

function splitName(name) {
  // Two lines of at most ~14 characters, breaking at spaces, then after "/" or "-"
  const s = String(name || "").trim();
  const MAX = 14;
  if (s.includes("|")) return s.split("|").slice(0, 2);
  if (s.length <= MAX) return [s];
  const tokens = s.split(/(?<=[\s/-])/);
  let a = "";
  let i = 0;
  while (i < tokens.length && (a + tokens[i]).trimEnd().length <= MAX) a += tokens[i++];
  if (!a) {
    a = s.slice(0, MAX - 1) + "-";
    return [a, ellipsize(s.slice(MAX - 1), MAX + 1)];
  }
  return [a.trimEnd(), ellipsize(tokens.slice(i).join("").trim(), MAX + 1)];
}

function ellipsize(t, n) {
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

class PhaseBusCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("phase-bus-card-editor");
  }

  static getStubConfig() {
    return { mode: "live", days: 10 };
  }

  setConfig(config) {
    if (config.mode && !["live", "average"].includes(config.mode)) {
      throw new Error("mode must be 'live' or 'average'");
    }
    this._config = { mode: "live", days: 10, ...config };
    this._resubscribe();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._resubscribe();
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._resubscribe();
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  _unsubscribe() {
    if (this._unsub) {
      this._unsub.then((u) => u && u()).catch(() => {});
      this._unsub = null;
    }
    clearInterval(this._avgTimer);
    this._avgTimer = null;
  }

  async _resubscribe() {
    if (!this._hass || !this._config || !this.isConnected) return;
    const key = JSON.stringify([this._config.entry_id, this._config.mode, this._config.days]);
    if (key === this._subKey && this._unsub) return;
    this._subKey = key;
    this._unsubscribe();
    this._error = null;
    try {
      let entryId = this._config.entry_id;
      if (!entryId) {
        const entries = await this._hass.callWS({ type: "phase_map/entries" });
        if (!entries.length) throw new Error("no_entry");
        entryId = entries[0].entry_id;
      }
      this._entryId = entryId;
      this._unsub = this._hass.connection.subscribeMessage(
        (payload) => { this._live = payload; this._render(); },
        { type: "phase_map/subscribe", entry_id: entryId },
      );
      await this._unsub;
      if (this._config.mode === "average") {
        await this._loadAverage();
        this._avgTimer = setInterval(() => this._loadAverage(), 15 * 60 * 1000);
      }
    } catch (err) {
      this._error = err && (err.message || err.code) ? (err.message || err.code) : String(err);
      this._render();
    }
  }

  async _loadAverage() {
    try {
      this._avg = await this._hass.callWS({ type: "phase_map/average", entry_id: this._entryId, days: Number(this._config.days) || 10 });
    } catch (err) {
      this._avg = null;
      this._avgError = err && err.message ? err.message : String(err);
    }
    this._render();
  }

  _t(key) {
    const sv = (this._hass?.locale?.language || this._hass?.language || "en").startsWith("sv");
    const T = {
      main_fuse: sv ? "Huvudsäkring" : "Main fuse",
      unmetered: sv ? "Omätt|rest" : "Unmetered|rest",
      average: sv ? "medel" : "average",
      of: sv ? "av" : "of",
      est: sv ? "uppsk." : "est.",
      not_running: sv ? "går inte" : "not running",
      running: sv ? "går" : "running",
      no_entry: sv ? "Ingen HA Phase Map hittades. Lägg till integrationen först." : "No HA Phase Map found. Add the integration first.",
      loading: sv ? "Laddar…" : "Loading…",
      days: sv ? "dagar" : "days",
      n_phase: sv ? "{n}-fas" : "{n}-phase",
      all_on: sv ? "allt på {p}" : "all on {p}",
      live: sv ? "Live" : "Live",
      average_days: sv ? "Medel · {d} dagar" : "Average · {d} days",
    };
    return T[key] ?? key;
  }

  _color(phase, i) {
    const cfg = this._config.colors || {};
    return cfg[phase] || DEFAULT_COLORS[phase] || ["#b8622a", "#3a7fc1", "#4f8f36"][i % 3];
  }

  _model() {
    const live = this._live;
    if (!live) return null;
    const avgMode = this._config.mode === "average";
    const avg = this._avg;
    const phases = live.phases_order;
    const v = live.voltage;
    const avgLoad = {};
    if (avgMode && avg) for (const l of avg.loads) avgLoad[l.id] = l.w;
    const rows = Object.fromEntries(phases.map((p) => [p, []]));
    const multi = [];
    for (const load of live.loads) {
      const w = avgMode ? (avgLoad[load.id] || {}) : load.w;
      const perPhase = {};
      for (const p of load.phases) perPhase[p] = w[p] ?? null;
      const total = load.estimated ? null : Object.values(perPhase).reduce((s, x) => s + (x || 0), 0);
      const item = { ...load, perPhase, total };
      if (load.phases.length > 1) multi.push(item);
      else if (load.phases.length === 1 && rows[load.phases[0]]) rows[load.phases[0]].push(item);
    }
    for (const p of phases) {
      if (avgMode) rows[p].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
      const ph = live.phases[p];
      const rest = avgMode ? avg?.phases?.[p]?.unmetered_w : (ph.unmetered_a == null ? null : ph.unmetered_a * v);
      rows[p].push({ id: `rest_${p}`, name: this._t("unmetered"), rest: true, total: rest == null ? null : Math.max(rest, 0) });
    }
    return { live, phases, rows, multi, avgMode, avg };
  }

  _svg(m) {
    const { live, phases, rows, multi, avgMode, avg } = m;
    const busY = Object.fromEntries(phases.map((p, i) => [p, BUS_TOP + i * BUS_GAP]));
    const lastBus = busY[phases[phases.length - 1]];
    const rowEnd = X0 + Math.max(...phases.map((p) => rows[p].length)) * (BW + GAP) - GAP;
    const tpX0 = rowEnd + 30 + TP_W / 2;
    const centres = multi.map((_, i) => tpX0 + i * (TP_W + TP_GAP));
    const W = Math.round((multi.length ? centres[centres.length - 1] + TP_W / 2 : rowEnd) + 16);
    const boxTop3 = lastBus + 34 + BH + 34;
    const H = multi.length ? boxTop3 + TP_H + 12 : lastBus + 34 + BH + 20;
    const busEnd = W - 18;
    const o = [];
    o.push(`<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="${esc(this._t("main_fuse"))}" xmlns="http://www.w3.org/2000/svg">`);
    const fuseTop = BUS_TOP - 40, fuseH = lastBus - BUS_TOP + 80;
    o.push(`<rect class="fuse" x="18" y="${fuseTop}" width="104" height="${fuseH}" rx="8"/>`);
    o.push(`<text class="fuse-t" x="70" y="${BUS_TOP - 14}" text-anchor="middle">${esc(this._t("main_fuse"))}</text>`);
    o.push(`<text class="fuse-s" x="70" y="${BUS_TOP + 2}" text-anchor="middle">${phases.length} × ${live.fuse_a} A</text>`);
    phases.forEach((p, i) => {
      const y = busY[p], c = this._color(p, i);
      const ph = live.phases[p];
      let label;
      if (avgMode) {
        const tw = avg?.phases?.[p]?.total_w;
        label = `≈ ${fmtW(tw)} ${this._t("average")}`;
      } else {
        const cur = ph.current_a;
        label = cur == null ? "–" : `${cur.toFixed(1)} A ${this._t("of")} ${live.fuse_a} A`;
      }
      const warn = !avgMode && ph.current_a != null && ph.current_a >= live.fuse_a - (live.margin_a ?? 1);
      o.push(`<line class="bus" x1="122" y1="${y}" x2="${busEnd}" y2="${y}" style="stroke:${c}"/>`);
      o.push(`<text class="ph" x="134" y="${y - 12}" style="fill:${c}">${esc(p)}</text>`);
      o.push(`<text class="ph-avg${warn ? " warn" : ""}" x="162" y="${y - 12}">${esc(label)}</text>`);
      rows[p].forEach((ld, j) => {
        const x = X0 + j * (BW + GAP), cx = x + BW / 2, top = y + 34;
        const est = ld.estimated;
        o.push(`<line class="tap" x1="${cx}" y1="${y}" x2="${cx}" y2="${top}" style="stroke:${est ? ESTIMATED_COLOR : c}"/>`);
        o.push(`<circle cx="${cx}" cy="${y}" r="4" style="fill:${c}"/>`);
        o.push(`<rect class="box${ld.rest ? " rest" : ""}${est ? " est" : ""}" x="${x}" y="${top}" width="${BW}" height="${BH}" rx="6" style="stroke:${est ? ESTIMATED_COLOR : c}"/>`);
        const lines = splitName(ld.name);
        const ty = lines.length === 2 ? top + 17 : top + 24;
        lines.forEach((l, k) => o.push(`<text class="nm" x="${cx}" y="${ty + k * 13}" text-anchor="middle">${esc(l)}</text>`));
        const val = est ? `${this._t("est")} ${fmtW(ld.estimated_w, 1000)}` : fmtW(ld.total);
        o.push(`<text class="w${!est && !ld.total ? " zero" : ""}" x="${cx}" y="${top + BH - 8}" text-anchor="middle">${esc(val)}</text>`);
      });
    });
    multi.forEach((ld, n) => {
      const xc = centres[n];
      const est = ld.estimated;
      ld.phases.forEach((p) => {
        const k = phases.indexOf(p);
        if (k < 0) return;
        const x = xc + (k - (phases.length - 1) / 2) * TP_SP;
        let d = `M${x},${busY[p]}`;
        for (const q of phases.slice(k + 1)) {
          const yb = busY[q];
          d += ` V${yb - HOP_R} A${HOP_R},${HOP_R} 0 0 1 ${x},${yb + HOP_R}`;
        }
        d += ` V${boxTop3}`;
        o.push(`<path class="cond${est ? " est" : ""}" d="${d}" style="stroke:${this._color(p, k)}"/>`);
        o.push(`<circle cx="${x}" cy="${busY[p]}" r="5" style="fill:${this._color(p, k)}"/>`);
      });
      o.push(`<rect class="box tp${est ? " est" : ""}" x="${xc - TP_W / 2}" y="${boxTop3}" width="${TP_W}" height="${TP_H}" rx="6"${est ? ` style="stroke:${ESTIMATED_COLOR}"` : ""}/>`);
      const txt = [];
      splitName(ld.name).forEach((l) => txt.push(["nm t3" + (est ? " estc" : ""), l]));
      txt.push(["nm small", this._t("n_phase").replace("{n}", ld.phases.length)]);
      txt.push(["w" + (!est && !ld.total ? " zero" : ""), est ? `${this._t("est")} ${fmtW(ld.estimated_w, 1000)}` : fmtW(ld.total)]);
      if (!est && ld.total) {
        // where the power goes, e.g. "all on L1" for a car that charges on one phase
        const active = ld.phases.filter((p) => (ld.perPhase[p] || 0) >= 1);
        if (active.length === 1 && ld.phases.length > 1) txt.push(["nm small", this._t("all_on").replace("{p}", active[0])]);
        else if (active.length > 1) txt.push(["nm small", active.map((p) => `${p} ${Math.round(ld.perPhase[p])}`).join(" · ")]);
      }
      txt.slice(0, 6).forEach(([cls, t], k) => o.push(`<text class="${cls}" x="${xc}" y="${boxTop3 + 19 + k * 16}" text-anchor="middle">${esc(t)}</text>`));
    });
    o.push("</svg>");
    return o.join("");
  }

  _render() {
    if (!this.shadowRoot) return;
    const title = this._config?.title;
    let body;
    if (this._error) {
      body = `<div class="msg">${esc(this._error === "no_entry" ? this._t("no_entry") : this._error)}</div>`;
    } else {
      const m = this._model();
      if (!m || (m.avgMode && !m.avg)) {
        body = `<div class="msg">${esc(this._avgError || this._t("loading"))}</div>`;
      } else {
        const dets = (m.live.detectors || []).map((d) =>
          `<span class="chip${d.on ? " on" : ""}">${esc(d.name)}: ${esc(d.on ? this._t("running") : this._t("not_running"))}</span>`).join("");
        const sub = m.avgMode ? this._t("average_days").replace("{d}", Number(this._config.days)) : this._t("live");
        body = `<div class="sub">${esc(sub)}</div><div class="diagram">${this._svg(m)}</div>${dets ? `<div class="chips">${dets}</div>` : ""}`;
      }
    }
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding: 12px 12px 14px; }
        .head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding: 0 4px 6px; }
        .title { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
        .sub { font-size: 12px; color: var(--secondary-text-color); padding: 0 4px 6px; }
        .diagram { overflow-x: auto; }
        svg { display:block; width:100%; min-width: 640px; height:auto; margin: 0 auto; }
        .fuse { fill: none; stroke: var(--primary-text-color); stroke-width: 1.5; }
        .fuse-t { font: 600 14px var(--ha-font-family-body, sans-serif); fill: var(--primary-text-color); }
        .fuse-s { font: 500 12px var(--code-font-family, monospace); fill: var(--secondary-text-color); }
        .bus { stroke-width: 6; stroke-linecap: round; }
        .ph { font: 600 15px var(--code-font-family, monospace); }
        .ph-avg { font: 500 12px var(--code-font-family, monospace); fill: var(--secondary-text-color); }
        .ph-avg.warn { fill: var(--error-color, #db4437); font-weight: 700; }
        .tap { stroke-width: 2; }
        .cond { fill: none; stroke-width: 2.5; stroke-linecap: round; }
        .cond.est { stroke-dasharray: 6 4; }
        .box { fill: var(--card-background-color, var(--ha-card-background, #fff)); stroke-width: 1.5; }
        .box.rest { fill: var(--secondary-background-color, transparent); stroke-dasharray: 4 3; }
        .box.est { stroke-dasharray: 5 4; }
        .box.tp { stroke: var(--primary-text-color); }
        .nm { font: 500 11.5px var(--ha-font-family-body, sans-serif); fill: var(--primary-text-color); }
        .nm.t3 { font-weight: 600; font-size: 12.5px; }
        .nm.estc { fill: ${ESTIMATED_COLOR}; }
        .nm.small { font-size: 10.5px; fill: var(--secondary-text-color); }
        .w { font: 600 13px var(--code-font-family, monospace); fill: var(--primary-text-color); }
        .w.zero { fill: var(--secondary-text-color); }
        .chips { display:flex; flex-wrap:wrap; gap:6px; padding: 8px 4px 0; }
        .chip { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.12)); color: var(--secondary-text-color); }
        .chip.on { background: ${ESTIMATED_COLOR}; color: #fff; }
        .msg { padding: 16px 4px; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        ${title ? `<div class="head"><span class="title">${esc(title)}</span></div>` : ""}
        ${body}
      </ha-card>`;
  }
}

class PhaseBusCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._renderForm();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    else this._renderForm();
  }

  _renderForm() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => ({
        entry_id: "Main fuse (HA Phase Map entry)", mode: "Values", days: "Average over (days)", title: "Title",
      }[s.name] || s.name);
      this._form.addEventListener("value-changed", (ev) => {
        this._config = { ...this._config, ...ev.detail.value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: "title", selector: { text: {} } },
      { name: "entry_id", selector: { config_entry: { integration: "phase_map" } } },
      { name: "mode", selector: { select: { mode: "dropdown", options: [
        { value: "live", label: "Live" }, { value: "average", label: "Average" }] } } },
      { name: "days", selector: { number: { min: 1, max: 90, mode: "box" } } },
    ];
  }
}

customElements.define("phase-bus-card", PhaseBusCard);
customElements.define("phase-bus-card-editor", PhaseBusCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "phase-bus-card",
  name: "Phase Bus Card",
  description: "Main fuse, one bus per phase, and every load on the phase it is connected to (HA Phase Map).",
  preview: false,
  documentationURL: "https://github.com/JanJoh/ha-phase-map-card",
});

console.info(`%c PHASE-BUS-CARD %c ${CARD_VERSION} `, "color:#fff;background:#3a7fc1;font-weight:700", "color:#3a7fc1");

// Just enough of a browser for the card to load and render under Node's test runner.
class FakeElement {
  constructor() { this.children = []; this.isConnected = false; this.shadowRoot = null; }
  attachShadow() { this.shadowRoot = { innerHTML: "" }; return this.shadowRoot; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener() {}
  dispatchEvent() { return true; }
}
const registry = new Map();
globalThis.HTMLElement = FakeElement;
globalThis.customElements = { get: (n) => registry.get(n), define: (n, c) => {
  if (registry.has(n)) throw new Error(`"${n}" has already been defined`);
  registry.set(n, c);
} };
globalThis.document = { createElement: () => new FakeElement() };
globalThis.window = globalThis;
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
module.exports = { registry };

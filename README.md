# HA Phase Map Card

A Home Assistant dashboard card that draws your main fuse as a single-line diagram: one bus
per phase, every load branching off the phase it is connected to, with live or average power.

![Phase bus card, light theme](images/card-light.png)

It needs the **[HA Phase Map](https://github.com/JanJoh/ha-phase-map)** integration, which
knows which load is on which phase and computes the values.

> [!IMPORTANT]
> The diagram is only as good as your main-fuse readings. HA Phase Map needs a **reliable,
> frequently updated current or power sensor for every phase at the main fuse** (for example a
> P1/HAN reader with per-phase values or a CT meter on the incoming cables). A house total or
> hourly supplier data is not enough. See
> [Before you start](https://github.com/JanJoh/ha-phase-map#before-you-start-you-need-a-reliable-meter-on-every-phase).

## What it shows

- The **main fuse** on the left, with its rating.
- One **bus per phase** in its own colour, labelled with the current against the fuse rating
  (live) or the average power (average). The label turns red when a phase is close to the fuse.
- **Single-phase loads** hang below their bus with their power, and an **Unmetered rest** box
  (dashed) shows what no meter accounts for.
- **Multi-phase loads** (EV charger, sauna, CEE outlet) on the right: one line per phase in the
  phase's colour, a dot where it joins its own bus, and a small arc where it crosses a bus it
  does not connect to. A charger that only uses one phase says so ("all on L1").
- **Estimated loads** (no meter) are dashed and show their estimate.
- **Meters behind other meters** (a garage's incoming meter with a CEE outlet and a heater
  behind it) are listed under that meter's box, with dots for the phases they use, followed
  by **Other**: what the meter measures beyond them.
- **Detectors** from the integration appear as chips under the diagram ("Sauna running").

Works in light and dark themes; on narrow screens the diagram scrolls sideways.

![Phase bus card, dark theme](images/card-dark.png)

## Installation

The repository is private while it is being tested, so install it manually for now:

1. Copy `dist/phase-bus-card.js` to `config/www/phase-bus-card.js`.
2. **Settings → Dashboards → ⋮ → Resources → Add resource**: URL
   `/local/phase-bus-card.js`, type **JavaScript module**.
3. Reload the browser.

Once public, it will be installable through HACS as a custom repository (category: Dashboard).

## Configuration

Add it from the card picker (**Phase Bus Card**), or in YAML:

```yaml
type: custom:phase-bus-card
title: Phase map
mode: live          # live (default) or average
days: 10            # average over this many days (mode: average)
entry_id: …         # optional: which main fuse, if you have more than one
colors:             # optional: phase colours
  L1: "#b8622a"
  L2: "#3a7fc1"
  L3: "#4f8f36"
```

| Option | Default | Meaning |
|---|---|---|
| `title` | none | Card heading |
| `mode` | `live` | `live` shows current values; `average` shows average power from long-term statistics |
| `days` | `10` | Averaging window for `mode: average` (1–90) |
| `entry_id` | first entry | The HA Phase Map config entry to draw |
| `colors` | brown / blue / green | Colour per phase name |

Load names wrap over two lines automatically; put a `|` in a load's name in HA Phase Map to
choose the break yourself (for example `Heat pump|compressor`).

## License

[MIT](LICENSE)

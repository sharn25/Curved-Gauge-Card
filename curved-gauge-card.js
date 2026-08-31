/**
 * Curved Gauge Card for Home Assistant
 * Ultra-high performance, lightweight semicircular curved arc gauge card.
 * Features curved textPath labels, boundary ticks, active bead marker, and dynamic HA GUI editor.
 */

class CurvedGaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._uid = Math.random().toString(36).substring(2, 9);
    this._cached = {};
    this._lastState = null;
    this._lastZone = -1;
  }

  static getStubConfig() {
    return {
      type: "custom:curved-gauge-card",
      entity: "sensor.temperature",
      title: "Temperature",
      preset: "temperature",
    };
  }

  static getPresets() {
    return {
      temperature: {
        min: 0,
        max: 40,
        unit: "°C",
        icon: "mdi:thermometer",
        center_label: "TEMPERATURE",
        segments: [
          { from: 0, to: 18, label: "Cold", color: "#38BDF8" },
          { from: 18, to: 26, label: "Ideal", color: "#10B981" },
          { from: 26, to: 40, label: "Hot", color: "#F43F5E" },
        ],
      },
      humidity: {
        min: 0,
        max: 100,
        unit: "%",
        icon: "mdi:water-percent",
        center_label: "HUMIDITY",
        segments: [
          { from: 0, to: 30, label: "Dry", color: "#F59E0B" },
          { from: 30, to: 60, label: "Comfort", color: "#10B981" },
          { from: 60, to: 100, label: "Humid", color: "#38BDF8" },
        ],
      },
      bmi: {
        min: 13.0,
        max: 37.0,
        unit: "",
        icon: "mdi:scale-bathroom",
        center_label: "BMI",
        segments: [
          { from: 13.0, to: 18.5, label: "Underweight", color: "#38BDF8" },
          { from: 18.5, to: 25.0, label: "Normal", color: "#10B981" },
          { from: 25.0, to: 37.0, label: "Overweight", color: "#F43F5E" },
        ],
      },
      battery: {
        min: 0,
        max: 100,
        unit: "%",
        icon: "mdi:battery-heart-variant",
        center_label: "BATTERY",
        segments: [
          { from: 0, to: 20, label: "Low", color: "#F43F5E" },
          { from: 20, to: 80, label: "Good", color: "#38BDF8" },
          { from: 80, to: 100, label: "Full", color: "#10B981" },
        ],
      },
      air_quality: {
        min: 0,
        max: 300,
        unit: "AQI",
        icon: "mdi:air-filter",
        center_label: "AIR QUALITY",
        segments: [
          { from: 0, to: 50, label: "Good", color: "#10B981" },
          { from: 50, to: 100, label: "Moderate", color: "#F59E0B" },
          { from: 100, to: 150, label: "Unhealthy", color: "#F97316" },
          { from: 150, to: 300, label: "Hazardous", color: "#F43F5E" },
        ],
      },
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    if (!config.entity && config.value === undefined) {
      throw new Error("Please specify an 'entity'.");
    }

    const presets = CurvedGaugeCard.getPresets();
    const preset = config.preset && presets[config.preset.toLowerCase()] ? presets[config.preset.toLowerCase()] : {};

    this._config = Object.assign(
      {
        title: "",
        subtitle: "",
        center_label: preset.center_label || undefined,
        icon: preset.icon || undefined,
        min: preset.min !== undefined ? preset.min : 0,
        max: preset.max !== undefined ? preset.max : 100,
        unit: preset.unit !== undefined ? preset.unit : undefined,
        gap: 6.0,
        stroke_width: 8,
        decimals: 1,
        show_header: true,
        show_labels: true,
        show_ticks: true,
        segments: preset.segments || [
          { from: 0, to: 33, label: "Low", color: "#38BDF8" },
          { from: 33, to: 66, label: "Normal", color: "#10B981" },
          { from: 66, to: 100, label: "High", color: "#F43F5E" },
        ],
      },
      config
    );

    this._lastState = null;
    this._lastZone = -1;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _getDimColor(hex) {
    if (!hex || !hex.startsWith("#")) return "rgba(127, 127, 127, 0.22)";
    let c = hex.substring(1);
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, 0.22)`;
  }

  _render() {
    const cfg = this._config;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          box-sizing: border-box;
        }
        ha-card {
          background: var(--ha-card-background, var(--card-background-color, var(--ha-card-background, #ffffff)));
          border-radius: var(--ha-card-border-radius, 12px);
          border-width: var(--ha-card-border-width, 1px);
          border-style: solid;
          border-color: var(--ha-card-border-color, var(--divider-color, rgba(127, 127, 127, 0.2)));
          box-shadow: var(--ha-card-box-shadow, none);
          box-sizing: border-box;
          padding: 16px 20px 20px 20px;
          font-family: var(--ha-card-font-family, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif);
          position: relative;
          overflow: hidden;
          cursor: pointer;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
          flex-shrink: 0;
        }
        .header-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .header-subtitle {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--secondary-text-color, #727272);
          opacity: 0.85;
        }
        .header-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
          letter-spacing: -0.3px;
        }
        .header-icon-badge {
          width: 38px;
          height: 38px;
          border-radius: var(--ha-card-border-radius, 12px);
          background: rgba(127, 127, 127, 0.06);
          border: 1px solid var(--ha-card-border-color, var(--divider-color, rgba(127, 127, 127, 0.12)));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-text-color, #212121);
          opacity: 0.85;
          flex-shrink: 0;
        }
        .header-icon-badge ha-icon {
          --mdc-icon-size: 20px;
        }
        .gauge-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 4px;
          flex: 1 1 auto;
          min-height: 0;
        }
        .gauge-svg {
          width: 100%;
          max-width: 340px;
          height: auto;
          aspect-ratio: 280 / 155;
          overflow: hidden;
          display: block;
        }
        .gauge-marker-group {
          will-change: transform;
          transition: transform 0.85s cubic-bezier(0.34, 1.4, 0.64, 1);
        }
        .marker-bead {
          transition: fill 0.3s ease;
        }
        .gauge-center-content {
          position: absolute;
          bottom: 4px;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          pointer-events: none;
        }
        .center-label {
          font-size: 11.5px;
          font-weight: 400;
          color: var(--primary-text-color, #212121);
          letter-spacing: 1px;
          text-transform: uppercase;
          opacity: 0.85;
          margin-bottom: 2px;
        }
        .center-val-box {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
        }
        .center-val {
          font-size: 24px;
          font-weight: 600;
          line-height: 1.05;
          letter-spacing: -0.5px;
          transition: color 0.3s ease;
        }
        .center-unit {
          font-size: 12px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
          opacity: 0.8;
        }
      </style>

      <ha-card id="card-root">
        ${cfg.show_header
        ? `
          <div class="header">
            <div class="header-text">
              ${cfg.subtitle ? `<span class="header-subtitle">${cfg.subtitle}</span>` : ""}
              <span class="header-title" id="card-title">${cfg.title || "Cult Smart Scale"}</span>
            </div>
            ${cfg.icon
          ? `
              <div class="header-icon-badge">
                <ha-icon icon="${cfg.icon}"></ha-icon>
              </div>
            `
          : ""
        }
          </div>
        `
        : ""
      }

        <div class="gauge-wrapper">
          <svg class="gauge-svg" viewBox="0 0 280 155">
            <defs>
              <path id="guide-outer-${this._uid}" d="M 28 146 A 112 112 0 0 1 252 146" fill="none" />
              <path id="guide-inner-${this._uid}" d="M 58 146 A 82 82 0 0 1 222 146" fill="none" />
            </defs>
            <g id="gauge-segments"></g>
            <text id="outer-labels" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-weight="300" font-size="12.5" fill="var(--secondary-text-color, #727272)"></text>
            <text id="inner-ticks" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-weight="500" font-size="10" fill="var(--secondary-text-color, #727272)" opacity="0.85"></text>
            <g id="marker-group" class="gauge-marker-group" transform="rotate(-180 140 146)">
              <circle cx="238" cy="146" r="8.5" id="marker-bead" class="marker-bead" fill="#10B981" />
            </g>
          </svg>

          <div class="gauge-center-content">
            <div class="center-label" id="center-label">${(cfg.center_label || "BMI").toUpperCase()}</div>
            <div class="center-val-box">
              <span class="center-val" id="center-val">--</span>
              <span class="center-unit" id="center-unit">${cfg.unit || ""}</span>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    // Click to open HA more-info dialog
    this.shadowRoot.getElementById("card-root").addEventListener("click", () => {
      if (this._config.entity) {
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId: this._config.entity },
            bubbles: true,
            composed: true,
          })
        );
      }
    });

    // Cache DOM references
    this._cached = {
      cardTitle: this.shadowRoot.getElementById("card-title"),
      centerLabel: this.shadowRoot.getElementById("center-label"),
      centerVal: this.shadowRoot.getElementById("center-val"),
      centerUnit: this.shadowRoot.getElementById("center-unit"),
      markerGroup: this.shadowRoot.getElementById("marker-group"),
      markerBead: this.shadowRoot.getElementById("marker-bead"),
      segmentsContainer: this.shadowRoot.getElementById("gauge-segments"),
      labelsContainer: this.shadowRoot.getElementById("outer-labels"),
      ticksContainer: this.shadowRoot.getElementById("inner-ticks"),
      segmentPaths: [],
      labelPaths: [],
    };

    this._buildStaticSVG();
    this._update(true);
  }

  _buildStaticSVG() {
    const cfg = this._config;
    const el = this._cached;
    if (!cfg || !el.segmentsContainer) return;

    const min = parseFloat(cfg.min);
    const max = parseFloat(cfg.max);
    const totalRange = max - min || 1;
    const segments = cfg.segments || [];
    const gapDeg = parseFloat(cfg.gap !== undefined ? cfg.gap : 6.0);
    const strokeWidth = parseFloat(cfg.stroke_width || 8);

    const cx = 140;
    const cy = 146;
    const r = 98;
    const N = segments.length;

    let segHtml = "";
    let labelHtml = "";

    segments.forEach((seg, i) => {
      const from = parseFloat(seg.from !== undefined ? seg.from : min);
      const to = parseFloat(seg.to !== undefined ? seg.to : max);

      const fStart = Math.max(0, Math.min(1, (from - min) / totalRange));
      const fEnd = Math.max(0, Math.min(1, (to - min) / totalRange));

      let startDeg = -180 + fStart * 180;
      let endDeg = -180 + fEnd * 180;

      if (N > 1) {
        if (i > 0) startDeg += gapDeg / 2;
        if (i < N - 1) endDeg -= gapDeg / 2;
      }

      const rad1 = (startDeg * Math.PI) / 180;
      const rad2 = (endDeg * Math.PI) / 180;
      const x1 = cx + r * Math.cos(rad1);
      const y1 = cy + r * Math.sin(rad1);
      const x2 = cx + r * Math.cos(rad2);
      const y2 = cy + r * Math.sin(rad2);
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;

      const activeColor = seg.color || "#10B981";
      const dimColor = seg.dimColor || this._getDimColor(activeColor);

      segHtml += `
        <path id="seg-${i}" d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}"
              stroke="${dimColor}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"
              style="transition: stroke 0.3s ease;" />
      `;

      if (cfg.show_labels && seg.label) {
        const midFraction = (fStart + fEnd) / 2;
        const offsetPercent = Math.round(midFraction * 100);
        labelHtml += `
          <textPath id="label-${i}" href="#guide-outer-${this._uid}" startOffset="${offsetPercent}%" text-anchor="middle"
                    fill="var(--secondary-text-color, #9ca3af)" font-weight="300" style="transition: fill 0.3s ease;">
            ${seg.label}
          </textPath>
        `;
      }
    });

    el.segmentsContainer.innerHTML = segHtml;
    el.labelsContainer.innerHTML = labelHtml;

    if (cfg.show_ticks) {
      const ticks = [{ val: min, fraction: 0 }];
      segments.forEach((seg) => {
        const to = parseFloat(seg.to);
        const f = Math.max(0, Math.min(1, (to - min) / totalRange));
        ticks.push({ val: to, fraction: f });
      });

      let ticksHtml = "";
      ticks.forEach((t) => {
        let offset = t.fraction * 100;
        if (t.fraction <= 0.01) offset = 4;
        else if (t.fraction >= 0.99) offset = 96;

        const valStr = Number.isInteger(t.val) ? t.val.toString() : t.val.toFixed(1);
        ticksHtml += `<textPath href="#guide-inner-${this._uid}" startOffset="${offset.toFixed(1)}%" text-anchor="middle">${valStr}</textPath>`;
      });
      el.ticksContainer.innerHTML = ticksHtml;
    } else {
      el.ticksContainer.innerHTML = "";
    }

    el.segmentPaths = segments.map((_, i) => this.shadowRoot.getElementById(`seg-${i}`));
    el.labelPaths = segments.map((_, i) => this.shadowRoot.getElementById(`label-${i}`));
  }

  _update(force = false) {
    const cfg = this._config;
    const el = this._cached;
    if (!el || !el.centerVal) return;

    let rawVal = null;
    let isAvailable = false;

    if (cfg.entity && this._hass && this._hass.states[cfg.entity]) {
      const entityState = this._hass.states[cfg.entity];
      const parsed = parseFloat(entityState.state);
      if (!isNaN(parsed)) {
        rawVal = parsed;
        isAvailable = true;
      }
    } else if (cfg.value !== undefined) {
      const parsed = parseFloat(cfg.value);
      if (!isNaN(parsed)) {
        rawVal = parsed;
        isAvailable = true;
      }
    }

    const stateStr = isAvailable ? String(rawVal) : "--";
    if (!force && this._lastState === stateStr) return;
    this._lastState = stateStr;

    const min = parseFloat(cfg.min);
    const max = parseFloat(cfg.max);
    const totalRange = max - min || 1;
    const decimals = parseInt(cfg.decimals !== undefined ? cfg.decimals : 1, 10);
    const segments = cfg.segments || [];

    let activeZoneIndex = -1;
    if (isAvailable) {
      for (let i = 0; i < segments.length; i++) {
        const from = parseFloat(segments[i].from !== undefined ? segments[i].from : min);
        const to = parseFloat(segments[i].to !== undefined ? segments[i].to : max);
        if (i === segments.length - 1) {
          if (rawVal >= from && rawVal <= to) { activeZoneIndex = i; break; }
        } else {
          if (rawVal >= from && rawVal < to) { activeZoneIndex = i; break; }
        }
      }
      if (activeZoneIndex === -1) {
        if (rawVal < min) activeZoneIndex = 0;
        else if (rawVal > max) activeZoneIndex = segments.length - 1;
      }
    }

    let friendlyName = cfg.title;
    let centerLabel = cfg.center_label;
    let unit = cfg.unit !== undefined ? cfg.unit : "";

    if (cfg.entity && this._hass && this._hass.states[cfg.entity]) {
      const entityState = this._hass.states[cfg.entity];
      if (!friendlyName && entityState.attributes && entityState.attributes.friendly_name) {
        friendlyName = entityState.attributes.friendly_name;
      }
      if (!centerLabel) {
        centerLabel = (friendlyName || "VALUE").toUpperCase();
      }
      if (cfg.unit === undefined && entityState.attributes && entityState.attributes.unit_of_measurement) {
        unit = entityState.attributes.unit_of_measurement;
      }
    }
    if (!centerLabel) centerLabel = (friendlyName || "VALUE").toUpperCase();

    const activeColor = activeZoneIndex >= 0 ? segments[activeZoneIndex]?.color || "#10B981" : "#10B981";

    if (el.cardTitle && friendlyName) el.cardTitle.textContent = friendlyName;
    if (el.centerLabel && centerLabel) el.centerLabel.textContent = centerLabel.toUpperCase();
    if (el.centerUnit) el.centerUnit.textContent = unit;

    if (el.centerVal) {
      el.centerVal.textContent = isAvailable ? (decimals > 0 ? rawVal.toFixed(decimals) : Math.round(rawVal).toString()) : "--";
      el.centerVal.style.color = activeColor;
    }

    // Update segment colors only if zone changed or on force
    if (force || this._lastZone !== activeZoneIndex) {
      this._lastZone = activeZoneIndex;
      segments.forEach((seg, i) => {
        const path = el.segmentPaths[i];
        const label = el.labelPaths[i];
        const segActiveColor = seg.color || "#10B981";
        const segDimColor = seg.dimColor || this._getDimColor(segActiveColor);
        const isCurrentActive = i === activeZoneIndex;

        if (path) {
          path.setAttribute("stroke", isCurrentActive ? segActiveColor : segDimColor);
        }
        if (label) {
          label.setAttribute("fill", isCurrentActive ? segActiveColor : "var(--secondary-text-color, #9ca3af)");
          label.setAttribute("font-weight", isCurrentActive ? "600" : "300");
        }
      });
    }

    // Update marker bead position
    const fraction = isAvailable ? Math.max(0, Math.min(1, (rawVal - min) / totalRange)) : 0;
    const angle = -180 + fraction * 180;

    if (el.markerGroup && el.markerBead) {
      el.markerGroup.setAttribute("transform", `rotate(${angle.toFixed(1)} 140 146)`);
      el.markerBead.setAttribute("fill", activeColor);
      el.markerBead.style.opacity = isAvailable ? "1" : "0.5";
    }
  }

  static async getConfigElement() {
    return document.createElement("curved-gauge-card-editor");
  }

  getCardSize() {
    return 5;
  }

  // Sections view (HA 2024.11+). Cell is 56px + 8px gap.
  // Header + 280x155 viewBox need about 5 rows; 4 is the floor so the
  // visual editor cannot persist rows: 2 and overflow into the next section.
  getGridOptions() {
    return {
      columns: 6,
      min_columns: 3,
      rows: 5,
      min_rows: 4,
    };
  }
}

/**
 * Native Home Assistant Visual Card Editor
 */
class CurvedGaugeCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._haForm) this._haForm.hass = hass;
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    if (!this._config) return;
    const value = ev.detail.value;

    let newConfig = Object.assign({}, this._config, value);

    if (value.preset && value.preset !== this._config.preset) {
      if (value.preset === "custom") {
        newConfig.preset = "custom";
      } else {
        const presets = CurvedGaugeCard.getPresets();
        if (presets[value.preset]) {
          const p = presets[value.preset];
          newConfig.min = p.min;
          newConfig.max = p.max;
          newConfig.unit = p.unit;
          newConfig.icon = p.icon;
          newConfig.center_label = p.center_label;
          newConfig.segments = p.segments;
        }
      }
    }

    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
    this._render();
  }

  _getSchema() {
    return [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "sensor" } },
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "title", selector: { text: {} } },
          { name: "subtitle", selector: { text: {} } },
        ],
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "center_label", selector: { text: {} } },
          { name: "icon", selector: { icon: {} } },
        ],
      },
      {
        name: "preset",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "custom", label: "⚙️ Custom (Manual Values)" },
              { value: "temperature", label: "🌡️ Temperature (°C)" },
              { value: "humidity", label: "💧 Humidity (%)" },
              { value: "bmi", label: "⚖️ BMI (Body Mass Index)" },
              { value: "battery", label: "🔋 Battery Level (%)" },
              { value: "air_quality", label: "🍃 Air Quality (AQI)" },
            ],
          },
        },
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "min", selector: { number: { mode: "box", step: "any" } } },
          { name: "max", selector: { number: { mode: "box", step: "any" } } },
        ],
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "unit", selector: { text: {} } },
          { name: "decimals", selector: { number: { min: 0, max: 3, mode: "box" } } },
        ],
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "show_header", selector: { boolean: {} } },
          { name: "show_labels", selector: { boolean: {} } },
          { name: "show_ticks", selector: { boolean: {} } },
        ],
      },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      entity: "Entity",
      title: "Card Title",
      subtitle: "Category Subtitle",
      center_label: "Center Text Label",
      icon: "Top Badge Icon",
      preset: "Configuration Preset",
      min: "Min Scale Value",
      max: "Max Scale Value",
      unit: "Unit of Measurement",
      decimals: "Decimal Places",
      show_header: "Show Header",
      show_labels: "Show Category Labels",
      show_ticks: "Show Boundary Ticks",
    };
    return labels[schema.name] || schema.name;
  }

  _render() {
    if (!this._haForm) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          ha-form { display: block; margin-bottom: 12px; }
        </style>
        <ha-form id="form"></ha-form>
      `;
      this._haForm = this.shadowRoot.getElementById("form");
      this._haForm.computeLabel = (s) => this._computeLabel(s);
      this._haForm.addEventListener("value-changed", (ev) => this._valueChanged(ev));
    }

    if (this._hass) this._haForm.hass = this._hass;

    this._haForm.data = Object.assign(
      {
        preset: "temperature",
        min: 0,
        max: 40,
        show_header: true,
        show_labels: true,
        show_ticks: true,
      },
      this._config
    );
    this._haForm.schema = this._getSchema();
  }
}

// Custom Element Registration
if (!customElements.get("curved-gauge-card-editor")) {
  customElements.define("curved-gauge-card-editor", CurvedGaugeCardEditor);
}
if (!customElements.get("curved-gauge-card")) {
  customElements.define("curved-gauge-card", CurvedGaugeCard);
}

// Register in Home Assistant Card Picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "curved-gauge-card",
  name: "Curved Gauge Card",
  description: "A clean, modern semicircular curved segmented arc gauge card.",
  preview: true,
  documentationURL: "https://github.com/sharanjit/cult_smart_scale",
});

console.info(
  "%c GAUGE-CARD %c v1.0.2 ",
  "color: white; background: #10B981; font-weight: bold; border-radius: 4px;",
  "color: #10B981; background: transparent;"
);

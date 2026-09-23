(function () {
  "use strict";

  const root = document.getElementById("iio409-hydrology-lab");
  if (!root) return;

  const accessHash = "36fc57e55deb94fde8aeb37e645788652a030c6ff7513330c1f4d5bf0e868b82";
  const accessKey = "iio409-hydrology-lab-access";
  const accessLifetime = 12 * 60 * 60 * 1000;
  const mode = root.dataset.hmlMode;
  const dataBase = "/courses/iio409-modelacionhidrologica/hydrological-lab/data/";
  const dayMilliseconds = 86400000;
  if (mode === "app" && !window.HydroLabEngine) return;

  const modelCatalog = {
    tuw: {
      name: "TUWmodel",
      summary: "HBV-type model with explicit snow, soil-moisture and response routines.",
      structure: "14 adjustable values in this lab; Tr and Ts share the effective Twb phase threshold.",
      parameters: [
        ["SCF", "Snow correction factor", "–", 0.9, 1.5, 1.2, 0.01],
        ["DDF", "Degree-day melt factor", "mm °C⁻¹ d⁻¹", 0, 5, 1.2, 0.05],
        ["Twb", "Shared rain/snow threshold (Tr = Ts)", "°C", -3, 3, 0, 0.1],
        ["Tm", "Melt threshold temperature", "°C", -2, 2, 0, 0.1],
        ["LPrat", "PET-reduction threshold ratio", "–", 0, 1, 0.9, 0.01],
        ["FC", "Maximum soil-moisture storage", "mm", 1, 600, 100, 1],
        ["Beta", "Non-linearity of runoff production", "–", 0, 20, 3.3, 0.1],
        ["k0", "Very-fast response coefficient", "d", 0.01, 2, 0.5, 0.01],
        ["k1", "Fast response coefficient", "d", 2, 30, 9, 0.1],
        ["k2", "Slow/baseflow response coefficient", "d", 30, 250, 105, 1],
        ["lsuz", "Upper-store activation threshold", "mm", 1, 100, 50, 1],
        ["cperc", "Maximum percolation rate", "mm d⁻¹", 0, 8, 2, 0.1],
        ["bmax", "Maximum routing base", "d", 0, 30, 10, 0.5],
        ["croute", "Flow-dependent routing scale", "d² mm⁻¹", 0, 50, 26.5, 0.5]
      ]
    },
    gr4j: {
      name: "GR4J",
      summary: "Parsimonious four-parameter daily rainfall-runoff model.",
      structure: "Production store, two unit hydrographs, groundwater exchange and routing store.",
      parameters: [
        ["X1", "Production-store capacity", "mm", 50, 500, 350, 1],
        ["X2", "Intercatchment exchange coefficient", "mm d⁻¹", -5, 5, 0, 0.1],
        ["X3", "Routing-store capacity", "mm", 20, 500, 90, 1],
        ["X4", "Unit-hydrograph time constant", "d", 0.8, 3, 1.7, 0.01]
      ]
    },
    "gr6j-cemaneige": {
      name: "GR6J-CemaNeige",
      summary: "Five-band degree-day snow accounting feeding the six-parameter GR6J model.",
      structure: "GR6J adds an exchange threshold and exponential store; CemaNeige adds thermal memory and melt intensity.",
      parameters: [
        ["X1", "Production-store capacity", "mm", 50, 500, 350, 1],
        ["X2", "Intercatchment exchange coefficient", "mm d⁻¹", -5, 5, 0, 0.1],
        ["X3", "Routing-store capacity", "mm", 20, 500, 90, 1],
        ["X4", "Unit-hydrograph time constant", "d", 0.8, 3, 1.7, 0.01],
        ["X5", "Exchange threshold", "–", -5, 5, 0, 0.1],
        ["X6", "Exponential-store scale", "mm", 5, 50, 20, 0.5],
        ["Ctg", "Snowpack thermal-memory coefficient", "–", 0.01, 1, 0.5, 0.01],
        ["Kf", "Degree-day melt coefficient", "mm °C⁻¹ d⁻¹", 2, 6, 3, 0.05]
      ]
    }
  };

  const imageBase = "/courses/iio409-modelacionhidrologica/hydrological-lab/images/";
  const modelFigures = {
    tuw: {
      src: `${imageBase}tuwmodel-conceptual.webp`,
      alt: "Conceptual diagram of TUWmodel hydrological processes, stores, fluxes and parameters"
    },
    gr4j: {
      src: `${imageBase}gr4j-conceptual.webp`,
      alt: "Conceptual diagram of GR4J hydrological processes, stores, fluxes and parameters"
    },
    "gr6j-cemaneige": {
      src: `${imageBase}gr6j-cemaneige-conceptual.webp`,
      alt: "Conceptual diagram of GR6J-CemaNeige hydrological processes, stores, fluxes and parameters"
    }
  };
  const catchmentFigures = {
    9414001: {
      src: `${imageBase}catchment-trancura-9414001.webp`,
      alt: "Map of the Trancura River catchment upstream of the Llafenco streamflow station"
    },
    7336001: {
      src: `${imageBase}catchment-cauquenes-7336001.webp`,
      alt: "Map of the Cauquenes catchment study area and its hydroclimatic characteristics"
    }
  };

  const selectors = {
    login: root.querySelector("[data-hml-login]"),
    loginForm: root.querySelector("[data-hml-login-form]"),
    loginError: root.querySelector("[data-hml-login-error]"),
    launchFallback: root.querySelector("[data-hml-launch-fallback]"),
    app: root.querySelector("[data-hml-app]"),
    dataset: root.querySelector("[data-hml-dataset]"),
    model: root.querySelector("[data-hml-model]"),
    parameters: root.querySelector("[data-hml-parameters]"),
    ranges: root.querySelector("[data-hml-ranges]"),
    rangeError: root.querySelector("[data-hml-range-error]"),
    view: root.querySelector("[data-hml-view]"),
    dateStart: root.querySelector("[data-hml-date-start]"),
    dateEnd: root.querySelector("[data-hml-date-end]"),
    timeStart: root.querySelector("[data-hml-time-start]"),
    timeEnd: root.querySelector("[data-hml-time-end]"),
    timeOutput: root.querySelector("[data-hml-time-output]"),
    canvas: root.querySelector("[data-hml-canvas]"),
    navigatorCanvas: root.querySelector("[data-hml-navigator-canvas]"),
    tooltip: root.querySelector("[data-hml-tooltip]"),
    runStatus: root.querySelector("[data-hml-run-status]"),
    context: root.querySelector("[data-hml-context]"),
    chartTitle: root.querySelector("[data-hml-chart-title]"),
    factTitle: root.querySelector("[data-hml-fact-title]"),
    facts: root.querySelector("[data-hml-facts]")
  };

  const state = {
    cache: new Map(), dataset: null, result: null, parameterDefinitions: [],
    runTimer: null, initialised: false, startIndex: 0, endIndex: 0,
    chartGeometry: null
  };

  function parameterDefinitions(modelKey) {
    return modelCatalog[modelKey].parameters.map((entry) => ({
      key: entry[0], description: entry[1], unit: entry[2], min: entry[3],
      max: entry[4], defaultValue: entry[5], value: entry[5], step: entry[6]
    }));
  } // parameterDefinitions END

  function precision(step) {
    const text = String(step);
    return text.includes(".") ? text.split(".")[1].length : 0;
  } // precision END

  function formatValue(value, step) {
    return Number(value).toFixed(Math.min(3, precision(step)));
  } // formatValue END

  function setSliderFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const fill = max > min ? (Number(input.value) - min) / (max - min) * 100 : 0;
    input.style.setProperty("--fill", `${Math.max(0, Math.min(100, fill))}%`);
  } // setSliderFill END

  function renderParameters() {
    selectors.parameters.replaceChildren();
    selectors.ranges.replaceChildren();
    for (const definition of state.parameterDefinitions) {
      const wrapper = document.createElement("div");
      wrapper.className = "hml-parameter";
      wrapper.innerHTML = `
        <div class="hml-parameter-label">
          <label for="hml-param-${definition.key}">${definition.key}</label>
          <output for="hml-param-${definition.key}"></output>
        </div>
        <small title="${definition.description}">${definition.description}</small>
        <input id="hml-param-${definition.key}" type="range">
        <div class="hml-parameter-bounds"><span></span><span></span></div>`;
      const input = wrapper.querySelector("input");
      const output = wrapper.querySelector("output");
      const bounds = wrapper.querySelectorAll(".hml-parameter-bounds span");
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step;
      input.value = definition.value;
      output.textContent = `${formatValue(definition.value, definition.step)} ${definition.unit}`;
      bounds[0].textContent = `${definition.min} ${definition.unit}`;
      bounds[1].textContent = `${definition.max} ${definition.unit}`;
      setSliderFill(input);
      input.addEventListener("input", () => {
        definition.value = Number(input.value);
        output.textContent = `${formatValue(definition.value, definition.step)} ${definition.unit}`;
        setSliderFill(input);
        scheduleSimulation();
      });
      selectors.parameters.appendChild(wrapper);

      const rangeRow = document.createElement("div");
      rangeRow.className = "hml-range-row";
      rangeRow.innerHTML = `
        <label>${definition.key}</label>
        <input type="number" aria-label="${definition.key} minimum" data-range="min">
        <input type="number" aria-label="${definition.key} maximum" data-range="max">`;
      const rangeInputs = rangeRow.querySelectorAll("input");
      rangeInputs[0].value = definition.min;
      rangeInputs[1].value = definition.max;
      rangeInputs[0].step = definition.step;
      rangeInputs[1].step = definition.step;
      rangeRow.dataset.parameter = definition.key;
      selectors.ranges.appendChild(rangeRow);
    }
  } // renderParameters END

  async function loadDataset(id) {
    if (state.cache.has(id)) return state.cache.get(id);
    selectors.runStatus.textContent = "Loading CAMELS-CL data…";
    const response = await fetch(`${dataBase}${id}.json`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Dataset ${id} could not be loaded (${response.status}).`);
    const dataset = await response.json();
    state.cache.set(id, dataset);
    return dataset;
  } // loadDataset END

  function isoDate(index) {
    const start = new Date(`${state.dataset.daily.start}T00:00:00Z`);
    return new Date(start.getTime() + index * dayMilliseconds).toISOString().slice(0, 10);
  } // isoDate END

  function indexFromDate(value) {
    const start = Date.parse(`${state.dataset.daily.start}T00:00:00Z`);
    const target = Date.parse(`${value}T00:00:00Z`);
    return Math.round((target - start) / dayMilliseconds);
  } // indexFromDate END

  function configureDates() {
    const maximumIndex = state.dataset.daily.count - 1;
    const minimumDate = state.dataset.daily.start;
    const maximumDate = isoDate(maximumIndex);
    selectors.dateStart.min = minimumDate;
    selectors.dateStart.max = maximumDate;
    selectors.dateEnd.min = minimumDate;
    selectors.dateEnd.max = maximumDate;
    selectors.dateStart.value = "2014-01-01";
    selectors.dateEnd.value = "2019-12-31";
    state.startIndex = Math.max(0, indexFromDate(selectors.dateStart.value));
    state.endIndex = Math.min(maximumIndex, indexFromDate(selectors.dateEnd.value));
    selectors.timeStart.min = 0;
    selectors.timeStart.max = maximumIndex;
    selectors.timeEnd.min = 0;
    selectors.timeEnd.max = maximumIndex;
    synchroniseWindowControls();
  } // configureDates END

  function synchroniseWindowControls() {
    selectors.dateStart.value = isoDate(state.startIndex);
    selectors.dateEnd.value = isoDate(state.endIndex);
    selectors.timeStart.value = state.startIndex;
    selectors.timeEnd.value = state.endIndex;
    selectors.timeOutput.textContent = `${isoDate(state.startIndex)} – ${isoDate(state.endIndex)}`;
  } // synchroniseWindowControls END

  function refreshWindow() {
    synchroniseWindowControls();
    drawPlot();
    drawNavigator();
    updateMetrics();
  } // refreshWindow END

  function redrawCharts() {
    drawPlot();
    drawNavigator();
  } // redrawCharts END

  function updateDateWindow() {
    let start = Math.max(0, indexFromDate(selectors.dateStart.value));
    let end = Math.min(state.dataset.daily.count - 1, indexFromDate(selectors.dateEnd.value));
    if (start > end) {
      if (document.activeElement === selectors.dateStart) end = start;
      else start = end;
    }
    state.startIndex = start;
    state.endIndex = end;
    refreshWindow();
  } // updateDateWindow END

  function updateSliderWindow(event) {
    let start = Number(selectors.timeStart.value);
    let end = Number(selectors.timeEnd.value);
    if (start > end) {
      if (event.currentTarget === selectors.timeStart) end = start;
      else start = end;
    }
    state.startIndex = start;
    state.endIndex = end;
    refreshWindow();
  } // updateSliderWindow END

  function scheduleSimulation() {
    window.clearTimeout(state.runTimer);
    selectors.runStatus.textContent = "Running…";
    state.runTimer = window.setTimeout(runSimulation, 70);
  } // scheduleSimulation END

  function runSimulation() {
    if (!state.dataset) return;
    const start = performance.now();
    const values = state.parameterDefinitions.map((definition) => definition.value);
    state.result = window.HydroLabEngine.runModel(state.dataset, selectors.model.value, values);
    const elapsed = performance.now() - start;
    selectors.runStatus.textContent = `Updated in ${elapsed.toFixed(0)} ms`;
    selectors.context.textContent = `${state.dataset.catchment.name} · ${state.dataset.catchment.id}`;
    updateFacts();
    drawPlot();
    drawNavigator();
    updateMetrics();
  } // runSimulation END

  function mean(values) {
    if (values.length === 0) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  } // mean END

  function updateMetrics() {
    if (!state.result) return;
    const observed = [];
    const simulated = [];
    for (let i = state.startIndex; i <= state.endIndex; i += 1) {
      if (Number.isFinite(state.result.qobs[i]) && Number.isFinite(state.result.q[i])) {
        observed.push(state.result.qobs[i]);
        simulated.push(state.result.q[i]);
      }
    }
    const observedMean = mean(observed);
    const simulatedMean = mean(simulated);
    let covariance = 0;
    let observedVariance = 0;
    let simulatedVariance = 0;
    let squaredError = 0;
    for (let i = 0; i < observed.length; i += 1) {
      covariance += (observed[i] - observedMean) * (simulated[i] - simulatedMean);
      observedVariance += (observed[i] - observedMean) ** 2;
      simulatedVariance += (simulated[i] - simulatedMean) ** 2;
      squaredError += (simulated[i] - observed[i]) ** 2;
    }
    const correlation = covariance / Math.sqrt(observedVariance * simulatedVariance);
    const rSquared = correlation ** 2;
    const alpha = Math.sqrt(simulatedVariance / observedVariance);
    const beta = simulatedMean / observedMean;
    const kge = 1 - Math.sqrt((correlation - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2);
    const nse = 1 - squaredError / observedVariance;
    const rmse = Math.sqrt(squaredError / observed.length);
    const pbias = 100 * (simulated.reduce((sum, value) => sum + value, 0) -
      observed.reduce((sum, value) => sum + value, 0)) /
      observed.reduce((sum, value) => sum + value, 0);
    const metric = (name, value, suffix = "") => {
      const element = root.querySelector(`[data-hml-metric="${name}"]`);
      element.textContent = Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—";
    };
    metric("kge", kge);
    metric("nse", nse);
    metric("r", correlation);
    metric("r2", rSquared);
    metric("rmse", rmse, " mm/d");
    metric("pbias", pbias, "%");
    metric("pairs", observed.length, " d");
  } // updateMetrics END

  const seriesStyles = {
    p: { label: "Precipitation", color: "#7dd3fc", type: "bar" },
    rain: { label: "Rainfall", color: "#0284c7" },
    snow: { label: "Snowfall", color: "#bae6fd" },
    pet: { label: "Potential ET", color: "#006400", width: 1.8 },
    aet: { label: "Actual ET", color: "#90ee90", dash: [10, 5], width: 2 },
    swe: { label: "Snow water equivalent", color: "#2563eb" },
    soil: { label: "Soil moisture", color: "#6366f1" },
    baseflow: { label: "Baseflow", color: "#8b3e2f" },
    quickflow: { label: "Quickflow", color: "#8b5cf6" },
    q: { label: "Simulated Q", color: "#0000ff", width: 1.8 },
    qobs: { label: "Observed Q", color: "#111827", width: 1.5 }
  };

  function panelDefinitions(view) {
    const flux = { title: "Precipitation phase", unit: "mm/d", keys: ["p", "rain", "snow"] };
    const evap = { title: "Evaporation", unit: "mm/d", keys: ["pet", "aet"] };
    const snowState = { title: "Snow water equivalent", unit: "mm", keys: ["swe"] };
    const soilState = { title: "Soil moisture", unit: "mm", keys: ["soil"] };
    const flow = { title: "Outlet streamflow and components", unit: "mm/d", keys: ["qobs", "q", "baseflow", "quickflow"] };
    if (view === "flow") return [flow];
    if (view === "snow-soil") return [flux, snowState, soilState];
    if (view === "water-balance") return [flux, evap, flow];
    return [flux, evap, snowState, soilState, flow];
  } // panelDefinitions END

  function binnedSeries(values, start, end, bins) {
    const length = end - start + 1;
    const binCount = Math.min(length, bins);
    const output = new Float64Array(binCount);
    output.fill(NaN);
    for (let bin = 0; bin < binCount; bin += 1) {
      const first = start + Math.floor(bin * length / binCount);
      const last = start + Math.floor((bin + 1) * length / binCount) - 1;
      let sum = 0;
      let count = 0;
      for (let i = first; i <= last; i += 1) {
        if (Number.isFinite(values[i])) {
          sum += values[i];
          count += 1;
        }
      }
      if (count > 0) output[bin] = sum / count;
    }
    return output;
  } // binnedSeries END

  function drawNavigator() {
    if (!state.result || !selectors.navigatorCanvas) return;
    const canvas = selectors.navigatorCanvas;
    const cssWidth = Math.max(320, canvas.clientWidth || 760);
    const cssHeight = 62;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.fillStyle = "#f1f5f9";
    context.fillRect(0, 0, cssWidth, cssHeight);

    const maximumIndex = state.dataset.daily.count - 1;
    const values = binnedSeries(state.result.qobs, 0, maximumIndex, Math.floor(cssWidth));
    let maximum = 0;
    for (const value of values) if (Number.isFinite(value)) maximum = Math.max(maximum, value);
    maximum = maximum > 0 ? maximum : 1;
    context.strokeStyle = "#8da0bd";
    context.lineWidth = 1.25;
    context.beginPath();
    let penDown = false;
    for (let i = 0; i < values.length; i += 1) {
      if (!Number.isFinite(values[i])) {
        penDown = false;
        continue;
      }
      const x = values.length === 1 ? 0 : i / (values.length - 1) * cssWidth;
      const y = cssHeight - 5 - values[i] / maximum * (cssHeight - 10);
      if (!penDown) context.moveTo(x, y);
      else context.lineTo(x, y);
      penDown = true;
    }
    context.stroke();

    const startX = state.startIndex / maximumIndex * cssWidth;
    const endX = state.endIndex / maximumIndex * cssWidth;
    context.fillStyle = "rgb(37 99 235 / 16%)";
    context.fillRect(startX, 0, endX - startX, cssHeight);
    context.fillStyle = "rgb(255 255 255 / 68%)";
    context.fillRect(0, 0, startX, cssHeight);
    context.fillRect(endX, 0, cssWidth - endX, cssHeight);
    context.strokeStyle = "#2563eb";
    context.lineWidth = 1.5;
    context.strokeRect(startX, 0.75, Math.max(1, endX - startX), cssHeight - 1.5);
  } // drawNavigator END

  function drawPlot() {
    if (!state.result) return;
    const canvas = selectors.canvas;
    const panels = panelDefinitions(selectors.view.value);
    const cssWidth = Math.max(480, canvas.clientWidth || 900);
    const cssHeight = panels.length === 1 ? 470 : panels.length === 2 ? 560 :
      panels.length === 3 ? 640 : panels.length === 4 ? 710 : 860;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, cssWidth, cssHeight);

    const margin = { left: 58, right: 18, top: 10, bottom: 34 };
    const gap = 18;
    const plotWidth = cssWidth - margin.left - margin.right;
    const panelHeight = (cssHeight - margin.top - margin.bottom - gap * (panels.length - 1)) /
      panels.length;
    const binCount = Math.max(40, Math.floor(plotWidth));
    const cached = new Map();
    const getBinned = (key) => {
      if (!cached.has(key)) {
        cached.set(key, binnedSeries(state.result[key], state.startIndex, state.endIndex, binCount));
      }
      return cached.get(key);
    };

    panels.forEach((panel, panelIndex) => {
      const top = margin.top + panelIndex * (panelHeight + gap);
      let maximum = 0;
      for (const key of panel.keys) {
        const values = getBinned(key);
        for (const value of values) if (Number.isFinite(value)) maximum = Math.max(maximum, value);
      }
      maximum = maximum > 0 ? maximum * 1.08 : 1;

      context.strokeStyle = "#e7eaf0";
      context.lineWidth = 1;
      context.fillStyle = "#667085";
      context.font = "11px Inter, sans-serif";
      context.textAlign = "right";
      context.textBaseline = "middle";
      for (let tick = 0; tick <= 4; tick += 1) {
        const y = top + panelHeight - tick / 4 * panelHeight;
        context.beginPath();
        context.moveTo(margin.left, y);
        context.lineTo(margin.left + plotWidth, y);
        context.stroke();
        context.fillText((maximum * tick / 4).toFixed(maximum < 10 ? 1 : 0), margin.left - 7, y);
      }
      context.save();
      context.translate(13, top + panelHeight / 2);
      context.rotate(-Math.PI / 2);
      context.textAlign = "center";
      context.fillText(panel.unit, 0, 0);
      context.restore();

      let legendX = margin.left + 4;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.font = "600 10px Inter, sans-serif";
      for (const key of panel.keys) {
        const style = seriesStyles[key];
        context.strokeStyle = style.color;
        context.fillStyle = style.color;
        context.lineWidth = style.width || 1.4;
        context.setLineDash(style.dash || []);
        context.beginPath();
        context.moveTo(legendX, top + 5);
        context.lineTo(legendX + 16, top + 5);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#344054";
        context.fillText(style.label, legendX + 21, top);
        legendX += 27 + context.measureText(style.label).width;

        const values = getBinned(key);
        if (style.type === "bar") {
          const barWidth = Math.max(1, plotWidth / values.length);
          context.fillStyle = style.color;
          context.globalAlpha = 0.55;
          for (let i = 0; i < values.length; i += 1) {
            if (!Number.isFinite(values[i])) continue;
            const height = values[i] / maximum * panelHeight;
            context.fillRect(margin.left + i / values.length * plotWidth,
              top + panelHeight - height, barWidth, height);
          }
          context.globalAlpha = 1;
        } else {
          context.strokeStyle = style.color;
          context.lineWidth = style.width || 1.35;
          context.setLineDash(style.dash || []);
          context.beginPath();
          let penDown = false;
          for (let i = 0; i < values.length; i += 1) {
            if (!Number.isFinite(values[i])) {
              penDown = false;
              continue;
            }
            const x = margin.left + (values.length === 1 ? 0 : i / (values.length - 1) * plotWidth);
            const y = top + panelHeight - values[i] / maximum * panelHeight;
            if (!penDown) context.moveTo(x, y);
            else context.lineTo(x, y);
            penDown = true;
          }
          context.stroke();
          context.setLineDash([]);
        }
      }

      context.fillStyle = "#344054";
      context.font = "700 11px Inter, sans-serif";
      context.textAlign = "right";
      context.fillText(panel.title, margin.left + plotWidth - 4, top + 2);
    });

    const axisY = cssHeight - margin.bottom + 7;
    context.fillStyle = "#667085";
    context.font = "11px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let tick = 0; tick <= 5; tick += 1) {
      const fraction = tick / 5;
      const x = margin.left + fraction * plotWidth;
      const index = Math.round(state.startIndex + fraction * (state.endIndex - state.startIndex));
      context.fillText(isoDate(index), x, axisY);
    }
    state.chartGeometry = { left: margin.left, width: plotWidth };
    selectors.chartTitle.textContent = selectors.view.options[selectors.view.selectedIndex].text;
  } // drawPlot END

  function updateTooltip(event) {
    if (!state.result || !state.chartGeometry) return;
    const rectangle = selectors.canvas.getBoundingClientRect();
    const x = event.clientX - rectangle.left;
    const fraction = (x - state.chartGeometry.left) / state.chartGeometry.width;
    if (fraction < 0 || fraction > 1) return;
    const index = Math.round(state.startIndex + fraction * (state.endIndex - state.startIndex));
    const value = (key) => Number.isFinite(state.result[key][index]) ? state.result[key][index].toFixed(2) : "NA";
    selectors.tooltip.textContent = `${isoDate(index)} · P ${value("p")} · rain ${value("rain")} · snow ${value("snow")} · PET ${value("pet")} · AET ${value("aet")} · SWE ${value("swe")} · soil ${value("soil")} · base ${value("baseflow")} · quick ${value("quickflow")} · Qsim ${value("q")} · Qobs ${value("qobs")} mm`;
  } // updateTooltip END

  function updateFacts() {
    if (!state.dataset) return;
    const model = modelCatalog[selectors.model.value];
    const catchment = state.dataset.catchment;
    const modelFigure = modelFigures[selectors.model.value];
    const catchmentFigure = catchmentFigures[catchment.id];
    const parameterList = state.parameterDefinitions
      .map((parameter) => `<li><strong>${parameter.key}</strong>: ${parameter.description}</li>`)
      .join("");
    selectors.factTitle.textContent = `${model.name} · ${catchment.name}`;
    selectors.facts.innerHTML = `
      <article class="hml-fact-card"><h3>Model purpose</h3><p>${model.summary}</p><p>${model.structure}</p></article>
      <article class="hml-fact-card"><h3>Catchment</h3><p><strong>${catchment.official_name}</strong><br>ID ${catchment.id} · ${catchment.area_km2} km²</p><p>Elevation: ${catchment.elevation.min}–${catchment.elevation.max} m; mean ${catchment.elevation.mean} m.</p></article>
      <figure class="hml-fact-card hml-fact-figure"><h3>${model.name} conceptual structure</h3><img src="${modelFigure.src}" alt="${modelFigure.alt}" loading="lazy" decoding="async"><figcaption>Processes, stores, fluxes and adjustable parameters represented by ${model.name}.</figcaption></figure>
      <figure class="hml-fact-card hml-fact-figure"><h3>${catchment.name} study area</h3><img src="${catchmentFigure.src}" alt="${catchmentFigure.alt}" loading="lazy" decoding="async"><figcaption>Study-area context for CAMELS-CL catchment ${catchment.id}.</figcaption></figure>
      <article class="hml-fact-card"><h3>Forcing and observations</h3><p>Daily CR2MET precipitation and temperature, Hargreaves-Samani PET, and DGA streamflow from CAMELS-CL.</p><p>${state.dataset.source.period[0]} to ${state.dataset.source.period[1]}.</p></article>
      <article class="hml-fact-card"><h3>Adjustable parameters</h3><ul>${parameterList}</ul></article>
      <article class="hml-fact-card"><h3>Displayed states</h3><p>Rain, snow, PET, AET, SWE, soil moisture, quickflow, baseflow, simulated and observed outlet streamflow.</p></article>
      <article class="hml-fact-card"><h3>Interpret with care</h3><p>States are model-dependent hypotheses. A good outlet hydrograph does not prove that snow, soil moisture or evaporation are correct.</p></article>`;
  } // updateFacts END

  function exportCsv() {
    if (!state.result) return;
    const columns = ["date", "precip_mm", "rain_mm", "snow_mm", "pet_mm", "aet_mm",
      "swe_mm", "soil_moisture_mm", "baseflow_mm", "quickflow_mm", "qsim_mm", "qobs_mm"];
    const rows = [columns.join(",")];
    const keys = ["p", "rain", "snow", "pet", "aet", "swe", "soil", "baseflow", "quickflow", "q", "qobs"];
    for (let i = state.startIndex; i <= state.endIndex; i += 1) {
      const values = keys.map((key) => Number.isFinite(state.result[key][i]) ? state.result[key][i].toFixed(4) : "");
      rows.push([isoDate(i), ...values].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `IIO409-${selectors.model.value}-${state.dataset.catchment.id}.csv`);
  } // exportCsv END

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } // downloadBlob END

  function exportPng() {
    selectors.canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `IIO409-${selectors.model.value}-${state.dataset.catchment.id}.png`);
    }, "image/png");
  } // exportPng END

  async function changeDataset() {
    try {
      state.dataset = await loadDataset(selectors.dataset.value);
      configureDates();
      runSimulation();
    } catch (error) {
      selectors.runStatus.textContent = "Data unavailable";
      selectors.tooltip.textContent = error.message;
    }
  } // changeDataset END

  function changeModel() {
    state.parameterDefinitions = parameterDefinitions(selectors.model.value);
    renderParameters();
    runSimulation();
  } // changeModel END

  function resetParameters() {
    for (const definition of state.parameterDefinitions) definition.value = definition.defaultValue;
    renderParameters();
    runSimulation();
  } // resetParameters END

  function applyRanges() {
    selectors.rangeError.textContent = "";
    for (const row of selectors.ranges.querySelectorAll(".hml-range-row")) {
      const definition = state.parameterDefinitions.find((item) => item.key === row.dataset.parameter);
      const inputs = row.querySelectorAll("input");
      const minimum = Number(inputs[0].value);
      const maximum = Number(inputs[1].value);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
        selectors.rangeError.textContent = `${definition.key}: minimum must be smaller than maximum.`;
        return;
      }
      definition.min = minimum;
      definition.max = maximum;
      definition.value = Math.max(minimum, Math.min(maximum, definition.value));
      definition.defaultValue = Math.max(minimum, Math.min(maximum, definition.defaultValue));
    }
    renderParameters();
    runSimulation();
  } // applyRanges END

  function switchTab(button) {
    root.querySelectorAll("[data-hml-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
    root.querySelectorAll("[data-hml-panel]").forEach((panel) => {
      const active = panel.dataset.hmlPanel === button.dataset.hmlTab;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    if (button.dataset.hmlTab === "model") {
      window.requestAnimationFrame(redrawCharts);
    }
  } // switchTab END

  function attachEvents() {
    selectors.dataset.addEventListener("change", changeDataset);
    selectors.model.addEventListener("change", changeModel);
    selectors.view.addEventListener("change", drawPlot);
    selectors.dateStart.addEventListener("change", updateDateWindow);
    selectors.dateEnd.addEventListener("change", updateDateWindow);
    selectors.timeStart.addEventListener("input", updateSliderWindow);
    selectors.timeEnd.addEventListener("input", updateSliderWindow);
    selectors.canvas.addEventListener("mousemove", updateTooltip);
    selectors.canvas.addEventListener("mouseleave", () => {
      selectors.tooltip.textContent = "Move over the plot to inspect daily values.";
    });
    root.querySelector("[data-hml-reset]").addEventListener("click", resetParameters);
    root.querySelector("[data-hml-apply-ranges]").addEventListener("click", applyRanges);
    root.querySelector("[data-hml-export-csv]").addEventListener("click", exportCsv);
    root.querySelector("[data-hml-export-png]").addEventListener("click", exportPng);
    root.querySelectorAll("[data-hml-tab]").forEach((button) =>
      button.addEventListener("click", () => switchTab(button)));
    root.querySelector("[data-hml-signout]").addEventListener("click", () => {
      localStorage.removeItem(accessKey);
      sessionStorage.removeItem(accessKey);
      window.close();
      window.setTimeout(() => window.location.replace(root.dataset.hmlLoginUrl), 100);
    });
    const resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(redrawCharts));
    resizeObserver.observe(selectors.canvas.parentElement);
  } // attachEvents END

  async function initialiseApp() {
    if (!state.initialised) {
      state.initialised = true;
      state.parameterDefinitions = parameterDefinitions(selectors.model.value);
      renderParameters();
      attachEvents();
    }
    await changeDataset();
  } // initialiseApp END

  async function digest(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } // digest END

  function hasValidAccess() {
    const grantedAt = Number(localStorage.getItem(accessKey));
    return Number.isFinite(grantedAt) && grantedAt > 0 && Date.now() - grantedAt < accessLifetime;
  } // hasValidAccess END

  async function enterApp() {
    selectors.app.hidden = false;
    await initialiseApp();
  } // enterApp END

  if (mode === "gate" && selectors.loginForm) {
    selectors.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      selectors.loginError.textContent = "";
      selectors.launchFallback.hidden = true;
      const pendingWindow = window.open("about:blank", "_blank");
      const form = new FormData(selectors.loginForm);
      const candidate = await digest(`${form.get("username")}|${form.get("password")}`);
      if (candidate !== accessHash) {
        if (pendingWindow) pendingWindow.close();
        selectors.loginError.textContent = "The username or password is incorrect.";
        return;
      }
      localStorage.setItem(accessKey, String(Date.now()));
      if (pendingWindow) {
        pendingWindow.opener = null;
        pendingWindow.location.replace(root.dataset.hmlAppUrl);
      } else {
        selectors.loginError.textContent = "Access granted. Your browser blocked the new tab; use the link below.";
        selectors.launchFallback.hidden = false;
      }
    });
  }

  if (mode === "app") {
    if (hasValidAccess()) enterApp();
    else window.location.replace(root.dataset.hmlLoginUrl);
  }
}());

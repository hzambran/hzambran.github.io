/* IIO409 hydrological teaching engines.
 * Equations follow TUWmodel 1.1-1 and airGR 1.7.9 (GR4J, GR6J, CemaNeige).
 */
(function (root) {
  "use strict";

  const makeSeries = (length, value = 0) => {
    const out = new Float64Array(length);
    if (value !== 0) out.fill(value);
    return out;
  }; // makeSeries END

  const finiteOrZero = (value) => Number.isFinite(value) ? value : 0;

  function unitHydrographs(x4) {
    const exponent = 2.5;
    const ss1 = (index) => index <= 0 ? 0 : (index < x4 ? (index / x4) ** exponent : 1);
    const ss2 = (index) => {
      if (index <= 0) return 0;
      if (index <= x4) return 0.5 * (index / x4) ** exponent;
      if (index < 2 * x4) return 1 - 0.5 * (2 - index / x4) ** exponent;
      return 1;
    }; // ss2 END
    return {
      uh1: Float64Array.from({ length: 20 }, (_, i) => ss1(i + 1) - ss1(i)),
      uh2: Float64Array.from({ length: 40 }, (_, i) => ss2(i + 1) - ss2(i))
    };
  } // unitHydrographs END

  function routeUnitHydrograph(state, ordinates, input) {
    for (let i = 0; i < state.length - 1; i += 1) {
      state[i] = state[i + 1] + ordinates[i] * input;
    }
    state[state.length - 1] = ordinates[state.length - 1] * input;
  } // routeUnitHydrograph END

  function runGR(forcing, params, version) {
    const n = forcing.p.length;
    const isGR6 = version === 6;
    const [x1raw, x2, x3raw, x4raw, x5 = 0, x6raw = 20] = params;
    const x1 = Math.max(0.01, x1raw);
    const x3 = Math.max(0.01, x3raw);
    const x4 = Math.max(0.5, x4raw);
    const x6 = Math.max(0.01, x6raw);
    const { uh1, uh2 } = unitHydrographs(x4);
    const stateUH1 = makeSeries(20);
    const stateUH2 = makeSeries(40);
    let productionStore = 0.3 * x1;
    let routingStore = 0.5 * x3;
    let exponentialStore = 0;

    const output = {
      q: makeSeries(n), quickflow: makeSeries(n), baseflow: makeSeries(n),
      aet: makeSeries(n), soil: makeSeries(n)
    };

    for (let i = 0; i < n; i += 1) {
      const precipitation = finiteOrZero(forcing.p[i]);
      const pet = finiteOrZero(forcing.pet[i]);
      let netRainfall = 0;
      let storeInput = 0;
      let effectiveRainfall = 0;
      let actualEvaporation = 0;

      if (precipitation <= pet) {
        const netEvaporation = pet - precipitation;
        const tanhTerm = Math.tanh(Math.min(13, netEvaporation / x1));
        const relativeStore = productionStore / x1;
        const storeEvaporation = productionStore * (2 - relativeStore) * tanhTerm /
          (1 + (1 - relativeStore) * tanhTerm);
        actualEvaporation = storeEvaporation + precipitation;
        productionStore -= storeEvaporation;
      } else {
        actualEvaporation = pet;
        netRainfall = precipitation - pet;
        const tanhTerm = Math.tanh(Math.min(13, netRainfall / x1));
        const relativeStore = productionStore / x1;
        storeInput = x1 * (1 - relativeStore * relativeStore) * tanhTerm /
          (1 + relativeStore * tanhTerm);
        effectiveRainfall = netRainfall - storeInput;
        productionStore += storeInput;
      }

      productionStore = Math.max(0, productionStore);
      const storeRatio4 = (productionStore / x1) ** 4;
      const percolation = productionStore *
        (1 - 1 / Math.sqrt(Math.sqrt(1 + storeRatio4 / 25.62890625)));
      productionStore -= percolation;
      effectiveRainfall += percolation;

      routeUnitHydrograph(stateUH1, uh1, effectiveRainfall * 0.9);
      routeUnitHydrograph(stateUH2, uh2, effectiveRainfall * 0.1);

      let exchange;
      let routingOutflow;
      let directOutflow;
      let exponentialOutflow = 0;

      if (!isGR6) {
        exchange = x2 * (routingStore / x3) ** 3.5;
        const exchange1 = Math.max(exchange, -routingStore - stateUH1[0]);
        routingStore = Math.max(0, routingStore + stateUH1[0] + exchange1);
        routingOutflow = routingStore *
          (1 - 1 / Math.sqrt(Math.sqrt(1 + (routingStore / x3) ** 4)));
        routingStore -= routingOutflow;
        directOutflow = Math.max(0, stateUH2[0] + exchange);
      } else {
        exchange = x2 * (routingStore / x3 - x5);
        const exchange1 = Math.max(exchange, -routingStore - 0.6 * stateUH1[0]);
        routingStore = Math.max(0, routingStore + 0.6 * stateUH1[0] + exchange1);
        routingOutflow = routingStore *
          (1 - 1 / Math.sqrt(Math.sqrt(1 + (routingStore / x3) ** 4)));
        routingStore -= routingOutflow;

        exponentialStore += 0.4 * stateUH1[0] + exchange;
        const storeRatio = Math.max(-33, Math.min(33, exponentialStore / x6));
        if (storeRatio > 7) {
          exponentialOutflow = exponentialStore + x6 / Math.exp(storeRatio);
        } else if (storeRatio < -7) {
          exponentialOutflow = x6 * Math.exp(storeRatio);
        } else {
          exponentialOutflow = x6 * Math.log(Math.exp(storeRatio) + 1);
        }
        exponentialStore -= exponentialOutflow;
        directOutflow = Math.max(0, stateUH2[0] + exchange);
      }

      output.q[i] = Math.max(0, routingOutflow + directOutflow + exponentialOutflow);
      output.quickflow[i] = directOutflow;
      output.baseflow[i] = routingOutflow + exponentialOutflow;
      output.aet[i] = actualEvaporation;
      output.soil[i] = productionStore;
    }
    return output;
  } // runGR END

  function prepareCemaInputs(dataset) {
    if (dataset._cemaInputs) return dataset._cemaInputs;
    const daily = dataset.daily;
    const n = daily.count;
    const elevations = dataset.catchment.elevation;
    const zInput = elevations.mean;
    const zLayers = elevations.layers;
    const gradients = dataset.valery_temperature_gradients;
    const gradientIndex = new Map();
    for (let i = 0; i < gradients.day.length; i += 1) {
      gradientIndex.set(`${gradients.month[i]}-${gradients.day[i]}`, i);
    }

    const precipFactors = zLayers.map((elevation) =>
      elevation <= 4000 ? Math.exp(0.00041 * (elevation - zInput)) :
        Math.exp(0.00041 * (4000 - zInput))
    );
    const meanPrecipFactor = precipFactors.reduce((sum, value) => sum + value, 0) /
      precipFactors.length;
    const layers = zLayers.map(() => ({
      p: makeSeries(n), temp: makeSeries(n), solidFraction: makeSeries(n)
    }));
    const start = new Date(`${daily.start}T00:00:00Z`);
    let solidTotal = 0;

    for (let i = 0; i < n; i += 1) {
      const date = new Date(start.getTime() + i * 86400000);
      const gradientRow = gradientIndex.get(`${date.getUTCMonth() + 1}-${date.getUTCDate()}`);
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const elevationOffset = zInput - zLayers[layerIndex];
        const layer = layers[layerIndex];
        layer.p[i] = daily.p[i] * precipFactors[layerIndex] / meanPrecipFactor;
        layer.temp[i] = daily.tavg[i] + elevationOffset *
          Math.abs(gradients.mean[gradientRow]) / 100;
        const layerTmin = daily.tmin[i] + elevationOffset *
          Math.abs(gradients.min[gradientRow]) / 100;
        const layerTmax = daily.tmax[i] + elevationOffset *
          Math.abs(gradients.max[gradientRow]) / 100;
        let solidFraction;
        if (zInput < 1500) {
          if (layerTmin >= 0) solidFraction = 0;
          else if (layerTmax <= 0) solidFraction = 1;
          else solidFraction = 1 - layerTmax / (layerTmax - layerTmin);
        } else {
          solidFraction = Math.max(0, Math.min(1, 1 - (layer.temp[i] + 1) / 4));
        }
        layer.solidFraction[i] = solidFraction;
        solidTotal += solidFraction * layer.p[i] / layers.length;
      }
    }

    dataset._cemaInputs = {
      layers,
      meanAnnualSolidPrecip: solidTotal / n * 365.25
    };
    return dataset._cemaInputs;
  } // prepareCemaInputs END

  function runCemaNeige(dataset, ctg, kf) {
    const prepared = prepareCemaInputs(dataset);
    const n = dataset.daily.count;
    const output = {
      rain: makeSeries(n), snow: makeSeries(n), swe: makeSeries(n),
      liquidAndMelt: makeSeries(n)
    };
    const threshold = 0.9 * prepared.meanAnnualSolidPrecip;
    const layerWeight = 1 / prepared.layers.length;

    for (const layer of prepared.layers) {
      let snowPack = 0;
      let thermalState = 0;
      for (let i = 0; i < n; i += 1) {
        const solidPrecipitation = layer.solidFraction[i] * layer.p[i];
        const liquidPrecipitation = layer.p[i] - solidPrecipitation;
        snowPack += solidPrecipitation;
        thermalState = ctg * thermalState + (1 - ctg) * layer.temp[i];
        thermalState = Math.min(0, thermalState);
        let potentialMelt = 0;
        if (thermalState === 0 && layer.temp[i] > 0) {
          potentialMelt = Math.min(snowPack, kf * layer.temp[i]);
        }
        const snowRatio = threshold > 0 ? Math.min(1, snowPack / threshold) : 1;
        const melt = (0.9 * snowRatio + 0.1) * potentialMelt;
        snowPack = Math.max(0, snowPack - melt);

        output.rain[i] += liquidPrecipitation * layerWeight;
        output.snow[i] += solidPrecipitation * layerWeight;
        output.swe[i] += snowPack * layerWeight;
        output.liquidAndMelt[i] += (liquidPrecipitation + melt) * layerWeight;
      }
    }
    return output;
  } // runCemaNeige END

  function runTUW(dataset, params) {
    const daily = dataset.daily;
    const n = daily.count;
    const [scf, ddf, twb, tm, lpRatio, fieldCapacityRaw, beta, k0, k1, k2,
      upperThreshold, percolationRate, maxBase, routeScale] = params;
    const fieldCapacity = Math.max(0.001, fieldCapacityRaw);
    const lp = Math.max(0.001, lpRatio * fieldCapacity);
    let soilMoisture = 50;
    let snowWaterEquivalent = 0;
    let upperStorage = 2.5;
    let lowerStorage = 2.5;

    const output = {
      p: Float64Array.from(daily.p), pet: Float64Array.from(daily.pet),
      qobs: Float64Array.from(daily.qobs, (value) => value === null ? NaN : value),
      rain: makeSeries(n), snow: makeSeries(n), swe: makeSeries(n),
      aet: makeSeries(n), soil: makeSeries(n), quickflow: makeSeries(n),
      baseflow: makeSeries(n), q: makeSeries(n)
    };

    for (let i = 0; i < n; i += 1) {
      const precipitation = daily.p[i];
      const temperature = daily.tavg[i];
      let pet = daily.pet[i];
      if (temperature < -0.1) pet = 0;

      let snowfall;
      if (temperature < twb) snowfall = precipitation;
      else if (temperature > twb) snowfall = 0;
      else snowfall = precipitation;
      const rainfall = precipitation - snowfall;
      let melt = Math.max(0, (temperature - tm) * ddf);
      const availableSnow = snowWaterEquivalent + scf * snowfall;
      melt = Math.min(melt, availableSnow);
      snowWaterEquivalent = Math.max(0, availableSnow - melt);

      const waterInput = rainfall + melt;
      let recharge = (soilMoisture / fieldCapacity) ** beta * waterInput;
      recharge = Math.max(0, Math.min(waterInput, recharge));
      soilMoisture += Math.max(0, waterInput - recharge);
      if (soilMoisture > fieldCapacity) {
        recharge += soilMoisture - fieldCapacity;
        soilMoisture = fieldCapacity;
      }
      let actualEvaporation = soilMoisture < lp ? soilMoisture * pet / lp : pet;
      actualEvaporation = Math.max(0, Math.min(pet, actualEvaporation, soilMoisture));
      soilMoisture -= actualEvaporation;

      let provisionalUpper = Math.max(0, upperStorage + recharge);
      let q0 = 0;
      if (provisionalUpper > upperThreshold && k0 > 0) {
        q0 = (provisionalUpper - upperThreshold) / k0 * Math.exp(-1 / k0);
        q0 = Math.max(0, Math.min(provisionalUpper - upperThreshold, q0));
      }
      provisionalUpper -= q0;
      let q1 = -percolationRate +
        (percolationRate + provisionalUpper / k1) * Math.exp(-1 / k1);
      q1 = Math.max(0, q1);
      let transferToLower = percolationRate;
      upperStorage = provisionalUpper - q1 - transferToLower;
      if (upperStorage < 0) {
        upperStorage = 0;
        transferToLower = provisionalUpper;
      }

      const provisionalLower = Math.max(0, lowerStorage);
      let q2 = transferToLower -
        (transferToLower - provisionalLower / k2) * Math.exp(-1 / k2);
      q2 = Math.max(0, q2);
      lowerStorage = provisionalLower - q2 + transferToLower;
      if (lowerStorage < 0) {
        lowerStorage = 0;
        q2 = provisionalLower + transferToLower;
      }

      const generatedFlow = q0 + q1 + q2;
      const routingBase = maxBase - routeScale * generatedFlow;
      const routingLength = routingBase > 1 ? Math.max(1, Math.trunc(routingBase)) : 1;
      for (let j = 1; j <= routingLength && i + j - 1 < n; j += 1) {
        let routed;
        if (routingLength === 1) {
          routed = generatedFlow;
        } else if (j <= Math.trunc(routingLength / 2)) {
          routed = (j - 0.5) * 4 * generatedFlow / routingLength ** 2;
        } else if (Math.abs(j - (routingLength / 2 + 0.5)) < 0.1) {
          routed = (j - 0.75) * 4 * generatedFlow / routingLength ** 2;
        } else {
          routed = (routingLength - j + 0.5) * 4 * generatedFlow /
            routingLength ** 2;
        }
        output.q[i + j - 1] += routed;
      }

      output.rain[i] = rainfall;
      output.snow[i] = snowfall;
      output.swe[i] = snowWaterEquivalent;
      output.aet[i] = actualEvaporation;
      output.soil[i] = soilMoisture;
      output.quickflow[i] = q0 + q1;
      output.baseflow[i] = q2;
    }
    return output;
  } // runTUW END

  function runModel(dataset, model, params) {
    if (model === "tuw") return runTUW(dataset, params);
    if (model === "gr4j") {
      const output = runGR({ p: dataset.daily.p, pet: dataset.daily.pet }, params, 4);
      const n = dataset.daily.count;
      return Object.assign(output, {
        p: Float64Array.from(dataset.daily.p), pet: Float64Array.from(dataset.daily.pet),
        qobs: Float64Array.from(dataset.daily.qobs, (value) => value === null ? NaN : value),
        rain: Float64Array.from(dataset.daily.p), snow: makeSeries(n), swe: makeSeries(n)
      });
    }
    if (model === "gr6j-cemaneige") {
      const snow = runCemaNeige(dataset, params[6], params[7]);
      const output = runGR({ p: snow.liquidAndMelt, pet: dataset.daily.pet }, params.slice(0, 6), 6);
      return Object.assign(output, {
        p: Float64Array.from(dataset.daily.p), pet: Float64Array.from(dataset.daily.pet),
        qobs: Float64Array.from(dataset.daily.qobs, (value) => value === null ? NaN : value),
        rain: snow.rain, snow: snow.snow, swe: snow.swe
      });
    }
    throw new Error(`Unknown model: ${model}`);
  } // runModel END

  const api = { runModel, runTUW, runGR, runCemaNeige, prepareCemaInputs };
  root.HydroLabEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof globalThis !== "undefined" ? globalThis : this));


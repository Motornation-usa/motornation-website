const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function clean(value) {
  return String(value || "").trim();
}

function splitVehicle(vehicle) {
  const parts = clean(vehicle).split(/\s+/).filter(Boolean);
  return {
    make: parts[0] || "",
    model: parts.slice(1).join(" "),
  };
}

function pickDecodedValue(row, key) {
  return clean(row?.[key]);
}

async function decodeVin({ vin, year }) {
  const safeVin = clean(vin).toUpperCase();
  if (safeVin.length < 11) return null;

  const params = new URLSearchParams({ format: "json" });
  if (year) params.set("modelyear", clean(year));
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(safeVin)}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHTSA lookup failed: ${res.status}`);
  const data = await res.json();
  const row = Array.isArray(data.Results) ? data.Results[0] : null;
  if (!row) return null;

  return {
    year: pickDecodedValue(row, "ModelYear"),
    make: pickDecodedValue(row, "Make"),
    model: pickDecodedValue(row, "Model"),
    trim: pickDecodedValue(row, "Trim"),
    engine: [
      pickDecodedValue(row, "EngineCylinders") && `${pickDecodedValue(row, "EngineCylinders")} cyl`,
      pickDecodedValue(row, "DisplacementL") && `${pickDecodedValue(row, "DisplacementL")}L`,
      pickDecodedValue(row, "FuelTypePrimary"),
    ].filter(Boolean).join(" "),
    raw: row,
  };
}

async function lookupProvider(vehicle) {
  const url = clean(process.env.OIL_SPECS_API_URL);
  const key = clean(process.env.OIL_SPECS_API_KEY);
  if (!url || !key) return null;

  const params = new URLSearchParams({
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    engine: vehicle.engine || "",
    vin: vehicle.vin || "",
  });

  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${separator}${params}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "X-API-Key": key,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Oil specs provider failed: ${res.status}`);
  return res.json();
}

function normalizeProvider(data) {
  if (!data) return null;
  const oil = data.oil || data.engineOil || data.fluid || data;
  const filter = data.filter || data.oilFilter || data.parts?.oilFilter || {};
  return {
    oilType: clean(oil.type || oil.viscosity || oil.grade || data.oilType),
    quantity: clean(oil.capacity || oil.quantity || oil.quarts || data.quantity),
    filterNumber: clean(filter.partNumber || filter.part || filter.number || data.filterNumber),
    filterBrand: clean(filter.brand || data.filterBrand),
    notes: clean(oil.notes || data.notes),
    source: clean(data.source || "Connected oil specs API"),
  };
}

function buildSearches(vehicle, specs, address) {
  const vehicleText = [vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(" ");
  const oilText = [specs?.oilType, specs?.quantity, "full synthetic oil"].filter(Boolean).join(" ");
  const filterText = [vehicleText, specs?.filterNumber || "oil filter"].filter(Boolean).join(" ");
  return {
    autozone: `https://www.google.com/search?q=${encodeURIComponent(`AutoZone ${filterText}`)}`,
    oreilly: `https://www.google.com/search?q=${encodeURIComponent(`O'Reilly Auto Parts ${filterText}`)}`,
    walmart: `https://www.google.com/search?q=${encodeURIComponent(`Walmart ${oilText} ${filterText}`)}`,
    nearest: `https://www.google.com/maps/search/${encodeURIComponent(`auto parts store near ${address || "Aurora CO"}`)}`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const q = event.queryStringParameters || {};
    const baseVehicle = {
      year: clean(q.year),
      vin: clean(q.vin),
      engine: clean(q.engine),
      ...splitVehicle(q.vehicle),
    };

    const decoded = await decodeVin(baseVehicle).catch((e) => ({ error: e.message }));
    const vehicle = {
      ...baseVehicle,
      ...(decoded && !decoded.error ? decoded : {}),
      vin: baseVehicle.vin,
      engine: baseVehicle.engine || (decoded && !decoded.error ? decoded.engine : ""),
    };

    const providerData = await lookupProvider(vehicle).catch((e) => ({ error: e.message }));
    const specs = normalizeProvider(providerData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        vehicle,
        decoded,
        specs,
        providerConfigured: Boolean(process.env.OIL_SPECS_API_URL && process.env.OIL_SPECS_API_KEY),
        providerError: providerData?.error || "",
        searches: buildSearches(vehicle, specs, clean(q.address)),
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};

#!/usr/bin/env node
/**
 * build-schedule.js
 * ------------------
 * Reads an unzipped GTFS feed and produces schedule.json for the transit
 * ticker frontend (index.html). No dependencies — pure Node.
 *
 * Usage:
 *   node build-schedule.js [path/to/gtfs/dir]
 *
 * Defaults to ./gtfs if no path is given. Expects stops.txt, stop_times.txt,
 * trips.txt, routes.txt, and calendar.txt and/or calendar_dates.txt inside.
 *
 * Output: ./schedule.json shaped as
 *   {
 *     stations: ["Deux-Montagnes", "Grand-Moulin", ...],   // resolved, in line order
 *     defaultStation: "Deux-Montagnes",
 *     generatedAt: "2026-08-28T20:00:00.000Z",
 *     data: {
 *       "Deux-Montagnes": { byDayType: { weekday: [...], saturday: [...], sunday: [...] } },
 *       "Grand-Moulin":   { byDayType: { ... } },
 *       ...
 *     }
 *   }
 *
 * Each passing is { time: "HH:MM", minutes: 1234, direction: "0"|"1",
 * headsign: "...", lineDirection: "upstream"|"downstream"|null }.
 *
 * `time` is wrapped to a normal 24h clock for display. `minutes` preserves
 * the raw GTFS minute count (which can exceed 1440 for post-midnight
 * service, e.g. "25:10" -> 1510) so the frontend can correctly figure out
 * whether a passing belongs to "later tonight" vs. "earlier today".
 *
 * `lineDirection` is derived from LINE_ORDER below, not from the raw GTFS
 * direction_id: a trip whose headsign resolves to a station earlier on the
 * line than the station being built is "upstream" (headed toward the
 * Deux-Montagnes end); a headsign resolving later on the line is
 * "downstream" (headed toward the Brossard end). This is what lets the
 * frontend point the animated train the correct physical way regardless of
 * which arbitrary value the feed happens to use for direction_id — GTFS
 * direction_id is only guaranteed consistent *within* one route/pattern,
 * not tied to real-world compass or line-diagram direction, and is used
 * only as a fallback when a headsign can't be resolved against the line.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---- configuration -----------------------------------------------------

// The REM (Réseau express métropolitain) A1/A2 line, Deux-Montagnes end
// first. Used both to order/label the station picker and to work out which
// physical way a trip is headed (see `lineDirection` above).
const LINE_ORDER = [
  "Deux-Montagnes",
  "Grand-Moulin",
  "Sainte-Dorothée",
  "Île-Bigras",
  "Bois-Franc",
  "Sunnybrooke",
  "Pierrefonds-Roxboro",
  "Des Sources",
  "Montpellier",
  "Du Ruisseau",
  "Côte-de-Liesse",
  "Ville-de-Mont-Royal",
  "Canora",
  "Édouard-Montpetit",
  "McGill",
  "Gare Centrale",
  "Griffintown – Bernard-Landry (Projected)",
  "Île-des-Sœurs",
  "Panama",
  "Du Quartier",
  "Brossard",
];

const DEFAULT_STATION = "Deux-Montagnes";

// A few headsigns feeds commonly use that aren't an exact station name.
const HEADSIGN_ALIASES = {
  "montreal": "Gare Centrale",
  "montréal": "Gare Centrale",
  "downtown": "Gare Centrale",
};

const GTFS_DIR = process.argv[2] || path.join(__dirname, "gtfs");
const OUT_FILE = path.join(__dirname, "schedule.json");

// ---- tiny robust CSV parser (handles quoted fields, "" escapes, \r\n) -

function parseCSV(text) {
  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore, \n handles the line break
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // last field/row (files may or may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty trailing rows.
  while (rows.length && rows[rows.length - 1].every((f) => f === "")) {
    rows.pop();
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const rec = {};
    const cols = rows[r];
    if (cols.length === 1 && cols[0] === "") continue;
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = cols[c] !== undefined ? cols[c].trim() : "";
    }
    out.push(rec);
  }
  return out;
}

function readGtfsFile(name) {
  const file = path.join(GTFS_DIR, name);
  if (!fs.existsSync(file)) return null;
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function requireGtfsFile(name) {
  const rows = readGtfsFile(name);
  if (rows === null) {
    console.error(`ERROR: missing required GTFS file: ${name} (looked in ${GTFS_DIR})`);
    process.exit(1);
  }
  return rows;
}

// ---- normalize helper (for loose station-name matching) --------------

function normalize(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .trim();
}

const LINE_ORDER_NORM = LINE_ORDER.map(normalize);

function lineIndexForHeadsign(headsign) {
  const norm = normalize(headsign);
  const aliased = HEADSIGN_ALIASES[norm] ? normalize(HEADSIGN_ALIASES[norm]) : norm;
  const idx = LINE_ORDER_NORM.indexOf(aliased);
  return idx === -1 ? null : idx;
}

// ---- GTFS time -> minutes-since-midnight (can exceed 1440) -----------

function timeToMinutes(hhmmss) {
  const parts = hhmmss.split(":").map((n) => parseInt(n, 10));
  const [h, m, s] = parts;
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m + (Number.isNaN(s) ? 0 : s / 60);
}

function formatWrappedHHMM(minutes) {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---- day-of-week classification for calendar_dates.txt dates ---------

function dayTypeForYYYYMMDD(yyyymmdd) {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}

// ---- resolve every stop_id belonging to a named station ---------------

function resolveStopIds(stationName, stops, stopById) {
  const targetNorm = normalize(stationName);
  const matched = new Set();
  for (const s of stops) {
    if (normalize(s.stop_name) === targetNorm) {
      matched.add(s.stop_id);
      continue;
    }
    if (s.parent_station) {
      const parent = stopById.get(s.parent_station);
      if (parent && normalize(parent.stop_name) === targetNorm) {
        matched.add(s.stop_id);
      }
    }
  }
  return matched;
}

// ---- main --------------------------------------------------------------

function main() {
  console.log(`Reading GTFS feed from: ${GTFS_DIR}`);

  const stops = requireGtfsFile("stops.txt");
  const stopTimes = requireGtfsFile("stop_times.txt");
  const trips = requireGtfsFile("trips.txt");
  const routes = readGtfsFile("routes.txt") || [];
  const calendar = readGtfsFile("calendar.txt");
  const calendarDates = readGtfsFile("calendar_dates.txt");

  if (!calendar && !calendarDates) {
    console.error("ERROR: need at least one of calendar.txt or calendar_dates.txt");
    process.exit(1);
  }

  const stopById = new Map(stops.map((s) => [s.stop_id, s]));

  // --- resolve stop_id(s) for every station on the line ------------------

  const stationStopIds = new Map(); // stationName -> Set<stop_id>
  const resolvedStations = [];

  for (const stationName of LINE_ORDER) {
    const ids = resolveStopIds(stationName, stops, stopById);
    if (ids.size === 0) {
      console.log(`Note: no stops found for "${stationName}" in this feed — skipping.`);
      continue;
    }
    stationStopIds.set(stationName, ids);
    resolvedStations.push(stationName);
  }

  if (resolvedStations.length === 0) {
    console.error("ERROR: none of the configured LINE_ORDER stations were found in this feed.");
    process.exit(1);
  }

  // --- build service_id -> Set<dayType> ---------------------------------

  const serviceDayTypes = new Map(); // service_id -> Set('weekday'|'saturday'|'sunday')

  function addDayType(serviceId, dayType) {
    if (!serviceDayTypes.has(serviceId)) serviceDayTypes.set(serviceId, new Set());
    serviceDayTypes.get(serviceId).add(dayType);
  }

  if (calendar) {
    for (const row of calendar) {
      const weekdayActive = ["monday", "tuesday", "wednesday", "thursday", "friday"].some(
        (d) => row[d] === "1"
      );
      if (weekdayActive) addDayType(row.service_id, "weekday");
      if (row.saturday === "1") addDayType(row.service_id, "saturday");
      if (row.sunday === "1") addDayType(row.service_id, "sunday");
    }
  }

  let ignoredRemovals = 0;
  if (calendarDates) {
    for (const row of calendarDates) {
      if (row.exception_type === "1") {
        addDayType(row.service_id, dayTypeForYYYYMMDD(row.date));
      } else if (row.exception_type === "2") {
        // A single-date removal can't be modeled in a day-type bucket
        // without full date awareness. This is a generic weekly schedule
        // generator, so we just note it and move on.
        ignoredRemovals++;
      }
    }
  }
  if (ignoredRemovals > 0) {
    console.log(`Note: ignored ${ignoredRemovals} calendar_dates.txt exception_type=2 (single-date removal) rows.`);
  }

  // --- trip_id -> { serviceId, direction, headsign } ---------------------

  const routeById = new Map(routes.map((r) => [r.route_id, r]));

  const tripInfo = new Map();
  for (const t of trips) {
    let headsign = t.trip_headsign;
    if (!headsign) {
      const route = routeById.get(t.route_id);
      headsign = (route && (route.route_long_name || route.route_short_name)) || "Unknown";
    }
    tripInfo.set(t.trip_id, {
      serviceId: t.service_id,
      direction: t.direction_id || "0",
      headsign,
    });
  }

  // --- walk stop_times once, bucketed per matched stop_id -----------------

  const stopIdToStation = new Map();
  for (const [stationName, ids] of stationStopIds) {
    for (const id of ids) stopIdToStation.set(id, stationName);
  }

  const byStation = new Map(); // stationName -> { weekday: [], saturday: [], sunday: [] }
  for (const stationName of resolvedStations) {
    byStation.set(stationName, { weekday: [], saturday: [], sunday: [] });
  }

  let matchedStopTimeRows = 0;

  for (const st of stopTimes) {
    const stationName = stopIdToStation.get(st.stop_id);
    if (!stationName) continue;

    const trip = tripInfo.get(st.trip_id);
    if (!trip) continue;

    const dayTypes = serviceDayTypes.get(trip.serviceId);
    if (!dayTypes || dayTypes.size === 0) continue;

    const rawTime = st.departure_time || st.arrival_time;
    if (!rawTime) continue;
    const minutes = timeToMinutes(rawTime);
    if (minutes === null) continue;

    matchedStopTimeRows++;

    const stationLineIndex = LINE_ORDER_NORM.indexOf(normalize(stationName));
    const headsignLineIndex = lineIndexForHeadsign(trip.headsign);
    let lineDirection = null;
    if (headsignLineIndex !== null && stationLineIndex !== -1) {
      if (headsignLineIndex < stationLineIndex) lineDirection = "upstream"; // toward Deux-Montagnes
      else if (headsignLineIndex > stationLineIndex) lineDirection = "downstream"; // toward Brossard
    }

    const entry = {
      time: formatWrappedHHMM(minutes),
      minutes,
      direction: trip.direction,
      headsign: trip.headsign,
      lineDirection,
    };

    const buckets = byStation.get(stationName);
    for (const dayType of dayTypes) {
      buckets[dayType].push(entry);
    }
  }

  const data = {};
  for (const stationName of resolvedStations) {
    const buckets = byStation.get(stationName);
    for (const dayType of Object.keys(buckets)) {
      buckets[dayType].sort((a, b) => a.minutes - b.minutes);
    }
    data[stationName] = { byDayType: buckets };
  }

  const defaultStation = resolvedStations.includes(DEFAULT_STATION)
    ? DEFAULT_STATION
    : resolvedStations[0];

  const schedule = {
    stations: resolvedStations,
    defaultStation,
    generatedAt: new Date().toISOString(),
    data,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(schedule, null, 2));

  console.log(`\nWrote ${OUT_FILE}`);
  console.log(`Resolved ${resolvedStations.length}/${LINE_ORDER.length} line stations (${matchedStopTimeRows} matched stop_time rows total). Default: "${defaultStation}".`);
  for (const stationName of resolvedStations) {
    const b = data[stationName].byDayType;
    console.log(`  ${stationName}: weekday ${b.weekday.length}, saturday ${b.saturday.length}, sunday ${b.sunday.length}`);
  }
}

main();

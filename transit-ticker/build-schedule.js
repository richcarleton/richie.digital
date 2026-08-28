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
 *     station: "Grand-Moulin",
 *     generatedAt: "2026-08-28T20:00:00.000Z",
 *     byDayType: {
 *       weekday:  [{ time: "HH:MM", minutes: 1234, direction: "0"|"1", headsign: "..." }, ...],
 *       saturday: [...],
 *       sunday:   [...]
 *     }
 *   }
 *
 * `time` is wrapped to a normal 24h clock for display. `minutes` preserves
 * the raw GTFS minute count (which can exceed 1440 for post-midnight
 * service, e.g. "25:10" -> 1510) so the frontend can correctly figure out
 * whether a passing belongs to "later tonight" vs. "earlier today".
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---- configuration ---------------------------------------------------

const STATION = "Grand-Moulin";
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

  // --- resolve stop_id(s) for STATION -----------------------------------

  const stopById = new Map(stops.map((s) => [s.stop_id, s]));
  const targetNorm = normalize(STATION);

  const matchedStopIds = new Set();
  for (const s of stops) {
    if (normalize(s.stop_name) === targetNorm) {
      matchedStopIds.add(s.stop_id);
      continue;
    }
    if (s.parent_station) {
      const parent = stopById.get(s.parent_station);
      if (parent && normalize(parent.stop_name) === targetNorm) {
        matchedStopIds.add(s.stop_id);
      }
    }
  }

  if (matchedStopIds.size === 0) {
    console.error(`ERROR: no stops found matching station name "${STATION}"`);
    console.error("Available stop names include (sample):");
    stops.slice(0, 20).forEach((s) => console.error(`  - ${s.stop_name}`));
    process.exit(1);
  }

  console.log(`Resolved ${matchedStopIds.size} stop_id(s) for "${STATION}": ${[...matchedStopIds].join(", ")}`);

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

  // --- walk stop_times for the matched stop_id(s) -------------------------

  const byDayType = { weekday: [], saturday: [], sunday: [] };
  let matchedStopTimeRows = 0;

  for (const st of stopTimes) {
    if (!matchedStopIds.has(st.stop_id)) continue;
    const trip = tripInfo.get(st.trip_id);
    if (!trip) continue;

    const dayTypes = serviceDayTypes.get(trip.serviceId);
    if (!dayTypes || dayTypes.size === 0) continue;

    const rawTime = st.departure_time || st.arrival_time;
    if (!rawTime) continue;
    const minutes = timeToMinutes(rawTime);
    if (minutes === null) continue;

    matchedStopTimeRows++;

    const entry = {
      time: formatWrappedHHMM(minutes),
      minutes,
      direction: trip.direction,
      headsign: trip.headsign,
    };

    for (const dayType of dayTypes) {
      byDayType[dayType].push(entry);
    }
  }

  for (const dayType of Object.keys(byDayType)) {
    byDayType[dayType].sort((a, b) => a.minutes - b.minutes);
  }

  const schedule = {
    station: STATION,
    generatedAt: new Date().toISOString(),
    byDayType,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(schedule, null, 2));

  console.log(`\nWrote ${OUT_FILE}`);
  console.log(`Summary for "${STATION}" (${matchedStopTimeRows} matched stop_time rows):`);
  console.log(`  weekday:  ${byDayType.weekday.length} passings`);
  console.log(`  saturday: ${byDayType.saturday.length} passings`);
  console.log(`  sunday:   ${byDayType.sunday.length} passings`);
}

main();

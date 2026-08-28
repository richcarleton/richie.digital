# REM Transit Ticker

A self-contained, cable-news-style departure chyron for the REM
(Réseau express métropolitain) line. No build step, no frameworks — just a
Node script that pre-bakes a `schedule.json`, and one `index.html` that
renders it.

## How it works

1. **`build-schedule.js`** (run locally, ahead of deploy) reads an unzipped
   GTFS feed and produces `schedule.json`: every scheduled passing at every
   station on `LINE_ORDER` (the real REM station sequence, Deux-Montagnes
   end first), bucketed into `weekday`, `saturday`, and `sunday` schedules
   per station.
2. **`index.html`** is deployed as-is alongside `schedule.json`. It fetches
   the JSON, lets you pick a station from a dropdown (defaults to
   Deux-Montagnes), figures out today's day-type, and renders a
   live-updating ticker of the next ~6 passings with countdowns — plus an
   animated REM-liveried train that periodically crosses the footer, headed
   the correct physical direction for whichever passing it's showing.

There is no server-side logic and no live GTFS-realtime feed — this shows
the static, scheduled timetable, refreshed client-side every second.

## Regenerating the schedule

```sh
node build-schedule.js /path/to/unzipped/gtfs
# or, with a ./gtfs folder next to this script:
node build-schedule.js
```

Required GTFS files: `stops.txt`, `stop_times.txt`, `trips.txt`,
`calendar.txt` and/or `calendar_dates.txt`. `routes.txt` is optional (used
as a headsign fallback).

`LINE_ORDER` at the top of `build-schedule.js` lists every station on the
line, in physical order. The script resolves each one to its `stop_id`(s)
by matching `stop_name` (case/accent insensitive) either directly or via
`parent_station`, so a station with multiple platforms is picked up
automatically. A station not present in the feed (e.g. a projected station
that hasn't opened yet) is skipped with a log line, not a hard failure.
`DEFAULT_STATION` picks which one the frontend selects on first load.

The included `gtfs/` folder is synthetic demo data (not real REM data) —
21 stations, both directions, three day-types — so the ticker has
something realistic to show out of the box. Swap it for a real unzipped
GTFS feed and re-run the script.

### Direction is derived from the line, not from `direction_id`

GTFS `direction_id` is only guaranteed consistent *within one route*, not
tied to any real-world compass or line-diagram direction — relying on it
for "which way is the train animation supposed to travel" produces exactly
the kind of mismatch you'll notice immediately if you're standing on the
platform. Instead, each passing's `lineDirection` is computed by looking up
its `headsign` in `LINE_ORDER`: a headsign earlier on the line than the
station being built is `"upstream"` (headed toward the Deux-Montagnes end),
a headsign later on the line is `"downstream"` (headed toward Brossard).
`direction_id` is kept only as a fallback for a headsign that can't be
resolved against the line (e.g. a generic "Montréal" headsign not exactly
matching a station name — see `HEADSIGN_ALIASES`).

### Other GTFS quirks handled

- **Post-midnight times**: GTFS allows times like `25:10` for a trip that
  runs into the next service day. The generator keeps the true minute count
  (`minutes`) alongside a wrapped display string (`time: "01:10"`) so the
  frontend's countdown math stays correct even when "01:10" actually means
  "later tonight," not "already happened this morning."
- **Quoted CSV fields**: the bundled CSV parser handles quoted fields with
  embedded commas/quotes, since GTFS station names sometimes contain them.
- **calendar.txt vs. calendar_dates.txt**: a service counts as "weekday" if
  any Mon–Fri flag is `1` in `calendar.txt`, "saturday"/"sunday" similarly.
  `calendar_dates.txt` additions (`exception_type=1`) are folded in using
  the day-of-week of the exception date. Single-date removals
  (`exception_type=2`) can't be represented in a generic weekly bucket and
  are logged as ignored — this script builds a *typical week*, not an
  exact calendar.

## Deploying

This folder is a static site — no build command needed. Point a static
host (Cloudflare Pages, GitHub Pages, etc.) at this directory with an empty
build command and `.` as the output directory.

Remember to re-run `build-schedule.js` and redeploy whenever the upstream
GTFS feed changes (new schedule season, service changes, etc.) — the
frontend does not fetch live GTFS-RT data.

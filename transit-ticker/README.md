# Grand-Moulin Transit Ticker

A self-contained, cable-news-style departure chyron for a single GTFS station.
No build step, no frameworks — just a Node script that pre-bakes a
`schedule.json`, and one `index.html` that renders it.

## How it works

1. **`build-schedule.js`** (run locally, ahead of deploy) reads an unzipped
   GTFS feed and produces `schedule.json`: every scheduled passing at the
   station named by the `STATION` constant, bucketed into `weekday`,
   `saturday`, and `sunday` schedules.
2. **`index.html`** is deployed as-is to Cloudflare Pages alongside
   `schedule.json`. It fetches the JSON, figures out today's day-type, and
   renders a live-updating ticker of the next ~6 passings with countdowns.

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

To point at a different station, edit the `STATION` constant at the top of
`build-schedule.js` — it matches `stop_name` exactly (case/accent
insensitive) either directly or via `parent_station`, so it picks up every
platform under a parent station automatically.

The included `gtfs/` folder is synthetic demo data (not real REM data) so
the ticker has something to show out of the box — swap it for a real
unzipped GTFS feed and re-run the script.

### Notes on GTFS quirks handled

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

## Deploying to Cloudflare Pages

This folder is a static site — no build command needed. Point a Cloudflare
Pages project at this directory (or wherever you copy `index.html` +
`schedule.json`) with an empty build command and `.` as the output
directory.

Remember to re-run `build-schedule.js` and redeploy whenever the upstream
GTFS feed changes (new schedule season, service changes, etc.) — the
frontend does not fetch live GTFS-RT data.

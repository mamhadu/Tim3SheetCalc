# Timesheet Calculator

Static browser app for planning monthly timesheets against Portuguese working days.

## What it does

- Calculates working days for a selected month and year
- Excludes weekends, Portuguese holidays, Lisbon municipal holiday, and entered days off
- Supports multiple projects with either target hours or allocation percentages
- Spreads project work across available days with an 8-hour default daily cap
- Shows a week-view calendar plus a left-side allocation breakdown
- Supports refreshing holiday data from an online source and exporting it back to JSON

## Holiday source

Holiday data always comes from [`holidays.json`](./holidays.json).

The file currently contains:

- `fixed`: fixed-date holidays
- `movable`: holidays calculated from Easter using day offsets
- `municipal`: Lisbon municipal holidays
- `onlineSources`: the API endpoint used by the refresh action
- `resolved`: optional downloaded snapshot for a specific year after an online refresh

If a `resolved` block exists for the selected year, the app uses that refreshed snapshot for that year. Otherwise it builds the holiday list from `fixed`, `movable`, and `municipal`.

## Running the app

### Recommended: serve the folder over HTTP

This allows the app to load `holidays.json` automatically.

Example:

```bash
cd /Tim3SheetCalc
python3 -m http.server 8123
```

Then open:

```text
http://127.0.0.1:8123/
```

### Running directly from `file://`

Some browsers block `fetch("./holidays.json")` when the page is opened directly from disk.

If you open `index.html` using `file://`:

- the app will not silently fall back to built-in holidays
- it will ask you to use **Choose holidays.json**
- after choosing the file manually, the calendar works normally

## Basic usage

1. Select the month and year.
2. Confirm the daily work limit, default `8`.
3. Add one or more day-off entries.
4. Add projects and enter either:
   - target hours, or
   - allocation percentage
5. Review the calendar, summary, and left-side allocation breakdown.

## Allocation rules

- Days off reduce available working capacity.
- Day-off ranges count only working days inside the selected month.
- Weekends and holidays inside a day-off range are ignored.
- Project percentages are calculated against the remaining project capacity after holidays and days off are removed.
- The allocation breakdown shows the share of the month’s total weekday capacity used by:
  - holidays
  - each project
  - days off

## Holiday actions in the sidebar

### `Choose holidays.json`

Loads a local JSON file manually. This is mainly for `file://` usage.

### `Refresh holidays online`

Fetches holidays from the configured online source for the selected year and merges the municipal entries from `holidays.json`.

The current source is:

- `https://date.nager.at/api/v3/PublicHolidays/{year}/PT`

### `Download holidays.json`

Exports a JSON file containing:

- the current rule sections from `holidays.json`
- the latest refreshed `resolved` holiday snapshot for the selected year

This lets you:

1. refresh online
2. download the exported file
3. load that file again with **Choose holidays.json**
4. keep using the refreshed holiday list for that year

## Editing holidays manually

Edit [`holidays.json`](./holidays.json) directly.

Examples:

- Remove a fixed holiday from `fixed`
- Add or remove a municipal holiday from `municipal`
- Change a movable holiday offset in `movable`

Invalid or incomplete holiday entries are ignored instead of crashing the app.

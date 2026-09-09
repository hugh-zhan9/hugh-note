# Year Summary Design

## Goal

Build a running annual summary experience under `/summary/:year` that matches the reference site's visual style and interaction model as closely as practical while using this repository's real running data.

The page must:

- use real yearly running data derived from `src/static/activities.json`
- support page-by-page navigation with `Space`, `Enter`, and `ArrowDown`
- keep the reference site's overall visual language, pacing, and layout structure
- generate yearly pages automatically for any year present in the dataset
- require no manual code changes when future yearly data arrives

## Scope

In scope:

- add a new summary route structure based on `:year`
- compute yearly summary data from the existing activities dataset
- implement a six-screen interactive summary flow
- match the reference site's typography, dark grid background, page transitions, and footer affordances
- support desktop and mobile layouts

Out of scope:

- cloning the reference site's bundled source code or asset pipeline
- introducing a separate app or build target
- hand-authoring year-specific copy or page definitions
- changing the current homepage data exploration flow outside the summary route

## Reference Findings

The reference page at `https://running.loongphy.com/2025` uses:

- a six-page full-screen narrative flow
- keyboard-first progression via `Space`, `Enter`, and `ArrowDown`
- a fixed footer hint with keycaps and `current / total` page index
- a dark brown-black background with subtle vertical and horizontal grid lines
- IBM Plex Sans and IBM Plex Mono with restrained motion and fade/slide entrance effects
- a consistent left-aligned editorial layout for section headers and stats

The six reference screens are:

1. Cover with greeting and annual summary sentence
2. Weekly mileage grid with headline metric
3. Start-time scatter plot across the year
4. Highlight metrics
5. Month-by-month vertical day grid
6. Share card / recap screen

## Recommended Approach

Implement the annual summary as a self-contained React page system within the current app, driven by a yearly aggregation layer.

Why this approach:

- it reuses the current Vite and React setup
- it keeps data access local and simple
- it lets future years appear automatically from the dataset
- it avoids brittle scraping, iframes, or a parallel app structure

## Routing

Add or adjust routes as follows:

- `/summary` redirects to the latest available year in the dataset
- `/summary/:year` renders the annual summary for that year
- if `:year` does not exist in the dataset, show a lightweight not-found state within the summary route or redirect to the latest year

The route contract stays small and explicit. No query-string-driven routing is needed.

## Data Model

Add a yearly summary aggregation module that derives the following from raw activities:

- available years
- year title data
- total distance
- total activity count
- distinct running days
- total moving time
- average pace
- average distance per run
- longest distance run
- longest duration run
- most frequent rounded distance bucket, such as `5K`
- weekly mileage totals for all ISO-like calendar weeks intersecting the year
- monthly daily mileage matrix
- start-time points by month, day, and hour
- longest running streak

Rules:

- only running-related activities should feed the annual summary
- multiple runs on the same day must aggregate correctly for day-based views
- summary copy is generated from templates using computed values
- future years must appear automatically once activities exist for that year

## Page Structure

### 1. Cover

Purpose:

- establish the tone
- show the year and an annual summary sentence

Content:

- runner name or site title
- year
- sentence built from annual totals, count, and distinct run days

Behavior:

- initial text fades and slides in
- keyboard hint and page number appear fixed at the bottom

### 2. Weekly Mileage Grid

Purpose:

- show the year's cumulative distance in a dense overview

Content:

- total mileage headline
- weekly average
- a week grid with labels like `第1周`

Behavior:

- cells with distance are highlighted
- active values can render the weekly total below the label, matching the reference feel

### 3. Start-Time Distribution

Purpose:

- show when runs usually start through the year

Content:

- section title and short descriptive copy
- y-axis `0-23`
- x-axis months `1月-12月`
- one marker per run start time

Behavior:

- points animate in with a staggered reveal on first entry
- hover can show a concise tooltip on desktop, but this remains secondary to the static visual

### 4. Annual Highlights

Purpose:

- present top summary facts in a clean editorial layout

Content:

- longest distance and date
- longest duration and date
- most frequent distance bucket and count

Behavior:

- values animate in with a subtle count-up or staged opacity reveal
- layout remains sparse and left-aligned like the reference

### 5. Monthly Vertical Day Grid

Purpose:

- show daily running distribution across the whole year using actual data

Content:

- twelve vertical month columns
- one dot per day
- visual distinction between no-run days, normal run days, and highlighted days
- supporting metrics such as running day count and longest streak

Behavior:

- this page must use aggregated real data from the selected year
- desktop prioritizes matching the reference composition
- mobile collapses spacing without changing the core month-column concept

### 6. Recap / Share Card

Purpose:

- close the flow with a compact summary card suitable for saving or sharing

Content:

- compact stats card
- day grid recap
- actions for restart and download

Behavior:

- `重新开始` resets to page 1
- `下载` exports the rendered recap card as an image
- no `复制` action is required in this phase

## Interaction Model

Global keyboard actions:

- `Space` => next page
- `Enter` => next page
- `ArrowDown` => next page

Additional rules:

- progression stops at the last page
- restart action on the last page returns to page 1
- transitions should be smooth but not heavy
- footer hint stays visible across pages

Animation principles:

- page enter: fade + small translate
- charts: staggered reveal
- no large parallax or complex physics
- motion must remain performant on mid-range mobile devices

## Visual Design

Use a dedicated summary styling layer, separate from the current main page styles.

Visual tokens:

- background: deep brown-black gradient with subtle light falloff
- grid lines: low-contrast warm gray
- primary text: off-white
- secondary text: muted warm gray
- accent: restrained warm highlight close to the reference's orange emphasis

Typography:

- IBM Plex Sans for narrative and headings
- IBM Plex Mono for numeric labels, key hints, and grid annotations

Composition:

- large left margin content block
- wide empty negative space
- fixed bottom affordances
- restrained border radius and soft card surfaces on the final recap page

## Component Boundaries

Add a focused set of summary components rather than one large page file.

Suggested structure:

- `src/pages/summary.tsx` or `src/pages/Summary/index.tsx`
- `src/components/YearSummary/`
- `src/components/YearSummary/PageShell.tsx`
- `src/components/YearSummary/FooterHint.tsx`
- `src/components/YearSummary/pages/`
- `src/utils/yearSummary.ts`

Responsibilities:

- route page loads the year and handles missing-year behavior
- summary controller manages current page state and keyboard progression
- page components render one screen each
- aggregation utilities return a typed yearly summary payload

## Error Handling

If a year has no eligible running data:

- do not render broken charts
- show a compact empty state with a clear message
- offer navigation to the latest valid year

If some metrics are missing:

- render placeholders conservatively
- avoid fake values
- prefer hiding a metric to showing misleading data

## Testing

Add tests before implementation for:

- available year extraction
- yearly aggregation totals
- weekly grid generation
- monthly day grid aggregation
- most frequent distance bucket selection
- route fallback for invalid years if implemented at the utility level

Manual verification after implementation:

- `/summary` redirects to latest year
- `/summary/:year` renders for all available years
- `Space`, `Enter`, and `ArrowDown` advance pages
- footer and page counts stay correct
- desktop and mobile layouts remain usable

## Implementation Notes

- keep the implementation production-friendly and low-complexity
- avoid introducing a large charting dependency for screens that can be rendered with simple DOM or SVG
- prefer CSS and small React utilities over abstraction-heavy animation libraries
- reuse the existing activities context only if it reduces complexity; otherwise the summary flow can read from the same static source directly through a dedicated utility

## Risks

- the monthly and weekly grids can become visually noisy if spacing is not tuned carefully
- future-year auto-generation depends on stable date parsing and activity filtering
- share-card export may require an additional lightweight dependency if native browser APIs are insufficient

## Decision Summary

Proceed with a data-driven annual summary under `/summary/:year`, with `/summary` redirecting to the latest available year, using a six-screen interactive flow that closely matches the reference site's visual and interaction model while remaining maintainable inside the current React app.

# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project

Cakra Nala detects coordinated influence operations (buzzers, bot farms, LLM swarms) and turns them into an operations dashboard for TNI AD cyber analysts. See `README.md` for the product.

## Layout

- `packages/cakranala`: the engine. Detection, simulation, evaluation, Perisai and privacy. Pure TypeScript with no IO, no network and no framework. It depends only on `graphology` and `graphology-communities-louvain`. It must stay reusable anywhere.
- `packages/cakranala-scrap`: the collector module. X, YouTube, Telegram, TikTok, Instagram and Facebook scrapers behind one `createCollector({ pool, tiktok, browser }).collect(target)` call. Instagram and Facebook drive a real Chromium (the `browser` service) over CDP, with target validation and credential rotation through a `CredentialPool` interface. It has no storage; applications supply the pool.
- `packages/cakranala-embeder`: the embedding and language model module. The multilingual e5 `Embedder` (transformers.js, loaded lazily) and an OpenAI compatible `Reasoner`, implementing the engine's ports.
- `cakranala-scrap` and `cakranala-embeder` depend on `cakranala`; `cakranala` never depends on them.
- `apps/web`: the product. All operational logic lives here: monitors, scheduler, SQLite storage, threat cases, alerts, reports, API and UI.
  - `src/server/`: `db.ts` (SQLite), `monitors.ts` (collection and demo feed), `analysis.ts` (analysis loop, cases, alerts), `reports.ts`, `engine.ts` (Perisai and accuracy)
  - `src/routes/`: one file per route, each exporting its TanStack Router route
  - `src/components/`: dashboard-01 block components adapted to this product, plus `components/ui/` from shadcn

## Commands

```bash
bun install
bun test
bun run typecheck
docker compose up -d --build
docker compose --profile test run --rm test
```

Always verify with `bun run typecheck`, `bun test`, and a rebuilt container responding on http://localhost:3000 before you consider work done.

## Code rules

- No comments in code, including vendored shadcn files. Strip them when adding components.
- Keep it lean: no unused files, exports or dependencies, and no speculative abstractions.
- No static knowledge such as keyword lists, slang dictionaries, fixed domain lists or hardcoded similarity thresholds. Derive thresholds from data or take them as options or config.
- The engine stays deterministic: seeded randomness only, and IDs derived from content with `uuidFrom`.
- Every entity ID is a UUID: cases, reports and monitors use `crypto.randomUUID()`, and clusters and narratives use deterministic UUIDs.

## UI rules

- Use shadcn components only, built on the dashboard-01 block. Do not write custom UI primitives; compose shadcn components such as Card, Table, Tabs, Badge, Progress, Empty, Alert, Spinner, Drawer and ToggleGroup.
- Use the default shadcn theme colors and the default font (Geist). Do not customize the palette or font sizes.
- Write UI content in Indonesian: labels, buttons, descriptions, toasts, error messages, case titles, briefs and reports. Keep menu items, tab names and technical terms (STIX, DISARM, SIE, cluster, decoy FDR, platform names) in English. Keep text terse and do not add decorative text.
- Never use dash characters (— or –) or the · separator in UI text. Text from the language model goes through `plain()`.
- Every navigable state is a path route. Never use query parameters or hash routes. Navigate with `Link`, not `onClick`.
- Show cases and reports by their titles, and show UUIDs only in shortened form.

## Data and security

- Never commit `.env`, `data/` or the SQLite database. Never print secrets.
- Collect only public data, and pseudonymize accounts before storage.
- Platform credentials live only in the encrypted vault (`apps/web/src/server/credentials.ts`, key in `data/credential.key`), managed at `/credentials`. Collectors rotate between operator supplied credentials and cool a credential down until its rate limit resets. A credential may carry its own proxy, so each session keeps one network identity. When a platform shows a checkpoint or CAPTCHA, the credential is marked failed for the operator to verify by hand.
- Every API endpoint requires a signed in user, except `/api/auth/*`, `/api/capabilities` and `/api/shield`. There is one role: every user can do everything.

## Git

- Commit each working step with a short, focused message.
- Do not add Co-Authored-By trailers or any AI attribution to commits.

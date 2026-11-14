# Cakra Nala

Cognitive Threat Intelligence and Human Centric Buzzer Defense.

Cakra Nala detects coordinated influence operations on social media (paid buzzers, bot farms and LLM driven swarms) by measuring how dependent accounts are on each other, not by guessing whether a single account is a bot. For every narrative it reports how many **effective independent voices** actually stand behind it, turns detections into tracked threat cases, writes commander reports, and gives citizens a checker for manipulative messages.

Built for the Kartika Cyber Hackathon 2026, Cognitive Domain category.

## How it works

1. **Monitor.** Operators register what to watch on X (a topic, replies and mentions aimed at an account, or one conversation plus the profiles of accounts that reposted it, which feed the account lifecycle layer), YouTube (comments on videos found by a search, or on one video), Telegram (public channels, with forwards traced to their origin), TikTok (comments on videos found by a search, or on one video), or a demo feed that replays a simulated scenario.
2. **Detect.** Every 15 seconds the server collects due monitors and analyzes the last 24 hours with the `cakranala` engine.
3. **Investigate.** The Situation page starts with what needs action. Coordinated clusters and the narratives they push become threat cases with severity, status, evidence, a network graph and the accounts involved.
4. **Respond.** Each case carries an escalation level (watch, alert, urgent) with a response checklist and the DISARM techniques its evidence supports (DISARM Framework, CC BY-SA 4.0, mapping in `apps/web/config/disarm.json`), exports as a STIX 2.1 bundle, and becomes a printable commander report with SHA-256 evidence hashes and a draft public message that uses prebunking.
5. **Protect.** Citizens paste a message or screenshot into Perisai and see the manipulation techniques used (from a configurable taxonomy in `apps/web/config/taxonomy.json`, each quote checked against the message), link impersonation, matching fact checks from TurnBackHoax.id by MAFINDO, and how much real support the narrative has.

### Detection engine

`cakranala` builds a multiplex dependency graph from five independent evidence layers:

| Layer | Signal |
|---|---|
| Co-action | Replies, quotes, URLs and hashtags shared within 15 minutes |
| Semantic co-framing | Same meaning in different words, through embeddings and spherical k-means frames |
| Copypasta | Near duplicate text through character n-grams, MinHash and LSH |
| Rhythm | Activity slots shared beyond chance |
| Account lifecycle | Accounts created the same day with the same handle pattern |

Each layer counts how often two accounts act together and compares it with a null model built from the data itself:

- **Content layers** (co-action, copypasta, co-framing) shuffle which account touched which object inside short time strata. Common shocks such as breaking news stay intact, and only persistent pair identity is broken.
- **Rhythm** shifts each account's whole timeline by whole days (or hours for short windows) and counts distinct co-active periods, so one shared live event is not mistaken for a habit.
- Pair counts are tested with a negative binomial tail whose overdispersion is estimated from the replicates. Layers are merged into evidence families with the Cauchy combination and a Bonferroni partial conjunction.
- The cluster forming threshold is chosen from the data so that the decoy false discovery rate, measured on the replicates, stays at or below 5 percent. Clusters are found with Louvain, pruned to a minimum degree, and kept only when their score beats the maximum score in every replicate (cluster level permutation test).

Every account also gets a coordination score, so analysts can rank accounts even below the cluster threshold. Narrative support is discounted with a Kish style design effect:

```
SIE = organic + Σ n_c / (1 + (n_c − 1) · ρ_c)
```

A narrative is flagged only when its synchronized coordinated share is far above the base rate (binomial test). The verdict is time split: events in each half of the window are judged by clusters detected only in the other half, so the same data never both finds and convicts a cluster. The Evidence tab shows each cluster's permutation p value, score, decoy false discovery rate and the strength of every evidence family.

All thresholds are data driven or configurable, and the engine has no training step and no labels.

## Repository

```
packages/
  cakranala/          detection and simulation engine, pure TypeScript, no IO
  cakranala-scrap/    collector module: X, YouTube, Telegram and TikTok scrapers, validation, credential rotation
  cakranala-embeder/  embedding and language model module: multilingual e5 embedder and any OpenAI compatible language model
apps/
  web/                operations dashboard: Bun.serve API, SQLite, React
```

The collector is its own module and can be used without the web app:

```ts
import { createCollector } from "cakranala-scrap";

const collector = createCollector({ pool, tiktok: sidecarConfig });
const dataset = await collector.collect({ platform: "telegram", kind: "account", target: "channel_one, channel_two", pages: 2 });
```

`pool` is any `CredentialPool` (count, acquire, ok, limited, failed, identity, setIdentity). The web app implements it with its encrypted vault; a script can implement it with a plain array. Telegram and YouTube work with an empty pool.

The engine never imports the other packages. Applications inject an `Embedder` and a `Reasoner` (from `cakranala-embeder`, or their own) when they want the semantic layer, briefs and Perisai explanations; without them it still runs.

```ts
import { analyze, evaluate, simulate } from "cakranala";
import { createE5Embedder, reasonerFromEnv } from "cakranala-embeder";
import scenario from "cakranala/scenarios/seruni.json";

const embedder = await createE5Embedder();
const reasoner = reasonerFromEnv();
const dataset = simulate(scenario, 1);
const report = await analyze(dataset, { embedder, reasoner });
console.log(evaluate(report, dataset.truth!));
```

## Web app

Stack: Bun, React 19, TanStack Router, TanStack Query, Tailwind CSS 4, shadcn/ui (dashboard-01), Recharts, Sigma.js, SQLite (`bun:sqlite`).

| Route | Purpose |
|---|---|
| `/` | Situation: KPIs, 24 hour activity, alerts, threat table |
| `/threats` | All threat cases by status |
| `/threats/:id` | Case summary, with `/evidence`, `/network` and `/accounts` |
| `/actors`, `/actors/:id`, `/actors/watchlist` | Actor profiles across cases and the account watchlist, with alerts when a watched account joins an operation |
| `/monitors`, `/monitors/new`, `/monitors/templates`, `/monitors/import` | Monitors per platform, new monitors, ready made templates, one click monitors from current trends, and data import (X transparency archive CSV or Cakra Nala dataset JSON, up to 24 hours, shifted into the analysis window) |
| `/reports`, `/reports/:id` | Commander reports rendered as PDF (Typst), counter narrative drafts |
| `/perisai` | Public message and screenshot checker |
| `/system` | Integrations, real data validation, audit chain |
| `/login` | Sign in, or create the first account on a fresh install |
| `/users` | Add users, change passwords, remove users |
| `/credentials` | Encrypted platform credentials |

With `DEMO_MODE=1` the server creates a demo feed that replays the fictional Pulau Seruni scenario (8 hours in 8 minutes), so the dashboard comes alive without any external data. Without it, demo feeds are hidden and only real monitors run.

## Run

Requirements: Docker with Compose.

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:3000. The multilingual embedding model is downloaded during the image build, so the container runs offline afterwards.

Run the tests inside Docker:

```bash
docker compose --profile test run --rm test
```

### Deploy to a server

1. Point a DNS record at the server and install Docker with Compose.
2. Clone the repository, `cp .env.example .env`, and set `DOMAIN` and `PSEUDONYM_SECRET`.
3. Start it with automatic HTTPS, then open the site right away and create the first account (the first visitor to a fresh install creates it):

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Back up `./data` regularly. It holds the SQLite database with cases, reports and the audit chain.
5. Update with `git pull` followed by the same `up -d --build` command.

Only Caddy is exposed (ports 80 and 443). The dashboard requires signing in. Passwords are hashed with Argon2id, sessions are HttpOnly cookies, and sign in attempts are rate limited per address. There is a single role: every user can do everything, and every change is recorded in the audit log with the username. The Perisai API (`/api/shield`) stays public and rate limited.

### Configuration

| Variable | Purpose |
|---|---|
| `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | Language model for case titles, briefs, reports, counter narratives and Perisai. Any OpenAI compatible endpoint works, including a self hosted model. Optional. |
| `PSEUDONYM_SECRET` | HMAC key used to pseudonymize collected accounts. |
| `DOMAIN` | Public domain for HTTPS in the production compose file. |
| `DEMO_MODE` | Set to `1` to replay the fictional demo scenario next to real monitors. Off by default. |
| `LIBRARY_FEED` | RSS feed of published fact checks that Perisai matches against, refreshed hourly. |
| `SHIELD_PER_MINUTE` | Perisai requests allowed per address per minute, 20 by default. |
| `REPORT_CLASSIFICATION` | Classification marking printed on every report page, `RESTRICTED` by default. |
| `PORT` | HTTP port, 3000 by default. |

Collected data and the SQLite database live in `./data`, mounted as a volume.

### TikTok

TikTok is collected through an optional sidecar, [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) (Apache 2.0), with its TimescaleDB, Redis and worker, under the `tiktok` compose profile. Set `TIKTOK_SIDECAR_URL=http://tiktok:8000`, `TIKTOK_SIDECAR_PASSWORD`, `TIKTOK_SECRET_KEY` (at least 32 characters) and `TIKTOK_DB_PASSWORD` in `.env`, then start with `docker compose --profile tiktok up -d --build` (add `-f docker-compose.prod.yml` on a server). The sidecar needs a TikTok session: add one at `/credentials` (the full cookie header including `ttwid`, and the exact user agent it came from). Cakra Nala imports each vault credential into the sidecar once and routes requests through it.

### Platform credentials

Platform sessions are not configured through environment variables. Operators add, test, disable, rotate out and remove them at `/credentials`. Test connection signs in with the session before it is saved and shows the account behind it (X: handle, name, followers and account age; YouTube: the signed in channel; TikTok: whether the sidecar accepts the cookie set and whether it is signed in). Every save is tested automatically and the verified account is stored with the credential. Each credential is encrypted with AES-GCM before it is stored in SQLite; the key is generated on first start in `data/credential.key` (file mode 600), so back it up together with the database. Collectors take the least recently used ready credential, put a credential on cooldown until its rate limit resets, move on to the next one, and disable a credential after three consecutive failures. X needs session cookies; YouTube works without a credential and uses one when present; TikTok uses one through its sidecar.

## Development

```bash
bun install
bun test
bun run typecheck
bun run dev
```

`bun run dev` starts the web app with hot reload on http://localhost:3000 and reads `.env` from the repository root.

## Data, privacy and limits

- Only public data is collected. Handles are replaced with HMAC pseudonyms before storage.
- Results are indicative patterns of coordinated behavior, never accusations against individuals.
- Live collection uses public web endpoints of X, YouTube and Telegram. It respects rate limits, waits for the reset when limited, rotates only between credentials the operator supplied, and never attempts to bypass CAPTCHAs or bot protection.
- Every state change (monitors, case status, reports) is written to an append only audit log where each entry carries the SHA-256 of the previous one. The System page verifies the chain.
- Accuracy is measured on labeled archives of real state influence operations and on simulated scenarios. On the real archives, account ranking reaches an average precision of 0.76 and 0.94, against 0.22 and 0.75 for ranking by post volume, with no control account placed in a cluster and no clusters on time shifted data. On simulations, bot farms and paid buzzers are caught almost completely with no organic or viral account flagged, and patient LLM swarms remain the hardest case.

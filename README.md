# Cakra Nala

Cognitive Threat Intelligence and Human Centric Buzzer Defense.

Cakra Nala detects coordinated influence operations on social media (paid buzzers, bot farms and LLM driven swarms) by measuring how dependent accounts are on each other, not by guessing whether a single account is a bot. For every narrative it reports how many **effective independent voices** actually stand behind it, turns detections into tracked threat cases, writes commander reports, and gives citizens a checker for manipulative messages.

Built for the Kartika Cyber Hackathon 2026, Cognitive Domain category.

## How it works

1. **Monitor.** Operators register what to watch: a topic, an account (replies and mentions aimed at it), a single post, or a demo feed that replays a simulated scenario.
2. **Detect.** Every 15 seconds the server collects due monitors and analyzes the last 24 hours with the `cakranala` engine.
3. **Investigate.** Coordinated clusters and the narratives they push become threat cases with severity, status, evidence, a network graph and the accounts involved.
4. **Respond.** Each case carries an escalation level (watch, alert, urgent) with a response checklist, exports as a STIX 2.1 bundle, and becomes a printable commander report with SHA-256 evidence hashes and a draft public message that uses prebunking.
5. **Protect.** Citizens paste a message or screenshot into Perisai and see the manipulation techniques used, link impersonation, and how much real support the narrative has.

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

A narrative is flagged only when its synchronized coordinated share is far above the dataset base rate (binomial test).

All thresholds are data driven or configurable, and the engine has no training step and no labels.

## Repository

```
packages/
  cakranala/          detection and simulation engine, pure TypeScript, no IO
  collect-x/          X collector: search through the web GraphQL API with a session
  embed-e5/           Embedder: multilingual-e5-small through transformers.js
  reasoner-openai/    Reasoner: any OpenAI compatible chat API (DeepSeek by default)
apps/
  web/                operations dashboard: Bun.serve API, SQLite, React
```

The engine never imports the other packages. Applications inject an `Embedder` and a `Reasoner` when they want the semantic layer, briefs and Perisai explanations; without them it still runs.

```ts
import { analyze, evaluate, simulate } from "cakranala";
import scenario from "cakranala/scenarios/seruni.json";

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
| `/monitors`, `/monitors/new` | What is being watched, and adding new monitors |
| `/reports`, `/reports/:id` | Commander reports, print or save as PDF, counter narrative drafts |
| `/perisai` | Public message and screenshot checker |
| `/system` | Real data validation, simulated accuracy, audit chain |
| `/operator` | Operator sign in for actions that change state |

On first start with an empty database the server creates a demo feed that replays the fictional Pulau Seruni scenario (8 hours in 8 minutes), so the dashboard comes alive without any external data.

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
2. Clone the repository, `cp .env.example .env`, and set `DOMAIN`, `OPERATOR_TOKEN` (a long random string) and `PSEUDONYM_SECRET`.
3. Start it with automatic HTTPS:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Back up `./data` regularly. It holds the SQLite database with cases, reports and the audit chain.
5. Update with `git pull` followed by the same `up -d --build` command.

Only Caddy is exposed (ports 80 and 443). Anyone can view the dashboard and use Perisai (rate limited per address). Creating monitors, changing case status and writing reports require signing in at `/operator` with the operator token.

### Configuration

| Variable | Purpose |
|---|---|
| `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | Language model for case titles, briefs, reports, counter narratives and Perisai. Any OpenAI compatible endpoint works, including a self hosted model. Optional. |
| `X_AUTH_TOKEN`, `X_CT0`, `X_USER_AGENT` | Session cookies of a dedicated X account for live monitors. Optional. |
| `OPERATOR_TOKEN` | Required to change monitors, case status and reports. |
| `PSEUDONYM_SECRET` | HMAC key used to pseudonymize collected accounts. |
| `DOMAIN` | Public domain for HTTPS in the production compose file. |
| `SHIELD_PER_MINUTE` | Perisai requests allowed per address per minute, 20 by default. |
| `PORT` | HTTP port, 3000 by default. |

Collected data and the SQLite database live in `./data`, mounted as a volume.

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
- Live collection relies on unofficial endpoints of X. It respects rate limits, backs off when limited, and never attempts to bypass CAPTCHAs or bot protection.
- Every state change (monitors, case status, reports) is written to an append only audit log where each entry carries the SHA-256 of the previous one. The System page verifies the chain.
- Accuracy is measured on labeled archives of real state influence operations and on simulated scenarios. On the real archives, account ranking reaches an average precision of 0.76 and 0.94, against 0.22 and 0.75 for ranking by post volume, with no control account placed in a cluster and no clusters on time shifted data. On simulations, bot farms and paid buzzers are caught almost completely with no organic or viral account flagged, and patient LLM swarms remain the hardest case.

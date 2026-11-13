# Cakra Nala

Cognitive Threat Intelligence and Human Centric Buzzer Defense.

Cakra Nala detects coordinated influence operations on social media (paid buzzers, bot farms and LLM driven swarms) by measuring how dependent accounts are on each other, not by guessing whether a single account is a bot. For every narrative it reports how many **effective independent voices** actually stand behind it, turns detections into tracked threat cases, writes commander reports, and gives citizens a checker for manipulative messages.

Built for the Kartika Cyber Hackathon 2026, Cognitive Domain category.

## How it works

1. **Monitor.** Operators register what to watch: a topic, an account (replies and mentions aimed at it), a single post, or a demo feed that replays a simulated scenario.
2. **Detect.** Every 15 seconds the server collects due monitors and analyzes the last 24 hours with the `cakranala` engine.
3. **Investigate.** Coordinated clusters and the narratives they push become threat cases with severity, status, evidence, a network graph and the accounts involved.
4. **Respond.** A case becomes a printable commander report and a draft public message that uses prebunking.
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

Each account pair is tested against what chance would produce, given how rare the shared content is and how active both accounts are (Poisson tail, Benjamini Hochberg FDR). A pair must be significant on at least two layers and in at least two separate episodes, which keeps one-off viral crowds out. Louvain groups the pairs into clusters. Forensics recover the start time, waves, the account order across waves (a sign of scripts), cadence, seeders and talking points. Narrative support is discounted with a Kish style design effect:

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
| `/system` | Detection accuracy by operation type and configuration |

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

### Configuration

| Variable | Purpose |
|---|---|
| `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | Language model for case titles, briefs, reports, counter narratives and Perisai. Any OpenAI compatible endpoint works, including a self hosted model. Optional. |
| `X_AUTH_TOKEN`, `X_CT0`, `X_USER_AGENT` | Session cookies of a dedicated X account for live monitors. Optional. |
| `OPERATOR_TOKEN` | Required to create, pause or delete live monitors. |
| `PSEUDONYM_SECRET` | HMAC key used to pseudonymize collected accounts. |
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
- Quantitative accuracy is measured on simulated scenarios with known ground truth. On those, precision is 100 percent, bot farms and paid buzzers are mostly caught, and patient LLM swarms remain the hardest case.

# SkyShift X

**See how the infrared sky changes over time.** A public-facing web tool for NASA Space Apps Challenge 2026, *Planet X and SPHEREx*.

- **Time Explorer** — choose a patch of sky and two dates; compare side by side, blink, or view the difference image; inspect flagged candidates.
- **3D explorer** — the Sun, planets, Kuiper Belt, SPHEREx and the *hypothetical* Planet Nine search region.
- **Discovery Journeys** — narrated, captioned investigations that tie images, spectra and evidence together.

> **Demo build:** every observation, candidate and spectrum is **simulated** and labelled. No new planet has been found. Planet Nine is an unconfirmed hypothesis.

## Run it

```bash
node --version         # use Node.js 24 LTS; pnpm 10.28.0
pnpm install
pnpm dev               # http://localhost:5173  (mock data)
```

```bash
pnpm check             # lint + typecheck + unit tests + production build
pnpm e2e               # end-to-end tests
```

Connect the real backend:

```bash
VITE_API_MODE=live VITE_API_BASE_URL=http://localhost:8000 pnpm dev
```

In live mode there is no fallback to mock data; failures are shown as errors. To try live mode before the Python service exists, run `pnpm mock:server` (a reference backend on port 8000).

## Deploy the demo

`pnpm build` produces a fully static site in `dist/` that works from any folder on any static host (relative asset paths, hash-based routes). Vercel uses the repository-root `vercel.json` with Node.js 24.x and pnpm 10.28.0. Import the repository into Vercel and use `main` as the production branch for automatic deployments. No environment variables or backend are required for the demo. See [docs/deployment.md](docs/deployment.md). The optional GitHub Pages workflow is manual (`workflow_dispatch`) and requires Pages to be configured first.

## For the backend team

Start at **[docs/api/README.md](docs/api/README.md)**: the contract, rules, endpoint table and example requests/responses. `docs/api/openapi.json` is generated from the Zod contracts in `src/contracts/v1`.

## Documentation

| Doc | What it covers |
|---|---|
| [docs/status.md](docs/status.md) | What works today, verified how, and known limitations |
| [docs/architecture.md](docs/architecture.md) | Structure, data flow, journey engine, rules |
| [docs/challenge-alignment.md](docs/challenge-alignment.md) | How each feature answers the challenge |
| [docs/api/README.md](docs/api/README.md) | API contract and backend integration guide |
| [docs/roadmap.md](docs/roadmap.md) | Priorities and next steps |
| [docs/adr/README.md](docs/adr/README.md) | Decisions and rejected alternatives |
| [docs/assets.md](docs/assets.md) | Imagery policy and asset manifest |
| [CLAUDE.md](CLAUDE.md) | Working agreement for Claude Code sessions and contributors |

# legal-watch

Weekly AI-assisted scan for new or changed Vietnamese crypto-asset law.

- **When:** every Monday at 08:00 Vietnam time (`.github/workflows/legal-watch.yml`), or manually via *Actions → Legal watch → Run workflow*.
- **How:** Perplexity Agent API (`POST /v1/agent`, web search limited to the review window and to official/major Vietnamese domains, JSON-schema output with citations).
- **Baseline:** what the public tracker already says: `content/phap-ly/*.md`, `content/phap-ly/_cap-phep.json`, and `reviewedAt`/`nextReviewDue` in `docs/LEGAL_REGISTER.md`.
- **Output:** opens (or comments on) one open issue labelled `legal-watch` when there are new or changed instruments, a licensing change, or the review deadline is ≤ 7 days away. Otherwise it only writes the job summary.
- **Never** edits legal content. AI results are leads; a human verifies each against the original document, then updates the register and content.

## Setup

```bash
gh secret set PERPLEXITY_API_KEY   # paste the key when prompted
```

Optional: change the preset (`fast` | `low` | `medium` | `high`) when running manually. The default is `low`, a reasoning preset.

## Local run

```bash
PERPLEXITY_API_KEY=... DRY_RUN=1 pnpm --filter @app/legal-watch start
```

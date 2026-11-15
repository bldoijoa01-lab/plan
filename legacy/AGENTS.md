<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# pages

## Purpose
GitHub Pages copy of the study-plan web app screen (`https://bldoijoa01-lab.github.io/plan/`, repo `bldoijoa01-lab/plan`). Static, no secrets: the user enters the UI token in the page's prompt (stored in the browser's localStorage). Since 2026-11-02 its `EXEC_URL` points at the Cloudflare Worker (`../cloud/`).

## Key Files
| File | Description |
|------|-------------|
| `index.html` | Generated from `../study-plan-dashboard/Index.html` by `node ../scratch/tests/publish_pages.js` (rewrites `EXEC_URL` to the Worker). Never edit by hand. |
| `README.md` | Repo readme. |

## For AI Agents
- Change the UI in `study-plan-dashboard/Index.html`, regenerate, then commit + push from this directory (own git repo; use a local `-c user.email/-c user.name` if identity is unset).
- Do not put tokens in this repo.

<!-- MANUAL: -->

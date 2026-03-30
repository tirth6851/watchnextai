# Repository Guidelines

## Project Structure & Module Organization
`backend/app.py` contains the Flask app, page routes, and `/api/*` endpoints. `backend/recommender.py` holds recommendation logic. `api/index.py` is the Vercel entry point that imports the Flask app.

UI files live in `templates/` (Jinja2 pages) and `static/` (`static/js/` for browser logic, `static/css/style.css` for global styles). Database schema and RLS policies live in `supabase/schema.sql`. Keep new server code in `backend/`, not `api/`, unless it is Vercel-specific wiring.

Repository-specific agent notes also exist in `CLAUDE.md`. Keep `AGENTS.md` aligned with it when workflow, architecture, or local command guidance changes.

## Build, Test, and Development Commands
Install dependencies with:

```bash
pip install -r requirements.txt
```

Run the local dev server:

```bash
flask run
FLASK_DEBUG=1 flask run
```

The app serves at `http://localhost:5000`. There is no separate build step; deployment is driven by `vercel.json` and Vercel’s Python runtime.

## Coding Style & Naming Conventions
Follow existing style in each layer. Python uses PEP 8 style with 4-space indentation and `snake_case` for functions and helpers. JavaScript in `static/js/` uses `camelCase` for functions and state fields. Template filenames are lowercase with underscores, such as `movie_detail.html`.

Prefer small helper functions over adding more inline logic to long route handlers. Reuse existing naming patterns like `*_detail.html`, `/api/<type>/<id>`, and `tmdb_get(...)`.

## Testing Guidelines
There is currently no automated test suite or lint configuration in this repository. For changes, verify manually by running `flask run` and exercising the affected page or API route locally.

When adding tests later, place them under `tests/` and use filenames like `test_recommender.py`. Focus first on API behavior, recommendation scoring, and auth-sensitive flows.

## Commit & Pull Request Guidelines
Recent history uses short conventional subjects such as `feat: ...` and `fix: ...`. Keep commit messages imperative and scoped, for example `fix: handle empty TMDB responses`.

Pull requests should include a concise summary, linked issue numbers when applicable, and screenshots or short recordings for UI changes. Note any required env vars or Supabase schema changes in the PR description.

## Security & Configuration Tips
Set `TMDB_API_KEY` and `GROQ_API_KEY` in a local `.env`. Do not commit secrets. If you change auth or database behavior, update `supabase/schema.sql` and document any required client-side Supabase config changes in `static/js/auth.js`.

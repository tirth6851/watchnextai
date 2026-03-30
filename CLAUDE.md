# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` serves the same purpose for OpenAI Codex. Keep both files aligned when architecture, commands, or workflow guidance changes.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (Flask dev server at http://localhost:5000)
flask run

# Run with debug mode
FLASK_DEBUG=1 flask run

# Set env vars (required)
# TMDB_API_KEY, GROQ_API_KEY
# Optional (Supabase has hardcoded fallbacks): SUPABASE_URL, SUPABASE_ANON_KEY
```

No build step, no tests, no lint tools configured. Deployment is via Vercel (push to main → automatic deploy).

## Architecture

**Stack:** Python/Flask backend, Vanilla JS frontend, Jinja2 templates, Supabase (PostgreSQL + auth), TMDB API, Jikan API (anime), Groq API (AI chat).

**Entry point:** `api/index.py` → imports Flask app from `backend/app.py`. Vercel routes all requests here.

### Backend (`backend/app.py`)

All routes and business logic in one file (~900 lines). Two categories:

- **Page routes** (`/`, `/browse`, `/movie/<id>`, `/tv/<id>`, `/anime/<id>`, `/person/<id>`, `/profile`) — render Jinja2 templates
- **API routes** (`/api/*`) — return JSON, consumed by frontend JS

Key API groups:
- `/api/movies`, `/api/tv_shows`, `/api/anime` — paginated content lists with category/genre/search params
- `/api/movie/<id>`, `/api/tv/<id>` — details, trailers, credits, watch providers, reviews
- `/api/person/<id>` — cast/crew details and filmography
- `/api/recommendations` — personalized recs (requires user JWT), delegates to `recommender.py`
- `/api/chat` — Groq-powered AI chatbot (Llama 3.3-70B)
- `/api/comments` — user reviews stored in Supabase
- `/api/search`, `/api/autocomplete` — unified cross-type search

Helper: `tmdb_get(endpoint, params)` — wraps all TMDB API calls with base URL and API key.

### Recommendation Engine (`backend/recommender.py`)

Content-based filtering:
1. Fetch user's 50 most recent watched items + ratings from Supabase
2. Pick top 8 seeds (rated items preferred)
3. Fetch TMDB `/recommendations` + `/similar` for each seed in parallel (4 threads)
4. Score candidates: freq_score (40%) + weight_score (25%) + genre_score (25%) + quality (10%)
5. Filter already-watched, return top-N

### Frontend (`static/js/`)

- **script.js** — Main browse page: infinite scroll, tab switching (Movies/TV/Anime/ForYou), genre sidebar, category buttons, search. Manages `state` object with page/category/contentType/query.
- **auth.js** — Supabase auth functions (signUp, signIn, signOut, passwordReset)
- **auth-modal.js** — Sign in/up modal UI, form validation, password strength meter
- **home.js** — Landing page carousels and hero section

Supabase JS client is initialized client-side in templates with the anon key (public, safe per Supabase's design).

### Database (`supabase/schema.sql`)

Three tables with Row-Level Security (`auth.uid() = user_id`):
- **watchlist** — items to watch
- **watched** — finished items with optional 1–10 rating
- **watching** — in-progress with season/episode tracking

### Templates (`templates/`)

Jinja2. Each content type has its own detail template (`movie_detail.html`, `tv_detail.html`, `anime_detail.html`). Browse/discover uses `index.html`. Auth modals are included via partials.

### Styling (`static/css/style.css`)

CSS custom properties for dark/light theming (`--bg`, `--fg`, `--primary`, etc.). Dark by default; light via `html[data-theme="light"]`. Responsive grid with `auto-fit` columns.

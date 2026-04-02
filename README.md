# WatchNextAI 🎬

> A movie, TV show, and anime discovery web app powered by Flask and the TMDB API, with AI-driven recommendations, user authentication, and a personal watchlist.

---

## 🌟 Features

- **Movies, TV Shows & Anime** — Browse all three content types with dedicated detail pages
- **Categories** — Discover, Trending, Popular, Top Rated, Upcoming, Now Playing, On Air, Airing Today
- **AI Recommendations** — Powered by the Groq API for smart, context-aware suggestions
- **Search** — Live search across the entire TMDB library
- **User Auth** — Sign up / sign in / sign out via Supabase (email + password)
- **Watchlist** — Save titles to your personal watchlist (requires sign in)
- **Dark / Light Mode** — Theme toggle persisted per session
- **Responsive UI** — Works on desktop and mobile
- **Password Strength Meter** — Visual feedback during sign-up
- **Profile Page** — View and manage your account

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask |
| Frontend | HTML, CSS, Vanilla JavaScript, Jinja2 |
| Auth & DB | Supabase (PostgreSQL) |
| Movie Data | TMDB API |
| AI | Groq API |
| Deployment | Vercel |

---

## 📦 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/tirth6851/watchnextai.git
cd watchnextai
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables

Create a `.env` file in the root:
```env
TMDB_API_KEY=your_tmdb_api_key
GROQ_API_KEY=your_groq_api_key
```

> TMDB keys are free at [themoviedb.org](https://www.themoviedb.org/settings/api).
> Groq keys are free at [console.groq.com](https://console.groq.com).

### 4. Configure Supabase auth

In `static/js/auth.js`, replace the placeholders with your own project values from the [Supabase dashboard](https://supabase.com):
```js
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 5. Run locally
```bash
flask run
```

Open [http://localhost:5000](http://localhost:5000).

---

## 🚀 Deploy to Vercel

1. Push the repo to GitHub
2. Import into [vercel.com](https://vercel.com) — it auto-detects `vercel.json`
3. Add these environment variables in the Vercel dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `TMDB_API_KEY` | ✅ Yes | [themoviedb.org](https://www.themoviedb.org/settings/api) |
| `GROQ_API_KEY` | ✅ Yes | [console.groq.com](https://console.groq.com) |
| `SUPABASE_URL` | Optional | Defaults to shared instance |
| `SUPABASE_ANON_KEY` | Optional | Defaults to shared instance |
| `SMTP_USER` / `SMTP_PASS` | Optional | For welcome/check-in emails |

4. Deploy — Vercel builds and serves automatically on every push to `main`

---

## 🌐 Live Demo

[watchnextai-orpin.vercel.app](https://watchnextai-orpin.vercel.app)

---

## 📁 Project Structure

```
watchnextai/
├── api/
│   └── index.py          # Vercel serverless entry point
├── backend/
│   ├── app.py            # Flask app & routes
│   └── recommender.py    # AI recommendation logic (Groq)
├── static/
│   ├── css/style.css
│   └── js/
│       ├── auth.js        # Supabase auth functions
│       ├── auth-modal.js  # Sign in / sign up modal UI
│       └── script.js      # Main frontend logic
├── templates/
│   ├── index.html         # Home / discover page
│   ├── movie_detail.html  # Movie detail page
│   ├── tv_detail.html     # TV show detail page
│   ├── anime_detail.html  # Anime detail page
│   ├── profile.html       # User profile page
│   ├── privacy.html
│   └── terms.html
├── requirements.txt
└── vercel.json
```

---

## 👨‍💻 About

Built by **Tirth Patel**, a CS student passionate about AI, Python, and media tech.

- [GitHub](https://github.com/tirth6851)
- [LinkedIn](https://www.linkedin.com/in/tirth-patel-949197346/)

---

## 📝 License

MIT — see [LICENSE](LICENSE).

**Last updated: March 2026**

from flask import Flask, render_template, request, jsonify
import os
import re
import smtplib
import threading
import random
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
import requests
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from groq import Groq
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)

app = Flask(
    __name__,
    template_folder=str(ROOT / "templates"),
    static_folder=str(ROOT / "static"),
    static_url_path="/static",
)

# Reject request bodies larger than 512 KB
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024

# Rate limiter — in-memory per process (adequate for single-instance / Vercel)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["300 per hour"],
    storage_uri="memory://",
)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)
_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{1,63}$")

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
REQUEST_TIMEOUT = 10
# Public anon key — safe to hardcode (already in JS frontend)
SUPABASE_URL  = os.getenv("SUPABASE_URL",  "https://lqlqurgthkdknxwwgygx.supabase.co")
SUPABASE_ANON = os.getenv("SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im"
    "xxbHF1cmd0aGtka254d3dneWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDkzNDcsImV"
    "4cCI6MjA4NjUyNTM0N30.OzS9coMZ3YJc9lumZWrIo5aQS2zT0YHHu3I1rKDoioI"
)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPPORTED_COMMENT_MEDIA_TYPES = {"movie", "tv", "anime"}

# Initialize Groq client
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

if not TMDB_API_KEY:
    app.logger.warning("TMDB_API_KEY is not configured. TMDB-backed routes will fail until it is set.")

_TMDB_ROUTE_PREFIXES = (
    "/api/movies", "/api/tv_shows", "/api/movie/", "/api/tv/",
    "/api/person/", "/api/genres", "/api/autocomplete",
    "/api/search", "/api/recommendations",
)

@app.before_request
def guard_tmdb_key():
    if not TMDB_API_KEY and request.path.startswith(_TMDB_ROUTE_PREFIXES):
        return jsonify({"error": "TMDB_API_KEY is not configured on this server."}), 503


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Request body too large (max 512 KB)."}), 413


@app.errorhandler(429)
def rate_limited(_):
    return jsonify({"error": "Too many requests. Please slow down."}), 429

MOVIE_ENDPOINTS = {
    "trending": "/trending/movie/week",
    "popular": "/movie/popular",
    "top_rated": "/movie/top_rated",
    "upcoming": "/movie/upcoming",
    "now_playing": "/movie/now_playing",
}

TV_ENDPOINTS = {
    "trending": "/trending/tv/week",
    "popular": "/tv/popular",
    "top_rated": "/tv/top_rated",
    "on_air": "/tv/on_the_air",
    "airing_today": "/tv/airing_today",
}

# Jikan API (MyAnimeList) for anime
JIKAN_BASE_URL = "https://api.jikan.moe/v4"


def tmdb_get(path: str, **params):
    if not TMDB_API_KEY:
        return None, "Missing TMDB_API_KEY."

    params["api_key"] = TMDB_API_KEY
    url = f"{TMDB_BASE_URL}{path}"

    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json(), None
    except requests.exceptions.Timeout:
        return None, "Request timed out."
    except requests.exceptions.RequestException:
        return None, "Upstream service unavailable."


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/browse")
def index():
    return render_template("index.html")


@app.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    return render_template("movie_detail.html", movie_id=movie_id)


@app.route("/api/movies")
def get_movies():
    category = request.args.get("category", "popular")
    page = request.args.get("page", 1, type=int)
    genre_id = request.args.get("genre_id", "")

    if genre_id and category != "search":
        data, err = tmdb_get(
            "/discover/movie",
            page=page,
            sort_by="popularity.desc",
            include_adult="false",
            include_video="false",
            with_genres=genre_id,
        )
        if err:
            return jsonify({"movies": [], "error": err}), 502
        return jsonify({"movies": (data or {}).get("results", [])})

    if category == "search":
        query = request.args.get("query", "")
        if not query:
            return jsonify({"movies": [], "error": "No query provided."}), 400

        data, err = tmdb_get(
            "/search/movie",
            query=query,
            page=page,
            include_adult="false",
        )

        if err:
            return jsonify({"movies": [], "error": err}), 502
        
        # Filter out low-quality movies
        results = (data or {}).get("results", [])
        filtered_movies = [
            movie for movie in results 
            if movie.get("vote_count", 0) > 50 or movie.get("popularity", 0) > 5
        ]
        return jsonify({"movies": filtered_movies})
            
        
    if category == "discover":
        data, err = tmdb_get(
            "/discover/movie",
            page=page,
            sort_by="vote_average.desc",
            include_adult="false",
            include_video="false",
            **{"vote_count.gte": 50, "with_original_language": "en"},  # Filter high-quality movies
        )
        if err:
            return jsonify({"movies": [], "error": err}), 502

        return jsonify({"movies": (data or {}).get("results", [])})

    if category in MOVIE_ENDPOINTS:
        data, err = tmdb_get(MOVIE_ENDPOINTS[category], page=page)

        if err:
            return jsonify({"movies": [], "error": err}), 502

        return jsonify({"movies": (data or {}).get("results", [])})

    return jsonify({"movies": [], "error": "Unknown category."}), 400


@app.route("/api/movie/<int:movie_id>")
def get_movie_details(movie_id):
    data, err = tmdb_get(f"/movie/{movie_id}")

    if err:
        return jsonify({"error": err}), 502

    return jsonify(data or {})


@app.route("/api/movie/<int:movie_id>/trailer")
def get_movie_trailer(movie_id):
    data, err = tmdb_get(f"/movie/{movie_id}/videos")

    if err:
        return jsonify({"error": err}), 502

    # Find YouTube trailer
    videos = (data or {}).get("results", [])
    trailer = next((v for v in videos if v.get("type") == "Trailer" and v.get("site") == "YouTube"), None)
    
    if trailer:
        return jsonify({"key": trailer.get("key")})
    
    return jsonify({"key": None})


@app.route("/api/chat", methods=["POST"])
@limiter.limit("20 per hour")
def chat():
    if not groq_client:
        return jsonify({"error": "Chatbot service not available. GROQ_API_KEY not configured."}), 503

    try:
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return jsonify({"error": "Invalid JSON body."}), 400
        movie_title    = str(data.get("movie_title", ""))[:200]
        movie_overview = str(data.get("movie_overview", ""))[:1000]
        user_message   = str(data.get("message", "")).strip()

        if not user_message:
            return jsonify({"error": "No message provided."}), 400
        if len(user_message) > 500:
            return jsonify({"error": "Message too long (max 500 characters)."}), 400
        
        # Create context-aware prompt
        system_prompt = f"""You are a friendly movie discussion assistant. You're currently discussing the movie '{movie_title}'. 
        
Movie Overview: {movie_overview}
        
Help users by:
- Answering questions about the movie
- Discussing themes, characters, and plot points
- Providing insights and analysis
- Recommending similar movies
- Being conversational and engaging

Keep responses concise (2-3 paragraphs max) and friendly."""
        
        # Call Groq API
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=500
        )
        
        response_text = chat_completion.choices[0].message.content
        
        return jsonify({"response": response_text})
        
    except Exception:
        return jsonify({"error": "Chat service unavailable. Please try again later."}), 500


@app.route("/health")
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# TV Shows routes
@app.route("/tv/<int:tv_id>")
def tv_detail(tv_id):
    return render_template("tv_detail.html", tv_id=tv_id)

@app.route("/api/tv_shows")
def get_tv_shows():
    category = request.args.get("category", "popular")
    page = request.args.get("page", 1, type=int)
    genre_id = request.args.get("genre_id", "")

    if genre_id and category != "search":
        data, err = tmdb_get(
            "/discover/tv",
            page=page,
            sort_by="popularity.desc",
            include_adult="false",
            with_genres=genre_id,
        )
        if err:
            return jsonify({"shows": [], "error": err}), 502
        return jsonify({"shows": (data or {}).get("results", [])})

    if category == "search":
        query = request.args.get("query", "")
        if not query:
            return jsonify({"shows": [], "error": "No query provided."}), 400
        
        data, err = tmdb_get(
            "/search/tv",
            query=query,
            page=page,
            include_adult="false",
        )
        if err:
            return jsonify({"shows": [], "error": err}), 502
        return jsonify({"shows": (data or {}).get("results", [])})
    
    if category in TV_ENDPOINTS:
        data, err = tmdb_get(TV_ENDPOINTS[category], page=page)
        if err:
            return jsonify({"shows": [], "error": err}), 502
        return jsonify({"shows": (data or {}).get("results", [])})
    
    return jsonify({"shows": [], "error": "Unknown category."}), 400

@app.route("/api/tv/<int:tv_id>")
def get_tv_details(tv_id):
    data, err = tmdb_get(f"/tv/{tv_id}")
    if err:
        return jsonify({"error": err}), 502
    return jsonify(data or {})

@app.route("/api/tv/<int:tv_id>/trailer")
def get_tv_trailer(tv_id):
    data, err = tmdb_get(f"/tv/{tv_id}/videos")
    if err:
        return jsonify({"error": err}), 502
    videos = (data or {}).get("results", [])
    trailer = next((v for v in videos if v.get("type") == "Trailer" and v.get("site") == "YouTube"), None)
    if trailer:
        return jsonify({"key": trailer.get("key")})
    return jsonify({"key": None})

@app.route("/api/movie/<int:movie_id>/credits")
def get_movie_credits(movie_id):
    data, err = tmdb_get(f"/movie/{movie_id}/credits")
    if err:
        return jsonify({"error": err}), 502
    cast = [
        {"id": m.get("id"), "name": m.get("name"), "character": m.get("character"),
         "profile_path": m.get("profile_path"), "popularity": round(m.get("popularity", 0), 1)}
        for m in (data or {}).get("cast", [])[:8]
    ]
    return jsonify({"cast": cast})

@app.route("/api/tv/<int:tv_id>/credits")
def get_tv_credits(tv_id):
    data, err = tmdb_get(f"/tv/{tv_id}/credits")
    if err:
        return jsonify({"error": err}), 502
    cast = [
        {"id": m.get("id"), "name": m.get("name"), "character": m.get("character"),
         "profile_path": m.get("profile_path"), "popularity": round(m.get("popularity", 0), 1)}
        for m in (data or {}).get("cast", [])[:8]
    ]
    return jsonify({"cast": cast})

# Anime routes
@app.route("/anime/<int:anime_id>")
def anime_detail(anime_id):
    return render_template("anime_detail.html", anime_id=anime_id)

@app.route("/api/anime")
def get_anime():
    category = request.args.get("category", "top")
    page = request.args.get("page", 1, type=int)
    
    try:
        if category == "search":
            query = request.args.get("query", "")
            if not query:
                return jsonify({"anime": [], "error": "No query provided."}), 400
            
            response = requests.get(
                f"{JIKAN_BASE_URL}/anime",
                params={"q": query, "page": page},
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
            return jsonify({"anime": data.get("data", [])})
        
        # Default: top anime
        response = requests.get(
            f"{JIKAN_BASE_URL}/top/anime",
            params={"page": page},
            timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        data = response.json()
        return jsonify({"anime": data.get("data", [])})
        
    except requests.exceptions.RequestException:
        return jsonify({"anime": [], "error": "Upstream service unavailable."}), 502

@app.route("/api/movie/<int:movie_id>/watch-providers")
def get_movie_watch_providers(movie_id):
    data, err = tmdb_get(f"/movie/{movie_id}/watch/providers")
    if err:
        return jsonify({"error": err}), 502
    results = (data or {}).get("results", {})
    return jsonify(results)


@app.route("/api/tv/<int:tv_id>/watch-providers")
def get_tv_watch_providers(tv_id):
    data, err = tmdb_get(f"/tv/{tv_id}/watch/providers")
    if err:
        return jsonify({"error": err}), 502
    results = (data or {}).get("results", {})
    return jsonify(results)


@app.route("/api/anime/<int:anime_id>")
def get_anime_details(anime_id):
    try:
        response = requests.get(
            f"{JIKAN_BASE_URL}/anime/{anime_id}/full",
            timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        return jsonify(response.json().get("data", {}))
    except requests.exceptions.RequestException:
        return jsonify({"error": "Upstream service unavailable."}), 502

@app.route("/api/anime/<int:anime_id>/recommendations")
def get_anime_recommendations(anime_id):
    try:
        response = requests.get(
            f"{JIKAN_BASE_URL}/anime/{anime_id}/recommendations",
            timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        recs = [
            {"mal_id": i["entry"]["mal_id"], "title": i["entry"]["title"], "images": i["entry"]["images"]}
            for i in response.json().get("data", [])[:12]
            if i.get("entry")
        ]
        return jsonify({"results": recs})
    except requests.exceptions.RequestException:
        return jsonify({"results": [], "error": "Upstream service unavailable."}), 502


@app.route("/api/recommendations")
@limiter.limit("60 per hour")
def get_recommendations():
    media_type = request.args.get("media_type", "movie")
    media_id   = request.args.get("media_id",   type=int)
    user_id    = request.args.get("user_id",    "").strip()
    page       = max(1, min(request.args.get("page", 1, type=int) or 1, 100))

    if not media_id and not user_id:
        return jsonify({"results": [], "error": "media_id or user_id required"}), 400
    if user_id and not _UUID_RE.match(user_id):
        return jsonify({"results": [], "error": "Invalid user_id format."}), 400
    if media_id and (media_id < 1 or media_id > 10_000_000):
        return jsonify({"results": [], "error": "Invalid media_id."}), 400

    if media_type not in ("movie", "tv"):
        return jsonify({"results": [], "error": "media_type must be movie or tv"}), 400
    if not TMDB_API_KEY:
        return jsonify({"results": [], "error": "Missing TMDB_API_KEY."}), 503

    from backend.recommender import recommend_for_user, recommend_content_based

    supa_url = os.getenv("SUPABASE_URL", "https://lqlqurgthkdknxwwgygx.supabase.co")
    supa_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

    if user_id:
        # Personalised path: score candidates using user history + ratings
        results = recommend_for_user(
            user_id, media_type, TMDB_API_KEY, supa_url, supa_key
        )
        # Fall back to content-based if this user has no history for the media_type
        if not results and media_id:
            results = recommend_content_based(media_type, media_id, TMDB_API_KEY)
    else:
        # Anonymous path: enhanced content-based (deduped + quality-sorted)
        results = recommend_content_based(media_type, media_id, TMDB_API_KEY)

    # Pagination shim so existing callers using page= still work
    per_page = 20
    start    = (page - 1) * per_page
    return jsonify({"results": results[start: start + per_page]})


@app.route("/api/genres")
def get_genres():
    media_type = request.args.get("type", "movie")
    if media_type not in ("movie", "tv"):
        return jsonify({"genres": [], "error": "type must be movie or tv"}), 400
    data, err = tmdb_get(f"/genre/{media_type}/list")
    if err:
        return jsonify({"genres": [], "error": err}), 502
    return jsonify({"genres": (data or {}).get("genres", [])})


@app.route("/api/autocomplete")
@limiter.limit("60 per minute")
def autocomplete():
    query = request.args.get("query", "").strip()
    if not query or len(query) < 2:
        return jsonify({"results": []})
    if len(query) > 200:
        return jsonify({"results": [], "error": "Query too long."}), 400

    data, err = tmdb_get("/search/multi", query=query, include_adult="false", page=1)
    if err:
        app.logger.warning("Autocomplete TMDB lookup failed for query %r: %s", query, err)
        return jsonify({"results": [], "error": err})

    results = []
    for item in (data or {}).get("results", [])[:10]:
        mt = item.get("media_type")
        if mt == "person":
            known = item.get("known_for_department", "")
            results.append({
                "id": item.get("id"),
                "media_type": "person",
                "title": item.get("name"),
                "profile_path": item.get("profile_path"),
                "known_for": known,
            })
        elif mt in ("movie", "tv"):
            results.append({
                "id": item.get("id"),
                "media_type": mt,
                "title": item.get("title") or item.get("name"),
                "year": (item.get("release_date") or item.get("first_air_date") or "")[:4],
                "poster_path": item.get("poster_path"),
            })
        if len(results) >= 7:
            break

    return jsonify({"results": results, "query": query})


@app.route("/api/search")
@limiter.limit("30 per minute")
def global_search():
    query = request.args.get("query", "").strip()
    page = max(1, min(request.args.get("page", 1, type=int) or 1, 500))

    if not query:
        return jsonify({"results": [], "error": "No query provided."}), 400
    if len(query) > 200:
        return jsonify({"results": [], "error": "Query too long."}), 400

    results = []

    def fetch_movies():
        data, _ = tmdb_get("/search/movie", query=query, page=page, include_adult="false")
        items = []
        for m in (data or {}).get("results", []):
            if m.get("vote_count", 0) > 50 or m.get("popularity", 0) > 5:
                m["media_type"] = "movie"
                items.append(m)
        return items

    def fetch_tv():
        data, _ = tmdb_get("/search/tv", query=query, page=page, include_adult="false")
        items = []
        for s in (data or {}).get("results", []):
            s["media_type"] = "tv"
            items.append(s)
        return items

    def fetch_anime():
        try:
            resp = requests.get(
                f"{JIKAN_BASE_URL}/anime",
                params={"q": query, "page": page},
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            items = []
            for a in resp.json().get("data", []):
                a["media_type"] = "anime"
                items.append(a)
            return items
        except Exception:
            return []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(fetch_movies), executor.submit(fetch_tv), executor.submit(fetch_anime)]
        for f in futures:
            results.extend(f.result())

    return jsonify({"results": results})


@app.route('/api/send-welcome-email', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def send_welcome_email():
    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')

    if not smtp_user or not smtp_pass:
        # Email service not configured — skip silently
        return jsonify({'success': True, 'note': 'Email service not configured'})

    data = request.get_json(silent=True) or {}
    to_email = data.get('email', '').strip()[:254]
    if not to_email or not _EMAIL_RE.match(to_email):
        return jsonify({'error': 'Invalid email address'}), 400

    from datetime import datetime, timezone
    agreed_at = data.get('agreed_at') or datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

    html_body = f"""<!DOCTYPE html>
<html><head><style>
  body{{margin:0;padding:0;background:#0b0f18;font-family:'Segoe UI',Arial,sans-serif;}}
  .wrap{{max-width:560px;margin:40px auto;background:rgba(255,255,255,0.06);
         border:1px solid rgba(148,163,184,0.2);border-radius:18px;padding:40px;}}
  h1{{color:#7c3aed;margin:0 0 16px;font-size:1.6rem;}}
  p{{color:#cbd5e1;line-height:1.65;margin:0 0 12px;}}
  ul{{color:#cbd5e1;line-height:2.2;padding-left:1.5rem;margin:0 0 20px;}}
  .cta{{display:inline-block;margin-top:8px;padding:14px 28px;
        background:#7c3aed;color:#fff;border-radius:999px;
        text-decoration:none;font-weight:700;font-size:0.95rem;}}
  .tc-box{{margin-top:28px;padding:16px 20px;background:rgba(124,58,237,0.12);
           border:1px solid rgba(124,58,237,0.35);border-radius:12px;}}
  .tc-box h3{{color:#a78bfa;margin:0 0 8px;font-size:.95rem;}}
  .tc-box p{{color:#94a3b8;font-size:.82rem;margin:0;}}
  .footer{{margin-top:32px;padding-top:16px;
           border-top:1px solid rgba(148,163,184,0.2);
           color:rgba(203,213,225,0.5);font-size:12px;}}
</style></head><body>
<div class="wrap">
  <h1>🎬 Welcome to WatchNextAI!</h1>
  <p>Hey! We're so glad you joined the family. 🎉</p>
  <p>Here's what's waiting for you:</p>
  <ul>
    <li>🎬 Thousands of Movies, TV Shows &amp; Anime</li>
    <li>🤖 AI chat to geek out about your favourites</li>
    <li>📋 Your personal Watchlist</li>
    <li>✓ Track everything you've watched</li>
  </ul>
  <p>Jump in and find your next obsession.</p>
  <a class="cta" href="https://watchnextai.vercel.app">Start Discovering →</a>
  <div class="tc-box">
    <h3>📋 Terms &amp; Conditions Agreement</h3>
    <p>By creating your account, you confirmed that you have read and agreed to WatchNextAI's
       <a href="https://watchnextai.vercel.app/terms" style="color:#a78bfa;">Terms &amp; Conditions</a>
       and <a href="https://watchnextai.vercel.app/privacy" style="color:#a78bfa;">Privacy Policy</a>.<br>
       Agreement recorded on: <strong style="color:#cbd5e1;">{agreed_at}</strong></p>
  </div>
  <div class="footer">
    WatchNextAI &nbsp;·&nbsp; {to_email}<br>
    If you didn't sign up, you can safely ignore this email.
  </div>
</div>
</body></html>"""

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '🎬 Welcome to WatchNextAI!'
        msg['From']    = smtp_user
        msg['To']      = to_email
        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())

        return jsonify({'success': True})
    except Exception:
        return jsonify({'success': False, 'error': 'Failed to send email. Please try again.'}), 500


@app.route('/profile')
def profile():
    return render_template('profile.html')

@app.route('/onboarding')
def onboarding():
    return render_template('onboarding.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')


def _send_checkin_email(to_email, title, media_type, user_name):
    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    if not smtp_user or not smtp_pass:
        return

    greeting = f"Hey {user_name}!" if user_name else "Hey!"
    type_label = {'movie': 'movie', 'tv': 'TV show', 'anime': 'anime'}.get(media_type, 'title')

    html_body = f"""<!DOCTYPE html>
<html><head><style>
  body{{margin:0;padding:0;background:#0b0f18;font-family:'Segoe UI',Arial,sans-serif;}}
  .wrap{{max-width:520px;margin:40px auto;background:rgba(255,255,255,0.06);
         border:1px solid rgba(148,163,184,0.2);border-radius:18px;padding:36px;}}
  h2{{color:#7c3aed;margin:0 0 14px;font-size:1.35rem;}}
  p{{color:#cbd5e1;line-height:1.65;margin:0 0 12px;}}
  .title{{color:#fff;font-weight:700;}}
  .cta{{display:inline-block;margin-top:10px;padding:12px 26px;
        background:#7c3aed;color:#fff;border-radius:999px;
        text-decoration:none;font-weight:700;font-size:.92rem;}}
  .footer{{margin-top:28px;padding-top:14px;
           border-top:1px solid rgba(148,163,184,0.2);
           color:rgba(203,213,225,0.45);font-size:11px;}}
</style></head><body>
<div class="wrap">
  <h2>📺 WatchNextAI Check-in</h2>
  <p>{greeting} Just checking in on you.</p>
  <p>You recently added <span class="title">{title}</span> to your list.
     How are you getting on with it? Have you started watching yet?</p>
  <p>Whatever stage you're at — we've got plenty more {type_label}s lined up for you
     when you're ready for your next pick.</p>
  <a class="cta" href="https://watchnextai.vercel.app/profile">Check my list →</a>
  <div class="footer">
    WatchNextAI &nbsp;·&nbsp; {to_email}<br>
    You received this because you added content to your list. To stop these, remove items from your list.
  </div>
</div>
</body></html>"""

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'📺 Still thinking about {title}?'
        msg['From']    = smtp_user
        msg['To']      = to_email
        msg.attach(MIMEText(html_body, 'html'))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
    except Exception:
        pass  # best-effort; never surface email errors to users


@app.route('/api/schedule-checkin-email', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def schedule_checkin_email():
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    if not smtp_user or not smtp_pass:
        return jsonify({'success': True, 'note': 'Email service not configured'})

    data = request.get_json(silent=True) or {}
    to_email   = data.get('email', '').strip()[:254]
    title      = str(data.get('title', 'your title')).strip()[:200]
    media_type = str(data.get('media_type', 'movie')).strip()
    user_name  = str(data.get('user_name', '')).strip()[:100]

    if not to_email or not _EMAIL_RE.match(to_email):
        return jsonify({'error': 'Invalid email address'}), 400
    if media_type not in SUPPORTED_COMMENT_MEDIA_TYPES:
        media_type = 'movie'

    # Schedule send 1–5 hours from now (in seconds)
    delay_seconds = random.randint(3600, 18000)
    t = threading.Timer(delay_seconds, _send_checkin_email, args=[to_email, title, media_type, user_name])
    t.daemon = True
    t.start()

    return jsonify({'success': True, 'scheduled_in_seconds': delay_seconds})


# ── Person / Cast pages ────────────────────────────────────────────────────────

@app.route("/person/<int:person_id>")
def person_detail(person_id):
    return render_template("person_detail.html", person_id=person_id)


@app.route("/api/person/<int:person_id>")
def get_person(person_id):
    data, err = tmdb_get(f"/person/{person_id}")
    if err:
        return jsonify({"error": err}), 502
    return jsonify(data or {})


@app.route("/api/person/<int:person_id>/credits")
def get_person_credits(person_id):
    data, err = tmdb_get(f"/person/{person_id}/combined_credits")
    if err:
        return jsonify({"error": err}), 502
    # Only keep real movies/TV, with a poster and enough votes to confirm authenticity
    raw = [
        c for c in (data or {}).get("cast", [])
        if c.get("poster_path")
        and c.get("media_type") in ("movie", "tv")
        and c.get("vote_count", 0) >= 10
    ]
    cast = sorted(raw, key=lambda x: x.get("popularity", 0), reverse=True)[:48]
    trimmed = [
        {
            "id": c.get("id"),
            "title": c.get("title") or c.get("name"),
            "media_type": c.get("media_type"),
            "poster_path": c.get("poster_path"),
            "character": c.get("character"),
            "job": c.get("job"),
            "release_date": c.get("release_date") or c.get("first_air_date"),
            "vote_average": round(c.get("vote_average", 0), 1),
            "vote_count": c.get("vote_count", 0),
        }
        for c in cast
    ]
    return jsonify({"cast": trimmed})


# ── Movie / TV credits — now include person id ──────────────────────────────────

@app.route("/api/movie/<int:movie_id>/reviews")
def get_movie_reviews(movie_id):
    data, err = tmdb_get(f"/movie/{movie_id}/reviews", page=1)
    if err:
        return jsonify({"results": []}), 502
    reviews = [
        {
            "author": r.get("author"),
            "content": r.get("content", "")[:800],
            "rating": r.get("author_details", {}).get("rating"),
            "created_at": r.get("created_at", "")[:10],
        }
        for r in (data or {}).get("results", [])[:5]
    ]
    return jsonify({"results": reviews})


@app.route("/api/tv/<int:tv_id>/reviews")
def get_tv_reviews(tv_id):
    data, err = tmdb_get(f"/tv/{tv_id}/reviews", page=1)
    if err:
        return jsonify({"results": []}), 502
    reviews = [
        {
            "author": r.get("author"),
            "content": r.get("content", "")[:800],
            "rating": r.get("author_details", {}).get("rating"),
            "created_at": r.get("created_at", "")[:10],
        }
        for r in (data or {}).get("results", [])[:5]
    ]
    return jsonify({"results": reviews})


# ── Comments ────────────────────────────────────────────────────────────────────

_PROFANITY = {"fuck","shit","bitch","asshole","cunt","nigger","faggot","retard","whore","slut"}

def _is_clean(text: str) -> bool:
    words = set(text.lower().split())
    return not words.intersection(_PROFANITY)


@app.route("/api/comments", methods=["GET"])
def get_comments():
    media_id   = request.args.get("media_id", type=int)
    media_type = request.args.get("media_type", "movie")
    if not media_id:
        return jsonify({"results": []}), 400
    if media_type not in SUPPORTED_COMMENT_MEDIA_TYPES:
        return jsonify({"results": [], "error": "media_type must be movie, tv, or anime"}), 400
    # Read directly from Supabase REST (SELECT is allowed for all via RLS)
    import urllib.parse
    params = urllib.parse.urlencode({
        "media_id":   f"eq.{media_id}",
        "media_type": f"eq.{media_type}",
        "order":      "created_at.desc",
        "limit":      "50",
        "select":     "id,username,content,created_at",
    })
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/comments?{params}",
            headers={"apikey": SUPABASE_ANON, "Authorization": f"Bearer {SUPABASE_ANON}"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return jsonify({"results": resp.json()})
    except Exception:
        return jsonify({"results": [], "error": "Could not load comments."}), 502


@app.route("/api/comments", methods=["POST"])
@limiter.limit("10 per 15 minutes")
def post_comment():
    data = request.get_json(silent=True) or {}
    content    = (data.get("content") or "").strip()
    media_id   = data.get("media_id")
    media_type = (data.get("media_type") or "movie").strip()
    user_id    = data.get("user_id")
    username   = (data.get("username") or "Anonymous").strip()[:40]

    if media_type not in SUPPORTED_COMMENT_MEDIA_TYPES:
        return jsonify({"error": "media_type must be movie, tv, or anime"}), 400
    if media_id is not None:
        try:
            media_id = int(media_id)
            if media_id < 1 or media_id > 10_000_000:
                raise ValueError
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid media_id."}), 400
    if user_id and not _UUID_RE.match(str(user_id)):
        return jsonify({"error": "Invalid user_id format."}), 400
    if not content or not media_id or not user_id:
        return jsonify({"error": "Missing required fields"}), 400
    if len(content) > 1000:
        return jsonify({"error": "Comment too long (max 1000 chars)"}), 400
    if not _is_clean(content):
        return jsonify({"error": "Your comment was flagged. Please keep it respectful."}), 400

    # Use the user's JWT forwarded from the browser so Supabase RLS can verify
    # auth.uid() == user_id.  Fall back to service key if present (bypasses RLS).
    user_jwt = (request.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
    supa_service = os.getenv("SUPABASE_SERVICE_KEY", "")
    bearer = user_jwt or supa_service or SUPABASE_ANON
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/comments",
            headers={
                "apikey": SUPABASE_ANON,
                "Authorization": f"Bearer {bearer}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json={"content": content, "media_id": media_id, "media_type": media_type,
                  "user_id": user_id, "username": username},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return jsonify({"success": True, "comment": resp.json()[0] if resp.json() else {}})
    except Exception:
        return jsonify({"error": "Could not save comment. Please try again."}), 502


if __name__ == "__main__":
    app.run(debug=False)

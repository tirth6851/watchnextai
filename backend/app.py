from flask import Flask, render_template, request, jsonify
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# ----------------------------
# Paths + Environment loading
# ----------------------------
ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# ----------------------------
# Flask App
# ----------------------------
app = Flask(
    __name__,
    template_folder=str(ROOT / "templates"),
    static_folder=str(ROOT / "static"),
    static_url_path="/static",
)

# ----------------------------
# TMDB Config
# ----------------------------
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"


def fetch_tmdb_json(url: str):
    """Fetch JSON from TMDB with basic error handling."""
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as exc:
        return None, f"Failed to reach TMDB: {exc}"

    if not response.ok:
        # Try to extract TMDB error message (if JSON)
        try:
            err = response.json()
            msg = err.get("status_message") or str(err)
            return None, f"TMDB error: {response.status_code} {msg}"
        except Exception:
            return None, f"TMDB error: {response.status_code} {response.reason}"

    try:
        return response.json(), None
    except ValueError:
        return None, "TMDB returned invalid JSON."


# ----------------------------
# Routes
# ----------------------------

# Home Route - Trending Movies
@app.route("/")
def home():
    if not TMDB_API_KEY:
        return render_template(
            "index.html",
            movies=[],
            TMDB_API_KEY=None,
            error_message="Missing TMDB_API_KEY. Add it to your .env file (local) or Vercel env vars (deploy).",
        )

    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    data, error = fetch_tmdb_json(url)
    movies = data.get("results", []) if data else []

    return render_template(
        "index.html",
        movies=movies,
        TMDB_API_KEY=None,  # NEVER expose key to frontend
        error_message=error,
    )


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id: int):
    if not TMDB_API_KEY:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message="Missing TMDB_API_KEY. Add it to your .env file (local) or Vercel env vars (deploy).",
        )

    movie_url = (
        f"{TMDB_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}"
        "&append_to_response=videos,reviews"
    )
    movie_data, error = fetch_tmdb_json(movie_url)
    if error:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message=error,
        )

    # Extract trailer key from videos
    trailer_key = None
    videos = (movie_data or {}).get("videos", {}).get("results", [])
    for video in videos:
        if video.get("type") == "Trailer" and video.get("site") == "YouTube":
            trailer_key = video.get("key")
            break

    return render_template(
        "movie.html",
        movie=movie_data or {},
        trailer_key=trailer_key,
        error_message=None,
    )


# Infinite Scroll - Load More Movies
@app.route("/load_more")
def load_more():
    if not TMDB_API_KEY:
        return jsonify({"movies": [], "error": "Missing TMDB_API_KEY."}), 400

    # Validate page
    try:
        page = int(request.args.get("page", 1))
    except ValueError:
        return jsonify({"movies": [], "error": "Invalid page."}), 400

    if page < 1 or page > 500:
        return jsonify({"movies": [], "error": "Page out of range."}), 400

    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    data, error = fetch_tmdb_json(url)
    if error:
        return jsonify({"movies": [], "error": error}), 502

    return jsonify({"movies": data.get("results", [])})


# Health check (helps debugging on Vercel)
@app.route("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "tmdb_key_present": bool(TMDB_API_KEY),
        }
    )


# Run locally only (Vercel will not use this block)
if __name__ == "__main__":
    app.run(debug=True)

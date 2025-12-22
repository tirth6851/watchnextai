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

MOVIE_ENDPOINTS = {
    "trending": "/trending/movie/week",
    "popular": "/movie/popular",
    "top_rated": "/movie/top_rated",
    "upcoming": "/movie/upcoming",
    "now_playing": "/movie/now_playing",
}


def tmdb_get(path: str, **params):
    """Call TMDB API and return (json, error_string_or_None)."""
    params["api_key"] = TMDB_API_KEY
    url = f"{TMDB_BASE_URL}{path}"
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


# ----------------------------
# Routes
# ----------------------------

@app.route("/")
def home():
    # default page uses Popular (bigger than trending)
    if not TMDB_API_KEY:
        return render_template(
            "index.html",
            movies=[],
            error_message="Missing TMDB_API_KEY. Add it to .env (local) or Vercel env vars (deploy).",
        )

    data, err = tmdb_get("/movie/popular", page=1)
    movies = (data or {}).get("results", [])

    return render_template(
        "index.html",
        movies=movies,
        error_message=err,
    )


@app.route("/movie/<int:movie_id>")
def movie_details(movie_id: int):
    if not TMDB_API_KEY:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message="Missing TMDB_API_KEY. Add it to .env (local) or Vercel env vars (deploy).",
        )

    data, err = tmdb_get(
        f"/movie/{movie_id}",
        append_to_response="videos,reviews"
    )
    if err:
        return render_template("movie.html", movie={}, trailer_key=None, error_message=err)

    trailer_key = None
    videos = (data or {}).get("videos", {}).get("results", [])
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer":
            trailer_key = v.get("key")
            break

    return render_template(
        "movie.html",
        movie=data or {},
        trailer_key=trailer_key,
        error_message=None
    )


@app.route("/load_more")
def load_more():
    """
    Supports:
    /load_more?page=2&category=popular
    /load_more?page=3&category=discover
    /load_more?page=1&q=batman
    """
    if not TMDB_API_KEY:
        return jsonify({"movies": [], "error": "Missing TMDB_API_KEY."}), 400

    category = request.args.get("category", "popular").strip()
    q = request.args.get("q", "").strip()

    try:
        page = int(request.args.get("page", 1))
    except ValueError:
        return jsonify({"movies": [], "error": "Invalid page."}), 400

    if page < 1 or page > 500:
        return jsonify({"movies": [], "error": "Page out of range (1..500)."}), 400

    # Search = huge library access
    if q:
        data, err = tmdb_get(
            "/search/movie",
            query=q,
            page=page,
            include_adult="false"
        )
        if err:
            return jsonify({"movies": [], "error": err}), 502
        return jsonify({"movies": (data or {}).get("results", [])})

    # Known category endpoints
    if category in MOVIE_ENDPOINTS:
        data, err = tmdb_get(MOVIE_ENDPOINTS[category], page=page)
        if err:
            return jsonify({"movies": [], "error": err}), 502
        return jsonify({"movies": (data or {}).get("results", [])})

    # Discover = massive + always available
    if category == "discover":
        data, err = tmdb_get(
            "/discover/movie",
            page=page,
            sort_by="popularity.desc",
            include_adult="false",
            include_video="false"
        )
        if err:
            return jsonify({"movies": [], "error": err}), 502
        return jsonify({"movies": (data or {}).get("results", [])})

    return jsonify({"movies": [], "error": "Unknown category."}), 400


@app.route("/health")
def health():
    return jsonify({"status": "ok", "tmdb_key_present": bool(TMDB_API_KEY)})


if __name__ == "__main__":
    app.run(debug=True)

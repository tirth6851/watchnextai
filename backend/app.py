from flask import Flask, render_template, request
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# TMDB API Key
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"


def fetch_tmdb_json(url):
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as exc:
        return None, f"Failed to reach TMDB: {exc}"

    if not response.ok:
        return None, f"TMDB error: {response.status_code} {response.reason}"

    return response.json(), None


# Home Route - Trending Movies
@app.route("/")
def home():
    if not TMDB_API_KEY:
        return render_template(
            "index.html",
            movies=[],
            TMDB_API_KEY=None,
            error_message="Missing TMDB_API_KEY. Add it to your .env file.",
        )

    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    data, error = fetch_tmdb_json(url)
    movies = data.get("results", []) if data else []
    return render_template(
        "index.html",
        movies=movies,
        TMDB_API_KEY=TMDB_API_KEY,
        error_message=error,
    )


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):
    if not TMDB_API_KEY:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message="Missing TMDB_API_KEY. Add it to your .env file.",
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
    for video in movie_data.get("videos", {}).get("results", []) if movie_data else []:
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            trailer_key = video["key"]
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
        return {"movies": [], "error": "Missing TMDB_API_KEY."}, 400

    page = request.args.get("page", 1)
    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    data, error = fetch_tmdb_json(url)
    if error:
        return {"movies": [], "error": error}, 502
    return {"movies": data.get("results", [])}


# Run the app
if __name__ == "__main__":
    app.run(debug=True)

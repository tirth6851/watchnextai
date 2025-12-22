from flask import Flask, render_template, request
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# TMDB API Key
TMDB_API_KEY = os.getenv("TMDB_API_KEY")


def fetch_tmdb_json(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        return {}, f"Unable to reach TMDb right now: {exc}"
    return response.json(), None


# Home Route - Trending Movies
@app.route("/")
def home():
    if not TMDB_API_KEY:
        return render_template(
            "index.html",
            movies=[],
            TMDB_API_KEY="",
            error_message="TMDB_API_KEY is missing. Add it to your .env file to load movies.",
        )

    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    response, error_message = fetch_tmdb_json(url)
    movies = response.get("results", [])
    return render_template(
        "index.html",
        movies=movies,
        TMDB_API_KEY=TMDB_API_KEY,
        error_message=error_message,
    )


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):
    if not TMDB_API_KEY:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message="TMDB_API_KEY is missing. Add it to your .env file to load movies.",
        )

    movie_url = (
        f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}"
        "&append_to_response=videos,reviews"
    )
    movie_data, error_message = fetch_tmdb_json(movie_url)
    if error_message:
        return render_template(
            "movie.html",
            movie={},
            trailer_key=None,
            error_message=error_message,
        )

    # Extract trailer key from videos
    trailer_key = None
    for video in movie_data.get("videos", {}).get("results", []):
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            trailer_key = video["key"]
            break

    return render_template(
        "movie.html",
        movie=movie_data,
        trailer_key=trailer_key,
        error_message=None,
    )


# Infinite Scroll - Load More Movies
@app.route("/load_more")
def load_more():
    if not TMDB_API_KEY:
        return {"movies": [], "error": "TMDB_API_KEY is missing."}

    page = request.args.get("page", 1)
    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    response, error_message = fetch_tmdb_json(url)
    return {"movies": response.get("results", []), "error": error_message}


# Run the app
if __name__ == "__main__":
    app.run(debug=True)

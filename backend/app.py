from flask import Flask, render_template, request
import os

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# TMDB API Key
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
REQUEST_TIMEOUT_SECONDS = 10


def fetch_tmdb(url):
    if not TMDB_API_KEY:
        return {"error": "TMDB_API_KEY is missing. Add it to your .env file."}

    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return {"error": "Unable to reach TMDB right now. Please try again later."}


# Home Route - Trending Movies
@app.route("/")
def home():
    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    response = fetch_tmdb(url)
    movies = response.get("results", [])
    error = response.get("error")
    return render_template(
        "index.html", movies=movies, TMDB_API_KEY=TMDB_API_KEY, error=error
    )


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):
    movie_url = (
        f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}"
        "&append_to_response=videos,reviews"
    )
    movie_data = fetch_tmdb(movie_url)
    error = movie_data.get("error")

    # Extract trailer key from videos
    trailer_key = None
    if not error:
        for video in movie_data.get("videos", {}).get("results", []):
            if video.get("type") == "Trailer" and video.get("site") == "YouTube":
                trailer_key = video.get("key")
                break

    return render_template(
        "movie.html",
        movie=movie_data,
        trailer_key=trailer_key,
        error=error,
    )


# Infinite Scroll - Load More Movies
@app.route("/load_more")
def load_more():
    page = request.args.get("page", 1)
    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    response = fetch_tmdb(url)
    return {
        "movies": response.get("results", []),
        "error": response.get("error"),
    }


# Run the app
if __name__ == "__main__":
    app.run(debug=True)

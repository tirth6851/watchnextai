from flask import Flask, render_template, request
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# TMDB API Key
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_TIMEOUT_SECONDS = 10


def fetch_tmdb_json(url):
    try:
        response = requests.get(url, timeout=TMDB_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.RequestException:
        return None
    return response.json()


def tmdb_error_message():
    if not TMDB_API_KEY:
        return "TMDB API key is missing. Add TMDB_API_KEY to your .env file."
    return "We couldn't reach TMDB right now. Please try again later."


# Home Route - Trending Movies
@app.route("/")
def home():
    if not TMDB_API_KEY:
        return render_template("index.html", movies=[], error=tmdb_error_message())

    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    response = fetch_tmdb_json(url)
    if not response:
        return render_template("index.html", movies=[], error=tmdb_error_message())

    movies = response.get("results", [])
    return render_template("index.html", movies=movies, error=None)


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):
    if not TMDB_API_KEY:
        return render_template("movie.html", movie=None, trailer_key=None, error=tmdb_error_message())

    movie_url = (
        f"{TMDB_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}"
        "&append_to_response=videos,reviews"
    )
    movie_data = fetch_tmdb_json(movie_url)
    if not movie_data:
        return render_template("movie.html", movie=None, trailer_key=None, error=tmdb_error_message())

    # Extract trailer key from videos
    trailer_key = None
    for video in movie_data.get("videos", {}).get("results", []):
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            trailer_key = video["key"]
            break

    return render_template("movie.html", movie=movie_data, trailer_key=trailer_key)


# Infinite Scroll - Load More Movies
@app.route("/load_more")
def load_more():
    if not TMDB_API_KEY:
        return {"movies": [], "error": tmdb_error_message()}, 503

    page = request.args.get("page", 1)
    url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    response = fetch_tmdb_json(url)
    if not response:
        return {"movies": [], "error": tmdb_error_message()}, 503

    return {"movies": response.get("results", [])}


# Run the app
if __name__ == "__main__":
    app.run(debug=True)

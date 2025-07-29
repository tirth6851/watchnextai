from flask import Flask, render_template, request
import requests
import os
from dotenv import load_dotenv
from recommender import MovieRecommender

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="../templates", static_folder="../static")

# TMDB API Key
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# Instantiate the recommender at startup
recommender = MovieRecommender(TMDB_API_KEY)


# Home Route - Trending Movies
@app.route("/")
def home():
    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page=1"
    response = requests.get(url).json()
    movies = response.get("results", [])
    return render_template("index.html", movies=movies)


# Movie Details Page
@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):
    movie_url = (
        f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}"
        "&append_to_response=videos,reviews"
    )
    movie_data = requests.get(movie_url).json()

    # Extract trailer key from videos
    trailer_key = None
    for video in movie_data.get("videos", {}).get("results", []):
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            trailer_key = video["key"]
            break

    # Get recommended movies
    recommended = recommender.get_recommendations(movie_id)

    return render_template(
        "movie.html",
        movie=movie_data,
        trailer_key=trailer_key,
        recommendations=recommended,
    )


# Infinite Scroll - Load More Movies
@app.route("/load_more")
def load_more():
    page = request.args.get("page", 1)
    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}&page={page}"
    response = requests.get(url).json()
    return {"movies": response.get("results", [])}


# Search Movies Route
@app.route("/search")
def search():
    query = request.args.get("query", "")
    if not query:
        return {"movies": []}

    url = (
        f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}"
        f"&query={requests.utils.quote(query)}"
    )
    response = requests.get(url).json()
    return {"movies": response.get("results", [])}


# Run the app
if __name__ == "__main__":
    app.run(debug=True)

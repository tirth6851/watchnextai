from flask import Flask, render_template
import requests
import os
from dotenv import load_dotenv


# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="../templates")


# Access the TMDb API key securely
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

@app.route("/")
def home():
    """Fetch trending movies and render homepage."""
    if not TMDB_API_KEY:
        return "Error: TMDB_API_KEY is not set in .env"

    url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={TMDB_API_KEY}"
    response = requests.get(url).json()
    movies = response.get("results", [])
    return render_template("index.html", movies=movies)

if __name__ == "__main__":
    app.run(debug=True)

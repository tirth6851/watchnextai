from flask import Flask, render_template, request, jsonify
import os
from pathlib import Path
import requests
from dotenv import load_dotenv
from groq import Groq

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)

app = Flask(
    __name__,
    template_folder=str(ROOT / "templates"),
    static_folder=str(ROOT / "static"),
    static_url_path="/static",
)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
REQUEST_TIMEOUT = 10
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq client
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

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
    except requests.exceptions.RequestException as e:
        return None, str(e)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    return render_template("movie_detail.html", movie_id=movie_id)


@app.route("/api/movies")
def get_movies():
    category = request.args.get("category", "popular")
    page = request.args.get("page", 1, type=int)

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
def chat():
    if not groq_client:
        return jsonify({"error": "Chatbot service not available. GROQ_API_KEY not configured."}), 503
    
    try:
        data = request.get_json()
        movie_title = data.get("movie_title", "")
        movie_overview = data.get("movie_overview", "")
        user_message = data.get("message", "")
        
        if not user_message:
            return jsonify({"error": "No message provided."}), 400
        
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
        
    except Exception as e:
        return jsonify({"error": f"Chat error: {str(e)}"}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "tmdb_key_present": bool(TMDB_API_KEY)})


# TV Shows routes
@app.route("/tv/<int:tv_id>")
def tv_detail(tv_id):
    return render_template("tv_detail.html", tv_id=tv_id)

@app.route("/api/tv_shows")
def get_tv_shows():
    category = request.args.get("category", "popular")
    page = request.args.get("page", 1, type=int)
    
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
        
    except requests.exceptions.RequestException as e:
        return jsonify({"anime": [], "error": str(e)}), 502

@app.route("/api/anime/<int:anime_id>")
def get_anime_details(anime_id):
    try:
        response = requests.get(
            f"{JIKAN_BASE_URL}/anime/{anime_id}/full",
            timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        return jsonify(response.json().get("data", {}))
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')


if __name__ == "__main__":
    app.run(debug=True)

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import requests


class MovieRecommender:
    """Simple semantic similarity-based movie recommender."""

    _model = None

    def __init__(self, api_key: str):
        self.api_key = api_key
        if MovieRecommender._model is None:
            MovieRecommender._model = SentenceTransformer("all-MiniLM-L6-v2")
        self.model = MovieRecommender._model
        self.overview_cache: dict[int, str] = {}

    def _get_movie_overview(self, movie_id: int) -> str:
        """Return the overview for a movie, caching the result."""
        if movie_id not in self.overview_cache:
            url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={self.api_key}"
            data = requests.get(url).json()
            overview = data.get("overview", "")
            self.overview_cache[movie_id] = overview or ""
        return self.overview_cache[movie_id]

    def _get_trending_movies(self):
        """Fetch trending movies and store their overviews in the cache."""
        url = f"https://api.themoviedb.org/3/trending/movie/week?api_key={self.api_key}&page=1"
        data = requests.get(url).json()
        movies = data.get("results", [])
        for movie in movies:
            if movie.get("overview"):
                self.overview_cache[movie["id"]] = movie["overview"]
        return movies

    def get_recommendations(self, movie_id: int, count: int = 5):
        """Return a list of recommended movies based on overview similarity."""
        trending = self._get_trending_movies()
        target_overview = self._get_movie_overview(movie_id)
        if not target_overview:
            return []

        overviews = [target_overview]
        for m in trending:
            overviews.append(self._get_movie_overview(m["id"]))

        embeddings = self.model.encode(overviews)
        target_emb = embeddings[0]
        other_embs = embeddings[1:]

        sims = cosine_similarity([target_emb], other_embs)[0]
        scored = [
            (sim, m)
            for sim, m in zip(sims, trending)
            if m["id"] != movie_id
        ]
        scored.sort(reverse=True, key=lambda x: x[0])
        recommendations = [
            {
                "id": m["id"],
                "title": m["title"],
                "poster_path": m.get("poster_path"),
            }
            for sim, m in scored[:count]
        ]
        return recommendations

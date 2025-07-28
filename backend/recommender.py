import requests


class Recommender:
    """Simple TMDb-based movie recommender."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_recommendations(self, movie_id: int, limit: int = 5):
        """Return a list of recommended movies from TMDb."""
        url = (
            f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations"
            f"?api_key={self.api_key}&page=1"
        )
        try:
            data = requests.get(url).json()
            return data.get("results", [])[:limit]
        except Exception:
            return []

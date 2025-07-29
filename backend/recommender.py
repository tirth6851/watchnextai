from __future__ import annotations

import os
from typing import Dict, List

import numpy as np
import requests
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


class MovieRecommender:
    """Recommend movies using sentence embeddings of overviews."""

    # Load the model once for all instances
    _model: SentenceTransformer | None = None

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        if MovieRecommender._model is None:
            MovieRecommender._model = SentenceTransformer("all-MiniLM-L6-v2")

        # Caches to avoid duplicate API calls and computations
        self._movie_cache: Dict[int, Dict] = {}
        self._embedding_cache: Dict[int, np.ndarray] = {}

    # Internal helpers -------------------------------------------------
    def _fetch_movie(self, movie_id: int) -> Dict:
        if movie_id not in self._movie_cache:
            url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={self.api_key}"
            self._movie_cache[movie_id] = requests.get(url).json()
        return self._movie_cache[movie_id]

    def _get_embedding(self, movie_id: int, overview: str | None = None) -> np.ndarray:
        if movie_id in self._embedding_cache:
            return self._embedding_cache[movie_id]
        if overview is None:
            overview = self._fetch_movie(movie_id).get("overview", "")
        embedding = MovieRecommender._model.encode([overview], convert_to_numpy=True)
        self._embedding_cache[movie_id] = embedding
        return embedding

    def _fetch_candidates(self, movie_id: int) -> List[Dict]:
        url = (
            f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations"
            f"?api_key={self.api_key}&page=1"
        )
        try:
            data = requests.get(url).json()
            return data.get("results", [])
        except Exception:
            return []

    # Public API -------------------------------------------------------
    def get_recommendations(self, movie_id: int, limit: int = 5) -> List[Dict]:
        """Return the most similar movies based on overview embeddings."""
        target_emb = self._get_embedding(movie_id)
        candidates = self._fetch_candidates(movie_id)
        if not candidates:
            return []

        emb_list = []
        movies = []
        for movie in candidates:
            cid = movie.get("id")
            if cid is None or cid == movie_id:
                continue
            emb = self._get_embedding(cid, movie.get("overview", ""))
            emb_list.append(emb)
            movies.append(movie)

        if not emb_list:
            return []

        matrix = np.vstack(emb_list)
        sims = cosine_similarity(target_emb, matrix)[0]
        ranked = sorted(zip(sims, movies), key=lambda x: x[0], reverse=True)
        return [m for _, m in ranked[:limit]]


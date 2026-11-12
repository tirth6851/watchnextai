import unittest
from unittest.mock import patch

from backend.app import app


class AppSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_page_routes_render(self):
        for path in [
            "/",
            "/browse",
            "/profile",
            "/privacy",
            "/terms",
            "/onboarding",
            "/movie/1",
            "/tv/1",
            "/anime/1",
            "/person/1",
        ]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)

    def test_recommendations_reject_missing_tmdb_key(self):
        with patch("backend.app.TMDB_API_KEY", None):
            response = self.client.get("/api/recommendations?media_type=movie&media_id=1")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"], "Missing TMDB_API_KEY.")

    def test_recommendations_uses_backend_recommender_module(self):
        fake_results = [{"id": 42, "title": "Example", "media_type": "movie"}]
        with patch("backend.app.TMDB_API_KEY", "tmdb-test"):
            with patch("backend.recommender.recommend_content_based", return_value=fake_results) as mock_recommend:
                response = self.client.get("/api/recommendations?media_type=movie&media_id=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["results"], fake_results)
        mock_recommend.assert_called_once_with("movie", 1, "tmdb-test")

    def test_comments_post_rejects_invalid_media_type(self):
        response = self.client.post(
            "/api/comments",
            json={"content": "hello", "media_id": 1, "media_type": "game", "user_id": "u1"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "media_type must be movie, tv, or anime")

    def test_comments_get_rejects_invalid_media_type(self):
        response = self.client.get("/api/comments?media_id=1&media_type=game")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "media_type must be movie, tv, or anime")

    def test_chat_rejects_non_object_json(self):
        with patch("backend.app.groq_client", object()):
            response = self.client.post("/api/chat", data="null", content_type="application/json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Invalid JSON body.")

    def test_autocomplete_surfaces_tmdb_failures(self):
        with patch("backend.app.tmdb_get", return_value=(None, "Missing TMDB_API_KEY.")):
            response = self.client.get("/api/autocomplete?query=batman")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"results": [], "error": "Missing TMDB_API_KEY."},
        )

    def test_global_search_survives_jikan_outage_quickly(self):
        import time
        import requests as requests_lib

        movie_payload = {"results": [{"id": 1, "title": "Dune", "vote_count": 100, "popularity": 50}]}

        def fake_tmdb_get(path, **params):
            if path == "/search/movie":
                return movie_payload, None
            return {"results": []}, None

        with patch("backend.app.TMDB_API_KEY", "tmdb-test"):
            with patch("backend.app.tmdb_get", side_effect=fake_tmdb_get):
                with patch(
                    "backend.app.requests.get",
                    side_effect=requests_lib.exceptions.ConnectTimeout("jikan down"),
                ) as mock_get:
                    started = time.monotonic()
                    response = self.client.get("/api/search?query=dune")
                    elapsed = time.monotonic() - started

        self.assertEqual(response.status_code, 200)
        results = response.get_json()["results"]
        self.assertEqual([r["media_type"] for r in results], ["movie"])
        self.assertLess(elapsed, 2)
        # The anime lookup must use a short (connect, read) timeout, not REQUEST_TIMEOUT.
        self.assertEqual(mock_get.call_args.kwargs["timeout"], (3, 4))


if __name__ == "__main__":
    unittest.main()

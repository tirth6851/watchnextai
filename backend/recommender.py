"""
Content-based recommendation engine for WatchNextAI.

Strategy
--------
1. Fetch user's watched items + ratings from Supabase (up to 50 most recent).
2. Split into seeds: rated (sorted by rating desc) then unrated, capped at 8 seeds.
3. For each seed fetch TMDB /recommendations + /similar in parallel (max 4 workers).
4. Score every candidate that appears across seeds:
     freq_score   = how many seeds surfaced it  (0–1)
     weight_score = avg of seed ratings normalised to 0–1
     genre_score  = genre overlap with user's preferred genres  (0–1)
     quality      = TMDB vote_average × capped vote_count  (0–1)
     final = 0.40·freq + 0.25·weight + 0.25·genre + 0.10·quality
5. Remove already-watched items, return top-N sorted by final score.

Falls back to pure TMDB passthrough when no history exists.
"""

import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

TMDB_BASE_URL = "https://api.themoviedb.org/3"
_TIMEOUT = 8


# ── helpers ───────────────────────────────────────────────────────────────────

def _tmdb(path: str, api_key: str, **params) -> dict:
    params["api_key"] = api_key
    try:
        r = requests.get(f"{TMDB_BASE_URL}{path}", params=params, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception:
        return {}


def _supa_fetch(table: str, supa_url: str, supa_key: str, **filters) -> list:
    """Read rows from a Supabase table via the REST API."""
    headers = {
        "apikey": supa_key,
        "Authorization": f"Bearer {supa_key}",
    }
    params = {k: v for k, v in filters.items()}
    try:
        r = requests.get(
            f"{supa_url}/rest/v1/{table}",
            headers=headers,
            params=params,
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json() or []
    except Exception:
        return []


# ── public API ────────────────────────────────────────────────────────────────

def get_user_history(user_id: str, supa_url: str, supa_key: str) -> list[dict]:
    """
    Return user's watched items sorted newest-first.
    Each row: {media_id, media_type, rating (int|None), title}
    """
    return _supa_fetch(
        "watched",
        supa_url,
        supa_key,
        **{
            "user_id": f"eq.{user_id}",
            "select": "media_id,media_type,rating,title",
            "order": "created_at.desc",
            "limit": "50",
        },
    )


def recommend_for_user(
    user_id: str,
    media_type: str,
    api_key: str,
    supa_url: str,
    supa_key: str,
    limit: int = 24,
) -> list[dict]:
    """
    Build personalised recommendations for *user_id* filtered to *media_type*.
    Returns a ranked list of TMDB item dicts (with media_type injected).
    Returns [] if the user has no relevant history — caller should fall back.
    """
    history = get_user_history(user_id, supa_url, supa_key)
    if not history:
        return []

    # Build set of already-watched IDs so we can exclude them
    watched_ids: set[int] = {
        w["media_id"] for w in history if w["media_type"] == media_type
    }

    # Seeds: items of the requested media_type only
    seeds = [w for w in history if w["media_type"] == media_type]
    if not seeds:
        return []

    rated   = sorted([s for s in seeds if s.get("rating")], key=lambda x: x["rating"], reverse=True)
    unrated = [s for s in seeds if not s.get("rating")]
    ordered_seeds = (rated + unrated)[:8]

    # Fetch genre preferences from top-rated seeds (quick parallel TMDB calls)
    preferred_genres: dict[int, float] = {}

    def _fetch_genres(seed: dict):
        detail = _tmdb(f"/{media_type}/{seed['media_id']}", api_key)
        weight = (seed.get("rating") or 3) / 5.0
        return [(g["id"], weight) for g in detail.get("genres", [])]

    with ThreadPoolExecutor(max_workers=4) as ex:
        for genre_list in ex.map(_fetch_genres, rated[:5]):
            for gid, w in genre_list:
                preferred_genres[gid] = preferred_genres.get(gid, 0.0) + w

    max_genre_val = max(preferred_genres.values(), default=1.0)

    # Fetch TMDB recs + similar for each seed
    candidate_map: dict[int, dict] = {}

    def _fetch_seed_recs(seed: dict):
        rating_weight = (seed.get("rating") or 3) / 5.0
        items = []
        for endpoint in ("recommendations", "similar"):
            data = _tmdb(f"/{media_type}/{seed['media_id']}/{endpoint}", api_key, page=1)
            for item in data.get("results", [])[:12]:
                item["media_type"] = media_type
                items.append(item)
        return items, rating_weight

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_fetch_seed_recs, seed): seed for seed in ordered_seeds}
        for future in as_completed(futures):
            try:
                recs, rating_weight = future.result()
                for item in recs:
                    iid = item.get("id")
                    if not iid or iid in watched_ids:
                        continue
                    if iid not in candidate_map:
                        candidate_map[iid] = {
                            "item": item,
                            "freq": 0,
                            "weight_sum": 0.0,
                            "count": 0,
                        }
                    candidate_map[iid]["freq"]       += 1
                    candidate_map[iid]["weight_sum"] += rating_weight
                    candidate_map[iid]["count"]      += 1
            except Exception:
                pass

    if not candidate_map:
        return []

    max_freq = max(c["freq"] for c in candidate_map.values())

    scored: list[tuple[float, dict]] = []
    for data in candidate_map.values():
        item = data["item"]

        freq_score  = data["freq"] / max_freq
        avg_weight  = data["weight_sum"] / data["count"]

        vote_avg    = item.get("vote_average", 0) / 10.0
        vote_cnt    = min(item.get("vote_count", 0), 1000) / 1000.0
        quality     = vote_avg * vote_cnt

        genre_raw   = sum(preferred_genres.get(g, 0.0) for g in item.get("genre_ids", []))
        genre_score = min(genre_raw / (max_genre_val * 3), 1.0)

        final = freq_score * 0.40 + avg_weight * 0.25 + genre_score * 0.25 + quality * 0.10
        scored.append((final, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def recommend_content_based(
    media_type: str,
    media_id: int,
    api_key: str,
    limit: int = 20,
) -> list[dict]:
    """
    Enhanced single-item content-based fallback.
    Merges TMDB /recommendations + /similar, deduplicates,
    sorts by vote quality and returns top-N.
    """
    seen: set[int] = set()
    results: list[dict] = []

    for endpoint in ("recommendations", "similar"):
        data = _tmdb(f"/{media_type}/{media_id}/{endpoint}", api_key, page=1)
        for item in data.get("results", []):
            iid = item.get("id")
            if iid and iid not in seen:
                seen.add(iid)
                item["media_type"] = media_type
                results.append(item)

    def _quality(item: dict) -> float:
        avg = item.get("vote_average", 0) / 10.0
        cnt = min(item.get("vote_count", 0), 1000) / 1000.0
        return avg * cnt

    results.sort(key=_quality, reverse=True)
    return results[:limit]

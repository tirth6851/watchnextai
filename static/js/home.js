// ---- Theme ----
function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (icon) icon.textContent = mode === "dark" ? "🌙" : "☀️";
  if (label) label.textContent = mode === "dark" ? "Dark" : "Light";
}

(function loadTheme() {
  applyTheme(localStorage.getItem("wn_theme") || "dark");
})();

document.getElementById("themeToggle")?.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("wn_theme", next);
  applyTheme(next);
});

// ---- Toast ----
function showToast(msg, variant = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  t.classList.toggle("toast-error", variant === "error");
  setTimeout(() => t.classList.remove("show"), 3500);
}

// ---- Hero search → /browse?q=... ----
function goSearch() {
  const q = document.getElementById("heroSearchInput")?.value.trim();
  if (!q) return;
  window.location.href = `/browse?q=${encodeURIComponent(q)}`;
}

document.getElementById("heroSearchBtn")?.addEventListener("click", goSearch);
document.getElementById("heroSearchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") goSearch();
});

// ---- Card builders ----
function makeMovieCard(movie) {
  const poster = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : "https://via.placeholder.com/342x513?text=No+Image";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "—";
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
  const card = document.createElement("a");
  card.className = "home-card";
  card.href = `/movie/${movie.id}`;
  card.innerHTML = `
    <img class="home-card__poster" src="${poster}" alt="${movie.title || "Movie"}" loading="lazy" />
    <div class="home-card__info">
      <span class="home-card__title">${movie.title || "Untitled"}</span>
      <span class="home-card__meta">⭐ ${rating} · ${year}</span>
    </div>
    <span class="home-card__badge home-card__badge--movie">Movie</span>
  `;
  return card;
}

function makeTvCard(show) {
  const poster = show.poster_path
    ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
    : "https://via.placeholder.com/342x513?text=No+Image";
  const rating = show.vote_average ? show.vote_average.toFixed(1) : "—";
  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : "";
  const card = document.createElement("a");
  card.className = "home-card";
  card.href = `/tv/${show.id}`;
  card.innerHTML = `
    <img class="home-card__poster" src="${poster}" alt="${show.name || "Show"}" loading="lazy" />
    <div class="home-card__info">
      <span class="home-card__title">${show.name || "Untitled"}</span>
      <span class="home-card__meta">⭐ ${rating} · ${year}</span>
    </div>
    <span class="home-card__badge home-card__badge--tv">TV</span>
  `;
  return card;
}

function makeAnimeCard(anime) {
  const poster = anime.images?.jpg?.image_url || "https://via.placeholder.com/342x513?text=No+Image";
  const rating = anime.score ? anime.score.toFixed(1) : "—";
  const year = anime.aired?.from ? anime.aired.from.slice(0, 4) : "";
  const card = document.createElement("a");
  card.className = "home-card";
  card.href = `/anime/${anime.mal_id}`;
  card.innerHTML = `
    <img class="home-card__poster" src="${poster}" alt="${anime.title || "Anime"}" loading="lazy" />
    <div class="home-card__info">
      <span class="home-card__title">${anime.title || "Untitled"}</span>
      <span class="home-card__meta">⭐ ${rating} · ${year}</span>
    </div>
    <span class="home-card__badge home-card__badge--anime">Anime</span>
  `;
  return card;
}

// ---- Populate rows ----
async function populateRow(rowId, url, cardFn, itemsKey) {
  const row = document.getElementById(rowId);
  if (!row) return;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const items = data[itemsKey] || [];
    row.innerHTML = "";
    items.slice(0, 20).forEach((item) => row.appendChild(cardFn(item)));
  } catch (e) {
    row.innerHTML = `<p style="color:var(--text-muted);padding:1rem;">Could not load content.</p>`;
  }
}

// ---- Hero background cycling ----
async function loadHeroBg() {
  const bg = document.getElementById("heroBg");
  if (!bg) return;
  try {
    const resp = await fetch("/api/movies?category=trending&page=1");
    const data = await resp.json();
    const movies = (data.movies || []).filter((m) => m.backdrop_path);
    if (!movies.length) return;
    let idx = 0;
    function showNext() {
      const m = movies[idx % movies.length];
      bg.style.backgroundImage = `url(https://image.tmdb.org/t/p/w1280${m.backdrop_path})`;
      idx++;
    }
    showNext();
    setInterval(showNext, 6000);
  } catch (_) {}
}

// ---- Mixed card (for recommendations which already have media_type) ----
function makeMixedCard(item) {
  if (item.media_type === "tv") return makeTvCard(item);
  return makeMovieCard(item);
}

// ---- Phase 1: "Because you watched" row ----
async function loadRecommendations(session) {
  const { data: watched, error } = await supabase
    .from("watched")
    .select("media_id, media_type, title")
    .eq("user_id", session.user.id)
    .in("media_type", ["movie", "tv"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !watched || watched.length === 0) return;
  const seed = watched[0];

  const resp = await fetch(`/api/recommendations?media_type=${seed.media_type}&media_id=${seed.media_id}`);
  if (!resp.ok) return;
  const data = await resp.json();
  const items = (data.results || []).slice(0, 20);
  if (!items.length) return;

  const section = document.getElementById("recsSection");
  const title = document.getElementById("recsTitle");
  const row = document.getElementById("recsRow");
  if (!section || !title || !row) return;

  title.textContent = `✨ Because you watched "${seed.title}"`;
  row.innerHTML = "";
  items.forEach((item) => row.appendChild(makeMixedCard(item)));
  section.style.display = "";
}

// ---- Phase 2: genre-taste "Picked for you" row ----
async function loadForYou(session) {
  const { data: watched, error } = await supabase
    .from("watched")
    .select("media_id, media_type, title, rating")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !watched || watched.length < 2) return;

  const payload = watched.map((w) => ({
    media_id: w.media_id,
    media_type: w.media_type,
    rating: w.rating || 5,
  }));

  const resp = await fetch("/api/for-you", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watched: payload }),
  });
  if (!resp.ok) return;
  const data = await resp.json();
  const items = (data.results || []).slice(0, 20);
  if (!items.length) return;

  const section = document.getElementById("forYouSection");
  const row = document.getElementById("forYouRow");
  if (!section || !row) return;

  row.innerHTML = "";
  items.forEach((item) => row.appendChild(makeMixedCard(item)));
  section.style.display = "";
}

// ---- Phase 3: AI picks row ----
async function loadAiPicks(session) {
  const { data: watched, error } = await supabase
    .from("watched")
    .select("media_id, media_type, title, rating")
    .eq("user_id", session.user.id)
    .not("rating", "is", null)
    .order("rating", { ascending: false })
    .limit(8);

  if (error || !watched || watched.length < 2) return;

  const titles = watched.map((w) => ({
    title: w.title,
    type: w.media_type,
    rating: w.rating,
  }));

  const section = document.getElementById("aiPicksSection");
  const row = document.getElementById("aiPicksRow");
  if (!section || !row) return;

  // Show loading state
  section.style.display = "";
  row.innerHTML = `<div class="home-row__loading">🤖 AI is thinking…</div>`;

  const resp = await fetch("/api/ai-picks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titles }),
  });

  if (!resp.ok) {
    section.style.display = "none";
    return;
  }

  const data = await resp.json();
  const picks = (data.picks || []).slice(0, 8);
  if (!picks.length) {
    section.style.display = "none";
    return;
  }

  row.innerHTML = "";
  picks.forEach((item) => {
    const card = makeMixedCard(item);
    if (!card) return;
    // Add AI reason tooltip
    if (item._reason) {
      const reason = document.createElement("div");
      reason.className = "home-card__reason";
      reason.textContent = item._reason;
      card.appendChild(reason);
    }
    row.appendChild(card);
  });
}

// ---- Load all personalised rows ----
async function loadPersonalised() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // Run all three phases in parallel
  await Promise.allSettled([
    loadRecommendations(session),
    loadForYou(session),
    loadAiPicks(session),
  ]);
}

// ---- Init ----
loadHeroBg();
loadPersonalised();
populateRow("trendingMoviesRow", "/api/movies?category=trending&page=1", makeMovieCard, "movies");
populateRow("trendingTvRow", "/api/tv_shows?category=trending&page=1", makeTvCard, "shows");
populateRow("topAnimeRow", "/api/anime?category=top&page=1", makeAnimeCard, "anime");

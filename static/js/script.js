let page = 1;
let isLoading = false;
let hasMore = true;

const grid = document.getElementById("movieGrid");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");

const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// -------- THEME ----------
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  if (themeToggle) {
    const icon = themeToggle.querySelector(".btn-icon");
    const text = themeToggle.querySelector(".btn-text");
    if (theme === "light") {
      icon.textContent = "☀️";
      text.textContent = "Light";
    } else {
      icon.textContent = "🌙";
      text.textContent = "Dark";
    }
  }

  try { localStorage.setItem("watchnextai_theme", theme); } catch (_) {}
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("watchnextai_theme"); } catch (_) {}

  if (saved === "light" || saved === "dark") {
    setTheme(saved);
    return;
  }

  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  setTheme(prefersLight ? "light" : "dark");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  });
}
initTheme();

// -------- SEARCH (client-side) ----------
function filterCards(query) {
  if (!grid) return;
  const q = (query || "").trim().toLowerCase();
  const cards = grid.querySelectorAll(".card");

  cards.forEach(card => {
    const title = card.getAttribute("data-title") || "";
    card.style.display = (q === "" || title.includes(q)) ? "" : "none";
  });
}

if (searchBtn && searchInput) {
  searchBtn.addEventListener("click", () => filterCards(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") filterCards(searchInput.value);
  });
}

// -------- INFINITE SCROLL ----------
function setLoading(show, text) {
  if (!loading || !loadingText) return;
  loading.style.display = show ? "flex" : "none";
  if (text) loadingText.textContent = text;
}

function makeCard(movie) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("data-title", (movie.title || "").toLowerCase());

  const poster = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  const rating = (movie.vote_average ?? 0).toFixed(1);
  const date = movie.release_date ? movie.release_date : "";

  card.innerHTML = `
    <a class="card-link" href="/movie/${movie.id}">
      <div class="poster">
        <img loading="lazy" src="${poster}" alt="${movie.title || "Movie"}" />
      </div>
      <div class="meta">
        <h3 class="movie-title">${movie.title || "Untitled"}</h3>
        <div class="row">
          <span class="badge">⭐ ${rating}</span>
          <span class="muted">${date}</span>
        </div>
      </div>
    </a>
  `;
  return card;
}

async function loadMoreMovies() {
  if (!grid || isLoading || !hasMore) return;

  isLoading = true;
  setLoading(true, "Loading more movies…");
  page += 1;

  try {
    const res = await fetch(`/load_more?page=${page}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      hasMore = false;
      setLoading(true, data.error || "Failed to load more.");
      return;
    }

    const movies = data.movies || [];
    if (movies.length === 0) {
      hasMore = false;
      setLoading(true, "No more movies to load.");
      return;
    }

    movies.forEach(m => grid.appendChild(makeCard(m)));
    setLoading(false);
  } catch (err) {
    hasMore = false;
    setLoading(true, err.message || "Network error.");
  } finally {
    isLoading = false;
  }
}

window.addEventListener("scroll", () => {
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 700;
  if (nearBottom) loadMoreMovies();
});

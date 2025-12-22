let page = 1;
let isLoading = false;
let hasMore = true;

let currentCategory = "popular"; // huge default
let currentQuery = "";

const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

const navLinks = document.getElementById("navLinks");
const pageTitle = document.getElementById("pageTitle");

const titles = {
  popular: "🔥 Popular Movies",
  top_rated: "⭐ Top Rated Movies",
  now_playing: "🎟️ Now Playing",
  upcoming: "📅 Upcoming Movies",
  discover: "🧭 Discover Movies",
  trending: "🔥 Trending Movies"
};

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  if (mode === "dark") {
    themeIcon && (themeIcon.textContent = "🌙");
    themeLabel && (themeLabel.textContent = "Dark");
  } else {
    themeIcon && (themeIcon.textContent = "☀️");
    themeLabel && (themeLabel.textContent = "Light");
  }
}

function loadTheme() {
  const saved = localStorage.getItem("wn_theme") || "dark";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("wn_theme", next);
  applyTheme(next);
}

themeToggle?.addEventListener("click", toggleTheme);
loadTheme();

function setActiveCategoryButton(category) {
  if (!navLinks) return;
  navLinks.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
}

async function fetchMovies(nextPage) {
  const params = new URLSearchParams({
    page: String(nextPage),
    category: currentCategory
  });

  if (currentQuery) params.set("q", currentQuery);

  const res = await fetch(`/load_more?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function renderMovieCard(movie) {
  const item = document.createElement("article");
  item.className = "card";

  const posterPath = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  item.innerHTML = `
    <a class="card-link" href="/movie/${movie.id}">
      <img class="poster" src="${posterPath}" alt="${movie.title || "Movie"}" loading="lazy">
    </a>
    <div class="card-meta">
      <div class="card-title">${movie.title || "Untitled"}</div>
      <div class="card-sub">
        <span class="rating">⭐ ${(movie.vote_average ?? "").toString().slice(0, 3)}</span>
        <span class="date">${movie.release_date || ""}</span>
      </div>
    </div>
  `;
  return item;
}

async function loadMoreMovies() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  loading.style.display = "block";
  loading.textContent = "Loading more movies...";

  page += 1;

  try {
    const data = await fetchMovies(page);
    const movies = data.movies || [];

    if (!movies.length) {
      hasMore = false;
      loading.textContent = "No more movies to load.";
      return;
    }

    movies.forEach(m => container.appendChild(renderMovieCard(m)));
    loading.style.display = "none";
  } catch (err) {
    hasMore = false;
    loading.textContent = "Error loading more movies.";
    console.error(err);
  } finally {
    isLoading = false;
  }
}

function resetAndLoadFirstPage() {
  page = 0;         // because loadMore increments first
  hasMore = true;
  isLoading = false;
  container.innerHTML = "";
  loading.style.display = "none";
  loadMoreMovies();
}

function handleScroll() {
  const scrollBottom = window.innerHeight + window.scrollY;
  const nearBottom = scrollBottom >= document.body.offsetHeight - 900;
  if (nearBottom) loadMoreMovies();
}

window.addEventListener("scroll", handleScroll);

navLinks?.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-link");
  if (!btn) return;

  currentCategory = btn.dataset.category;
  currentQuery = "";
  searchInput && (searchInput.value = "");

  setActiveCategoryButton(currentCategory);
  pageTitle && (pageTitle.textContent = titles[currentCategory] || "Movies");
  resetAndLoadFirstPage();
});

async function runSearch() {
  const q = (searchInput?.value || "").trim();
  currentQuery = q;
  if (pageTitle) pageTitle.textContent = q ? `🔎 Results for "${q}"` : (titles[currentCategory] || "Movies");
  resetAndLoadFirstPage();
}

searchBtn?.addEventListener("click", runSearch);
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

/* Initial state */
setActiveCategoryButton(currentCategory);
pageTitle && (pageTitle.textContent = titles[currentCategory] || "Movies");
resetAndLoadFirstPage();

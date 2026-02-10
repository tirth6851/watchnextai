const state = {
  page: 1,
  isLoading: false,
  hasMore: true,
  currentCategory: "discover",
  currentQuery: "",
};

const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");
const toast = document.getElementById("toast");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const navLinks = document.getElementById("navLinks");
const pageTitle = document.getElementById("pageTitle");
const pageHint = document.getElementById("pageHint");

const titles = {
  discover: "🧭 Discover",
  trending: "🔥 Trending",
  popular: "🎬 Popular",
  top_rated: "⭐ Top Rated",
  upcoming: "📅 Upcoming",
  now_playing: "🎟️ Now Playing",
};

const hints = {
  discover: "Endless picks across every genre and vibe.",
  trending: "Weekly buzz and what everyone is watching.",
  popular: "Big hits you can queue up tonight.",
  top_rated: "Critically loved classics and favorites.",
  upcoming: "New releases around the corner.",
  now_playing: "Currently in theaters worldwide.",
};

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  if (mode === "dark") {
    if (themeIcon) themeIcon.textContent = "🌙";
    if (themeLabel) themeLabel.textContent = "Dark";
  } else {
    if (themeIcon) themeIcon.textContent = "☀️";
    if (themeLabel) themeLabel.textContent = "Light";
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

function showToast(message, variant = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  toast.classList.toggle("toast-error", variant === "error");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function setActiveCategoryButton(category) {
  if (!navLinks) return;
  navLinks.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
}

function updateHeader() {
  if (!pageTitle || !pageHint) return;
  if (state.currentQuery) {
    pageTitle.textContent = `🔎 Results for "${state.currentQuery}"`;
    pageHint.textContent = "Searching the full library.";
  } else {
    pageTitle.textContent = titles[state.currentCategory] || "Movies";
    pageHint.textContent = hints[state.currentCategory] || "Browse the library.";
  }
}

function renderMovieCard(movie) {
  const card = document.createElement("article");
  card.className = "card movie-card";
  card.dataset.title = (movie.title || "").toLowerCase();

  const posterPath = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "0.0";
  const releaseYear = movie.release_date ? movie.release_date.slice(0, 4) : "TBA";

  card.innerHTML = `
    <a class="card-link" href="/movie/${movie.id}">
      <img class="poster" src="${posterPath}" alt="${movie.title || "Movie"}" loading="lazy" />
    </a>
    <div class="card-meta">
      <h3 class="card-title">${movie.title || "Untitled"}</h3>
      <div class="card-sub">
        <span class="rating">⭐ ${rating}</span>
        <span class="release">${releaseYear}</span>
      </div>
    </div>
  `;

  return card;
}

async function fetchMovies(page) {
  const params = new URLSearchParams({ page: String(page), category: state.currentCategory });
  if (state.currentQuery) {
    params.set("q", state.currentQuery);
  }

  const response = await fetch(`/api/movies?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function loadMovies({ page, replace = false } = {}) {
  if (!container || state.isLoading) return;
  if (!state.hasMore && !replace) return;

  state.isLoading = true;
  if (loading) loading.style.display = "block";

  try {
    const data = await fetchMovies(page);
    const movies = data.movies || [];

    if (replace) {
      container.innerHTML = "";
    }

    if (!movies.length) {
      state.hasMore = false;
      if (loading) loading.textContent = "No more movies to load.";
    } else {
      movies.forEach((movie) => container.appendChild(renderMovieCard(movie)));
      if (loading) loading.style.display = "none";
    }

    state.page = page;
    applyClientFilter(searchInput?.value || "");
  } catch (error) {
    state.hasMore = false;
    if (loading) loading.style.display = "none";
    showToast(error.message || "Could not load movies.", "error");
  } finally {
    state.isLoading = false;
  }
}

function resetAndLoad() {
  state.page = 1;
  state.hasMore = true;
  if (loading) {
    loading.textContent = "Loading more movies…";
    loading.style.display = "block";
  }
  loadMovies({ page: 1, replace: true });
}

function applyClientFilter(query) {
  if (!container) return;
  const normalized = query.trim().toLowerCase();
  const cards = container.querySelectorAll(".movie-card");
  cards.forEach((card) => {
    const title = card.dataset.title || "";
    card.style.display = normalized && !title.includes(normalized) ? "none" : "";
  });
}

function handleSearchInput(event) {
  applyClientFilter(event.target.value || "");
}

function runServerSearch() {
  const q = (searchInput?.value || "").trim();
  state.currentQuery = q;
  updateHeader();
  resetAndLoad();
}

function handleCategoryClick(event) {
  const button = event.target.closest(".nav-link");
  if (!button) return;

  state.currentCategory = button.dataset.category;
  state.currentQuery = "";
  if (searchInput) searchInput.value = "";
  localStorage.setItem("wn_category", state.currentCategory);

  setActiveCategoryButton(state.currentCategory);
  updateHeader();
  resetAndLoad();
}

function throttle(fn, wait) {
  let lastRun = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastRun >= wait) {
      lastRun = now;
      fn(...args);
    }
  };
}

const handleScroll = throttle(() => {
  if (state.isLoading || !state.hasMore) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 800;
  if (nearBottom) {
    loadMovies({ page: state.page + 1 });
  }
}, 250);

if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
if (navLinks) navLinks.addEventListener("click", handleCategoryClick);
if (searchInput) searchInput.addEventListener("input", handleSearchInput);
if (searchBtn) searchBtn.addEventListener("click", runServerSearch);
if (searchInput) {
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runServerSearch();
    }
  });
}

loadTheme();

const savedCategory = localStorage.getItem("wn_category");
if (savedCategory && titles[savedCategory]) {
  state.currentCategory = savedCategory;
}

setActiveCategoryButton(state.currentCategory);
updateHeader();
if (container) {
  resetAndLoad();
}

window.addEventListener("scroll", handleScroll);

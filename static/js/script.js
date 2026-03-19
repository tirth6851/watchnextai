const state = {
  page: 1,
  isLoading: false,
  hasMore: true,
  currentCategory: "discover",
  currentQuery: "",
  currentContentType: "movies",
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

const movieTitles = {
  discover: "🧭 Discover",
  trending: "🔥 Trending",
  popular: "🎬 Popular",
  top_rated: "⭐ Top Rated",
  upcoming: "📅 Upcoming",
  now_playing: "🎟️ Now Playing",
};

const movieHints = {
  discover: "Endless picks across every genre and vibe.",
  trending: "Weekly buzz and what everyone is watching.",
  popular: "Big hits you can queue up tonight.",
  top_rated: "Critically loved classics and favorites.",
  upcoming: "New releases around the corner.",
  now_playing: "Currently in theaters worldwide.",
};

const tvTitles = {
  trending: "🔥 Trending Shows",
  popular: "📺 Popular Shows",
  top_rated: "⭐ Top Rated Shows",
  on_air: "📡 On Air",
  airing_today: "🗓️ Airing Today",
};

const tvHints = {
  trending: "Shows everyone is binge-watching this week.",
  popular: "Top picks for your next binge.",
  top_rated: "Critically acclaimed series.",
  on_air: "Currently running shows.",
  airing_today: "New episodes dropping today.",
};

// Nav buttons per content type
const movieNavCategories = ["discover", "trending", "popular", "top_rated", "upcoming", "now_playing"];
const tvNavCategories = ["trending", "popular", "top_rated", "on_air", "airing_today"];

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  const dynamicBg = document.getElementById("dynamicBg");
  if (dynamicBg) {
    dynamicBg.style.opacity = mode === "light" ? "0" : (dynamicBg.style.backgroundImage ? "1" : "0");
  }
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

function updateNavForContentType() {
  if (!navLinks) return;
  const type = state.currentContentType;
  navLinks.querySelectorAll(".nav-link").forEach((btn) => {
    const cat = btn.dataset.category;
    if (type === "movies") {
      btn.style.display = movieNavCategories.includes(cat) ? "" : "none";
    } else if (type === "tv") {
      btn.style.display = tvNavCategories.includes(cat) ? "" : "none";
    } else {
      // anime — hide all category nav
      btn.style.display = "none";
    }
  });
}

function updateHeader() {
  if (!pageTitle || !pageHint) return;
  if (state.currentQuery) {
    pageTitle.textContent = `🔎 Results for "${state.currentQuery}"`;
    pageHint.textContent = "Searching the full library.";
    return;
  }
  if (state.currentContentType === "movies") {
    pageTitle.textContent = movieTitles[state.currentCategory] || "Movies";
    pageHint.textContent = movieHints[state.currentCategory] || "Browse the library.";
  } else if (state.currentContentType === "tv") {
    pageTitle.textContent = tvTitles[state.currentCategory] || "TV Shows";
    pageHint.textContent = tvHints[state.currentCategory] || "Browse TV shows.";
  } else {
    pageTitle.textContent = "🎌 Anime";
    pageHint.textContent = "Top anime from MyAnimeList.";
  }
}

// ---- 3D Tilt effect ----

function addTiltEffect(card) {
  card.addEventListener("mousemove", function (e) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -9;
    const rotY = ((x - cx) / cx) * 9;
    card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04,1.04,1.04)`;
    const glare = card.querySelector(".card-glare");
    if (glare) {
      const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90;
      const pct = Math.min(
        Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) /
          (Math.max(rect.width, rect.height) * 0.55),
        1
      );
      glare.style.background = `linear-gradient(${angle}deg, rgba(255,255,255,${(pct * 0.22).toFixed(3)}), transparent 60%)`;
    }
  });
  card.addEventListener("mouseleave", function () {
    card.style.transform = "";
    const glare = card.querySelector(".card-glare");
    if (glare) glare.style.background = "transparent";
  });
}

// ---- Card renderers ----

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
    <div class="card-glare"></div>
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
  addTiltEffect(card);
  return card;
}

function renderTvCard(show) {
  const card = document.createElement("article");
  card.className = "card movie-card";
  card.dataset.title = (show.name || "").toLowerCase();

  const posterPath = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  const rating = show.vote_average ? show.vote_average.toFixed(1) : "0.0";
  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : "TBA";

  card.innerHTML = `
    <div class="card-glare"></div>
    <a class="card-link" href="/tv/${show.id}">
      <img class="poster" src="${posterPath}" alt="${show.name || "Show"}" loading="lazy" />
    </a>
    <div class="card-meta">
      <h3 class="card-title">${show.name || "Untitled"}</h3>
      <div class="card-sub">
        <span class="rating">⭐ ${rating}</span>
        <span class="release">${year}</span>
      </div>
    </div>
  `;
  addTiltEffect(card);
  return card;
}

function renderAnimeCard(anime) {
  const card = document.createElement("article");
  card.className = "card movie-card";
  card.dataset.title = (anime.title || "").toLowerCase();

  const imageUrl = anime.images?.jpg?.image_url || "https://via.placeholder.com/500x750?text=No+Image";
  const rating = anime.score ? anime.score.toFixed(1) : "N/A";
  const year = anime.aired?.from ? anime.aired.from.slice(0, 4) : "TBA";

  card.innerHTML = `
    <div class="card-glare"></div>
    <a class="card-link" href="/anime/${anime.mal_id}">
      <img class="poster" src="${imageUrl}" alt="${anime.title || "Anime"}" loading="lazy" />
    </a>
    <div class="card-meta">
      <h3 class="card-title">${anime.title || "Untitled"}</h3>
      <div class="card-sub">
        <span class="rating">⭐ ${rating}</span>
        <span class="release">${year}</span>
      </div>
    </div>
  `;
  addTiltEffect(card);
  return card;
}

// ---- Fetch functions ----

async function fetchMovies(page) {
  const category = state.currentQuery ? "search" : state.currentCategory;
  const params = new URLSearchParams({ page: String(page), category });
  if (state.currentQuery) params.set("query", state.currentQuery);

  const response = await fetch(`/api/movies?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTvShows(page) {
  const category = state.currentQuery ? "search" : state.currentCategory;
  const params = new URLSearchParams({ page: String(page), category });
  if (state.currentQuery) params.set("query", state.currentQuery);

  const response = await fetch(`/api/tv_shows?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchAnime(page) {
  const params = new URLSearchParams({ page: String(page) });
  if (state.currentQuery) {
    params.set("category", "search");
    params.set("query", state.currentQuery);
  } else {
    params.set("category", "top");
  }

  const response = await fetch(`/api/anime?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ---- Main load function ----

async function loadContent({ page, replace = false } = {}) {
  if (!container || state.isLoading) return;
  if (!state.hasMore && !replace) return;

  state.isLoading = true;
  if (loading) loading.style.display = "block";

  try {
    let items = [];

    if (state.currentContentType === "movies") {
      const data = await fetchMovies(page);
      items = data.movies || [];
      if (replace) container.innerHTML = "";
      if (!items.length) {
        state.hasMore = false;
        if (loading) loading.textContent = "No more movies to load.";
      } else {
        items.forEach((m) => container.appendChild(renderMovieCard(m)));
        if (loading) loading.style.display = "none";
      }
    } else if (state.currentContentType === "tv") {
      const data = await fetchTvShows(page);
      items = data.shows || [];
      if (replace) container.innerHTML = "";
      if (!items.length) {
        state.hasMore = false;
        if (loading) loading.textContent = "No more shows to load.";
      } else {
        items.forEach((s) => container.appendChild(renderTvCard(s)));
        if (loading) loading.style.display = "none";
      }
    } else {
      const data = await fetchAnime(page);
      items = data.anime || [];
      if (replace) container.innerHTML = "";
      if (!items.length) {
        state.hasMore = false;
        if (loading) loading.textContent = "No more anime to load.";
      } else {
        items.forEach((a) => container.appendChild(renderAnimeCard(a)));
        if (loading) loading.style.display = "none";
      }
    }

    state.page = page;
    applyClientFilter(searchInput?.value || "");
  } catch (error) {
    state.hasMore = false;
    if (loading) loading.style.display = "none";
    showToast(error.message || "Could not load content.", "error");
  } finally {
    state.isLoading = false;
  }
}

// Keep old name as alias for compatibility
function loadMovies(opts) { return loadContent(opts); }

function resetAndLoad() {
  state.page = 1;
  state.hasMore = true;
  if (loading) {
    loading.textContent = "Loading…";
    loading.style.display = "block";
  }
  loadContent({ page: 1, replace: true });
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

// Content-type tab handler
function handleContentTypeClick(event) {
  const button = event.target.closest(".content-type-btn");
  if (!button) return;

  const type = button.dataset.type;
  if (type === state.currentContentType) return;

  state.currentContentType = type;
  state.currentQuery = "";
  if (searchInput) searchInput.value = "";

  // Set a default category for the new type
  if (type === "movies") {
    state.currentCategory = localStorage.getItem("wn_category") || "discover";
  } else if (type === "tv") {
    state.currentCategory = "popular";
  }

  // Update active tab button
  document.querySelectorAll(".content-type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  updateNavForContentType();
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
    loadContent({ page: state.page + 1 });
  }
}, 250);

if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
if (navLinks) navLinks.addEventListener("click", handleCategoryClick);
if (searchInput) searchInput.addEventListener("input", handleSearchInput);
if (searchBtn) searchBtn.addEventListener("click", runServerSearch);
if (searchInput) {
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runServerSearch();
  });
}

const contentTypeTabs = document.getElementById("contentTypeTabs");
if (contentTypeTabs) contentTypeTabs.addEventListener("click", handleContentTypeClick);

loadTheme();

const savedCategory = localStorage.getItem("wn_category");
if (savedCategory && movieTitles[savedCategory]) {
  state.currentCategory = savedCategory;
}

updateNavForContentType();
setActiveCategoryButton(state.currentCategory);
updateHeader();
if (container) {
  resetAndLoad();
}

window.addEventListener("scroll", handleScroll);

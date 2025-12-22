let page = 1;
const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

let isLoading = false;
let hasMore = true;

/* =========================
   Theme (system / light / dark)
   ========================= */
function getSystemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode) {
  // mode: "system" | "light" | "dark"
  document.documentElement.setAttribute("data-theme", mode);

  const effective = mode === "system" ? getSystemTheme() : mode;
  if (effective === "dark") {
    themeIcon.textContent = "🌙";
    themeLabel.textContent = "Dark";
  } else {
    themeIcon.textContent = "☀️";
    themeLabel.textContent = "Light";
  }
}

function loadTheme() {
  const saved = localStorage.getItem("wn_theme") || "system";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "system";
  const next = current === "dark" ? "light" : "dark"; // simple toggle between dark/light
  localStorage.setItem("wn_theme", next);
  applyTheme(next);
}

themeToggle?.addEventListener("click", toggleTheme);

// If user uses "system", update live when OS theme changes
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const current = document.documentElement.getAttribute("data-theme") || "system";
    if (current === "system") applyTheme("system");
  });
}

loadTheme();

/* =========================
   Active card detection (IntersectionObserver)
   ========================= */
function setupActiveObserver() {
  const items = document.querySelectorAll(".feed-item");
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      // pick the entry with the highest intersectionRatio
      let best = null;
      for (const e of entries) {
        if (e.isIntersecting) {
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
      }
      if (best?.target) {
        document.querySelectorAll(".feed-item").forEach(el => el.classList.remove("active"));
        best.target.classList.add("active");
      }
    },
    { root: container, threshold: [0.35, 0.5, 0.65, 0.8] }
  );

  items.forEach(item => observer.observe(item));
}

/* =========================
   Infinite scroll
   ========================= */
async function loadMoreMovies() {
  if (isLoading || !hasMore) return;

  isLoading = true;
  loading.style.display = "block";
  loading.textContent = "Loading more movies...";

  page++;

  let data = { movies: [], error: "Failed to load more movies." };

  try {
    const response = await fetch(`/load_more?page=${page}`);
    if (response.ok) {
      data = await response.json();
    } else {
      data.error = `Failed to load more movies (${response.status}).`;
    }
  } catch (err) {
    data.error = err.message || data.error;
  }

  if (!data.movies || data.movies.length === 0) {
    hasMore = false;
    loading.textContent = data.error || "No more movies to load.";
    isLoading = false;
    return;
  }

  data.movies.forEach(movie => {
    const item = document.createElement("article");
    item.className = "feed-item";
    item.dataset.id = movie.id;
    item.dataset.title = (movie.title || "").toLowerCase();

    const posterPath = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "https://via.placeholder.com/500x750?text=No+Image";

    const overview = movie.overview ? movie.overview : "No overview available.";

    item.innerHTML = `
      <a class="poster-link" href="/movie/${movie.id}" aria-label="Open ${movie.title}">
        <img class="poster" src="${posterPath}" alt="${movie.title}" loading="lazy">
      </a>

      <div class="overlay">
        <div class="overlay-top">
          <div class="title-wrap">
            <h2 class="movie-title">${movie.title}</h2>
            ${movie.release_date ? `<div class="meta">${movie.release_date}</div>` : ``}
          </div>

          <div class="badge" title="TMDB Rating">
            <span aria-hidden="true">⭐</span>
            <span>${movie.vote_average ?? ""}</span>
          </div>
        </div>

        <p class="overview">${overview}</p>

        <div class="actions">
          <a class="btn" href="/movie/${movie.id}">Details</a>
          <button class="btn btn-ghost" type="button" data-action="save">Save</button>
          <button class="btn btn-ghost" type="button" data-action="share">Share</button>
        </div>
      </div>

      <div class="right-rail" aria-hidden="true">
        <div class="rail-btn">❤️</div>
        <div class="rail-btn">➕</div>
        <div class="rail-btn">↗️</div>
      </div>
    `;

    container.appendChild(item);
  });

  // re-run observer on new items
  setupActiveObserver();

  loading.style.display = "none";
  isLoading = false;
}

container?.addEventListener("scroll", () => {
  const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 900;
  if (nearBottom) loadMoreMovies();
});

/* =========================
   Search filter (client-side)
   ========================= */
function filterMovies(query) {
  const q = (query || "").trim().toLowerCase();
  const items = document.querySelectorAll(".feed-item");

  items.forEach(item => {
    const title = item.dataset.title || "";
    item.style.display = q === "" || title.includes(q) ? "" : "none";
  });
}

searchBtn?.addEventListener("click", () => filterMovies(searchInput.value));
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") filterMovies(searchInput.value);
});

/* Init */
setupActiveObserver();
loading.style.display = "none";

let page = 1;
const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");

let isLoading = false;
let hasMore = true;

// Find the most visible item and mark it active
function updateActiveCard() {
  const items = document.querySelectorAll(".feed-item");
  if (!items.length) return;

  const viewportTop = container.scrollTop;
  const viewportHeight = container.clientHeight;

  let bestItem = null;
  let bestScore = -Infinity;

  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    // rect is relative to window; we want visibility score based on center distance
    const centerDist = Math.abs((rect.top + rect.height / 2) - (window.innerHeight / 2));
    const score = -centerDist; // closer to center = better (less distance)

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  });

  items.forEach(i => i.classList.remove("active"));
  if (bestItem) bestItem.classList.add("active");
}

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

  if (data.error && (!data.movies || data.movies.length === 0)) {
    loading.textContent = data.error;
    isLoading = false;
    return;
  }

  if (!data.movies || data.movies.length === 0) {
    hasMore = false;
    loading.textContent = "No more movies to load.";
    isLoading = false;
    return;
  }

  data.movies.forEach(movie => {
    const item = document.createElement("article");
    item.className = "feed-item movie-card";
    item.dataset.id = movie.id;

    const posterPath = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "https://via.placeholder.com/500x750?text=No+Image";

    const overview = movie.overview ? movie.overview : "";

    item.innerHTML = `
      <a class="poster-link" href="/movie/${movie.id}" aria-label="Open ${movie.title}">
        <img class="poster" src="${posterPath}" alt="${movie.title}" loading="lazy">
      </a>

      <div class="overlay">
        <div class="title-row">
          <h2 class="movie-title">${movie.title}</h2>
          <div class="rating">⭐ ${movie.vote_average ?? ""}</div>
        </div>
        <p class="overview">${overview}</p>
        <div class="actions">
          <a class="btn" href="/movie/${movie.id}">Details</a>
          <button class="btn btn-ghost" type="button">Save</button>
        </div>
      </div>
    `;

    container.appendChild(item);
  });

  loading.style.display = "none";
  isLoading = false;
  updateActiveCard();
}

// Scroll handler for container (not window!)
container.addEventListener("scroll", () => {
  updateActiveCard();

  // Load more when near bottom
  const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 800;
  if (nearBottom) loadMoreMovies();
});

// Initial
updateActiveCard();

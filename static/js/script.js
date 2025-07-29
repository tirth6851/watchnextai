let page = 1; // Pagination
let isSearching = false; // Track if search results are displayed
const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");
const searchForm = document.getElementById("search-form");
const searchInput = searchForm ? searchForm.querySelector("input") : null;

function appendMovies(movies, clear = false) {
  if (clear) container.innerHTML = "";
  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <a href="/movie/${movie.id}">
        <img src="https://image.tmdb.org/t/p/w300${movie.poster_path}" alt="${movie.title}">
      </a>
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p>⭐ ${movie.vote_average}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadTrending(reset = false) {
  if (reset) {
    page = 1;
    container.innerHTML = "";
  }
  loading.style.display = "block";
  const response = await fetch(`/load_more?page=${page}`);
  const data = await response.json();
  appendMovies(data.movies);
  loading.style.display = "none";
  animateCards();
}

// Animate cards when visible and scale center card
function animateCards() {
  const cards = document.querySelectorAll(".movie-card");
  const centerY = window.innerHeight / 2;

  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const distance = Math.abs(centerY - cardCenter);

    // Reveal effect
    if (rect.top < window.innerHeight) card.classList.add("show");

    // Scale based on distance from center
    let scale = 1 - distance / 600;
    scale = Math.max(0.9, Math.min(scale, 1.3));
    card.style.transform = `scale(${scale})`;
  });
}

// Infinite scroll loading
async function loadMoreMovies() {
  if (isSearching) return;
  loading.style.display = "block";
  page++;
  const response = await fetch(`/load_more?page=${page}`);
  const data = await response.json();
  appendMovies(data.movies);
  loading.style.display = "none";
  animateCards();
}

window.addEventListener("scroll", () => {
  animateCards();

  // When near bottom, load more
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMoreMovies();
  }
});

// Search handling
if (searchForm) {
  searchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
      if (isSearching) {
        isSearching = false;
        await loadTrending(true);
      }
      return;
    }
    page = 1;
    isSearching = true;
    loading.style.display = "block";
    const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    appendMovies(data.movies, true);
    loading.style.display = "none";
    animateCards();
  });
}

// Initial animation
animateCards();

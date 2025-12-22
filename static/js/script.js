let page = 1; // Pagination
const container = document.getElementById("movie-container");
const loading = document.getElementById("loading");
let isLoading = false;
let hasError = false;

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
  if (isLoading || hasError) return;
  isLoading = true;
  loading.style.display = "block";
  page++;
  let data;

  try {
    const response = await fetch(`/load_more?page=${page}`);
    data = await response.json();
  } catch (error) {
    hasError = true;
    loading.textContent = "We couldn't load more movies right now.";
    isLoading = false;
    return;
  }

  if (data.error) {
    hasError = true;
    loading.textContent = data.error;
    isLoading = false;
    return;
  }

  data.movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";
    const poster = movie.poster_path
      ? `<img src="https://image.tmdb.org/t/p/w300${movie.poster_path}" alt="${movie.title}">`
      : `<div class="poster-placeholder">No Image</div>`;
    card.innerHTML = `
      <a href="/movie/${movie.id}">
        ${poster}
      </a>
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p>⭐ ${movie.vote_average}</p>
      </div>
    `;
    container.appendChild(card);
  });

  loading.style.display = "none";
  loading.textContent = "Loading more movies...";
  isLoading = false;
  animateCards();
}

window.addEventListener("scroll", () => {
  animateCards();

  // When near bottom, load more
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMoreMovies();
  }
});

// Initial animation
animateCards();

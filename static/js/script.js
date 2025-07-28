const carousel = document.querySelector(".movie-carousel");
const cards = document.querySelectorAll(".movie-card");

carousel.addEventListener("scroll", () => {
  const center = carousel.offsetWidth / 2;

  cards.forEach(card => {
    const cardRect = card.getBoundingClientRect();
    const cardCenter = cardRect.left + cardRect.width / 2;
    const distance = Math.abs(center - cardCenter);

    // Scale closer cards
    let scale = 1 - distance / 800;
    scale = Math.max(0.85, Math.min(scale, 1.2));

    card.style.transform = `scale(${scale})`;
  });
});

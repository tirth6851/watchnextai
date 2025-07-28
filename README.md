# WatchNextAI 🎬

**WatchNextAI** is a Python-based movie recommendation website that not only suggests movies based on your preferences but also provides **comprehensive details about each movie**, including trailers, reviews, ratings, and streaming links. It covers **all regional movie industries** (Hollywood, Bollywood, Tollywood, etc.) and shows available **subtitles and dubbing languages** (e.g., Hindi, Telugu, Punjabi).

---

## 🌟 Key Features
- **Personalized Recommendations** – Learns from user ratings and movie history.
- **Multi-Industry Support** – Suggests movies from Hollywood, Bollywood, Tollywood, and other regional industries.
- **Sub/Dub Availability** – Displays language options like Hindi, Telugu, Tamil, Punjabi, and English.
- **Movie Details Page** – When you click a movie poster, you see:
  - Official trailer (YouTube integration).
  - Ratings (from TMDb/IMDb).
  - Reviews and user feedback.
  - Links to legal streaming platforms.
- **Watchlist & Favorites** – Save your favorite movies.
- **Trending Movies** – Shows popular movies and updates daily.

---

## 🛠 Tech Stack
**Backend:**
- Python (Flask)
- TMDb API (for global + regional movies)
- Pandas, NumPy for handling data
- SQLite for storing user ratings/preferences

**Frontend:**
- HTML, CSS, JavaScript (with Bootstrap/Tailwind)
- Jinja2 (Flask templating)
- Responsive UI for mobile & desktop

**External Services:**
- **TMDb API** – Movie data (trailers, posters, ratings).
- **YouTube API** – For movie trailers.
- **Streaming Links API** – (optional, can be static or user-added links).

---

## 📦 Installation

### **1. Clone the Repository**
```bash
git clone https://github.com/yourusername/watchnextai.git
cd watchnextai

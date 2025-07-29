# WatchNextAI 🎬

WatchNextAI is a lightweight Flask application that displays trending movies from the TMDb API. It includes a minimal recommendation component and showcases movie details such as trailers, ratings and reviews.

## Project Structure

- `backend/` – Flask server and placeholder recommendation logic
- `static/` – Front end CSS and JavaScript
- `templates/` – HTML templates
- `requirements.txt` – Python dependencies

## Features

- Trending movie list with infinite scroll
- Individual movie pages with trailer, rating and reviews
- Simple recommendation logic for future personalization
- Responsive UI built with HTML, CSS and JavaScript

## Installation

```bash
git clone https://github.com/yourusername/watchnextai.git
cd watchnextai
cp .env.example .env  # add your TMDB_API_KEY
pip install -r requirements.txt
python backend/app.py
```

Visit `http://127.0.0.1:5000` to view the site.

## Running Tests

Install the dependencies and execute `pytest` from the repository root:

```bash
pip install -r requirements.txt
pytest
```

## AI Model

WatchNextAI currently uses basic trending data from TMDb. A small collaborative filtering model is planned for personalized recommendations but is limited by the available dataset and is not yet fully featured.

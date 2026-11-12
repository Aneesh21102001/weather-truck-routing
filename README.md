# Weather-Aware Truck Routing

A full-stack web application that helps truck drivers choose safer routes by combining route options, weather forecasts, truck load weight, travel time, and checkpoint-level weather risk.

The application generates multiple driving routes, samples weather conditions along each route based on estimated truck arrival times, calculates risk levels, and recommends the best route using the assessment's ranking rules.

## Features

- Generate up to 3 route options between an origin and destination
- Support departure date and time
- Account for truck load weight
- Sample weather checkpoints every 10, 25, or 50 miles
- Estimate truck arrival time at every checkpoint
- Retrieve forecast weather for each checkpoint
- Calculate wind, rain, and snow risk
- Apply load-specific wind restrictions
- Rank routes using severe miles, high-risk miles, average risk, and travel time
- Display routes and checkpoints on an interactive Mapbox map
- Display weather risk as a heatmap along the trip corridor
- View a 0 to 48 hour weather forecast using the map slider
- Inspect checkpoint weather and risk details
- Responsive frontend interface
- Production deployment with Vercel and Render

## Risk Rules

### Wind

| Wind speed | Risk |
| --- | --- |
| < 25 mph | Low |
| 25 to 35 mph | Moderate |
| 35 to 45 mph | High |
| 45 to 55 mph | Severe |
| >= 55 mph | No Travel |

### Rain

| Rain rate | Risk |
| --- | --- |
| < 0.10 in/hr | Low |
| 0.10 to 0.25 in/hr | Moderate |
| > 0.25 to 0.50 in/hr | High |
| > 0.50 to 1.00 in/hr | Severe |
| > 1.00 in/hr | No Travel |

### Snow

| Snow rate | Risk |
| --- | --- |
| < 0.5 in/hr | Low |
| 0.5 to 1.0 in/hr | Moderate |
| 1.0 to 2.0 in/hr | High |
| 2.0 to 3.0 in/hr | Severe |
| > 3.0 in/hr | No Travel |

### Load-specific restrictions

- Wind >= 55 mph results in No Travel for every load.
- Wind 45 to 55 mph with a load above 30,000 lb results in No Travel.
- Wind 35 to 45 mph with a load above 40,000 lb results in Severe risk.

## Route Recommendation

Routes are ranked in this order:

1. Fewest Severe-risk miles
2. Fewest High-risk miles
3. Lowest average risk
4. Shortest travel time

This prioritizes safer routes before optimizing travel time.

## How Weather Is Calculated

Weather is evaluated using the truck's estimated arrival time at each checkpoint.

For example:

```text
Departure
   ↓
Route geometry
   ↓
Checkpoint generation
   ↓
Estimated arrival time
   ↓
Weather forecast at checkpoint + ETA
   ↓
Wind / rain / snow risk
   ↓
Overall checkpoint risk
```

This avoids using the current weather at every checkpoint when the truck will reach those locations hours later.

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Mapbox GL JS

### Backend

- Python
- Django
- Django REST Framework
- Requests
- PyProj
- Shapely

### External APIs

- Mapbox Directions API
- Mapbox Geocoding API
- Open-Meteo Forecast API

### Deployment

- Vercel for the frontend
- Render for the backend

## Project Structure

```text
weather-truck-routing/
├── backend/
│   ├── config/
│   ├── routing/
│   │   ├── services/
│   │   │   ├── checkpoint_service.py
│   │   │   ├── recommendation_service.py
│   │   │   ├── risk_service.py
│   │   │   ├── routing_service.py
│   │   │   └── weather_service.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── MapView.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Local Setup

### Prerequisites

- Python 3.13+
- Node.js
- npm
- Mapbox access token

### Clone the repository

```bash
git clone https://github.com/Aneesh21102001/weather-truck-routing.git
cd weather-truck-routing
```

## Backend Setup

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

Run Django:

```bash
python manage.py runserver
```

The backend runs at:

```text
http://127.0.0.1:8000
```

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

Start the development server:

```bash
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

## API

### Analyze Routes

```text
POST /api/routes/analyze/
```

Request:

```json
{
  "origin": "New York, NY",
  "destination": "Boston, MA",
  "departure_time": "2026-11-13T16:00:00Z",
  "load_weight_lb": 30000,
  "checkpoint_interval_miles": 25
}
```

The response contains:

- Route geometry
- Route distance
- Route duration
- Checkpoints
- Checkpoint coordinates
- Checkpoint ETA
- Weather conditions
- 48-hour forecast
- Risk classification
- Route risk summary
- Route recommendation

## Production

Frontend:

```text
https://weather-truck-routing-topaz.vercel.app
```

Backend:

```text
https://weather-truck-routing-jqzw.onrender.com
```

The production frontend communicates with the Django API hosted on Render.

## Validation

The project was tested against the defined risk boundaries, including:

- Wind thresholds
- Rain thresholds
- Snow thresholds
- Load-specific wind restrictions
- Different checkpoint intervals
- Different origin and destination pairs
- Production frontend to backend communication
- Weather forecast slider from 0 to 48 hours

## Future Improvements

Potential improvements include:

- Persistent trip history
- User accounts
- More detailed traffic-aware ETA calculations
- Route caching
- Automated API retry and rate-limit handling
- More advanced weather visualization
- Automated backend tests for the complete route-analysis pipeline
- Performance optimization for large route geometries

## License

This project was built as a full-stack engineering assessment project.

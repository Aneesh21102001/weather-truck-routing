import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ShieldCheck,
  Wind,
} from "lucide-react";

import MapView from "./MapView";

type ForecastPoint = {
  hour: number;
  forecast_time: string;
  wind_speed_mph: number;
  rain_in_per_hour: number;
  snow_in_per_hour: number;
  risk: {
    overall_risk: string;
  };
};

type Checkpoint = {
  distance_miles: number;
  latitude: number;
  longitude: number;
  eta: string;
  weather: {
    wind_speed_mph: number;
    rain_in_per_hour: number;
    snow_in_per_hour: number;
    forecast_time: string;
    forecast: ForecastPoint[];
  };
  risk: {
    wind_risk: string;
    rain_risk: string;
    snow_risk: string;
    overall_risk: string;
    risk_reason: string;
  };
};

type RouteResult = {
  id: string;
  distance_miles: number;
  duration_minutes: number;
  recommended: boolean;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  checkpoints: Checkpoint[];
  risk_summary: {
    severe_miles: number;
    high_miles: number;
    no_travel_miles: number;
    average_risk: number;
  };
};

type AnalyzeResponse = {
  routes: RouteResult[];
};

const RISK_COLORS: Record<string, string> = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#dc2626",
  "No Travel": "#7f1d1d",
};

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(
    minutes % 60
  );

  return `${hours}h ${remainingMinutes
    .toString()
    .padStart(2, "0")}m`;
}

function formatEta(eta: string) {
  return new Date(eta).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function getRiskTextClass(risk: string) {
  switch (risk) {
    case "Low":
      return "text-green-600";
    case "Moderate":
      return "text-yellow-600";
    case "High":
      return "text-orange-600";
    case "Severe":
      return "text-red-600";
    case "No Travel":
      return "text-red-900";
    default:
      return "text-slate-600";
  }
}

function getRouteRisk(route: RouteResult) {
  if (route.risk_summary.no_travel_miles > 0) {
    return "No Travel";
  }

  if (route.risk_summary.severe_miles > 0) {
    return "Severe";
  }

  if (route.risk_summary.high_miles > 0) {
    return "High";
  }

  return "Low";
}

function getRiskBadgeClass(risk: string) {
  switch (risk) {
    case "Low":
      return "bg-green-50 text-green-700";

    case "Moderate":
      return "bg-yellow-50 text-yellow-700";

    case "High":
      return "bg-orange-50 text-orange-700";

    case "Severe":
      return "bg-red-50 text-red-700";

    case "No Travel":
      return "bg-red-100 text-red-900";

    default:
      return "bg-slate-50 text-slate-600";
  }
}

function App() {
  const [origin, setOrigin] =
    useState("");

  const [destination, setDestination] =
    useState("");

  const [departureTime, setDepartureTime] =
    useState("");

  const [loadWeight, setLoadWeight] =
    useState("");

  const [checkpointInterval, setCheckpointInterval] =
    useState("select");

  const [routes, setRoutes] =
    useState<RouteResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedRouteId, setSelectedRouteId] =
    useState<string | null>(null);

  const [
    selectedCheckpointIndex,
    setSelectedCheckpointIndex,
  ] = useState(0);

  const analyzeRoutes = async () => {
    setLoading(true);
    setError("");

    if (
      !origin.trim() ||
      !destination.trim() ||
      !departureTime ||
      !loadWeight ||
      checkpointInterval === "select"
    ) {
      setError(
        "Please fill in all required fields before analyzing the route."
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/routes/analyze/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            origin,
            destination,
            departure_time: new Date(
              departureTime
            ).toISOString(),
            load_weight_lb:
              Number(loadWeight),
            checkpoint_interval_miles:
              Number(checkpointInterval),
          }),
        }
      );

      const data =
        (await response.json()) as
          | AnalyzeResponse
          | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error
            : "Failed to analyze routes."
        );
      }

      const routeData =
        data as AnalyzeResponse;

      setRoutes(routeData.routes);

      const recommendedRoute =
        routeData.routes.find(
          (route) => route.recommended
        ) ?? routeData.routes[0];

      if (recommendedRoute) {
        setSelectedRouteId(
          recommendedRoute.id
        );
        setSelectedCheckpointIndex(0);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedRoute =
    routes.find(
      (route) =>
        route.id === selectedRouteId
    ) ?? routes[0];

  const selectedCheckpoint =
    selectedRoute?.checkpoints[
      selectedCheckpointIndex
    ];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#172033]">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#172033] text-white">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Weather-Aware Truck Routing
              </h1>

              <p className="mt-1 text-sm text-[#64748b]">
                Choose the safest route based on
                weather, load weight, and travel time.
              </p>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-[#e1e5ea] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <MapPin
              size={17}
              className="text-[#64748b]"
            />

            <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748b]">
              Trip details
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#64748b]">
                Origin <span className="text-red-500">*</span>
              </label>

              <input
                required
                value={origin}
                onChange={(event) =>
                  setOrigin(event.target.value)
                }
                className="w-full rounded-xl border border-[#d9dee6] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#172033]"
                placeholder="Enter Origin"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-[#64748b]">
                Destination <span className="text-red-500">*</span>
              </label>

              <input
                required
                value={destination}
                onChange={(event) =>
                  setDestination(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-[#d9dee6] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#172033]"
                placeholder="Enter Destination"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#64748b]">
                <Calendar size={13} />
                Departure <span className="text-red-500">*</span>
              </label>

              <input
                required
                type="datetime-local"
                value={departureTime}
                onChange={(event) =>
                  setDepartureTime(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-[#d9dee6] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#172033]"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#64748b]">
                <Package size={13} />
                Load weight <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <input
                  required
                  type="number"
                  value={loadWeight}
                  onChange={(event) =>
                    setLoadWeight(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#d9dee6] bg-white px-3 py-2.5 pr-12 text-sm outline-none transition focus:border-[#172033]"
                  min="0"
                />

                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8]">
                  lb
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-[#64748b]">
                Checkpoints <span className="text-red-500">*</span>
              </label>

              <select
                required
                value={checkpointInterval}
                onChange={(event) =>
                  setCheckpointInterval(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-[#d9dee6] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#172033]"
              >
                <option value="select">
                  Select
                </option>
                <option value="10">
                  Every 10 miles
                </option>

                <option value="25">
                  Every 25 miles
                </option>

                <option value="50">
                  Every 50 miles
                </option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={analyzeRoutes}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25324a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Analyzing..."
                : "Analyze routes"}

              {!loading && (
                <ArrowRight size={16} />
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {routes.length > 0 && (
          <>
            <section className="mb-6">
              <MapView
                routes={routes}
                origin={origin}
                destination={destination}
              />
            </section>

            {selectedCheckpoint && (
              <section className="mb-6 rounded-2xl border border-[#e1e5ea] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                      Checkpoint details
                    </div>

                    <h2 className="mt-1 text-sm font-bold text-[#172033]">
                      {selectedRoute?.id.toUpperCase()}{" "}
                      · Checkpoint{" "}
                      {selectedCheckpointIndex + 1}
                    </h2>

                    <p className="mt-1 text-xs text-[#64748b]">
                      {selectedCheckpoint.distance_miles.toFixed(
                        1
                      )}{" "}
                      miles · ETA{" "}
                      {formatEta(
                        selectedCheckpoint.eta
                      )}
                    </p>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskTextClass(
                      selectedCheckpoint.risk
                        .overall_risk
                    )}`}
                  >
                    {
                      selectedCheckpoint.risk
                        .overall_risk
                    }
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-[#f7f9fb] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
                      <Wind size={14} />
                      Wind
                    </div>

                    <div className="mt-2 text-lg font-bold text-[#172033]">
                      {selectedCheckpoint.weather.wind_speed_mph.toFixed(
                        2
                      )}{" "}
                      mph
                    </div>

                    <div
                      className={`mt-1 text-xs font-medium ${getRiskTextClass(
                        selectedCheckpoint.risk
                          .wind_risk
                      )}`}
                    >
                      {
                        selectedCheckpoint.risk
                          .wind_risk
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#f7f9fb] p-4">
                    <div className="text-xs font-semibold text-[#64748b]">
                      Rain
                    </div>

                    <div className="mt-2 text-lg font-bold text-[#172033]">
                      {selectedCheckpoint.weather.rain_in_per_hour.toFixed(
                        2
                      )}{" "}
                      in/hr
                    </div>

                    <div
                      className={`mt-1 text-xs font-medium ${getRiskTextClass(
                        selectedCheckpoint.risk
                          .rain_risk
                      )}`}
                    >
                      {
                        selectedCheckpoint.risk
                          .rain_risk
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#f7f9fb] p-4">
                    <div className="text-xs font-semibold text-[#64748b]">
                      Snow
                    </div>

                    <div className="mt-2 text-lg font-bold text-[#172033]">
                      {selectedCheckpoint.weather.snow_in_per_hour.toFixed(
                        2
                      )}{" "}
                      in/hr
                    </div>

                    <div
                      className={`mt-1 text-xs font-medium ${getRiskTextClass(
                        selectedCheckpoint.risk
                          .snow_risk
                      )}`}
                    >
                      {
                        selectedCheckpoint.risk
                          .snow_risk
                      }
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-[#f7f9fb] p-4">
                  <div className="text-xs font-semibold text-[#64748b]">
                    Risk assessment
                  </div>

                  <div className="mt-2 text-xs text-[#475569]">
                    {
                      selectedCheckpoint.risk
                        .risk_reason
                    }
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedRoute?.checkpoints.map(
                    (checkpoint, index) => {
                      const isSelected =
                        index ===
                        selectedCheckpointIndex;

                      return (
                        <button
                          key={`${selectedRoute.id}-${index}`}
                          onClick={() => {
                            setSelectedCheckpointIndex(
                              index
                            );
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
                            isSelected
                              ? "border-[#172033] bg-[#172033] text-white"
                              : "border-[#e1e5ea] bg-white text-[#64748b] hover:border-[#172033]"
                          }`}
                        >
                          {checkpoint.distance_miles.toFixed(
                            0
                          )}{" "}
                          mi
                        </button>
                      );
                    }
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                    Route analysis
                  </div>

                  <h2 className="mt-1 text-xl font-bold text-[#172033]">
                    {routes.length} routes found
                  </h2>
                </div>

                <div className="hidden rounded-lg border border-[#e1e5ea] bg-white px-3 py-2 text-[11px] text-[#64748b] md:block">
                  <ShieldCheck
                    size={13}
                    className="mr-1 inline"
                  />
                  Recommended route is based on
                  weather risk first, then travel
                  time.
                </div>
              </div>

              <div className="space-y-4">
                {routes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => {
                      setSelectedRouteId(
                        route.id
                      );
                      setSelectedCheckpointIndex(
                        0
                      );
                    }}
                    className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                      selectedRouteId === route.id
                        ? "border-[#172033]"
                        : "border-[#e1e5ea] hover:border-[#94a3b8]"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                          {route.id}
                        </span>

                        {route.recommended && (
                          <span className="rounded-full bg-[#172033] px-2 py-0.5 text-[9px] font-bold text-white">
                            Recommended
                          </span>
                        )}
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${getRiskBadgeClass(
                          getRouteRisk(route)
                        )}`}
                      >
                        {route.risk_summary.no_travel_miles > 0
                          ? "No Travel"
                          : route.risk_summary.severe_miles > 0
                            ? "Severe"
                            : route.risk_summary.high_miles > 0
                              ? "High"
                              : "Low"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-[#f7f9fb] p-3">
                        <div className="text-xl font-bold text-[#172033]">
                          {Math.round(
                            route.distance_miles
                          )}
                        </div>

                        <div className="text-[10px] text-[#94a3b8]">
                          miles
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#f7f9fb] p-3">
                        <div className="text-xl font-bold text-[#172033]">
                          {formatDuration(
                            route.duration_minutes
                          )}
                        </div>

                        <div className="text-[10px] text-[#94a3b8]">
                          travel time
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#f7f9fb] p-3">
                        <div className="text-xl font-bold text-[#172033]">
                          {route.risk_summary.high_miles.toFixed(
                            0
                          )}
                        </div>

                        <div className="text-[10px] text-[#94a3b8]">
                          high-risk mi
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#f7f9fb] p-3">
                        <div className="text-xl font-bold text-[#172033]">
                          {route.risk_summary.severe_miles.toFixed(
                            0
                          )}
                        </div>

                        <div className="text-[10px] text-[#94a3b8]">
                          severe mi
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {[
                        {
                          label: "Low / Moderate",
                          value:
                            route.distance_miles -
                            route.risk_summary.high_miles -
                            route.risk_summary.severe_miles -
                            route.risk_summary.no_travel_miles,
                        },
                        {
                          label: "High",
                          value:
                            route.risk_summary.high_miles,
                        },
                        {
                          label: "Severe",
                          value:
                            route.risk_summary.severe_miles,
                        },
                        {
                          label: "No Travel",
                          value:
                            route.risk_summary.no_travel_miles,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-[#edf0f3] px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                background:
                                  RISK_COLORS[
                                    item.label
                                  ],
                              }}
                            />

                            {item.label}
                          </div>

                          <div className="mt-1 text-xs font-bold text-[#172033]">
                            {Math.max(
                              0,
                              item.value
                            ).toFixed(0)}{" "}
                            mi
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f7f9fb] p-3">
                      {route.recommended ? (
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-[#64748b]"
                        />
                      ) : (
                        <Clock
                          size={14}
                          className="mt-0.5 shrink-0 text-[#64748b]"
                        />
                      )}

                      <div>
                        <div className="text-[10px] font-bold text-[#475569]">
                          {route.recommended
                            ? "Why this route?"
                            : "Alternative route"}
                        </div>

                        <div className="mt-1 text-[10px] leading-4 text-[#64748b]">
                          {route.recommended
                            ? "Best score using severe miles, high-risk miles, average risk, then travel time."
                            : "Available for comparison against the recommended route."}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
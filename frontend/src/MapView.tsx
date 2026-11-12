import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

type MapRoute = {
  id: string;
  recommended: boolean;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  checkpoints: Checkpoint[];
};

type MapViewProps = {
  routes: MapRoute[];
  origin: string;
  destination: string;
};

const RISK_COLORS: Record<string, string> = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#dc2626",
  "No Travel": "#7f1d1d",
};

function getRiskScore(risk: string) {
  if (risk === "No Travel") return 4;
  if (risk === "Severe") return 3;
  if (risk === "High") return 2;
  if (risk === "Moderate") return 1;
  return 0;
}

function getForecastRisk(
  checkpoint: Checkpoint,
  forecastHour: number
) {
  const forecast = checkpoint.weather.forecast?.find(
    (item) => item.hour === forecastHour
  );

  return {
    forecast,
    risk:
      forecast?.risk.overall_risk ??
      checkpoint.risk.overall_risk,
  };
}

function MapView({ routes, origin, destination }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

  const [forecastHour, setForecastHour] = useState(0);

  /*
   * Initialize Mapbox once.
   */
  useEffect(() => {
    if (!mapContainer.current || map.current) {
      return;
    }

    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    if (!token) {
      console.error(
        "VITE_MAPBOX_ACCESS_TOKEN is not configured"
      );
      return;
    }

    mapboxgl.accessToken = token;

    const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-98, 39],
        zoom: 3.5,
    });

    mapInstance.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );

    map.current = mapInstance;

    mapInstance.on("load", () => {

  mapInstance.resize();
});

    mapInstance.on("error", (event) => {
    console.error("MAPBOX ERROR:", event);
    });

    return () => {
      markerRefs.current.forEach((marker) => {
        marker.remove();
      });

      markerRefs.current = [];

      mapInstance.remove();
      map.current = null;
    };
  }, []);

  /*
   * Draw route lines.
   */
  useEffect(() => {
    if (!map.current || routes.length === 0) {
      return;
    }

    const currentMap = map.current;

    const drawRoutes = () => {
      if (!currentMap.isStyleLoaded()) {
        return;
      }

      routes.forEach((route) => {
        const sourceId = `${route.id}-source`;
        const layerId = `${route.id}-layer`;

        const routeData = {
          type: "Feature" as const,
          properties: {},
          geometry: route.geometry,
        };

        const existingSource =
          currentMap.getSource(sourceId);

        if (!existingSource) {
          currentMap.addSource(sourceId, {
            type: "geojson",
            data: routeData,
          });
        } else if ("setData" in existingSource) {
          existingSource.setData(routeData);
        }

        if (!currentMap.getLayer(layerId)) {
          currentMap.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": route.recommended
                ? "#172033"
                : "#94a3b8",
              "line-width": route.recommended ? 6 : 4,
              "line-opacity": route.recommended
                ? 0.95
                : 0.65,
            },
          });
        }
      });

      const allCoordinates = routes.flatMap(
        (route) => route.geometry.coordinates
      );

      if (allCoordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();

        allCoordinates.forEach(([lng, lat]) => {
          bounds.extend([lng, lat]);
        });

        currentMap.fitBounds(bounds, {
          padding: 70,
          duration: 1000,
        });
      }
    };

    if (currentMap.isStyleLoaded()) {
      drawRoutes();
    } else {
      currentMap.once("load", drawRoutes);
    }

    return () => {
      currentMap.off("load", drawRoutes);
    };
  }, [routes]);

  /*
   * Update weather heatmap.
   */
  useEffect(() => {
    if (!map.current || routes.length === 0) {
      return;
    }

    const currentMap = map.current;

    const updateHeatmap = () => {
      if (!currentMap.isStyleLoaded()) {
        return;
      }

      routes.forEach((route) => {
        const sourceId = `${route.id}-heat-source`;
        const layerId = `${route.id}-heat-layer`;

        const heatFeatures = route.checkpoints.map(
          (checkpoint) => {
            const { risk } = getForecastRisk(
              checkpoint,
              forecastHour
            );

            return {
              type: "Feature" as const,
              properties: {
                risk,
                riskScore: getRiskScore(risk),
              },
              geometry: {
                type: "Point" as const,
                coordinates: [
                  checkpoint.longitude,
                  checkpoint.latitude,
                ],
              },
            };
          }
        );

        const heatData = {
          type: "FeatureCollection" as const,
          features: heatFeatures,
        };

        const existingSource =
          currentMap.getSource(sourceId);

        if (!existingSource) {
          currentMap.addSource(sourceId, {
            type: "geojson",
            data: heatData,
          });
        } else if ("setData" in existingSource) {
          existingSource.setData(heatData);
        }

        if (!currentMap.getLayer(layerId)) {
          currentMap.addLayer({
            id: layerId,
            type: "heatmap",
            source: sourceId,
            maxzoom: 10,
            paint: {
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", "riskScore"],
                0,
                0.25,
                1,
                0.45,
                2,
                0.7,
                3,
                0.9,
                4,
                1,
              ],

              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                0.8,
                8,
                1.5,
              ],

              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                18,
                8,
                30,
              ],

              "heatmap-opacity": 0.65,

              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(34,197,94,0)",
                0.2,
                "#22c55e",
                0.4,
                "#eab308",
                0.6,
                "#f97316",
                0.8,
                "#dc2626",
                1,
                "#7f1d1d",
              ],
            },
          });
        }
      });
    };

    if (currentMap.isStyleLoaded()) {
      updateHeatmap();
    } else {
      currentMap.once("load", updateHeatmap);
    }

    return () => {
      currentMap.off("load", updateHeatmap);
    };
  }, [routes, forecastHour]);

  /*
   * Update markers.
   */
  useEffect(() => {
    if (!map.current || routes.length === 0) {
      return;
    }

    const currentMap = map.current;

    const updateMarkers = () => {
      if (!currentMap.isStyleLoaded()) {
        return;
      }

      markerRefs.current.forEach((marker) => {
        marker.remove();
      });

      markerRefs.current = [];

      const primaryRoute =
        routes.find((route) => route.recommended) ??
        routes[0];

      if (!primaryRoute.checkpoints.length) {
        return;
      }

      const startCheckpoint =
        primaryRoute.checkpoints[0];

      const endCheckpoint =
        primaryRoute.checkpoints[
          primaryRoute.checkpoints.length - 1
        ];

      const startMarker = new mapboxgl.Marker({
        color: "#172033",
      })
        .setLngLat([
          startCheckpoint.longitude,
          startCheckpoint.latitude,
        ])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
          }).setHTML(`
            <div style="font-family: system-ui;">
              <strong>Origin</strong>
              <div style="margin-top: 5px;">
                ${origin}
              </div>
            </div>
          `)
        )
        .addTo(currentMap);

      const endMarker = new mapboxgl.Marker({
        color: "#2563eb",
      })
        .setLngLat([
          endCheckpoint.longitude,
          endCheckpoint.latitude,
        ])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
          }).setHTML(`
            <div style="font-family: system-ui;">
              <strong>Destination</strong>
              <div style="margin-top: 5px;">
                ${destination}
              </div>
            </div>
          `)
        )
        .addTo(currentMap);

      markerRefs.current.push(
        startMarker,
        endMarker
      );

      routes.forEach((route) => {
        route.checkpoints.forEach(
          (checkpoint, index) => {
            const { forecast, risk } =
              getForecastRisk(
                checkpoint,
                forecastHour
              );

            const color =
              RISK_COLORS[risk] ?? "#64748b";

            const markerElement =
              document.createElement("div");

            markerElement.className =
              "weather-heat-marker";

            markerElement.style.width = "9px";
            markerElement.style.height = "9px";
            markerElement.style.borderRadius = "50%";
            markerElement.style.background = color;

            markerElement.style.boxShadow = `
              0 0 0 3px rgba(255,255,255,0.85),
              0 0 18px ${color}
            `;

            const popup =
              new mapboxgl.Popup({
                offset: 12,
                maxWidth: "280px",
              }).setHTML(`
                <div style="font-family: system-ui; padding: 2px;">
                  <strong>
                    ${route.id.toUpperCase()} · Checkpoint ${
                      index + 1
                    }
                  </strong>

                  <div style="margin-top: 7px;">
                    ${checkpoint.distance_miles.toFixed(
                      1
                    )} miles
                  </div>

                  <div style="margin-top: 7px;">
                    Forecast: +${forecastHour}h
                  </div>

                  <div>
                    Time:
                    ${
                      forecast?.forecast_time ??
                      "Unavailable"
                    }
                  </div>

                  <div style="margin-top: 7px;">
                    Wind:
                    ${forecast?.wind_speed_mph ?? 0}
                    mph
                  </div>

                  <div>
                    Rain:
                    ${forecast?.rain_in_per_hour ?? 0}
                    in/hr
                  </div>

                  <div>
                    Snow:
                    ${forecast?.snow_in_per_hour ?? 0}
                    in/hr
                  </div>

                  <div style="margin-top: 7px;">
                    Risk:
                    <strong>${risk}</strong>
                  </div>
                </div>
              `);

            const marker =
              new mapboxgl.Marker({
                element: markerElement,
              })
                .setLngLat([
                  checkpoint.longitude,
                  checkpoint.latitude,
                ])
                .setPopup(popup)
                .addTo(currentMap);

            markerRefs.current.push(marker);
          }
        );
      });
    };

    if (currentMap.isStyleLoaded()) {
      updateMarkers();
    } else {
      currentMap.once("load", updateMarkers);
    }

    return () => {
      currentMap.off("load", updateMarkers);
    };
  }, [routes, origin, destination, forecastHour]);

  const currentForecastTime =
    routes
      .flatMap(
        (route) => route.checkpoints
      )
      .map((checkpoint) =>
        checkpoint.weather.forecast?.find(
          (forecast) =>
            forecast.hour === forecastHour
        )
      )
      .find(Boolean)?.forecast_time;

  return (
    <div
        className="relative w-full overflow-hidden rounded-2xl border border-[#e1e5ea] bg-white shadow-sm"
        style={{ height: "520px" }}
    >
      <div
        ref={mapContainer}
        className="absolute inset-0 h-full w-full"
      />

      <div className="absolute left-4 top-4 z-10 w-[320px] rounded-2xl border border-[#e1e5ea] bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-[#172033]">
              Weather forecast
            </div>

            <div className="mt-1 text-xs text-[#64748b]">
              {currentForecastTime
                ? new Date(
                    `${currentForecastTime}:00Z`
                  ).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Loading"}
            </div>
          </div>

          <div className="rounded-lg bg-[#172033] px-2.5 py-1 text-xs font-semibold text-white">
            +{forecastHour}h
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="48"
          step="1"
          value={forecastHour}
          onChange={(event) =>
            setForecastHour(
              Number(event.target.value)
            )
          }
          className="w-full accent-[#172033]"
        />

        <div className="mt-2 flex justify-between text-[11px] font-medium text-[#94a3b8]">
          <span>Now</span>
          <span>12h</span>
          <span>24h</span>
          <span>36h</span>
          <span>48h</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 w-[125px] rounded-2xl border border-[#e1e5ea] bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
          Weather risk
        </div>

        <div className="space-y-2">
          {Object.entries(RISK_COLORS).map(
            ([risk, color]) => (
              <div
                className="flex items-center gap-2 text-xs font-medium text-[#475569]"
                key={risk}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: color,
                  }}
                />

                {risk}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default MapView;
import os
import requests
from dotenv import load_dotenv

load_dotenv()


class RoutingService:
    BASE_URL = "https://api.mapbox.com"

    def __init__(self):
        self.access_token = os.getenv("MAPBOX_ACCESS_TOKEN")

        if not self.access_token:
            raise RuntimeError("MAPBOX_ACCESS_TOKEN is not configured")

    def geocode(self, address):
        url = f"{self.BASE_URL}/search/geocode/v6/forward"

        response = requests.get(
            url,
            params={
                "q": address,
                "access_token": self.access_token,
                "limit": 1,
            },
            timeout=10,
        )

        response.raise_for_status()

        data = response.json()

        features = data.get("features", [])

        if not features:
            raise ValueError(f"Could not geocode: {address}")

        coordinates = features[0]["geometry"]["coordinates"]

        return {
            "longitude": coordinates[0],
            "latitude": coordinates[1],
        }

    def get_routes(self, origin, destination):
        origin_coords = self.geocode(origin)
        destination_coords = self.geocode(destination)

        coordinates = (
            f"{origin_coords['longitude']},{origin_coords['latitude']};"
            f"{destination_coords['longitude']},{destination_coords['latitude']}"
        )

        url = f"{self.BASE_URL}/directions/v5/mapbox/driving/{coordinates}"

        common_params = {
            "access_token": self.access_token,
            "geometries": "geojson",
            "overview": "full",
            "steps": "false",
        }

        # Request 1:
        # Get the normal fastest route plus Mapbox's alternative.
        response = requests.get(
            url,
            params={
                **common_params,
                "alternatives": "true",
            },
            timeout=20,
        )

        response.raise_for_status()

        data = response.json()
        routes = data.get("routes", [])

        if not routes:
            return []

        # Request 2:
        # Force another route by excluding a road point
        # from the first route.
        primary_route = routes[0]
        geometry = primary_route.get("geometry", {})
        route_coordinates = geometry.get("coordinates", [])

        if len(route_coordinates) > 4:
            midpoint = route_coordinates[len(route_coordinates) // 2]

            exclude_point = (
                f"point({midpoint[0]} {midpoint[1]})"
            )

            alternative_response = requests.get(
                url,
                params={
                    **common_params,
                    "alternatives": "true",
                    "exclude": exclude_point,
                },
                timeout=20,
            )

            alternative_response.raise_for_status()

            alternative_data = alternative_response.json()

            for candidate in alternative_data.get("routes", []):
                routes.append(candidate)

        # Remove duplicate routes.
        unique_routes = []
        route_signatures = set()

        for route in routes:
            route_geometry = route.get("geometry", {})
            route_coordinates = route_geometry.get(
                "coordinates",
                [],
            )

            if not route_coordinates:
                continue

            # Use several geometry points as a lightweight
            # signature for detecting duplicate routes.
            sample_indexes = [
                0,
                len(route_coordinates) // 4,
                len(route_coordinates) // 2,
                (len(route_coordinates) * 3) // 4,
                len(route_coordinates) - 1,
            ]

            signature = tuple(
                (
                    round(route_coordinates[index][0], 3),
                    round(route_coordinates[index][1], 3),
                )
                for index in sample_indexes
                if 0 <= index < len(route_coordinates)
            )

            if signature in route_signatures:
                continue

            route_signatures.add(signature)
            unique_routes.append(route)

        return unique_routes[:3]
from datetime import timedelta

from pyproj import Geod


class CheckpointService:

    @staticmethod
    def create_checkpoints(
        geometry,
        route_distance_miles,
        route_duration_minutes,
        departure_time,
        interval_miles,
    ):
        coordinates = geometry["coordinates"]

        geod = Geod(ellps="WGS84")

        # Calculate the real geographic distance of each
        # geometry segment.
        segment_distances = []
        cumulative_distances = [0.0]

        total_distance_miles = 0.0

        for index in range(len(coordinates) - 1):
            lon1, lat1 = coordinates[index]
            lon2, lat2 = coordinates[index + 1]

            _, _, distance_meters = geod.inv(
                lon1,
                lat1,
                lon2,
                lat2,
            )

            distance_miles = distance_meters / 1609.344

            segment_distances.append(distance_miles)

            total_distance_miles += distance_miles

            cumulative_distances.append(
                total_distance_miles
            )

        # Use the actual geometry distance for interpolation.
        route_distance = total_distance_miles

        distances = []
        distance_miles = 0.0

        while distance_miles < route_distance:
            distances.append(distance_miles)
            distance_miles += interval_miles

        # Always include the exact destination.
        if not distances or distances[-1] != route_distance:
            distances.append(route_distance)

        checkpoints = []

        for distance_miles in distances:

            # Find the geometry segment containing this
            # checkpoint.
            segment_index = 0

            for index in range(
                len(segment_distances)
            ):
                if (
                    cumulative_distances[index]
                    <= distance_miles
                    <= cumulative_distances[index + 1]
                ):
                    segment_index = index
                    break

            start_lon, start_lat = coordinates[
                segment_index
            ]

            end_lon, end_lat = coordinates[
                segment_index + 1
            ]

            segment_start_distance = (
                cumulative_distances[segment_index]
            )

            segment_distance = segment_distances[
                segment_index
            ]

            distance_into_segment = (
                distance_miles
                - segment_start_distance
            )

            if segment_distance == 0:
                longitude = start_lon
                latitude = start_lat
            else:

                azimuth, _, _ = geod.inv(
                    start_lon,
                    start_lat,
                    end_lon,
                    end_lat,
                )

                longitude, latitude, _ = geod.fwd(
                    start_lon,
                    start_lat,
                    azimuth,
                    distance_into_segment
                    * 1609.344,
                )

            progress = (
                distance_miles / route_distance
                if route_distance
                else 0
            )

            eta_minutes = (
                route_duration_minutes
                * progress
            )

            eta = (
                departure_time
                + timedelta(minutes=eta_minutes)
            )

            checkpoints.append(
                {
                    "distance_miles": round(
                        distance_miles,
                        2,
                    ),
                    "latitude": round(
                        latitude,
                        6,
                    ),
                    "longitude": round(
                        longitude,
                        6,
                    ),
                    "eta": eta.isoformat(),
                }
            )

        return checkpoints
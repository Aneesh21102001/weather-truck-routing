from datetime import datetime, timedelta, timezone

import requests

class WeatherService:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def get_weather_for_checkpoints(
        self,
        checkpoints,
        forecast_start,
        forecast_hours=48,
    ):
        if not checkpoints:
            return []

        latitudes = ",".join(
            str(checkpoint["latitude"])
            for checkpoint in checkpoints
        )

        longitudes = ",".join(
            str(checkpoint["longitude"])
            for checkpoint in checkpoints
        )

        response = requests.get(
            self.BASE_URL,
            params={
                "latitude": latitudes,
                "longitude": longitudes,
                "hourly": (
                    "wind_speed_10m,"
                    "precipitation,"
                    "snowfall"
                ),
                "forecast_days": 3,
                "timezone": "UTC",
            },
            timeout=30,
        )

        response.raise_for_status()

        data = response.json()

        if not isinstance(data, list):
            data = [data]

        if len(data) != len(checkpoints):
            raise ValueError(
                f"Weather locations mismatch. "
                f"Expected {len(checkpoints)}, "
                f"received {len(data)}."
            )

        results = []

        forecast_start = forecast_start.astimezone(
            timezone.utc
        )

        forecast_targets = [
            forecast_start + timedelta(hours=hour)
            for hour in range(forecast_hours + 1)
        ]

        for checkpoint, location_weather in zip(
            checkpoints,
            data,
        ):
            hourly = location_weather["hourly"]
            weather_times = hourly["time"]

            weather_lookup = {
                weather_time: index
                for index, weather_time in enumerate(
                    weather_times
                )
            }

            forecast = []

            for hour, target_datetime in enumerate(
                forecast_targets
            ):
                target_string = target_datetime.replace(
                    tzinfo=None
                ).isoformat(
                    timespec="minutes"
                )

                if target_string in weather_lookup:
                    index = weather_lookup[target_string]
                else:
                    nearest_time = min(
                        weather_times,
                        key=lambda weather_time: abs(
                            (
                                datetime.fromisoformat(
                                    weather_time
                                ).replace(tzinfo=timezone.utc)
                                - target_datetime
                            ).total_seconds()
                        ),
                    )

                    index = weather_lookup[nearest_time]

                wind = hourly["wind_speed_10m"][index]
                rain = hourly["precipitation"][index]
                snow = hourly["snowfall"][index]

                forecast.append(
                    {
                        "hour": hour,
                        "forecast_time": target_string,
                        "wind_speed_mph": (
                            round(
                                wind * 0.621371,
                                2,
                            )
                            if wind is not None
                            else 0.0
                        ),
                        "rain_in_per_hour": (
                            round(
                                rain / 25.4,
                                4,
                            )
                            if rain is not None
                            else 0.0
                        ),
                        "snow_in_per_hour": (
                            round(
                                snow / 2.54,
                                4,
                            )
                            if snow is not None
                            else 0.0
                        ),
                    }
                )

            target = checkpoint["eta"]

            target_datetime = target.astimezone(
                timezone.utc
            ).replace(
                minute=0,
                second=0,
                microsecond=0,
                tzinfo=None,
            )

            target_string = target_datetime.isoformat(
                timespec="minutes"
            )

            index = weather_lookup.get(
                target_string
            )

            if index is None:
                raise ValueError(
                    f"No weather forecast found for "
                    f"{target_string}"
                )

            wind = hourly["wind_speed_10m"][index]
            rain = hourly["precipitation"][index]
            snow = hourly["snowfall"][index]

            results.append(
                {
                    "wind_speed_mph": (
                        round(
                            wind * 0.621371,
                            2,
                        )
                        if wind is not None
                        else 0.0
                    ),
                    "rain_in_per_hour": (
                        round(
                            rain / 25.4,
                            4,
                        )
                        if rain is not None
                        else 0.0
                    ),
                    "snow_in_per_hour": (
                        round(
                            snow / 2.54,
                            4,
                        )
                        if snow is not None
                        else 0.0
                    ),
                    "forecast_time": weather_times[index],
                    "forecast": forecast,
                }
            )

        return results
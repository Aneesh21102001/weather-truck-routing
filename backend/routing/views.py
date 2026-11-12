from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime

from .serializers import RouteAnalysisSerializer
from .services.routing_service import RoutingService
from .services.checkpoint_service import CheckpointService
from .services.weather_service import WeatherService
from .services.risk_service import RiskService
from .services.recommendation_service import RecommendationService

@api_view(["POST"])
def analyze_routes(request):
    serializer = RouteAnalysisSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data

    try:
        routing_service = RoutingService()
        weather_service = WeatherService()

        routes = routing_service.get_routes(
            data["origin"],
            data["destination"],
        )

        formatted_routes = []

        for index, route in enumerate(routes[:3]):

            distance_miles = round(
                route["distance"] / 1609.344,
                2,
            )

            duration_minutes = round(
                route["duration"] / 60,
                2,
            )

            checkpoints = CheckpointService.create_checkpoints(
                geometry=route["geometry"],
                route_distance_miles=distance_miles,
                route_duration_minutes=duration_minutes,
                departure_time=data["departure_time"],
                interval_miles=data["checkpoint_interval_miles"],
            )

            for checkpoint in checkpoints:
                checkpoint["eta"] = datetime.fromisoformat(
                    checkpoint["eta"]
                )

            weather_results = weather_service.get_weather_for_checkpoints(
                checkpoints,
                forecast_start=data["departure_time"],
            )

            for checkpoint, weather in zip(
                checkpoints,
                weather_results,
            ):
                for forecast_point in weather["forecast"]:
                    forecast_point["risk"] = RiskService.calculate_risk(
                        wind_speed_mph=forecast_point["wind_speed_mph"],
                        rain_in_per_hour=forecast_point["rain_in_per_hour"],
                        snow_in_per_hour=forecast_point["snow_in_per_hour"],
                        load_weight_lb=data["load_weight_lb"],
                    )
                
                risk = RiskService.calculate_risk(
                    wind_speed_mph=weather["wind_speed_mph"],
                    rain_in_per_hour=weather["rain_in_per_hour"],
                    snow_in_per_hour=weather["snow_in_per_hour"],
                    load_weight_lb=data["load_weight_lb"],
                )

                checkpoint["weather"] = weather
                checkpoint["risk"] = risk
                checkpoint["eta"] = checkpoint["eta"].isoformat()

            # THIS MUST BE INSIDE THE FOR LOOP
            formatted_routes.append(
                {
                    "id": f"route-{index + 1}",
                    "distance_miles": distance_miles,
                    "duration_minutes": duration_minutes,
                    "geometry": route["geometry"],
                    "checkpoints": checkpoints,
                }
            )

        formatted_routes = RecommendationService.recommend(
            formatted_routes
        )

        return Response(
            {
                "routes": formatted_routes,
            }
        )

    except ValueError as error:
        return Response(
            {"error": str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    except Exception as error:
        return Response(
            {"error": str(error)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
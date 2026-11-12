class RecommendationService:

    RISK_SCORE = {
        "Low": 0,
        "Moderate": 1,
        "High": 2,
        "Severe": 3,
        "No Travel": 4,
    }

    @classmethod
    def score_route(cls, route):
        checkpoints = route["checkpoints"]

        severe_miles = 0.0
        high_miles = 0.0
        no_travel_miles = 0.0

        total_risk_score = 0.0
        total_segment_miles = 0.0

        for index, checkpoint in enumerate(checkpoints):
            if index == 0:
                continue

            previous_checkpoint = checkpoints[index - 1]

            segment_miles = (
                checkpoint["distance_miles"]
                - previous_checkpoint["distance_miles"]
            )

            risk = checkpoint["risk"]["overall_risk"]

            total_segment_miles += segment_miles
            total_risk_score += (
                cls.RISK_SCORE[risk] * segment_miles
            )

            if risk == "Severe":
                severe_miles += segment_miles

            elif risk == "High":
                high_miles += segment_miles

            elif risk == "No Travel":
                no_travel_miles += segment_miles

        average_risk = (
            total_risk_score / total_segment_miles
            if total_segment_miles
            else 0
        )

        return {
            "severe_miles": round(severe_miles, 2),
            "high_miles": round(high_miles, 2),
            "no_travel_miles": round(no_travel_miles, 2),
            "average_risk": round(average_risk, 2),
        }

    @classmethod
    def recommend(cls, routes):
        scored_routes = []

        for route in routes:
            score = cls.score_route(route)

            route["risk_summary"] = score

            scored_routes.append(
                route
            )

        recommended_route = min(
            scored_routes,
            key=lambda route: (
                route["risk_summary"]["severe_miles"],
                route["risk_summary"]["high_miles"],
                route["risk_summary"]["average_risk"],
                route["duration_minutes"],
            ),
        )

        for route in scored_routes:
            route["recommended"] = (
                route["id"] == recommended_route["id"]
            )

        return scored_routes
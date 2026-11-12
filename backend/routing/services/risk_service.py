class RiskService:

    RISK_LEVELS = {
        "Low": 0,
        "Moderate": 1,
        "High": 2,
        "Severe": 3,
        "No Travel": 4,
    }

    @staticmethod
    def classify_wind(wind_speed_mph):
        if wind_speed_mph < 25:
            return "Low"
        elif wind_speed_mph < 35:
            return "Moderate"
        elif wind_speed_mph < 45:
            return "High"
        elif wind_speed_mph < 55:
            return "Severe"
        else:
            return "No Travel"

    @staticmethod
    def classify_rain(rain_in_per_hour):
        if rain_in_per_hour < 0.10:
            return "Low"
        elif rain_in_per_hour <= 0.25:
            return "Moderate"
        elif rain_in_per_hour <= 0.50:
            return "High"
        elif rain_in_per_hour <= 1.00:
            return "Severe"
        else:
            return "No Travel"

    @staticmethod
    def classify_snow(snow_in_per_hour):
        if snow_in_per_hour < 0.5:
            return "Low"
        elif snow_in_per_hour <= 1.0:
            return "Moderate"
        elif snow_in_per_hour <= 2.0:
            return "High"
        elif snow_in_per_hour <= 3.0:
            return "Severe"
        else:
            return "No Travel"

    @classmethod
    def calculate_risk(
        cls,
        wind_speed_mph,
        rain_in_per_hour,
        snow_in_per_hour,
        load_weight_lb,
    ):
        wind_risk = cls.classify_wind(wind_speed_mph)
        rain_risk = cls.classify_rain(rain_in_per_hour)
        snow_risk = cls.classify_snow(snow_in_per_hour)

        risks = {
            "wind": wind_risk,
            "rain": rain_risk,
            "snow": snow_risk,
        }

        # Load-specific wind rules.
        if wind_speed_mph >= 55:
            overall_risk = "No Travel"
            reason = "Wind speed is 55 mph or higher."

        elif wind_speed_mph >= 45 and load_weight_lb > 30000:
            overall_risk = "No Travel"
            reason = "Wind is 45+ mph with a load above 30,000 lb."

        elif wind_speed_mph >= 35 and load_weight_lb > 40000:
            overall_risk = "Severe"
            reason = "Wind is 35+ mph with a load above 40,000 lb."

        else:
            overall_risk = max(
                risks.values(),
                key=lambda risk: cls.RISK_LEVELS[risk],
            )

            reason = (
                f"Wind: {wind_risk}, "
                f"Rain: {rain_risk}, "
                f"Snow: {snow_risk}."
            )

        return {
            "wind_risk": wind_risk,
            "rain_risk": rain_risk,
            "snow_risk": snow_risk,
            "overall_risk": overall_risk,
            "risk_reason": reason,
        }
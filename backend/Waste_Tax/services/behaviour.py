
def classify_behaviour(waste_type: str, weight: float) -> str:

    if waste_type == "Organic":

        thresholds = [0.5, 2.0, 5.0]

    elif waste_type == "Inorganic":

        thresholds = [1.0, 4.0, 8.0]

    elif waste_type == "Recyclable":

        thresholds = [0.1, 0.8, 2.5]

    else:

        return "Unknown"


    if weight <= thresholds[0]:
        return "Zero"
    elif weight <= thresholds[1]:
        return "Low"
    elif weight <= thresholds[2]:
        return "Normal"
    else:
        return "High"
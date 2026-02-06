
def update_week_history(prev_12_weeks: List[float], new_weight: float) -> List[float]:

    prev_12_weeks = prev_12_weeks[-11:]
    prev_12_weeks.append(new_weight)
    return prev_12_weeks

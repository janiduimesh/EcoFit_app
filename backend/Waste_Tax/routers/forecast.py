from fastapi import APIRouter, HTTPException, Query
from typing import List
import copy
from services.db_service import db
from services.tax_engine import tax_engine
from routers.weight import predict_weight_core, WASTE_TYPE_MAP
from pydantic import BaseModel
from schemas.dashboard import BillDetails, ForecastItem

router = APIRouter()


class UnifiedForecastResponse(BaseModel):
    household_id: str
    waste_type: str
    history_data: List[ForecastItem]
    forecast_data: List[ForecastItem]


def get_next_date(year, week):
    if week >= 52:
        return year + 1, 1
    return year, week + 1


@router.get("/forecast/{household_id}/{waste_type}", response_model=UnifiedForecastResponse)
async def get_waste_forecast(
        household_id: str,
        waste_type: str,
        horizon: int = Query(default=4)
):
    # 1. SETUP: Get Profile & Pricing
    user_profile = await db.households_col.find_one({"_id": household_id})
    if not user_profile:
        raise HTTPException(404, "Household not found")
    # income_tier removed from calculation, only pricing needed now

    price_record = await db.waste_prices.find_one({"waste_type": waste_type})
    base_rate = price_record.get("current_base_price", 0.0) if price_record else 0.0

    # 2. FETCH HISTORY
    history_doc = await db.history_col.find_one({
        "household_id": household_id,
        "waste_type": waste_type
    })

    if not history_doc or "weeks" not in history_doc:
        raise HTTPException(404, "No history found")

    all_weeks = sorted(history_doc["weeks"], key=lambda x: (x["year"], x["week"]))
    # Deepcopy to ensure we don't mutate the original cached data during forecasting
    simulation_window = copy.deepcopy(all_weeks[-12:])

    history_results = []

    # 3. PROCESS HISTORY (Recent Context)
    for i, entry in enumerate(simulation_window):
        actual_weight = entry.get("weight_kg", 0.0)

        # Calculate Features
        r4 = entry.get("roll_4w", actual_weight)
        r12 = entry.get("roll_12w", actual_weight)

        # Determine Lag1 (use previous week's weight in the window, or 0 if start of window)
        lag1 = simulation_window[i - 1]["weight_kg"] if i > 0 else 0.0

        bill_data = tax_engine.calculate_bill(
            weight=actual_weight,
            category=waste_type,
            r4=r4,
            r12=r12,
            lag1=lag1,  # Added lag1
            rate=base_rate
        )

        # Inject weight into bill_data so BillDetails(weight_kg=...) works
        bill_data["weight_kg"] = actual_weight

        # Ensure we use the safe "penalty_amount" key (handled by BillDetails schema mapping or dict unpacking)
        # If your BillDetails schema expects "penalty_amount", the unpack **bill_data works fine
        # provided tax_engine returns "penalty_amount" now.

        history_results.append(ForecastItem(
            week_offset=- (len(simulation_window) - i),
            year=entry["year"],
            week=entry["week"],
            predicted_weight_kg=actual_weight,
            estimated_bill=BillDetails(**bill_data)
        ))

    # 4. PROCESS FORECAST LOOP
    forecast_results = []
    model_key = WASTE_TYPE_MAP.get(waste_type)

    curr_year = simulation_window[-1]["year"]
    curr_week = simulation_window[-1]["week"]

    for i in range(1, horizon + 1):
        # Prepare window features for LSTM
        vals = [x["weight_kg"] for x in simulation_window]
        for idx, w in enumerate(simulation_window):
            w["lag_1w"] = vals[idx - 1] if idx >= 1 else 0
            w["lag_2w"] = vals[idx - 2] if idx >= 2 else 0
            w["lag_4w"] = vals[idx - 4] if idx >= 4 else 0

        # Predict next weight
        try:
            predicted_val = predict_weight_core(model_key, simulation_window)
            predicted_val = max(0.0, round(predicted_val, 2))
        except:
            predicted_val = 0.0

        # Calculate Rollings for the *new* predicted item
        # We append the new prediction temporarily to a list to calc stats
        future_vals = [w["weight_kg"] for w in simulation_window] + [predicted_val]
        r4 = sum(future_vals[-4:]) / 4
        r12 = sum(future_vals[-12:]) / 12

        # Lag1 for the *new* prediction is the *last* actual/simulated weight
        lag1_for_calc = simulation_window[-1]["weight_kg"]

        # Calculate Bill for predicted weight
        bill_data = tax_engine.calculate_bill(
            weight=predicted_val,
            category=waste_type,
            r4=r4,
            r12=r12,
            lag1=lag1_for_calc,  # Added lag1
            rate=base_rate
        )
        bill_data["weight_kg"] = predicted_val

        # Advance Date
        curr_year, curr_week = get_next_date(curr_year, curr_week)

        forecast_results.append(ForecastItem(
            week_offset=i,
            year=curr_year,
            week=curr_week,
            predicted_weight_kg=predicted_val,
            estimated_bill=BillDetails(**bill_data)
        ))

        # Update Simulation Window for next iteration (Auto-regressive step)
        simulation_window.append({
            "year": curr_year,
            "week": curr_week,
            "weight_kg": predicted_val
        })
        if len(simulation_window) > 12:
            simulation_window.pop(0)

    return UnifiedForecastResponse(
        household_id=household_id,
        waste_type=waste_type,
        history_data=history_results,
        forecast_data=forecast_results
    )
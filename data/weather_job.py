import requests
from datetime import datetime, timezone
from pymongo import MongoClient
from apscheduler.schedulers.blocking import BlockingScheduler

# 🔴 CHANGE THIS
MONGODB_URI = "mongodb+srv://Pawani:ecofit123@cluster0.zg0jvo4.mongodb.net/?appName=Cluster0"
DB_NAME = "ecofit_db"

# Colombo (city-level point; later you can do per-ward)
COLOMBO_LAT = 6.9271
COLOMBO_LNG = 79.8612

def hour_floor_utc(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

def fetch_and_store_weather():
    now = datetime.now(timezone.utc)
    ts_hour = hour_floor_utc(now)

    # Open-Meteo forecast endpoint (hourly)
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={COLOMBO_LAT}&longitude={COLOMBO_LNG}"
        "&hourly=temperature_2m,precipitation,precipitation_probability,rain,wind_speed_10m"
        "&timezone=UTC"
        "&forecast_days=2"
    )

    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()

    times = data.get("hourly", {}).get("time", [])
    temps = data.get("hourly", {}).get("temperature_2m", [])
    precip = data.get("hourly", {}).get("precipitation", [])
    precip_prob = data.get("hourly", {}).get("precipitation_probability", [])
    rain = data.get("hourly", {}).get("rain", [])
    wind = data.get("hourly", {}).get("wind_speed_10m", [])

    # Find the index for this hour (UTC)
    # Open-Meteo returns times like "2026-02-08T10:00"
    key = ts_hour.strftime("%Y-%m-%dT%H:00")
    if key not in times:
        print("⚠️ Current hour not found in API response:", key)
        return

    i = times.index(key)

    doc = {
        "tsHour": ts_hour,                 # store as datetime (Mongo Date)
        "lat": COLOMBO_LAT,
        "lng": COLOMBO_LNG,
        "tempC": temps[i] if i < len(temps) else None,
        "precipMm": precip[i] if i < len(precip) else None,
        "rainMm": rain[i] if i < len(rain) else None,
        "precipProb": precip_prob[i] if i < len(precip_prob) else None,
        "windKph": wind[i] if i < len(wind) else None,
        "updatedAt": now
    }

    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    col = db["weather_hourly"]

    # Upsert (one record per hour)
    res = col.update_one(
        {"tsHour": ts_hour},
        {"$set": doc},
        upsert=True
    )

    print(f"✅ Weather stored for {key} | upserted={res.upserted_id is not None}")

def main():
    # Run once immediately
    fetch_and_store_weather()

    # Then schedule hourly
    sched = BlockingScheduler(timezone="UTC")
    sched.add_job(fetch_and_store_weather, "cron", minute=0)  # every hour at :00
    print("⏱️ Weather job running. It will fetch every hour at minute 0 (UTC).")
    sched.start()

if __name__ == "__main__":
    main()

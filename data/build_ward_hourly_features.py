from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

MONGODB_URI = "mongodb+srv://Pawani:ecofit123@cluster0.zg0jvo4.mongodb.net/?appName=Cluster0"
DB_NAME = "ecofit_db"

def hour_floor(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0)

def get_min_max(db, col_name, field, match=None):
    pipe = []
    if match:
        pipe.append({"$match": match})
    pipe += [
        {"$group": {"_id": None, "min": {"$min": f"${field}"}, "max": {"$max": f"${field}"}}}
    ]
    res = list(db[col_name].aggregate(pipe, allowDiskUse=True))
    if not res or res[0]["min"] is None:
        return None, None
    return res[0]["min"], res[0]["max"]

def build_features():
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]

    wards = list(db["wards_master"].find({"active": True}, {"wardId": 1}))
    ward_ids = [w["wardId"] for w in wards]
    if len(ward_ids) < 47:
        raise RuntimeError("wards_master must contain 47 wards")

    # ✅ detect real data window from synthetic data
    c_min, c_max = get_min_max(db, "complaints", "createdAt", {"source": "synthetic"})
    s_min, s_max = get_min_max(db, "service_logs", "startTime", {"source": "synthetic"})
    if c_min is None or s_min is None:
        raise RuntimeError("Cannot find synthetic data in complaints/service_logs.")

    start = hour_floor(min(c_min, s_min))
    end = hour_floor(max(c_max, s_max)) + timedelta(hours=1)  # include last bucket

    print("Using window:")
    print("start:", start)
    print("end  :", end)

    # clean rebuild only this window
    out = db["ward_hourly_features"]
    out.delete_many({"tsHour": {"$gte": start, "$lt": end}})

    # complaints aggregation
    complaints_pipe = [
        {"$match": {"source":"synthetic", "createdAt": {"$gte": start, "$lt": end}}},
        {"$project": {
            "wardId": "$ward.wardId",
            "severity": "$severity",
            "status": "$status",
            "tsHour": {"$dateTrunc": {"date": "$createdAt", "unit": "hour"}}
        }},
        {"$group": {
            "_id": {"wardId": "$wardId", "tsHour": "$tsHour"},
            "complaintsCount": {"$sum": 1},
            "avgSeverity": {"$avg": "$severity"},
            "unresolvedComplaints": {
                "$sum": {"$cond": [{"$in": ["$status", ["NEW", "IN_PROGRESS"]]}, 1, 0]}
            }
        }}
    ]

    comp_map = {}
    for row in db["complaints"].aggregate(complaints_pipe, allowDiskUse=True):
        wid = row["_id"]["wardId"]
        ts = row["_id"]["tsHour"]
        comp_map[(wid, ts)] = {
            "complaintsCount": int(row.get("complaintsCount", 0)),
            "avgSeverity": float(row.get("avgSeverity") or 0.0),
            "unresolvedComplaints": int(row.get("unresolvedComplaints", 0))
        }

    # service aggregation
    service_pipe = [
        {"$match": {"source":"synthetic", "startTime": {"$gte": start, "$lt": end}}},
        {"$project": {
            "wardId": "$ward.wardId",
            "outcome": "$outcome",
            "estimatedKg": "$waste.estimatedKg",
            "binsCleared": "$waste.binsCleared",
            "overflowPoints": "$waste.overflowPointsCleared",
            "tsHour": {"$dateTrunc": {"date": "$startTime", "unit": "hour"}}
        }},
        {"$group": {
            "_id": {"wardId": "$wardId", "tsHour": "$tsHour"},
            "serviceCollected": {"$sum": {"$cond": [{"$eq": ["$outcome", "COLLECTED"]}, 1, 0]}},
            "servicePartial": {"$sum": {"$cond": [{"$eq": ["$outcome", "PARTIAL"]}, 1, 0]}},
            "serviceMissed": {"$sum": {"$cond": [{"$eq": ["$outcome", "MISSED"]}, 1, 0]}},
            "estimatedKg": {"$sum": {"$ifNull": ["$estimatedKg", 0]}},
            "binsCleared": {"$sum": {"$ifNull": ["$binsCleared", 0]}},
            "overflowPoints": {"$sum": {"$ifNull": ["$overflowPoints", 0]}}
        }}
    ]

    srv_map = {}
    for row in db["service_logs"].aggregate(service_pipe, allowDiskUse=True):
        wid = row["_id"]["wardId"]
        ts = row["_id"]["tsHour"]
        srv_map[(wid, ts)] = {
            "serviceCollected": int(row.get("serviceCollected", 0)),
            "servicePartial": int(row.get("servicePartial", 0)),
            "serviceMissed": int(row.get("serviceMissed", 0)),
            "estimatedKg": float(row.get("estimatedKg", 0)),
            "binsCleared": int(row.get("binsCleared", 0)),
            "overflowPoints": int(row.get("overflowPoints", 0))
        }

    # weather map (weather might not exist for old synthetic period -> default 0)
    weather_map = {}
    for w in db["weather_hourly"].find({"tsHour": {"$gte": start, "$lt": end}}, {"tsHour":1, "precipMm":1, "precipProb":1, "tempC":1, "rainMm":1, "windKph":1}):
        weather_map[w["tsHour"]] = {
            "precipMm": float(w.get("precipMm") or 0.0),
            "precipProb": float(w.get("precipProb") or 0.0),
            "tempC": float(w.get("tempC") or 0.0),
            "rainMm": float(w.get("rainMm") or 0.0),
            "windKph": float(w.get("windKph") or 0.0),
        }

    # build grid
    batch = []
    ts = start
    while ts < end:
        wfeat = weather_map.get(ts, {"precipMm":0.0, "precipProb":0.0, "tempC":0.0, "rainMm":0.0, "windKph":0.0})
        for wid in ward_ids:
            doc = {
                "tsHour": ts,
                "wardId": wid,
                **wfeat,
                "complaintsCount": 0,
                "avgSeverity": 0.0,
                "unresolvedComplaints": 0,
                "serviceCollected": 0,
                "servicePartial": 0,
                "serviceMissed": 0,
                "estimatedKg": 0.0,
                "binsCleared": 0,
                "overflowPoints": 0
            }
            doc.update(comp_map.get((wid, ts), {}))
            doc.update(srv_map.get((wid, ts), {}))
            batch.append(doc)

        if len(batch) >= 3000:
            out.insert_many(batch)
            batch = []
        ts += timedelta(hours=1)

    if batch:
        out.insert_many(batch)

    out.create_index([("tsHour", 1), ("wardId", 1)], unique=True)
    out.create_index([("wardId", 1), ("tsHour", 1)])

    print("✅ Built ward_hourly_features.")
    print("Docs:", out.count_documents({"tsHour": {"$gte": start, "$lt": end}}))

if __name__ == "__main__":
    build_features()

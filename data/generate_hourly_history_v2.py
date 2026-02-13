import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

# 🔴 CHANGE THIS TO YOUR REAL MONGODB URI
MONGODB_URI = "mongodb+srv://Pawani:ecofit123@cluster0.zg0jvo4.mongodb.net/?appName=Cluster0"
DB_NAME = "ecofit_db"

CATEGORIES = ["OVERFLOW", "MISSED_PICKUP", "ILLEGAL_DUMP", "BAD_ODOR", "OTHER"]
ISSUES = ["RAIN", "FLOOD", "BLOCKED_ROAD", "VEHICLE_ISSUE", "STAFF_SHORTAGE", "OTHER"]
SHIFTS = ["MORNING", "EVENING"]

# Colombo bounding box (approx)
LAT_MIN, LAT_MAX = 6.86, 6.98
LNG_MIN, LNG_MAX = 79.83, 79.92

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def hour_weight(h):
    if 0 <= h <= 5: return 0.20
    if 6 <= h <= 10: return 1.25
    if 11 <= h <= 15: return 0.90
    if 16 <= h <= 21: return 1.20
    return 0.60

def rain_regime(day):
    rainy = random.random() < 0.30
    if day % 21 in (10,11,12,13,14):
        rainy = rainy or (random.random() < 0.45)
    flood = (day % 90 in (40,41)) and random.random() < 0.6
    if flood: rainy = True
    return rainy, flood

def volume_from_pressure(p):
    if p < 0.9: return "LOW"
    if p < 1.4: return "MEDIUM"
    return "HIGH"

def estimated_kg(vol, hotspot, flood):
    base = {"LOW": (150,450), "MEDIUM": (400,1100), "HIGH": (900,2200)}[vol]
    kg = random.randint(*base)
    if hotspot: kg = int(kg * random.uniform(1.1,1.35))
    if flood: kg = int(kg * random.uniform(1.2,1.6))
    return clamp(kg, 80, 3500)

def bins_cleared(vol, hotspot):
    base = {"LOW": (2,8), "MEDIUM": (6,18), "HIGH": (14,35)}[vol]
    n = random.randint(*base)
    if hotspot: n = int(n * random.uniform(1.1,1.25))
    return clamp(n, 1, 60)

def overflow_points(vol, hotspot, flood):
    if vol == "LOW": base = (0,2)
    elif vol == "MEDIUM": base = (1,4)
    else: base = (2,8)
    n = random.randint(*base)
    if hotspot: n += random.randint(0,2)
    if flood: n += random.randint(1,3)
    return clamp(n, 0, 15)

def main(days=180, avg_complaints=6):
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]

    wards = list(db.wards_master.find({"active": True}))
    if len(wards) != 47:
        raise Exception("wards_master must contain 47 wards")

    complaints = db.complaints
    services = db.service_logs

    # 🔥 CLEAN OLD SYNTHETIC DATA
    complaints.delete_many({"source": "synthetic"})
    services.delete_many({"source": "synthetic"})

    hotspot_wards = set(random.sample([w["wardId"] for w in wards], 8))
    flood_prone = set(random.sample([w["wardId"] for w in wards], 6))

    base_rate = {w["wardId"]: clamp(random.gauss(avg_complaints,2.5),1.5,14) for w in wards}
    service_prob = {w["wardId"]: clamp(random.gauss(0.82,0.1),0.55,0.97) for w in wards}

    pressure = {w["wardId"]: 1.0 for w in wards}
    missed = {w["wardId"]: 0 for w in wards}

    start = datetime.now(timezone.utc) - timedelta(days=days)

    comp_batch, serv_batch = [], []

    def flush():
        nonlocal comp_batch, serv_batch
        if comp_batch:
            complaints.insert_many(comp_batch)
            comp_batch = []
        if serv_batch:
            services.insert_many(serv_batch)
            serv_batch = []

    for d in range(days):
        day = start + timedelta(days=d)
        weekend = day.weekday() in (5,6)
        rainy, flood = rain_regime(d)

        weekend_m = 1.1 if weekend else 1.0
        rain_m = 1 + (0.25 if rainy else 0) + (0.6 if flood else 0)

        # ----- SERVICE LOGS -----
        for w in wards:
            wid = w["wardId"]
            zones = w.get("zones", [])
            hotspot = wid in hotspot_wards

            p = service_prob[wid]
            if hotspot: p += 0.08
            if pressure[wid] > 1.4: p += 0.05
            p = clamp(p, 0.55, 0.99)

            do_service = missed[wid] >= 2 or random.random() < p
            shifts = ["MORNING"]
            if do_service and (hotspot or missed[wid] >= 1) and random.random() < 0.22:
                shifts.append("EVENING")

            if do_service:
                for shift in shifts:
                    sh = random.choice([6,7,8,9]) if shift=="MORNING" else random.choice([16,17,18])
                    st = day.replace(hour=sh, minute=random.randint(0,59))
                    et = st + timedelta(minutes=random.randint(60,160))

                    pm = 0.05 + (0.12 if rainy else 0) + (0.28 if flood else 0)
                    if wid in flood_prone and flood: pm += 0.15
                    pp = 0.10 + (0.06 if rainy else 0)

                    r = random.random()
                    outcome = "MISSED" if r < pm else "PARTIAL" if r < pm+pp else "COLLECTED"

                    issues = []
                    if rainy and outcome!="COLLECTED": issues.append("RAIN")
                    if flood and outcome!="COLLECTED": issues.append("FLOOD")
                    if outcome!="COLLECTED" and not issues:
                        issues.append(random.choice(["VEHICLE_ISSUE","STAFF_SHORTAGE","BLOCKED_ROAD"]))

                    vol = volume_from_pressure(pressure[wid])
                    serv_batch.append({
                        "logId": f"SRV-SYN-{wid[:3]}-{int(st.timestamp())}",
                        "createdAt": st,
                        "updatedAt": st,
                        "source": "synthetic",
                        "ward": {"wardId": wid, "zones": zones},
                        "serviceType": "WASTE_COLLECTION",
                        "shift": shift,
                        "startTime": st,
                        "endTime": et,
                        "outcome": outcome,
                        "volumeLevel": vol,
                        "waste": {
                            "estimatedKg": estimated_kg(vol, hotspot, flood),
                            "measuredKg": None,
                            "binsCleared": bins_cleared(vol, hotspot),
                            "overflowPointsCleared": overflow_points(vol, hotspot, flood)
                        },
                        "issues": issues,
                        "notes": "Synthetic service",
                        "createdBy": {"staffId":"SYNTH","staffName":"Generator"}
                    })

                    if outcome=="COLLECTED":
                        pressure[wid]*=0.85; missed[wid]=0
                    elif outcome=="MISSED":
                        pressure[wid]*=1.28; missed[wid]+=1
                    else:
                        pressure[wid]*=1.1; missed[wid]=max(0,missed[wid]-1)

        # ----- COMPLAINTS (HOURLY) -----
        for h in range(24):
            hw = hour_weight(h)
            for w in wards:
                wid = w["wardId"]
                lam = base_rate[wid]*hw*weekend_m*rain_m*pressure[wid]
                count = max(0,int(random.gauss(lam,max(0.6,lam*0.35))))

                for i in range(count):
                    ts = day.replace(hour=h,minute=random.randint(0,59))
                    sev = 1 if pressure[wid]<1.1 else 2 if pressure[wid]<1.6 else 4
                    comp_batch.append({
                        "complaintId": f"CMP-SYN-{wid[:3]}-{int(ts.timestamp())}-{i}",
                        "createdAt": ts,
                        "updatedAt": ts,
                        "source": "synthetic",
                        "citizen": {"userId": f"SYNTH_{random.randint(1,8000)}"},
                        "ward": {"wardId": wid, "zones": w.get("zones",[])},
                        "location": {"lat": random.uniform(LAT_MIN,LAT_MAX),
                                     "lng": random.uniform(LNG_MIN,LNG_MAX),
                                     "addressText": None},
                        "category": random.choice(CATEGORIES),
                        "severity": sev,
                        "description": "Synthetic complaint",
                        "status": "NEW",
                        "statusHistory": [{"status":"NEW","timestamp":ts,"updatedBy":"SYNTH"}],
                        "assignedTo": None,
                        "resolvedAt": None,
                        "resolution": None
                    })

                if len(comp_batch)>=4000 or len(serv_batch)>=1200:
                    flush()

    flush()
    print("DONE")
    print("Complaints:", complaints.count_documents({"source":"synthetic"}))
    print("Service logs:", services.count_documents({"source":"synthetic"}))

if __name__=="__main__":
    main()

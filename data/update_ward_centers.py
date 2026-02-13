from pymongo import MongoClient

client = MongoClient("mongodb+srv://Pawani:ecofit123@cluster0.zg0jvo4.mongodb.net/?appName=Cluster0")
db = client["ecofit_db"]

res = db.wards_master.update_many(
    {},
    {"$set": {"center": {"lat": 6.9271, "lng": 79.8612}}}
)

print("Matched:", res.matched_count)
print("Modified:", res.modified_count)

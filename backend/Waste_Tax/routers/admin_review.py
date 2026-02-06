from fastapi import APIRouter, HTTPException
from services.db_service import db
from services.behaviour import classify_behaviour
from schemas.review import SubmitWeightRequest, PendingItemResponse, ReviewActionRequest
from typing import List
from bson import ObjectId
from datetime import datetime

router = APIRouter()


@router.post("/submit_weight_for_review")
async def submit_weight(data: SubmitWeightRequest):

    history_record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })

    if not history_record or not history_record.get("weeks"):

        target_year = datetime.now().year
        target_week = 1
    else:

        weeks = history_record["weeks"]
        last_entry = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-1]


        if last_entry["week"] < 52:
            target_week = last_entry["week"] + 1
            target_year = last_entry["year"]
        else:
            target_week = 1
            target_year = last_entry["year"] + 1


    existing_pending = await db.pending_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type,
        "year": target_year,
        "week": target_week,
        "status": "REVIEW"
    })


    if existing_pending:

        await db.pending_col.update_one(
            {"_id": existing_pending["_id"]},
            {
                "$set": {
                    "weight_kg": data.weight_kg,
                    "submitted_at": datetime.utcnow()
                }
            }
        )
        action = "Updated"
        submission_id = str(existing_pending["_id"])
    else:

        new_submission = {
            "household_id": data.household_id,
            "waste_type": data.waste_type,
            "weight_kg": data.weight_kg,
            "year": target_year,
            "week": target_week,
            "status": "REVIEW",
            "submitted_at": datetime.utcnow()
        }
        result = await db.pending_col.insert_one(new_submission)
        action = "Created"
        submission_id = str(result.inserted_id)

    return {
        "message": f"Submission {action} successfully.",
        "submission_id": submission_id,
        "week": target_week,
        "year": target_year,
        "status": "REVIEW"
    }


@router.get("/my_submissions/{household_id}/{waste_type}")
async def get_my_submissions(household_id: str, waste_type: str):

    cursor = db.pending_col.find({
        "household_id": household_id,
        "waste_type": waste_type,
        "status": {"$in": ["REVIEW", "DENIED"]}
    }).sort("submitted_at", -1)

    results = []
    async for doc in cursor:
        results.append({
            "submission_id": str(doc["_id"]),
            "year": doc.get("year"),
            "week": doc.get("week"),
            "weight_kg": doc["weight_kg"],
            "status": doc["status"],
            "submitted_at": doc["submitted_at"]
        })
    return results


@router.get("/pending_reviews", response_model=List[PendingItemResponse])
async def get_pending_reviews():
    cursor = db.pending_col.find({"status": "REVIEW"})
    results = []
    async for doc in cursor:
        results.append(PendingItemResponse(
            submission_id=str(doc["_id"]),
            household_id=doc["household_id"],
            waste_type=doc["waste_type"],
            weight_kg=doc["weight_kg"],
            status=doc["status"],
            submitted_at=doc["submitted_at"]
        ))
    return results

@router.post("/process_review_action")
async def process_review(data: ReviewActionRequest):

    try:
        obj_id = ObjectId(data.submission_id)
    except:
        raise HTTPException(400, "Invalid Submission ID format")

    submission = await db.pending_col.find_one({"_id": obj_id})
    if not submission:
        raise HTTPException(404, "Submission not found")

    if submission["status"] != "REVIEW":
        raise HTTPException(400, f"Item is already {submission['status']}")

    if data.action.upper() == "DENY":
        await db.pending_col.update_one(
            {"_id": obj_id},
            {"$set": {"status": "DENIED", "reviewed_at": datetime.utcnow()}}
        )
        return {"message": "Weight rejected. History was not updated.", "status": "DENIED"}

    elif data.action.upper() == "VERIFY":

        await db.pending_col.update_one(
            {"_id": obj_id},
            {"$set": {"status": "VERIFIED", "reviewed_at": datetime.utcnow()}}
        )

        household_id = submission["household_id"]
        waste_type = submission["waste_type"]
        weight_kg = submission["weight_kg"]

        history_record = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": waste_type
        })

        if not history_record:

            weeks = []
            new_week_num = 1
            new_year = datetime.now().year
        else:
            weeks = history_record.get("weeks", [])

            if weeks:
                last_entry = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-1]
                new_week_num = last_entry["week"] + 1 if last_entry["week"] < 52 else 1
                new_year = last_entry["year"] if last_entry["week"] < 52 else last_entry["year"] + 1
            else:
                new_week_num = 1
                new_year = datetime.now().year


        weeks.append({
            "year": new_year,
            "week": new_week_num,
            "weight_kg": weight_kg
        })


        weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-12:]


        weights_list = [w["weight_kg"] for w in weeks]
        for idx, w in enumerate(weeks):
            w["lag_1w"] = weights_list[idx - 1] if idx >= 1 else 0
            w["lag_2w"] = weights_list[idx - 2] if idx >= 2 else 0
            w["lag_4w"] = weights_list[idx - 4] if idx >= 4 else 0
            w["roll_4w"] = round(sum(weights_list[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2)
            w["roll_12w"] = round(sum(weights_list[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2)


            w["behaviour_class"] = classify_behaviour(waste_type, w["weight_kg"])


        if history_record:
            await db.history_col.update_one(
                {"_id": history_record["_id"]},
                {"$set": {"weeks": weeks}}
            )
        else:

            await db.history_col.insert_one({
                "household_id": household_id,
                "waste_type": waste_type,
                "weeks": weeks
            })

        return {
            "message": "Weight Verified and added to Main History.",
            "status": "VERIFIED",
            "week_added": new_week_num
        }

    else:
        raise HTTPException(400, "Action must be VERIFY or DENY")


@router.get("/pending_reviews/{household_id}")
async def get_pending_by_household(household_id: str):

    cursor = db.pending_col.find({
        "household_id": household_id,
        "status": "REVIEW"
    }).sort("submitted_at", -1)

    results = []
    async for doc in cursor:
        results.append({
            "submission_id": str(doc["_id"]),
            "household_id": doc["household_id"],
            "waste_type": doc["waste_type"],
            "weight_kg": doc["weight_kg"],
            "year": doc.get("year", "N/A"),
            "week": doc.get("week", "N/A"),
            "status": doc["status"],
            "submitted_at": doc["submitted_at"]
        })
    return results




@router.get("/all_pending_reviews")
async def get_all_pending_reviews():

    cursor = db.pending_col.find({"status": "REVIEW"}).sort("submitted_at", 1)

    results = []
    async for doc in cursor:
        results.append({
            "submission_id": str(doc["_id"]),
            "household_id": doc["household_id"],
            "waste_type": doc["waste_type"],
            "weight_kg": doc["weight_kg"],
            "week": doc.get("week", "N/A"),
            "status": doc["status"],
            "submitted_at": doc["submitted_at"]
        })
    return results
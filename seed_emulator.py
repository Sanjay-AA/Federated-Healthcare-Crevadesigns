import json
import random
from datetime import date, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT_ID = "demo-federated-healthcare"
BASE_URL = f"http://127.0.0.1:8080/v1/projects/{PROJECT_ID}/databases/(default)/documents"

# Helper functions for Firestore REST values
def stringValue(value):
    return {"stringValue": str(value)}

def integerValue(value):
    return {"integerValue": str(value)}

def doubleValue(value):
    return {"doubleValue": float(value)}

def booleanValue(value):
    return {"booleanValue": bool(value)}

def arrayValue(values):
    return {"arrayValue": {"values": values}}

def mapValue(fields):
    return {"mapValue": {"fields": fields}}

def write_doc(collection, doc_id, data):
    url = f"{BASE_URL}/{collection}/{doc_id}"
    payload = json.dumps({"fields": data}).encode("utf-8")
    request = Request(
        url,
        data=payload,
        method="PATCH",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            status = response.status
            print(f"WRITE {collection}/{doc_id}: HTTP {status}")
            return status
    except HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", errors="ignore")
        print(f"ERROR {collection}/{doc_id}: HTTP {status}")
        print(f"Response Body: {body}")
        raise
    except URLError as e:
        print("Could not connect to Firestore Emulator.")
        print("Make sure `firebase emulators:start --project=demo-federated-healthcare` is running.")
        raise

def make_reported_cases(phc_id, district, start_date_str="2026-08-06"):
    start = date.fromisoformat(start_date_str)
    cases_values = []
    for i in range(14):
        day = start + timedelta(days=i)
        if district == "Namakkal":
            if i < 6:
                dengue = 2
                malaria = 1
            else:
                dengue = 2 + (i - 5) * 4
                malaria = 1 + (i - 5) * 2
        else:
            dengue = 1
            malaria = 0
            
        cases_values.append(mapValue({
            "phc_id": stringValue(phc_id),
            "date": stringValue(day.strftime("%Y-%m-%d")),
            "dengue_cases": integerValue(dengue),
            "malaria_cases": integerValue(malaria)
        }))
    return arrayValue(cases_values)

def make_history(base_usage, district, start_date_str="2026-08-06"):
    start = date.fromisoformat(start_date_str)
    history_values = []
    for i, qty in enumerate(base_usage):
        day = start + timedelta(days=i)
        if district == "Namakkal":
            if i < 6:
                dengue = 2
                malaria = 1
            else:
                dengue = 2 + (i - 5) * 4
                malaria = 1 + (i - 5) * 2
        else:
            dengue = 1
            malaria = 0
        history_values.append(mapValue({
            "date": stringValue(day.strftime("%b %d")),
            "quantity_used": integerValue(qty),
            "dengue_cases": integerValue(dengue),
            "malaria_cases": integerValue(malaria)
        }))
    return arrayValue(history_values)

def verify_collection(collection):
    url = f"{BASE_URL}/{collection}"
    request = Request(url, method="GET")
    try:
        with urlopen(request, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            docs = res_data.get("documents", [])
            return len(docs)
    except Exception as e:
        print(f"Verification query failed for {collection}: {e}")
        return 0

def seed():
    random.seed(42)

    # 1. Countries
    countries_data = [
        ("IN", "India", "Asia", "ACTIVE"),
        ("BR", "Brazil", "Americas", "CONNECTED"),
        ("RU", "Russia", "Europe", "CONNECTED"),
        ("CN", "China", "Asia", "CONNECTED"),
        ("ZA", "South Africa", "Africa", "CONNECTED")
    ]
    for code, name, region, status in countries_data:
        write_doc("countries", code, {
            "code": stringValue(code),
            "name": stringValue(name),
            "region": stringValue(region),
            "status": stringValue(status)
        })

    # 2. Districts
    districts_data = [
        ("salem", "Salem", "Tamil Nadu", "IN", "TN-SLM"),
        ("erode", "Erode", "Tamil Nadu", "IN", "TN-ERD"),
        ("namakkal", "Namakkal", "Tamil Nadu", "IN", "TN-NAM")
    ]
    for doc_id, name, state, country_code, node_code in districts_data:
        write_doc("districts", doc_id, {
            "name": stringValue(name),
            "state": stringValue(state),
            "country_code": stringValue(country_code),
            "node_code": stringValue(node_code)
        })

    # 3. PHCs
    phcs_data = [
        {
            "id": "phc-slm-1",
            "name": "Salem Rural PHC",
            "district": "Salem",
            "total_beds": 20,
            "occupied_beds": 8,
            "total_staff": 15,
            "staff_present_today": 14,
            "lat": 11.6643,
            "lng": 78.1460,
        },
        {
            "id": "phc-erd-1",
            "name": "Erode Central PHC",
            "district": "Erode",
            "total_beds": 25,
            "occupied_beds": 12,
            "total_staff": 18,
            "staff_present_today": 16,
            "lat": 11.3410,
            "lng": 77.7172,
        },
        {
            "id": "phc-nmk-1",
            "name": "Namakkal Town PHC",
            "district": "Namakkal",
            "total_beds": 30,
            "occupied_beds": 29,
            "total_staff": 20,
            "staff_present_today": 18,
            "lat": 11.2189,
            "lng": 78.1673,
        },
        {
            "id": "phc-nmk-2",
            "name": "Senthamangalam PHC",
            "district": "Namakkal",
            "total_beds": 15,
            "occupied_beds": 6,
            "total_staff": 10,
            "staff_present_today": 9,
            "lat": 11.2721,
            "lng": 78.2394,
        }
    ]
    for p in phcs_data:
        write_doc("phcs", p["id"], {
            "name": stringValue(p["name"]),
            "district": stringValue(p["district"]),
            "total_beds": integerValue(p["total_beds"]),
            "occupied_beds": integerValue(p["occupied_beds"]),
            "total_staff": integerValue(p["total_staff"]),
            "staff_present_today": integerValue(p["staff_present_today"]),
            "country_code": stringValue("IN"),
            "lat": doubleValue(p["lat"]),
            "lng": doubleValue(p["lng"]),
            "status": stringValue("ACTIVE"),
            "reported_cases": make_reported_cases(p["id"], p["district"])
        })

    # 4. Medicines
    medicines_data = [
        {
            "medicine_id": "med-slm1-paracetamol",
            "medicine_name": "Paracetamol",
            "phc_id": "phc-slm-1",
            "unit": "Tablets",
            "current_stock": 850,
            "reorder_level": 100,
            "daily_consumption": 16,
            "predicted_days_remaining": 53,
            "status": "HEALTHY",
            "history": [15,18,14,16,15,17,18,16,15,16,17,15,16,18]
        },
        {
            "medicine_id": "med-slm1-iv",
            "medicine_name": "IV Fluids",
            "phc_id": "phc-slm-1",
            "unit": "Bottles",
            "current_stock": 520,
            "reorder_level": 50,
            "daily_consumption": 4,
            "predicted_days_remaining": 130,
            "status": "HEALTHY",
            "history": [3,4,2,3,4,3,5,4,3,4,4,3,5,4]
        },
        {
            "medicine_id": "med-slm1-ors",
            "medicine_name": "ORS",
            "phc_id": "phc-slm-1",
            "unit": "Sachets",
            "current_stock": 340,
            "reorder_level": 50,
            "daily_consumption": 9,
            "predicted_days_remaining": 37,
            "status": "HEALTHY",
            "history": [8,10,7,9,8,11,9,10,8,9,10,8,9,11]
        },
        {
            "medicine_id": "med-erd1-amoxicillin",
            "medicine_name": "Amoxicillin",
            "phc_id": "phc-erd-1",
            "unit": "Capsules",
            "current_stock": 600,
            "reorder_level": 100,
            "daily_consumption": 12,
            "predicted_days_remaining": 50,
            "status": "HEALTHY",
            "history": [5,6,5,7,6,8,7,6,7,8,7,6,8,7]
        },
        {
            "medicine_id": "med-erd1-azithromycin",
            "medicine_name": "Azithromycin",
            "phc_id": "phc-erd-1",
            "unit": "Tablets",
            "current_stock": 80,
            "reorder_level": 100,
            "daily_consumption": 25,
            "predicted_days_remaining": 3,
            "status": "LOW_STOCK",
            "history": [12,14,11,13,12,15,14,13,12,14,15,13,14,15]
        },
        {
            "medicine_id": "med-erd1-iv",
            "medicine_name": "IV Fluids",
            "phc_id": "phc-erd-1",
            "unit": "Bottles",
            "current_stock": 460,
            "reorder_level": 50,
            "daily_consumption": 7,
            "predicted_days_remaining": 65,
            "status": "HEALTHY",
            "history": [5,6,5,7,6,8,7,6,7,8,7,6,8,7]
        },
        {
            "medicine_id": "med-nmk1-paracetamol",
            "medicine_name": "Paracetamol",
            "phc_id": "phc-nmk-1",
            "unit": "Tablets",
            "current_stock": 45,
            "reorder_level": 200,
            "daily_consumption": 145,
            "predicted_days_remaining": 0,
            "status": "CRITICAL",
            "history": [12,15,10,14,35,48,60,72,85,90,110,115,130,145]
        },
        {
            "medicine_id": "med-nmk1-iv",
            "medicine_name": "IV Fluids",
            "phc_id": "phc-nmk-1",
            "unit": "Bottles",
            "current_stock": 12,
            "reorder_level": 100,
            "daily_consumption": 48,
            "predicted_days_remaining": 0,
            "status": "CRITICAL",
            "history": [2,3,1,2,8,12,18,22,26,30,34,38,42,48]
        },
        {
            "medicine_id": "med-nmk1-ors",
            "medicine_name": "ORS",
            "phc_id": "phc-nmk-1",
            "unit": "Sachets",
            "current_stock": 180,
            "reorder_level": 100,
            "daily_consumption": 32,
            "predicted_days_remaining": 5,
            "status": "LOW_STOCK",
            "history": [5,8,6,7,10,12,15,18,20,22,25,28,30,32]
        },
        {
            "medicine_id": "med-nmk2-metformin",
            "medicine_name": "Metformin",
            "phc_id": "phc-nmk-2",
            "unit": "Tablets",
            "current_stock": 400,
            "reorder_level": 100,
            "daily_consumption": 10,
            "predicted_days_remaining": 40,
            "status": "HEALTHY",
            "history": [12,13,11,12,13,14,12,13,14,13,12,14,13,14]
        },
        {
            "medicine_id": "med-nmk2-insulin",
            "medicine_name": "Insulin",
            "phc_id": "phc-nmk-2",
            "unit": "Vials",
            "current_stock": 50,
            "reorder_level": 30,
            "daily_consumption": 5,
            "predicted_days_remaining": 10,
            "status": "LOW_STOCK",
            "history": [3,3,2,4,3,4,3,3,4,3,4,3,4,4]
        },
        {
            "medicine_id": "med-nmk2-ibuprofen",
            "medicine_name": "Ibuprofen",
            "phc_id": "phc-nmk-2",
            "unit": "Tablets",
            "current_stock": 10,
            "reorder_level": 50,
            "daily_consumption": 15,
            "predicted_days_remaining": 0,
            "status": "CRITICAL",
            "history": [7,8,6,8,7,9,8,7,8,9,8,7,9,8]
        }
    ]
    for m in medicines_data:
        phc_id = m["phc_id"]
        district = "Namakkal" if "nmk" in phc_id else "Salem" if "slm" in phc_id else "Erode"
        write_doc("medicines", m["medicine_id"], {
            "medicine_id": stringValue(m["medicine_id"]),
            "medicine_name": stringValue(m["medicine_name"]),
            "name": stringValue(m["medicine_name"]),  # frontend compatibility
            "phc_id": stringValue(m["phc_id"]),
            "unit": stringValue(m["unit"]),
            "current_stock": integerValue(m["current_stock"]),
            "reorder_level": integerValue(m["reorder_level"]),
            "daily_consumption": integerValue(m["daily_consumption"]),
            "predicted_days_remaining": integerValue(m["predicted_days_remaining"]),
            "status": stringValue(m["status"]),
            "consumption_history": make_history(m["history"], district)
        })

    # 5. Disease Reports
    districts_geo = {
        "Salem": (11.6643, 78.1460, 15),
        "Erode": (11.3410, 77.7172, 10),
        "Namakkal": (11.2189, 78.1673, 20)
    }
    diseases = ["Dengue", "Malaria", "Typhoid", "Influenza", "Acute Respiratory Infection"]
    report_id = 1
    start_report_date = date(2026, 8, 13)
    for dist_name, (lat, lng, base_cases) in districts_geo.items():
        for day_offset in range(7):
            current_date = start_report_date + timedelta(days=day_offset)
            if dist_name == "Namakkal":
                cases = base_cases + (day_offset * 20) + random.randint(-5, 5)
                trend = "INCREASING"
                severity = "HIGH" if cases >= 70 else "MODERATE" if cases >= 40 else "LOW"
            else:
                cases = base_cases + random.randint(-3, 3)
                trend = "STABLE"
                severity = "LOW"
            
            disease = diseases[day_offset % len(diseases)]
            write_doc("diseaseReports", f"report-{report_id:03d}", {
                "district": stringValue(dist_name),
                "disease": stringValue(disease),
                "reported_cases": integerValue(cases),
                "date": stringValue(current_date.strftime("%Y-%m-%d")),
                "severity": stringValue(severity),
                "trend": stringValue(trend),
                "latitude": doubleValue(lat),
                "longitude": doubleValue(lng)
            })
            report_id += 1

    # 6. Alerts
    alerts = [
        ("alert-001", {
            "type": "STOCK_OUT",
            "title": "Paracetamol Critical Stock-out Warning",
            "message": "Namakkal Town PHC is projected to run out of Paracetamol in 0 days.",
            "severity": "CRITICAL",
            "district": "Namakkal",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-nmk-1",
            "medicine_id": "med-nmk1-paracetamol",
            "medicine_name": "Paracetamol",
            "days_to_stockout": 0
        }),
        ("alert-002", {
            "type": "DISEASE_SURGE",
            "title": "Dengue Outbreak Warning",
            "message": "Namakkal district exhibits a severe dengue surge trend.",
            "severity": "HIGH",
            "district": "Namakkal",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-nmk-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        }),
        ("alert-003", {
            "type": "CAPACITY",
            "title": "Bed Capacity Warning",
            "message": "Namakkal Town PHC bed occupancy is at 96%.",
            "severity": "HIGH",
            "district": "Namakkal",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-nmk-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        })
    ]
    for doc_id, a in alerts:
        write_doc("alerts", doc_id, {
            "type": stringValue(a["type"]),
            "title": stringValue(a["title"]),
            "message": stringValue(a["message"]),
            "severity": stringValue(a["severity"]),
            "district": stringValue(a["district"]),
            "status": stringValue(a["status"]),
            "created_at": stringValue(a["created_at"]),
            "phc_id": stringValue(a["phc_id"]),
            "medicine_id": stringValue(a["medicine_id"]),
            "medicine_name": stringValue(a["medicine_name"]),
            "days_to_stockout": integerValue(a["days_to_stockout"])
        })

    # 7. Transfers
    transfers_data = [
        ("transfer-001", {
            "from_phc_id": "phc-slm-1",
            "to_phc_id": "phc-nmk-1",
            "medicine_id": "med-slm1-paracetamol",
            "medicine_name": "Paracetamol",
            "quantity": 300,
            "distance_km": 95.4,
            "status": "RECOMMENDED"
        }),
        ("transfer-002", {
            "from_phc_id": "phc-erd-1",
            "to_phc_id": "phc-nmk-1",
            "medicine_id": "med-erd1-iv",
            "medicine_name": "IV Fluids",
            "quantity": 100,
            "distance_km": 72.1,
            "status": "RECOMMENDED"
        })
    ]
    for doc_id, t in transfers_data:
        write_doc("transfers", doc_id, {
            "from_phc_id": stringValue(t["from_phc_id"]),
            "to_phc_id": stringValue(t["to_phc_id"]),
            "medicine_id": stringValue(t["medicine_id"]),
            "medicine_name": stringValue(t["medicine_name"]),
            "quantity": integerValue(t["quantity"]),
            "distance_km": doubleValue(t["distance_km"]),
            "status": stringValue(t["status"])
        })

    # 8. Federated Models
    nodes = {
        "Salem": mapValue({
            "slope": doubleValue(0.05),
            "status": stringValue("STABLE")
        }),
        "Namakkal": mapValue({
            "slope": doubleValue(11.93),
            "status": stringValue("OUTBREAK")
        }),
        "Erode": mapValue({
            "slope": doubleValue(-0.02),
            "status": stringValue("STABLE")
        })
    }
    write_doc("federatedModels", "current", {
        "algorithm": stringValue("FedAvg"),
        "status": stringValue("ACTIVE"),
        "aggregator": stringValue("Tamil Nadu Central Aggregator"),
        "global_trend": doubleValue(3.42),
        "outbreak_risk": booleanValue(True),
        "nodes": mapValue({
            "Salem": nodes["Salem"],
            "Namakkal": nodes["Namakkal"],
            "Erode": nodes["Erode"]
        })
    })

    print("\nSeed complete.\n")
    print("Created/updated:")
    print("  countries: 5")
    print("  districts: 3")
    print("  phcs: 4")
    print("  medicines: 12")
    print("  diseaseReports: 21")
    print("  alerts: 3")
    print("  transfers: 2")
    print("  federatedModels: 1\n")
    print("Open:")
    print("http://127.0.0.1:4000/\n")
    print("Then open:")
    print("Firestore -> Data\n")

    # Verification
    print("Verification:")
    c_count = verify_collection("countries")
    p_count = verify_collection("phcs")
    f_count = verify_collection("federatedModels")
    print(f"  countries found: {c_count}")
    print(f"  phcs found: {p_count}")
    print(f"  federatedModels found: {f_count}")

    if c_count < 5 or p_count < 4 or f_count < 1:
        print("\nWARNING: Seed completed but verification failed.")
        print("Check the Firestore Emulator project ID and port.")

if __name__ == "__main__":
    seed()

import json
import random
from datetime import date, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT_ID = "federated-healthcare-3fcd3"
BASE_URL = f"http://127.0.0.1:8080/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def s(value):
    return {"stringValue": str(value)}

def n(value):
    if isinstance(value, int):
        return {"integerValue": str(value)}
    return {"doubleValue": float(value)}

def b(value):
    return {"booleanValue": bool(value)}

def arr(values):
    return {"arrayValue": {"values": values}}

def obj(values):
    return {"mapValue": {"fields": values}}

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
            return response.status
    except HTTPError as e:
        print(f"ERROR {collection}/{doc_id}: HTTP {e.code} {e.read().decode(errors='ignore')}")
        raise
    except URLError as e:
        print("Could not connect to Firestore Emulator.")
        print("Make sure `firebase emulators:start` is running.")
        raise

def seed():
    random.seed(42)

    # ---------------------------------------------------------
    # 1. COUNTRIES
    # ---------------------------------------------------------
    countries = [
        ("IN", "India", "South Asia"),
        ("BR", "Brazil", "South America"),
        ("RU", "Russia", "Eastern Europe / Asia"),
        ("CN", "China", "East Asia"),
        ("ZA", "South Africa", "Southern Africa"),
    ]

    for code, name, region in countries:
        write_doc("countries", code, {
            "name": s(name),
            "code": s(code),
            "region": s(region),
            "status": s("ACTIVE" if code == "IN" else "CONNECTED"),
        })

    # ---------------------------------------------------------
    # 2. DISTRICTS
    # ---------------------------------------------------------
    districts = [
        ("salem", "Salem", "TN-SLM"),
        ("erode", "Erode", "TN-ERD"),
        ("namakkal", "Namakkal", "TN-NAM"),
    ]

    for doc_id, name, node_code in districts:
        write_doc("districts", doc_id, {
            "name": s(name),
            "state": s("Tamil Nadu"),
            "country_code": s("IN"),
            "node_code": s(node_code),
        })

    # ---------------------------------------------------------
    # 3. PHCs
    # ---------------------------------------------------------
    phcs = [
        {
            "id": "phc-slm-1",
            "name": "Salem Rural PHC",
            "district": "Salem",
            "lat": 11.6643,
            "lng": 78.1460,
            "total_beds": 20,
            "occupied_beds": 8,
            "total_staff": 15,
            "staff_present_today": 14,
        },
        {
            "id": "phc-erd-1",
            "name": "Erode Central PHC",
            "district": "Erode",
            "lat": 11.3410,
            "lng": 77.7172,
            "total_beds": 25,
            "occupied_beds": 12,
            "total_staff": 18,
            "staff_present_today": 16,
        },
        {
            "id": "phc-nmk-1",
            "name": "Namakkal Town PHC",
            "district": "Namakkal",
            "lat": 11.2189,
            "lng": 78.1673,
            "total_beds": 30,
            "occupied_beds": 29,
            "total_staff": 20,
            "staff_present_today": 18,
        },
        {
            "id": "phc-nmk-2",
            "name": "Senthamangalam PHC",
            "district": "Namakkal",
            "lat": 11.2721,
            "lng": 78.2394,
            "total_beds": 15,
            "occupied_beds": 6,
            "total_staff": 10,
            "staff_present_today": 9,
        },
    ]

    for p in phcs:
        write_doc("phcs", p["id"], {
            "name": s(p["name"]),
            "district": s(p["district"]),
            "country_code": s("IN"),
            "lat": n(p["lat"]),
            "lng": n(p["lng"]),
            "total_beds": n(p["total_beds"]),
            "occupied_beds": n(p["occupied_beds"]),
            "total_staff": n(p["total_staff"]),
            "staff_present_today": n(p["staff_present_today"]),
            "status": s("ACTIVE"),
        })

    # ---------------------------------------------------------
    # 4. MEDICINES + 14-DAY CONSUMPTION HISTORY
    # ---------------------------------------------------------
    medicine_profiles = {
        "phc-slm-1": {
            "Paracetamol": ("Tablets", 850, [15,18,14,16,15,17,18,16,15,16,17,15,16,18]),
            "IV Fluids": ("Bottles", 520, [3,4,2,3,4,3,5,4,3,4,4,3,5,4]),
            "ORS": ("Sachets", 340, [8,10,7,9,8,11,9,10,8,9,10,8,9,11]),
        },
        "phc-erd-1": {
            "Paracetamol": ("Tablets", 750, [20,22,19,21,20,23,22,20,21,24,22,21,23,22]),
            "IV Fluids": ("Bottles", 460, [5,6,5,7,6,8,7,6,7,8,7,6,8,7]),
            "ORS": ("Sachets", 310, [12,14,11,13,12,15,14,13,12,14,15,13,14,15]),
        },
        "phc-nmk-1": {
            "Paracetamol": ("Tablets", 45, [12,15,10,14,35,48,60,72,85,90,110,115,130,145]),
            "IV Fluids": ("Bottles", 12, [2,3,1,2,8,12,18,22,26,30,34,38,42,48]),
            "ORS": ("Sachets", 180, [5,8,6,7,10,12,15,18,20,22,25,28,30,32]),
        },
        "phc-nmk-2": {
            "Paracetamol": ("Tablets", 420, [12,13,11,12,13,14,12,13,14,13,12,14,13,14]),
            "IV Fluids": ("Bottles", 210, [3,3,2,4,3,4,3,3,4,3,4,3,4,4]),
            "ORS": ("Sachets", 260, [7,8,6,8,7,9,8,7,8,9,8,7,9,8]),
        },
    }

    start = date(2026, 8, 6)

    medicine_docs = []

    for phc_id, meds in medicine_profiles.items():
        for med_name, (unit, stock, usage) in meds.items():
            safe = med_name.lower().replace(" ", "-")
            phc_short = phc_id.replace("phc-", "")
            doc_id = f"med-{phc_short}-{safe}"

            history_values = []
            for i, quantity in enumerate(usage):
                history_values.append(obj({
                    "date": s((start + timedelta(days=i)).strftime("%b %d")),
                    "quantity_used": n(quantity),
                }))

            minimum_stock = 100 if unit == "Tablets" else 50

            write_doc("medicines", doc_id, {
                "phc_id": s(phc_id),
                "name": s(med_name),
                "unit": s(unit),
                "current_stock": n(stock),
                "minimum_stock": n(minimum_stock),
                "consumption_history": arr(history_values),
            })
            medicine_docs.append((doc_id, phc_id, med_name, stock, usage))

    # ---------------------------------------------------------
    # 5. DISEASE REPORTS
    # This collection is created automatically by the emulator
    # when the first document is written.
    # ---------------------------------------------------------
    disease_cases = {
        "Salem": 18,
        "Erode": 12,
        "Namakkal": 96,
    }

    report_counter = 1
    for district_name, base_cases in disease_cases.items():
        for day_offset in range(7):
            report_date = date(2026, 8, 13) + timedelta(days=day_offset)
            cases = max(0, base_cases + random.randint(-4, 5))
            if district_name == "Namakkal":
                cases += day_offset * 9

            write_doc("diseaseReports", f"report-{report_counter:03d}", {
                "district": s(district_name),
                "country_code": s("IN"),
                "disease": s("Dengue"),
                "reported_cases": n(cases),
                "suspected_cases": n(max(1, cases // 4)),
                "recovered_cases": n(max(0, cases // 3)),
                "deaths": n(0 if cases < 80 else 1),
                "severity": s("HIGH" if cases >= 70 else "MODERATE" if cases >= 30 else "LOW"),
                "reporting_date": s(report_date.isoformat()),
            })
            report_counter += 1

    # ---------------------------------------------------------
    # 6. ALERTS
    # ---------------------------------------------------------
    alerts = [
        ("alert-001", {
            "type": "STOCK_OUT",
            "severity": "CRITICAL",
            "phc_id": "phc-nmk-1",
            "medicine_id": "med-nmk1-paracetamol",
            "medicine_name": "Paracetamol",
            "days_to_stockout": 1,
            "status": "ACTIVE",
        }),
        ("alert-002", {
            "type": "STOCK_OUT",
            "severity": "HIGH",
            "phc_id": "phc-nmk-1",
            "medicine_id": "med-nmk1-iv-fluids",
            "medicine_name": "IV Fluids",
            "days_to_stockout": 1,
            "status": "ACTIVE",
        }),
        ("alert-003", {
            "type": "DISEASE_SURGE",
            "severity": "HIGH",
            "phc_id": "phc-nmk-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0,
            "status": "ACTIVE",
        }),
    ]

    for doc_id, a in alerts:
        write_doc("alerts", doc_id, {
            "type": s(a["type"]),
            "severity": s(a["severity"]),
            "phc_id": s(a["phc_id"]),
            "medicine_id": s(a["medicine_id"]),
            "medicine_name": s(a["medicine_name"]),
            "days_to_stockout": n(a["days_to_stockout"]),
            "status": s(a["status"]),
        })

    # ---------------------------------------------------------
    # 7. TRANSFER RECOMMENDATIONS
    # ---------------------------------------------------------
    write_doc("transfers", "transfer-001", {
        "from_phc_id": s("phc-slm-1"),
        "to_phc_id": s("phc-nmk-1"),
        "medicine_id": s("med-slm-1-paracetamol"),
        "medicine_name": s("Paracetamol"),
        "quantity": n(300),
        "distance_km": n(95.4),
        "status": s("RECOMMENDED"),
    })

    write_doc("transfers", "transfer-002", {
        "from_phc_id": s("phc-erd-1"),
        "to_phc_id": s("phc-nmk-1"),
        "medicine_id": s("med-erd-1-iv-fluids"),
        "medicine_name": s("IV Fluids"),
        "quantity": n(100),
        "distance_km": n(72.1),
        "status": s("RECOMMENDED"),
    })

    # ---------------------------------------------------------
    # 8. FEDERATED MODEL
    # ---------------------------------------------------------
    nodes = {
        "Salem": obj({
            "slope": n(0.05),
            "status": s("STABLE"),
        }),
        "Namakkal": obj({
            "slope": n(11.93),
            "status": s("OUTBREAK"),
        }),
        "Erode": obj({
            "slope": n(-0.02),
            "status": s("STABLE"),
        }),
    }

    write_doc("federatedModels", "current", {
        "algorithm": s("FedAvg"),
        "status": s("ACTIVE"),
        "aggregator": s("Tamil Nadu Central Aggregator"),
        "global_trend": n(3.42),
        "outbreak_risk": b(True),
        "nodes": obj(nodes),
    })

    print("\nSeed complete.")
    print("Created/updated:")
    print("  countries: 5")
    print("  districts: 3")
    print("  phcs: 4")
    print("  medicines: 12")
    print("  diseaseReports: 21")
    print("  alerts: 3")
    print("  transfers: 2")
    print("  federatedModels: 1")
    print("\nOpen: http://127.0.0.1:4000/")
    print("Then open Firestore > Data to verify the collections.")

if __name__ == "__main__":
    seed()

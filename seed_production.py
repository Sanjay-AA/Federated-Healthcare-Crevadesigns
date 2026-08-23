#!/usr/bin/env python3
r"""
seed_production.py

Production Database Seeding Script for Creva Health / Federated Healthcare.
Target Project: federated-healthcare-3fcd3 (Production)

Usage:
  1. Set environment variable:
     Windows PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
     Windows CMD: set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
     Linux/macOS: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

  2. Dry Run (Preview without writing):
     python seed_production.py --dry-run

  3. Seed Production:
     python seed_production.py
"""

import os
import sys
import argparse
import random
from datetime import date, timedelta

PROJECT_ID = "federated-healthcare-3fcd3"
EXPECTED_COUNTS = {
    "countries": 5,
    "districts": 9,
    "phcs": 19,
    "medicines": 43,
    "diseaseReports": 63,
    "alerts": 9,
    "transfers": 4,
    "federatedModels": 1,
}

def make_reported_cases(phc_id, district, start_date_str="2026-08-06"):
    start = date.fromisoformat(start_date_str)
    cases_list = []
    for i in range(14):
        day = start + timedelta(days=i)
        if district in ["Namakkal", "Thrissur", "Pune"]:
            if i < 6:
                dengue = 2
                malaria = 1
            else:
                dengue = 2 + (i - 5) * 4
                malaria = 1 + (i - 5) * 2
        else:
            dengue = 1
            malaria = 0
            
        cases_list.append({
            "phc_id": str(phc_id),
            "date": day.strftime("%Y-%m-%d"),
            "dengue_cases": int(dengue),
            "malaria_cases": int(malaria)
        })
    return cases_list

def make_history(base_usage, district, start_date_str="2026-08-06"):
    start = date.fromisoformat(start_date_str)
    history_list = []
    for i, qty in enumerate(base_usage):
        day = start + timedelta(days=i)
        if district in ["Namakkal", "Thrissur", "Pune"]:
            if i < 6:
                dengue = 2
                malaria = 1
            else:
                dengue = 2 + (i - 5) * 4
                malaria = 1 + (i - 5) * 2
        else:
            dengue = 1
            malaria = 0
        history_list.append({
            "date": day.strftime("%b %d"),
            "quantity_used": int(qty),
            "dengue_cases": int(dengue),
            "malaria_cases": int(malaria)
        })
    return history_list

def build_seed_payloads():
    random.seed(42)
    payloads = {}

    # 1. Countries
    countries = [
        ("IN", {"code": "IN", "name": "India", "region": "Asia", "status": "ACTIVE"}),
        ("BR", {"code": "BR", "name": "Brazil", "region": "Americas", "status": "CONNECTED"}),
        ("RU", {"code": "RU", "name": "Russia", "region": "Europe", "status": "CONNECTED"}),
        ("CN", {"code": "CN", "name": "China", "region": "Asia", "status": "CONNECTED"}),
        ("ZA", {"code": "ZA", "name": "South Africa", "region": "Africa", "status": "CONNECTED"}),
    ]
    payloads["countries"] = countries

    # 2. Districts
    districts = [
        ("salem", {"name": "Salem", "state": "Tamil Nadu", "country_code": "IN", "node_code": "TN-SLM"}),
        ("erode", {"name": "Erode", "state": "Tamil Nadu", "country_code": "IN", "node_code": "TN-ERD"}),
        ("namakkal", {"name": "Namakkal", "state": "Tamil Nadu", "country_code": "IN", "node_code": "TN-NAM"}),
        ("ernakulam", {"name": "Ernakulam", "state": "Kerala", "country_code": "IN", "node_code": "KL-EKM"}),
        ("thrissur", {"name": "Thrissur", "state": "Kerala", "country_code": "IN", "node_code": "KL-TCR"}),
        ("kozhikode", {"name": "Kozhikode", "state": "Kerala", "country_code": "IN", "node_code": "KL-KKD"}),
        ("mumbai_suburban", {"name": "Mumbai Suburban", "state": "Maharashtra", "country_code": "IN", "node_code": "MH-MUB"}),
        ("pune", {"name": "Pune", "state": "Maharashtra", "country_code": "IN", "node_code": "MH-PUN"}),
        ("nagpur", {"name": "Nagpur", "state": "Maharashtra", "country_code": "IN", "node_code": "MH-NGP"}),
    ]
    payloads["districts"] = districts

    # 3. PHCs
    phcs_raw = [
        # Tamil Nadu PHCs
        {"id": "phc-slm-1", "name": "Salem Rural PHC", "district": "Salem", "state": "Tamil Nadu", "total_beds": 20, "occupied_beds": 8, "total_staff": 15, "staff_present_today": 14, "lat": 11.6643, "lng": 78.1460},
        {"id": "phc-erd-1", "name": "Erode Central PHC", "district": "Erode", "state": "Tamil Nadu", "total_beds": 25, "occupied_beds": 12, "total_staff": 18, "staff_present_today": 16, "lat": 11.3410, "lng": 77.7172},
        {"id": "phc-nmk-1", "name": "Namakkal Town PHC", "district": "Namakkal", "state": "Tamil Nadu", "total_beds": 30, "occupied_beds": 29, "total_staff": 20, "staff_present_today": 18, "lat": 11.2189, "lng": 78.1673},
        {"id": "phc-nmk-2", "name": "Senthamangalam PHC", "district": "Namakkal", "state": "Tamil Nadu", "total_beds": 15, "occupied_beds": 6, "total_staff": 10, "staff_present_today": 9, "lat": 11.2721, "lng": 78.2394},
        # Kerala PHCs
        {"id": "phc-ekm-1", "name": "Ernakulam Town PHC", "district": "Ernakulam", "state": "Kerala", "total_beds": 20, "occupied_beds": 10, "total_staff": 15, "staff_present_today": 13, "lat": 9.9816, "lng": 76.2999},
        {"id": "phc-ekm-2", "name": "Kochi Port PHC", "district": "Ernakulam", "state": "Kerala", "total_beds": 15, "occupied_beds": 5, "total_staff": 10, "staff_present_today": 9, "lat": 9.9650, "lng": 76.2700},
        {"id": "phc-tcr-1", "name": "Thrissur Central PHC", "district": "Thrissur", "state": "Kerala", "total_beds": 35, "occupied_beds": 33, "total_staff": 25, "staff_present_today": 23, "lat": 10.5276, "lng": 76.2144},
        {"id": "phc-tcr-2", "name": "Guruvayur PHC", "district": "Thrissur", "state": "Kerala", "total_beds": 20, "occupied_beds": 8, "total_staff": 12, "staff_present_today": 11, "lat": 10.5950, "lng": 76.0350},
        {"id": "phc-kkd-1", "name": "Kozhikode Beach PHC", "district": "Kozhikode", "state": "Kerala", "total_beds": 25, "occupied_beds": 12, "total_staff": 18, "staff_present_today": 17, "lat": 11.2588, "lng": 75.7804},
        {"id": "phc-kkd-2", "name": "Beypore PHC", "district": "Kozhikode", "state": "Kerala", "total_beds": 15, "occupied_beds": 7, "total_staff": 10, "staff_present_today": 9, "lat": 11.1780, "lng": 75.8150},
        # Maharashtra PHCs
        {"id": "phc-mub-1", "name": "Andheri Community PHC", "district": "Mumbai Suburban", "state": "Maharashtra", "total_beds": 30, "occupied_beds": 12, "total_staff": 20, "staff_present_today": 18, "lat": 19.1197, "lng": 72.8464},
        {"id": "phc-mub-2", "name": "Borivali Community PHC", "district": "Mumbai Suburban", "state": "Maharashtra", "total_beds": 25, "occupied_beds": 10, "total_staff": 15, "staff_present_today": 14, "lat": 19.2307, "lng": 72.8567},
        {"id": "phc-mub-3", "name": "Kurla Urban PHC", "district": "Mumbai Suburban", "state": "Maharashtra", "total_beds": 20, "occupied_beds": 8, "total_staff": 12, "staff_present_today": 11, "lat": 19.0728, "lng": 72.8797},
        {"id": "phc-pun-1", "name": "Pune Rural PHC", "district": "Pune", "state": "Maharashtra", "total_beds": 35, "occupied_beds": 33, "total_staff": 25, "staff_present_today": 23, "lat": 18.5204, "lng": 73.8567},
        {"id": "phc-pun-2", "name": "Hadapsar Community PHC", "district": "Pune", "state": "Maharashtra", "total_beds": 20, "occupied_beds": 9, "total_staff": 14, "staff_present_today": 12, "lat": 18.5089, "lng": 73.9260},
        {"id": "phc-pun-3", "name": "Kothrud Urban PHC", "district": "Pune", "state": "Maharashtra", "total_beds": 15, "occupied_beds": 6, "total_staff": 10, "staff_present_today": 9, "lat": 18.5074, "lng": 73.8077},
        {"id": "phc-ngp-1", "name": "Nagpur Central PHC", "district": "Nagpur", "state": "Maharashtra", "total_beds": 25, "occupied_beds": 11, "total_staff": 18, "staff_present_today": 16, "lat": 21.1458, "lng": 79.0882},
        {"id": "phc-ngp-2", "name": "Kamptee Community PHC", "district": "Nagpur", "state": "Maharashtra", "total_beds": 20, "occupied_beds": 7, "total_staff": 12, "staff_present_today": 11, "lat": 21.2234, "lng": 79.1989},
        {"id": "phc-ngp-3", "name": "Hingna Rural PHC", "district": "Nagpur", "state": "Maharashtra", "total_beds": 15, "occupied_beds": 5, "total_staff": 10, "staff_present_today": 9, "lat": 21.0667, "lng": 78.9667},
    ]
    phcs = []
    for p in phcs_raw:
        doc = {
            "name": p["name"],
            "district": p["district"],
            "state": p["state"],
            "total_beds": int(p["total_beds"]),
            "occupied_beds": int(p["occupied_beds"]),
            "total_staff": int(p["total_staff"]),
            "staff_present_today": int(p["staff_present_today"]),
            "country_code": "IN",
            "lat": float(p["lat"]),
            "lng": float(p["lng"]),
            "status": "ACTIVE",
            "reported_cases": make_reported_cases(p["id"], p["district"])
        }
        phcs.append((p["id"], doc))
    payloads["phcs"] = phcs

    # 4. Medicines
    medicines_raw = [
        # Salem Rural PHC
        {"medicine_id": "med-slm1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-slm-1", "unit": "Tablets", "current_stock": 850, "reorder_level": 100, "daily_consumption": 16, "predicted_days_remaining": 53, "status": "HEALTHY", "history": [15,18,14,16,15,17,18,16,15,16,17,15,16,18]},
        {"medicine_id": "med-slm1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-slm-1", "unit": "Bottles", "current_stock": 520, "reorder_level": 50, "daily_consumption": 4, "predicted_days_remaining": 130, "status": "HEALTHY", "history": [3,4,2,3,4,3,5,4,3,4,4,3,5,4]},
        {"medicine_id": "med-slm1-ors", "medicine_name": "ORS", "phc_id": "phc-slm-1", "unit": "Sachets", "current_stock": 340, "reorder_level": 50, "daily_consumption": 9, "predicted_days_remaining": 37, "status": "HEALTHY", "history": [8,10,7,9,8,11,9,10,8,9,10,8,9,11]},
        # Erode Central PHC
        {"medicine_id": "med-erd1-amoxicillin", "medicine_name": "Amoxicillin", "phc_id": "phc-erd-1", "unit": "Capsules", "current_stock": 600, "reorder_level": 100, "daily_consumption": 12, "predicted_days_remaining": 50, "status": "HEALTHY", "history": [5,6,5,7,6,8,7,6,7,8,7,6,8,7]},
        {"medicine_id": "med-erd1-azithromycin", "medicine_name": "Azithromycin", "phc_id": "phc-erd-1", "unit": "Tablets", "current_stock": 80, "reorder_level": 100, "daily_consumption": 25, "predicted_days_remaining": 3, "status": "LOW_STOCK", "history": [12,14,11,13,12,15,14,13,12,14,15,13,14,15]},
        {"medicine_id": "med-erd1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-erd-1", "unit": "Bottles", "current_stock": 460, "reorder_level": 50, "daily_consumption": 7, "predicted_days_remaining": 65, "status": "HEALTHY", "history": [5,6,5,7,6,8,7,6,7,8,7,6,8,7]},
        # Namakkal Town PHC
        {"medicine_id": "med-nmk1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-nmk-1", "unit": "Tablets", "current_stock": 45, "reorder_level": 200, "daily_consumption": 145, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [12,15,10,14,35,48,60,72,85,90,110,115,130,145]},
        {"medicine_id": "med-nmk1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-nmk-1", "unit": "Bottles", "current_stock": 12, "reorder_level": 100, "daily_consumption": 48, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [2,3,1,2,8,12,18,22,26,30,34,38,42,48]},
        {"medicine_id": "med-nmk1-ors", "medicine_name": "ORS", "phc_id": "phc-nmk-1", "unit": "Sachets", "current_stock": 180, "reorder_level": 100, "daily_consumption": 32, "predicted_days_remaining": 5, "status": "LOW_STOCK", "history": [5,8,6,7,10,12,15,18,20,22,25,28,30,32]},
        # Senthamangalam PHC
        {"medicine_id": "med-nmk2-metformin", "medicine_name": "Metformin", "phc_id": "phc-nmk-2", "unit": "Tablets", "current_stock": 400, "reorder_level": 100, "daily_consumption": 10, "predicted_days_remaining": 40, "status": "HEALTHY", "history": [12,13,11,12,13,14,12,13,14,13,12,14,13,14]},
        {"medicine_id": "med-nmk2-insulin", "medicine_name": "Insulin", "phc_id": "phc-nmk-2", "unit": "Vials", "current_stock": 50, "reorder_level": 30, "daily_consumption": 5, "predicted_days_remaining": 10, "status": "LOW_STOCK", "history": [3,3,2,4,3,4,3,3,4,3,4,3,4,4]},
        {"medicine_id": "med-nmk2-ibuprofen", "medicine_name": "Ibuprofen", "phc_id": "phc-nmk-2", "unit": "Tablets", "current_stock": 10, "reorder_level": 50, "daily_consumption": 15, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [7,8,6,8,7,9,8,7,8,9,8,7,9,8]},
        # Ernakulam Town PHC
        {"medicine_id": "med-ekm1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-ekm-1", "unit": "Tablets", "current_stock": 750, "reorder_level": 100, "daily_consumption": 15, "predicted_days_remaining": 50, "status": "HEALTHY", "history": [12,14,15,13,16,14,15,14,16,13,14,15,13,15]},
        {"medicine_id": "med-ekm1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-ekm-1", "unit": "Bottles", "current_stock": 450, "reorder_level": 50, "daily_consumption": 5, "predicted_days_remaining": 90, "status": "HEALTHY", "history": [3,4,3,4,5,4,3,4,5,4,3,4,4,5]},
        {"medicine_id": "med-ekm1-ors", "medicine_name": "ORS", "phc_id": "phc-ekm-1", "unit": "Sachets", "current_stock": 310, "reorder_level": 50, "daily_consumption": 8, "predicted_days_remaining": 38, "status": "HEALTHY", "history": [7,8,6,7,9,8,7,9,8,7,8,9,7,8]},
        # Kochi Port PHC
        {"medicine_id": "med-ekm2-amoxicillin", "medicine_name": "Amoxicillin", "phc_id": "phc-ekm-2", "unit": "Capsules", "current_stock": 500, "reorder_level": 80, "daily_consumption": 10, "predicted_days_remaining": 50, "status": "HEALTHY", "history": [8,9,8,10,9,8,9,10,9,8,9,10,8,10]},
        # Thrissur Central PHC
        {"medicine_id": "med-tcr1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-tcr-1", "unit": "Tablets", "current_stock": 50, "reorder_level": 200, "daily_consumption": 150, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [10,14,12,15,38,50,65,78,92,98,115,120,135,150]},
        {"medicine_id": "med-tcr1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-tcr-1", "unit": "Bottles", "current_stock": 15, "reorder_level": 100, "daily_consumption": 50, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [2,3,2,3,9,13,19,23,28,32,36,40,45,50]},
        {"medicine_id": "med-tcr1-ors", "medicine_name": "ORS", "phc_id": "phc-tcr-1", "unit": "Sachets", "current_stock": 170, "reorder_level": 100, "daily_consumption": 30, "predicted_days_remaining": 5, "status": "LOW_STOCK", "history": [4,7,5,6,9,11,14,17,19,21,24,27,29,30]},
        # Guruvayur PHC
        {"medicine_id": "med-tcr2-metformin", "medicine_name": "Metformin", "phc_id": "phc-tcr-2", "unit": "Tablets", "current_stock": 380, "reorder_level": 100, "daily_consumption": 8, "predicted_days_remaining": 47, "status": "HEALTHY", "history": [6,8,7,8,9,8,7,8,9,8,7,8,8,8]},
        {"medicine_id": "med-tcr2-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-tcr-2", "unit": "Tablets", "current_stock": 900, "reorder_level": 200, "daily_consumption": 20, "predicted_days_remaining": 45, "status": "HEALTHY", "history": [18,20,19,21,20,22,21,20,22,21,20,21,20,20]},
        {"medicine_id": "med-tcr2-iv", "medicine_name": "IV Fluids", "phc_id": "phc-tcr-2", "unit": "Bottles", "current_stock": 600, "reorder_level": 50, "daily_consumption": 4, "predicted_days_remaining": 150, "status": "HEALTHY", "history": [3,4,3,4,5,4,3,4,5,4,3,4,4,4]},
        # Kozhikode Beach PHC
        {"medicine_id": "med-kkd1-metformin", "medicine_name": "Metformin", "phc_id": "phc-kkd-1", "unit": "Tablets", "current_stock": 410, "reorder_level": 100, "daily_consumption": 12, "predicted_days_remaining": 34, "status": "HEALTHY", "history": [10,11,12,11,13,12,11,13,12,11,12,13,12,12]},
        {"medicine_id": "med-kkd1-insulin", "medicine_name": "Insulin", "phc_id": "phc-kkd-1", "unit": "Vials", "current_stock": 48, "reorder_level": 30, "daily_consumption": 4, "predicted_days_remaining": 12, "status": "HEALTHY", "history": [3,3,2,4,3,3,3,4,3,3,4,3,4,4]},
        # Beypore PHC
        {"medicine_id": "med-kkd2-ibuprofen", "medicine_name": "Ibuprofen", "phc_id": "phc-kkd-2", "unit": "Tablets", "current_stock": 10, "reorder_level": 50, "daily_consumption": 14, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [6,7,5,7,6,8,7,6,7,8,7,6,8,14]},
        # Maharashtra Medicines
        # Pune Rural PHC
        {"medicine_id": "med-pun1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-pun-1", "unit": "Tablets", "current_stock": 40, "reorder_level": 200, "daily_consumption": 140, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [10,14,12,15,36,48,62,75,88,95,110,118,130,140]},
        {"medicine_id": "med-pun1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-pun-1", "unit": "Bottles", "current_stock": 10, "reorder_level": 100, "daily_consumption": 45, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [2,3,2,3,9,13,19,23,28,32,36,40,45,50]},
        {"medicine_id": "med-pun1-ors", "medicine_name": "ORS", "phc_id": "phc-pun-1", "unit": "Sachets", "current_stock": 160, "reorder_level": 100, "daily_consumption": 30, "predicted_days_remaining": 5, "status": "LOW_STOCK", "history": [4,7,5,6,9,11,14,17,19,21,24,27,29,30]},
        # Hadapsar Community PHC (Surplus Donor)
        {"medicine_id": "med-pun2-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-pun-2", "unit": "Tablets", "current_stock": 850, "reorder_level": 200, "daily_consumption": 18, "predicted_days_remaining": 47, "status": "HEALTHY", "history": [15,17,16,18,17,19,18,17,18,19,18,17,18,18]},
        {"medicine_id": "med-pun2-iv", "medicine_name": "IV Fluids", "phc_id": "phc-pun-2", "unit": "Bottles", "current_stock": 550, "reorder_level": 50, "daily_consumption": 5, "predicted_days_remaining": 110, "status": "HEALTHY", "history": [3,4,3,4,5,4,3,4,5,4,3,4,4,5]},
        {"medicine_id": "med-pun2-amoxicillin", "medicine_name": "Amoxicillin", "phc_id": "phc-pun-2", "unit": "Capsules", "current_stock": 620, "reorder_level": 100, "daily_consumption": 10, "predicted_days_remaining": 62, "status": "HEALTHY", "history": [8,9,8,10,9,8,9,10,9,8,9,10,8,10]},
        # Kothrud Urban PHC
        {"medicine_id": "med-pun3-metformin", "medicine_name": "Metformin", "phc_id": "phc-pun-3", "unit": "Tablets", "current_stock": 420, "reorder_level": 100, "daily_consumption": 10, "predicted_days_remaining": 42, "status": "HEALTHY", "history": [9,10,11,10,12,11,10,12,11,10,11,12,11,10]},
        {"medicine_id": "med-pun3-insulin", "medicine_name": "Insulin", "phc_id": "phc-pun-3", "unit": "Vials", "current_stock": 55, "reorder_level": 30, "daily_consumption": 4, "predicted_days_remaining": 13, "status": "HEALTHY", "history": [3,3,2,4,3,3,3,4,3,3,4,3,4,4]},
        # Andheri Community PHC
        {"medicine_id": "med-mub1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-mub-1", "unit": "Tablets", "current_stock": 800, "reorder_level": 100, "daily_consumption": 16, "predicted_days_remaining": 50, "status": "HEALTHY", "history": [14,16,15,17,16,18,17,16,17,18,17,16,17,16]},
        {"medicine_id": "med-mub1-iv", "medicine_name": "IV Fluids", "phc_id": "phc-mub-1", "unit": "Bottles", "current_stock": 500, "reorder_level": 50, "daily_consumption": 5, "predicted_days_remaining": 100, "status": "HEALTHY", "history": [3,4,3,4,5,4,3,4,5,4,3,4,4,5]},
        {"medicine_id": "med-mub1-ors", "medicine_name": "ORS", "phc_id": "phc-mub-1", "unit": "Sachets", "current_stock": 350, "reorder_level": 50, "daily_consumption": 8, "predicted_days_remaining": 43, "status": "HEALTHY", "history": [7,8,6,7,9,8,7,9,8,7,8,9,7,8]},
        # Borivali Community PHC
        {"medicine_id": "med-mub2-amoxicillin", "medicine_name": "Amoxicillin", "phc_id": "phc-mub-2", "unit": "Capsules", "current_stock": 580, "reorder_level": 100, "daily_consumption": 11, "predicted_days_remaining": 52, "status": "HEALTHY", "history": [8,9,8,10,9,8,9,10,9,8,9,10,8,11]},
        {"medicine_id": "med-mub2-azithromycin", "medicine_name": "Azithromycin", "phc_id": "phc-mub-2", "unit": "Tablets", "current_stock": 85, "reorder_level": 100, "daily_consumption": 24, "predicted_days_remaining": 3, "status": "LOW_STOCK", "history": [11,13,10,12,11,14,13,12,11,13,14,12,13,14]},
        # Kurla Urban PHC
        {"medicine_id": "med-mub3-metformin", "medicine_name": "Metformin", "phc_id": "phc-mub-3", "unit": "Tablets", "current_stock": 390, "reorder_level": 100, "daily_consumption": 9, "predicted_days_remaining": 43, "status": "HEALTHY", "history": [8,9,8,9,10,9,8,9,10,9,8,9,8,9]},
        # Nagpur Central PHC
        {"medicine_id": "med-ngp1-paracetamol", "medicine_name": "Paracetamol", "phc_id": "phc-ngp-1", "unit": "Tablets", "current_stock": 780, "reorder_level": 100, "daily_consumption": 15, "predicted_days_remaining": 52, "status": "HEALTHY", "history": [13,15,14,16,15,17,16,15,16,17,16,15,16,15]},
        {"medicine_id": "med-ngp1-insulin", "medicine_name": "Insulin", "phc_id": "phc-ngp-1", "unit": "Vials", "current_stock": 50, "reorder_level": 30, "daily_consumption": 4, "predicted_days_remaining": 12, "status": "HEALTHY", "history": [3,3,2,4,3,3,3,4,3,3,4,3,4,4]},
        # Kamptee Community PHC
        {"medicine_id": "med-ngp2-ibuprofen", "medicine_name": "Ibuprofen", "phc_id": "phc-ngp-2", "unit": "Tablets", "current_stock": 12, "reorder_level": 50, "daily_consumption": 15, "predicted_days_remaining": 0, "status": "CRITICAL", "history": [6,7,5,7,6,8,7,6,7,8,7,6,8,15]},
        # Hingna Rural PHC
        {"medicine_id": "med-ngp3-ors", "medicine_name": "ORS", "phc_id": "phc-ngp-3", "unit": "Sachets", "current_stock": 300, "reorder_level": 50, "daily_consumption": 7, "predicted_days_remaining": 42, "status": "HEALTHY", "history": [6,7,5,6,8,7,6,8,7,6,7,8,6,7]},
    ]
    medicines = []
    for m in medicines_raw:
        phc_id = m["phc_id"]
        if "nmk" in phc_id:
            district, state = "Namakkal", "Tamil Nadu"
        elif "slm" in phc_id:
            district, state = "Salem", "Tamil Nadu"
        elif "erd" in phc_id:
            district, state = "Erode", "Tamil Nadu"
        elif "ekm" in phc_id:
            district, state = "Ernakulam", "Kerala"
        elif "tcr" in phc_id:
            district, state = "Thrissur", "Kerala"
        elif "kkd" in phc_id:
            district, state = "Kozhikode", "Kerala"
        elif "mub" in phc_id:
            district, state = "Mumbai Suburban", "Maharashtra"
        elif "pun" in phc_id:
            district, state = "Pune", "Maharashtra"
        elif "ngp" in phc_id:
            district, state = "Nagpur", "Maharashtra"
        else:
            district, state = "Erode", "Tamil Nadu"

        doc = {
            "medicine_id": m["medicine_id"],
            "medicine_name": m["medicine_name"],
            "name": m["medicine_name"],
            "phc_id": m["phc_id"],
            "district": district,
            "state": state,
            "unit": m["unit"],
            "current_stock": int(m["current_stock"]),
            "reorder_level": int(m["reorder_level"]),
            "daily_consumption": int(m["daily_consumption"]),
            "predicted_days_remaining": int(m["predicted_days_remaining"]),
            "status": m["status"],
            "consumption_history": make_history(m["history"], district)
        }
        medicines.append((m["medicine_id"], doc))
    payloads["medicines"] = medicines

    # 5. Disease Reports
    districts_geo = {
        "Salem": (11.6643, 78.1460, 15, "Tamil Nadu"),
        "Erode": (11.3410, 77.7172, 10, "Tamil Nadu"),
        "Namakkal": (11.2189, 78.1673, 20, "Tamil Nadu"),
        "Ernakulam": (9.9816, 76.2999, 12, "Kerala"),
        "Thrissur": (10.5276, 76.2144, 25, "Kerala"),
        "Kozhikode": (11.2588, 75.7804, 14, "Kerala"),
        "Mumbai Suburban": (19.1197, 72.8464, 14, "Maharashtra"),
        "Pune": (18.5204, 73.8567, 24, "Maharashtra"),
        "Nagpur": (21.1458, 79.0882, 12, "Maharashtra"),
    }
    diseases = ["Dengue", "Malaria", "Typhoid", "Influenza", "Acute Respiratory Infection"]
    report_id = 1
    start_report_date = date(2026, 8, 13)
    reports = []
    for dist_name, (lat, lng, base_cases, state_name) in districts_geo.items():
        for day_offset in range(7):
            current_date = start_report_date + timedelta(days=day_offset)
            if dist_name in ["Namakkal", "Thrissur", "Pune"]:
                cases = base_cases + (day_offset * 20) + random.randint(-5, 5)
                trend = "INCREASING"
                severity = "HIGH" if cases >= 70 else "MODERATE" if cases >= 40 else "LOW"
            else:
                cases = base_cases + random.randint(-3, 3)
                trend = "STABLE"
                severity = "LOW"
            
            disease = diseases[day_offset % len(diseases)]
            doc = {
                "district": dist_name,
                "state": state_name,
                "disease": disease,
                "reported_cases": int(cases),
                "date": current_date.strftime("%Y-%m-%d"),
                "severity": severity,
                "trend": trend,
                "latitude": float(lat),
                "longitude": float(lng)
            }
            reports.append((f"report-{report_id:03d}", doc))
            report_id += 1
    payloads["diseaseReports"] = reports

    # 6. Alerts
    alerts = [
        ("alert-001", {
            "type": "STOCK_OUT",
            "title": "Paracetamol Critical Stock-out Warning",
            "message": "Namakkal Town PHC is projected to run out of Paracetamol in 0 days.",
            "severity": "CRITICAL",
            "district": "Namakkal",
            "state": "Tamil Nadu",
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
            "state": "Tamil Nadu",
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
            "state": "Tamil Nadu",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-nmk-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        }),
        ("alert-004", {
            "type": "STOCK_OUT",
            "title": "Paracetamol Critical Stock-out Warning",
            "message": "Thrissur Central PHC is projected to run out of Paracetamol in 0 days.",
            "severity": "CRITICAL",
            "district": "Thrissur",
            "state": "Kerala",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-tcr-1",
            "medicine_id": "med-tcr1-paracetamol",
            "medicine_name": "Paracetamol",
            "days_to_stockout": 0
        }),
        ("alert-005", {
            "type": "DISEASE_SURGE",
            "title": "Dengue Outbreak Warning",
            "message": "Thrissur district exhibits a severe dengue surge trend.",
            "severity": "HIGH",
            "district": "Thrissur",
            "state": "Kerala",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-tcr-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        }),
        ("alert-006", {
            "type": "CAPACITY",
            "title": "Bed Capacity Warning",
            "message": "Thrissur Central PHC bed occupancy is at 94%.",
            "severity": "HIGH",
            "district": "Thrissur",
            "state": "Kerala",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-tcr-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        }),
        ("alert-007", {
            "type": "STOCK_OUT",
            "title": "Paracetamol Critical Stock-out Warning",
            "message": "Pune Rural PHC is projected to run out of Paracetamol in 0 days.",
            "severity": "CRITICAL",
            "district": "Pune",
            "state": "Maharashtra",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-pun-1",
            "medicine_id": "med-pun1-paracetamol",
            "medicine_name": "Paracetamol",
            "days_to_stockout": 0
        }),
        ("alert-008", {
            "type": "DISEASE_SURGE",
            "title": "Dengue Outbreak Warning",
            "message": "Pune district exhibits a severe dengue surge trend.",
            "severity": "HIGH",
            "district": "Pune",
            "state": "Maharashtra",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-pun-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        }),
        ("alert-009", {
            "type": "CAPACITY",
            "title": "Bed Capacity Warning",
            "message": "Pune Rural PHC bed occupancy is at 94%.",
            "severity": "HIGH",
            "district": "Pune",
            "state": "Maharashtra",
            "status": "ACTIVE",
            "created_at": "2026-08-20T12:00:00Z",
            "phc_id": "phc-pun-1",
            "medicine_id": "",
            "medicine_name": "",
            "days_to_stockout": 0
        })
    ]
    payloads["alerts"] = alerts

    # 7. Transfers
    transfers = [
        ("transfer-001", {
            "from_phc_id": "phc-slm-1",
            "to_phc_id": "phc-nmk-1",
            "medicine_id": "med-slm1-paracetamol",
            "medicine_name": "Paracetamol",
            "quantity": 300,
            "distance_km": 95.4,
            "status": "RECOMMENDED",
            "state": "Tamil Nadu"
        }),
        ("transfer-002", {
            "from_phc_id": "phc-erd-1",
            "to_phc_id": "phc-nmk-1",
            "medicine_id": "med-erd1-iv",
            "medicine_name": "IV Fluids",
            "quantity": 100,
            "distance_km": 72.1,
            "status": "RECOMMENDED",
            "state": "Tamil Nadu"
        }),
        ("transfer-003", {
            "from_phc_id": "phc-tcr-2",
            "to_phc_id": "phc-tcr-1",
            "medicine_id": "med-tcr2-paracetamol",
            "medicine_name": "Paracetamol",
            "quantity": 400,
            "distance_km": 24.5,
            "status": "RECOMMENDED",
            "state": "Kerala"
        }),
        ("transfer-004", {
            "from_phc_id": "phc-pun-2",
            "to_phc_id": "phc-pun-1",
            "medicine_id": "med-pun2-paracetamol",
            "medicine_name": "Paracetamol",
            "quantity": 350,
            "distance_km": 9.8,
            "status": "RECOMMENDED",
            "state": "Maharashtra"
        })
    ]
    payloads["transfers"] = transfers

    # 8. Federated Models
    nodes = {
        "Salem": {"slope": 0.05, "status": "STABLE"},
        "Namakkal": {"slope": 11.93, "status": "OUTBREAK"},
        "Erode": {"slope": -0.02, "status": "STABLE"},
        "Ernakulam": {"slope": 0.08, "status": "STABLE"},
        "Thrissur": {"slope": 12.45, "status": "OUTBREAK"},
        "Kozhikode": {"slope": -0.04, "status": "STABLE"},
        "Mumbai Suburban": {"slope": 0.06, "status": "STABLE"},
        "Pune": {"slope": 13.10, "status": "OUTBREAK"},
        "Nagpur": {"slope": -0.03, "status": "STABLE"}
    }
    federated_models = [
        ("current", {
            "algorithm": "FedAvg",
            "status": "ACTIVE",
            "aggregator": "India Central Aggregator",
            "global_trend": 4.81,
            "outbreak_risk": True,
            "nodes": nodes
        })
    ]
    payloads["federatedModels"] = federated_models

    return payloads

def main():
    parser = argparse.ArgumentParser(description="Seed Production Firestore Database for Creva Health")
    parser.add_argument("--dry-run", action="store_true", help="Preview seed operations without writing to Firestore")
    args = parser.parse_args()

    print("====================================================")
    print("Creva Health — Production Database Seeding Script")
    print(f"Target Project: {PROJECT_ID}")
    print("====================================================\n")

    payloads = build_seed_payloads()

    if args.dry_run:
        print("[DRY-RUN MODE ACTIVATED] No data will be written to Cloud Firestore.\n")
        print("Summary of data to be seeded:")
        total_items = 0
        for coll_name, items in payloads.items():
            count = len(items)
            total_items += count
            exp = EXPECTED_COUNTS.get(coll_name, count)
            status = "MATCH" if count == exp else f"MISMATCH (Expected: {exp})"
            print(f"  • {coll_name:<16}: {count:>3} documents [{status}]")
        print(f"\nTotal documents prepared: {total_items}")
        print("\nDry run completed successfully. Remove --dry-run to write to production.")
        return

    # Check for GOOGLE_APPLICATION_CREDENTIALS environment variable
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        print("ERROR: Environment variable GOOGLE_APPLICATION_CREDENTIALS is not set.")
        print("\nTo fix this:")
        print("1. Download your service account key JSON from Firebase Console:")
        print("   Project Settings -> Service Accounts -> Generate New Private Key")
        print("2. Set the environment variable in your terminal:")
        print("   Windows PowerShell : $env:GOOGLE_APPLICATION_CREDENTIALS='C:\\path\\to\\key.json'")
        print("   Windows CMD        : set GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\key.json")
        print("   Linux / macOS      : export GOOGLE_APPLICATION_CREDENTIALS='/path/to/key.json'")
        print("3. Re-run python seed_production.py\n")
        sys.exit(1)

    if not os.path.exists(cred_path):
        print(f"ERROR: Service account key file not found at path: {cred_path}")
        print("Please check the filepath and try again.")
        sys.exit(1)

    # Initialize Firebase Admin SDK
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("ERROR: Required Python packages 'firebase-admin' and 'google-cloud-firestore' are missing.")
        print("Install them by running: pip install firebase-admin google-cloud-firestore")
        sys.exit(1)

    try:
        cred = credentials.Certificate(cred_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
        db = firestore.client()
        print(f"✓ Connected to Firebase Admin SDK for project: '{PROJECT_ID}'\n")
    except Exception as e:
        print(f"ERROR: Failed to initialize Firebase Admin SDK: {e}")
        sys.exit(1)

    # Write documents to Cloud Firestore
    print("Writing documents to Cloud Firestore...")
    total_written = 0
    for coll_name, items in payloads.items():
        print(f"\n--- Seeding collection: {coll_name} ({len(items)} documents) ---")
        for doc_id, doc_data in items:
            try:
                db.collection(coll_name).document(doc_id).set(doc_data)
                print(f"  ✓ WRITE {coll_name}/{doc_id}")
                total_written += 1
            except Exception as write_err:
                print(f"  ✗ ERROR writing {coll_name}/{doc_id}: {write_err}")

    print("\n====================================================")
    print(f"Seeding completed. Total written: {total_written} documents.")
    print("====================================================\n")

    # Verification Step: Read document counts from production Firestore
    print("Verifying Production Firestore Database Counts...")
    actual_counts = {}
    has_warning = False

    for coll_name, exp_count in EXPECTED_COUNTS.items():
        try:
            docs = list(db.collection(coll_name).stream())
            actual = len(docs)
            actual_counts[coll_name] = actual
            if actual == exp_count:
                print(f"  ✓ {coll_name:<16}: {actual:>3} / {exp_count} docs [OK]")
            else:
                has_warning = True
                print(f"  ⚠️ {coll_name:<16}: {actual:>3} / {exp_count} docs [MISMATCH]")
        except Exception as read_err:
            has_warning = True
            print(f"  ✗ {coll_name:<16}: ERROR reading collection: {read_err}")

    print("\n====================================================")
    if has_warning:
        print("WARNING: Seeding completed, but one or more collection counts differed from expected values.")
        print("Please check your Cloud Firestore Security Rules or project permissions.")
    else:
        print("SUCCESS: All 8 collections seeded and verified with 100% exact match counts!")
    print("====================================================")

if __name__ == "__main__":
    main()

// Central Mock Data for Phase 1 - Creva Health PHC Inventory Portal

export const mockPHC = {
  id: "PHC-NAM-001",
  name: "Namakkal Town PHC",
  district: "Namakkal",
  state: "Tamil Nadu",
  officerName: "Raman Kumar",
  officerRole: "PHC Inventory Officer",
  status: "Operational",
  lastSync: "Today, 10:32 AM"
};

export const mockMedicines = [
  {
    id: "MED-001",
    name: "Paracetamol",
    currentStock: 750,
    dailyConsumption: 120,
    safetyStock: 300,
    status: "Healthy", // Healthy | Low | Critical
    unit: "Tablets",
    lastUpdated: "Today, 10:32 AM",
    description: "Analgesic and antipyretic medication used to treat mild to moderate pain and fever.",
    category: "Analgesic",
    shelfLocation: "Rack A-3",
    recentActivity: [
      { date: "Today", event: "Stock verified", detail: "750 Tablets", type: "verify" },
      { date: "Yesterday", event: "Stock updated", detail: "850 → 750 (Dispensed)", type: "update" },
      { date: "2 days ago", event: "Stock verified", detail: "900 Tablets", type: "verify" },
      { date: "5 days ago", event: "Stock received", detail: "500 Tablets received (Batch #PR-992)", type: "receive" }
    ]
  },
  {
    id: "MED-002",
    name: "ORS (Oral Rehydration Salts)",
    currentStock: 310,
    dailyConsumption: 80,
    safetyStock: 250,
    status: "Healthy",
    unit: "Sachets",
    lastUpdated: "Today, 09:45 AM",
    description: "Oral electrolyte mix used to treat dehydration caused by diarrhea or vomiting.",
    category: "Rehydration",
    shelfLocation: "Rack C-1",
    recentActivity: [
      { date: "Today, 09:45 AM", event: "Stock verified", detail: "310 Sachets", type: "verify" },
      { date: "Yesterday", event: "Stock updated", detail: "350 → 310 (Stock dispensing)", type: "update" }
    ]
  },
  {
    id: "MED-003",
    name: "Amoxicillin",
    currentStock: 120,
    dailyConsumption: 60,
    safetyStock: 200,
    status: "Critical",
    unit: "Capsules",
    lastUpdated: "Today, 09:20 AM",
    description: "Broad-spectrum penicillin antibiotic used to treat bacterial infections.",
    category: "Antibiotics",
    shelfLocation: "Rack B-2",
    recentActivity: [
      { date: "Today, 09:20 AM", event: "Low Stock Alert triggered", detail: "120 Capsules remaining", type: "alert" },
      { date: "Yesterday", event: "Stock updated", detail: "180 → 120 (Dispensed)", type: "update" }
    ]
  },
  {
    id: "MED-004",
    name: "Ibuprofen",
    currentStock: 180,
    dailyConsumption: 45,
    safetyStock: 150,
    status: "Low",
    unit: "Tablets",
    lastUpdated: "Yesterday",
    description: "Nonsteroidal anti-inflammatory drug (NSAID) used for treating pain, fever, and inflammation.",
    category: "Analgesic",
    shelfLocation: "Rack A-4",
    recentActivity: [
      { date: "Yesterday", event: "Stock verified", detail: "180 Tablets", type: "verify" },
      { date: "3 days ago", event: "Stock updated", detail: "220 → 180", type: "update" }
    ]
  },
  {
    id: "MED-005",
    name: "Metformin (500mg)",
    currentStock: 1200,
    dailyConsumption: 150,
    safetyStock: 500,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Today, 10:15 AM",
    description: "First-line medication for the treatment of type 2 diabetes.",
    category: "Anti-Diabetic",
    shelfLocation: "Rack D-1",
    recentActivity: [
      { date: "Today, 10:15 AM", event: "Stock verified", detail: "1200 Tablets", type: "verify" }
    ]
  },
  {
    id: "MED-006",
    name: "Amlodipine (5mg)",
    currentStock: 85,
    dailyConsumption: 40,
    safetyStock: 120,
    status: "Critical",
    unit: "Tablets",
    lastUpdated: "Yesterday",
    description: "Calcium channel blocker used to treat high blood pressure and chest pain.",
    category: "Cardiovascular",
    shelfLocation: "Rack D-3",
    recentActivity: [
      { date: "Yesterday", event: "Stock updated", detail: "125 → 85 (Dispensed)", type: "update" }
    ]
  },
  {
    id: "MED-007",
    name: "Cetirizine (10mg)",
    currentStock: 450,
    dailyConsumption: 50,
    safetyStock: 150,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "2 days ago",
    description: "Second-generation antihistamine used to treat hay fever, allergies, and angioedema.",
    category: "Antihistamine",
    shelfLocation: "Rack B-1",
    recentActivity: [
      { date: "2 days ago", event: "Stock verified", detail: "450 Tablets", type: "verify" }
    ]
  },
  {
    id: "MED-008",
    name: "Azithromycin (500mg)",
    currentStock: 90,
    dailyConsumption: 30,
    safetyStock: 100,
    status: "Low",
    unit: "Tablets",
    lastUpdated: "Today, 08:30 AM",
    description: "Macrolide antibiotic used for the treatment of a number of bacterial infections.",
    category: "Antibiotics",
    shelfLocation: "Rack B-3",
    recentActivity: [
      { date: "Today, 08:30 AM", event: "Stock verified", detail: "90 Tablets", type: "verify" }
    ]
  },
  {
    id: "MED-009",
    name: "Albendazole (400mg)",
    currentStock: 320,
    dailyConsumption: 10,
    safetyStock: 50,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "3 days ago",
    description: "Broad-spectrum anthelmintic medication used to treat various parasitic worm infestations.",
    category: "Anthelmintic",
    shelfLocation: "Rack E-2",
    recentActivity: []
  },
  {
    id: "MED-010",
    name: "Iron & Folic Acid",
    currentStock: 2500,
    dailyConsumption: 300,
    safetyStock: 800,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Today, 10:30 AM",
    description: "Supplement utilized to prevent and treat iron deficiency anemia, especially in pregnancy.",
    category: "Supplements",
    shelfLocation: "Rack F-1",
    recentActivity: [
      { date: "Today, 10:30 AM", event: "Stock verified", detail: "2500 Tablets", type: "verify" }
    ]
  },
  {
    id: "MED-011",
    name: "Zinc Sulphate (20mg)",
    currentStock: 65,
    dailyConsumption: 25,
    safetyStock: 80,
    status: "Low",
    unit: "Tablets",
    lastUpdated: "Yesterday",
    description: "Zinc supplement used alongside ORS in pediatric diarrheal management.",
    category: "Supplements",
    shelfLocation: "Rack F-2",
    recentActivity: []
  },
  {
    id: "MED-012",
    name: "Pantoprazole (40mg)",
    currentStock: 600,
    dailyConsumption: 70,
    safetyStock: 200,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Today, 10:10 AM",
    description: "Proton pump inhibitor used for treating gastroesophageal reflux disease and acid reflux.",
    category: "Gastrointestinal",
    shelfLocation: "Rack C-2",
    recentActivity: []
  },
  {
    id: "MED-013",
    name: "Salbutamol Inhaler",
    currentStock: 12,
    dailyConsumption: 4,
    safetyStock: 15,
    status: "Critical",
    unit: "Inhalers",
    lastUpdated: "Today, 09:00 AM",
    description: "Bronchodilator used to relieve bronchospasm in asthma and COPD.",
    category: "Respiratory",
    shelfLocation: "Rack G-1",
    recentActivity: [
      { date: "Today, 09:00 AM", event: "Critical Alert triggered", detail: "Only 12 Inhalers left", type: "alert" }
    ]
  },
  {
    id: "MED-014",
    name: "Metronidazole (400mg)",
    currentStock: 480,
    dailyConsumption: 60,
    safetyStock: 180,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "3 days ago",
    description: "Antibiotic and antiprotozoal medication used to treat pelvic inflammatory disease, endocarditis, and bacterial vaginosis.",
    category: "Antibiotics",
    shelfLocation: "Rack B-4",
    recentActivity: []
  },
  {
    id: "MED-015",
    name: "Dicyclomine (20mg)",
    currentStock: 230,
    dailyConsumption: 35,
    safetyStock: 100,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "2 days ago",
    description: "Antispasmodic medication used to treat spasms of the intestines such as in irritable bowel syndrome.",
    category: "Antispasmodic",
    shelfLocation: "Rack A-5",
    recentActivity: []
  },
  {
    id: "MED-016",
    name: "Omeprazole (20mg)",
    currentStock: 80,
    dailyConsumption: 45,
    safetyStock: 120,
    status: "Low",
    unit: "Capsules",
    lastUpdated: "Yesterday",
    description: "Proton pump inhibitor used to reduce stomach acid secretion.",
    category: "Gastrointestinal",
    shelfLocation: "Rack C-3",
    recentActivity: []
  },
  {
    id: "MED-017",
    name: "Ciprofloxacin (500mg)",
    currentStock: 350,
    dailyConsumption: 50,
    safetyStock: 150,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Yesterday",
    description: "Fluoroquinolone antibiotic used to treat a number of bacterial infections.",
    category: "Antibiotics",
    shelfLocation: "Rack B-5",
    recentActivity: []
  },
  {
    id: "MED-018",
    name: "Vitamin D3 (60K IU)",
    currentStock: 180,
    dailyConsumption: 15,
    safetyStock: 50,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "4 days ago",
    description: "Vitamin supplement crucial for bone health and calcium absorption.",
    category: "Supplements",
    shelfLocation: "Rack F-3",
    recentActivity: []
  },
  {
    id: "MED-019",
    name: "B-Complex",
    currentStock: 1400,
    dailyConsumption: 180,
    safetyStock: 400,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Today, 10:20 AM",
    description: "Combination of essential B vitamins used to support cellular metabolism and energy production.",
    category: "Supplements",
    shelfLocation: "Rack F-4",
    recentActivity: []
  },
  {
    id: "MED-020",
    name: "Paracetamol Syrup (125mg/5ml)",
    currentStock: 65,
    dailyConsumption: 20,
    safetyStock: 50,
    status: "Healthy",
    unit: "Bottles",
    lastUpdated: "Today, 09:30 AM",
    description: "Pediatric liquid formulation of paracetamol for fever and pain relief.",
    category: "Analgesic",
    shelfLocation: "Rack A-3 (Liquid)",
    recentActivity: []
  },
  {
    id: "MED-021",
    name: "ORS Liquid (Ready to Drink)",
    currentStock: 90,
    dailyConsumption: 30,
    safetyStock: 100,
    status: "Low",
    unit: "Tetrapacks",
    lastUpdated: "Yesterday",
    description: "Ready-to-drink formulation of oral rehydration salts.",
    category: "Rehydration",
    shelfLocation: "Rack C-1",
    recentActivity: []
  },
  {
    id: "MED-022",
    name: "Atorvastatin (10mg)",
    currentStock: 600,
    dailyConsumption: 40,
    safetyStock: 150,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "5 days ago",
    description: "Statin medication used to prevent cardiovascular disease and lower lipids.",
    category: "Cardiovascular",
    shelfLocation: "Rack D-2",
    recentActivity: []
  },
  {
    id: "MED-023",
    name: "Doxycycline (100mg)",
    currentStock: 150,
    dailyConsumption: 25,
    safetyStock: 80,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "Today, 08:45 AM",
    description: "Tetracycline antibiotic used to treat bacterial infections and malaria prophylaxis.",
    category: "Antibiotics",
    shelfLocation: "Rack B-6",
    recentActivity: []
  },
  {
    id: "MED-024",
    name: "Clopidogrel (75mg)",
    currentStock: 140,
    dailyConsumption: 30,
    safetyStock: 100,
    status: "Healthy",
    unit: "Tablets",
    lastUpdated: "2 days ago",
    description: "Antiplatelet medication used to reduce the risk of heart disease and stroke.",
    category: "Cardiovascular",
    shelfLocation: "Rack D-4",
    recentActivity: []
  }
];

export const mockInventoryHistory = [
  {
    id: "HIST-001",
    date: "Today, 10:32 AM",
    medicineId: "MED-001",
    medicineName: "Paracetamol",
    previousStock: 850,
    newStock: 750,
    change: -100,
    reason: "Routine verification",
    notes: "Physical stock matched. Recorded difference.",
    updatedBy: "Raman Kumar (PHC Officer)"
  },
  {
    id: "HIST-002",
    date: "Today, 09:45 AM",
    medicineId: "MED-002",
    medicineName: "ORS (Oral Rehydration Salts)",
    previousStock: 350,
    newStock: 310,
    change: -40,
    reason: "Stock dispensing",
    notes: "Daily distribution to clinics.",
    updatedBy: "Raman Kumar (PHC Officer)"
  },
  {
    id: "HIST-003",
    date: "Yesterday, 04:15 PM",
    medicineId: "MED-003",
    medicineName: "Amoxicillin",
    previousStock: 180,
    newStock: 120,
    change: -60,
    reason: "Stock dispensing",
    notes: "Prescriptions filled for outpatient ward.",
    updatedBy: "Raman Kumar (PHC Officer)"
  },
  {
    id: "HIST-004",
    date: "Yesterday, 11:30 AM",
    medicineId: "MED-006",
    medicineName: "Amlodipine (5mg)",
    previousStock: 125,
    newStock: 85,
    change: -40,
    reason: "Stock dispensing",
    notes: "Dispensed to NCD clinic patients.",
    updatedBy: "Raman Kumar (PHC Officer)"
  },
  {
    id: "HIST-005",
    date: "2 days ago, 10:00 AM",
    medicineId: "MED-005",
    medicineName: "Metformin (500mg)",
    previousStock: 1200,
    newStock: 1200,
    change: 0,
    reason: "Routine verification",
    notes: "Monthly physical stock verification.",
    updatedBy: "Raman Kumar (PHC Officer)"
  },
  {
    id: "HIST-006",
    date: "5 days ago, 02:20 PM",
    medicineId: "MED-001",
    medicineName: "Paracetamol",
    previousStock: 400,
    newStock: 900,
    change: 500,
    reason: "New stock received",
    notes: "Received shipment from district store.",
    updatedBy: "Raman Kumar (PHC Officer)"
  }
];

export const mockNotifications = [
  {
    id: "NOTIF-001",
    type: "critical", // critical | warning | info
    title: "Critical Stock Alert",
    message: "Amoxicillin is critically low.",
    detail: "Current stock is 120 Capsules (Safety Stock: 200).",
    time: "Today, 09:20 AM",
    read: false
  },
  {
    id: "NOTIF-002",
    type: "critical",
    title: "Critical Stock Alert",
    message: "Salbutamol Inhaler is critically low.",
    detail: "Current stock is 12 Inhalers (Safety Stock: 15).",
    time: "Today, 09:00 AM",
    read: false
  },
  {
    id: "NOTIF-003",
    type: "warning",
    title: "Low Stock Alert",
    message: "Ibuprofen is low.",
    detail: "Current stock is 180 Tablets (Safety Stock: 150).",
    time: "Yesterday, 05:00 PM",
    read: true
  },
  {
    id: "NOTIF-004",
    type: "info",
    title: "Stock Verified",
    message: "Paracetamol inventory was updated.",
    detail: "Recorded stock: 750 Tablets.",
    time: "Today, 10:32 AM",
    read: true
  }
];

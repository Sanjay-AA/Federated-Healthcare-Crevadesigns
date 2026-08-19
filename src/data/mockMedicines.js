export const mockMedicines = [
  // ==========================================
  // PHC 1: Namakkal Town PHC (phc-nmk-1) - CRITICAL SURGE
  // ==========================================
  {
    id: "med-nmk1-para",
    phc_id: "phc-nmk-1",
    name: "Paracetamol",
    unit: "Tablets",
    current_stock: 45,
    consumption_history: [
      { date: "Aug 06", quantity_used: 12 },
      { date: "Aug 07", quantity_used: 15 },
      { date: "Aug 08", quantity_used: 10 },
      { date: "Aug 09", quantity_used: 14 },
      { date: "Aug 10", quantity_used: 35 }, // Heavy rain starts, waterlogging begins
      { date: "Aug 11", quantity_used: 48 },
      { date: "Aug 12", quantity_used: 60 },
      { date: "Aug 13", quantity_used: 72 },
      { date: "Aug 14", quantity_used: 85 },
      { date: "Aug 15", quantity_used: 90 },
      { date: "Aug 16", quantity_used: 110 },
      { date: "Aug 17", quantity_used: 115 },
      { date: "Aug 18", quantity_used: 130 },
      { date: "Aug 19", quantity_used: 145 } // Peak outbreak demand
    ]
  },
  {
    id: "med-nmk1-iv",
    phc_id: "phc-nmk-1",
    name: "IV Fluids",
    unit: "Bottles",
    current_stock: 12,
    consumption_history: [
      { date: "Aug 06", quantity_used: 2 },
      { date: "Aug 07", quantity_used: 3 },
      { date: "Aug 08", quantity_used: 1 },
      { date: "Aug 09", quantity_used: 2 },
      { date: "Aug 10", quantity_used: 8 },  // Outbreak starts
      { date: "Aug 11", quantity_used: 12 },
      { date: "Aug 12", quantity_used: 18 },
      { date: "Aug 13", quantity_used: 22 },
      { date: "Aug 14", quantity_used: 26 },
      { date: "Aug 15", quantity_used: 30 },
      { date: "Aug 16", quantity_used: 34 },
      { date: "Aug 17", quantity_used: 38 },
      { date: "Aug 18", quantity_used: 42 },
      { date: "Aug 19", quantity_used: 48 }  // Severe surge, stock depleted
    ]
  },
  {
    id: "med-nmk1-ors",
    phc_id: "phc-nmk-1",
    name: "ORS",
    unit: "Sachets",
    current_stock: 180,
    consumption_history: [
      { date: "Aug 06", quantity_used: 5 },
      { date: "Aug 07", quantity_used: 8 },
      { date: "Aug 08", quantity_used: 6 },
      { date: "Aug 09", quantity_used: 7 },
      { date: "Aug 10", quantity_used: 10 },
      { date: "Aug 11", quantity_used: 12 },
      { date: "Aug 12", quantity_used: 15 },
      { date: "Aug 13", quantity_used: 18 },
      { date: "Aug 14", quantity_used: 20 },
      { date: "Aug 15", quantity_used: 22 },
      { date: "Aug 16", quantity_used: 25 },
      { date: "Aug 17", quantity_used: 28 },
      { date: "Aug 18", quantity_used: 30 },
      { date: "Aug 19", quantity_used: 32 }
    ]
  },

  // ==========================================
  // PHC 2: Salem Rural PHC (phc-slm-1) - STABLE
  // ==========================================
  {
    id: "med-slm1-para",
    phc_id: "phc-slm-1",
    name: "Paracetamol",
    unit: "Tablets",
    current_stock: 850,
    consumption_history: [
      { date: "Aug 06", quantity_used: 15 },
      { date: "Aug 07", quantity_used: 18 },
      { date: "Aug 08", quantity_used: 14 },
      { date: "Aug 09", quantity_used: 16 },
      { date: "Aug 10", quantity_used: 15 },
      { date: "Aug 11", quantity_used: 17 },
      { date: "Aug 12", quantity_used: 18 },
      { date: "Aug 13", quantity_used: 16 },
      { date: "Aug 14", quantity_used: 15 },
      { date: "Aug 15", quantity_used: 16 },
      { date: "Aug 16", quantity_used: 17 },
      { date: "Aug 17", quantity_used: 15 },
      { date: "Aug 18", quantity_used: 16 },
      { date: "Aug 19", quantity_used: 18 }
    ]
  },
  {
    id: "med-slm1-iv",
    phc_id: "phc-slm-1",
    name: "IV Fluids",
    unit: "Bottles",
    current_stock: 520,
    consumption_history: [
      { date: "Aug 06", quantity_used: 3 },
      { date: "Aug 07", quantity_used: 4 },
      { date: "Aug 08", quantity_used: 2 },
      { date: "Aug 09", quantity_used: 3 },
      { date: "Aug 10", quantity_used: 4 },
      { date: "Aug 11", quantity_used: 3 },
      { date: "Aug 12", quantity_used: 5 },
      { date: "Aug 13", quantity_used: 4 },
      { date: "Aug 14", quantity_used: 3 },
      { date: "Aug 15", quantity_used: 4 },
      { date: "Aug 16", quantity_used: 4 },
      { date: "Aug 17", quantity_used: 3 },
      { date: "Aug 18", quantity_used: 5 },
      { date: "Aug 19", quantity_used: 4 }
    ]
  },
  {
    id: "med-slm1-ors",
    phc_id: "phc-slm-1",
    name: "ORS",
    unit: "Sachets",
    current_stock: 340,
    consumption_history: [
      { date: "Aug 06", quantity_used: 8 },
      { date: "Aug 07", quantity_used: 10 },
      { date: "Aug 08", quantity_used: 7 },
      { date: "Aug 09", quantity_used: 9 },
      { date: "Aug 10", quantity_used: 8 },
      { date: "Aug 11", quantity_used: 11 },
      { date: "Aug 12", quantity_used: 9 },
      { date: "Aug 13", quantity_used: 10 },
      { date: "Aug 14", quantity_used: 8 },
      { date: "Aug 15", quantity_used: 9 },
      { date: "Aug 16", quantity_used: 10 },
      { date: "Aug 17", quantity_used: 8 },
      { date: "Aug 18", quantity_used: 9 },
      { date: "Aug 19", quantity_used: 11 }
    ]
  },

  // ==========================================
  // PHC 3: Erode Central PHC (phc-erd-1) - STABLE
  // ==========================================
  {
    id: "med-erd1-para",
    phc_id: "phc-erd-1",
    name: "Paracetamol",
    unit: "Tablets",
    current_stock: 750,
    consumption_history: [
      { date: "Aug 06", quantity_used: 20 },
      { date: "Aug 07", quantity_used: 22 },
      { date: "Aug 08", quantity_used: 19 },
      { date: "Aug 09", quantity_used: 21 },
      { date: "Aug 10", quantity_used: 20 },
      { date: "Aug 11", quantity_used: 23 },
      { date: "Aug 12", quantity_used: 22 },
      { date: "Aug 13", quantity_used: 20 },
      { date: "Aug 14", quantity_used: 21 },
      { date: "Aug 15", quantity_used: 24 },
      { date: "Aug 16", quantity_used: 22 },
      { date: "Aug 17", quantity_used: 21 },
      { date: "Aug 18", quantity_used: 23 },
      { date: "Aug 19", quantity_used: 22 }
    ]
  },
  {
    id: "med-erd1-iv",
    phc_id: "phc-erd-1",
    name: "IV Fluids",
    unit: "Bottles",
    current_stock: 460,
    consumption_history: [
      { date: "Aug 06", quantity_used: 5 },
      { date: "Aug 07", quantity_used: 6 },
      { date: "Aug 08", quantity_used: 5 },
      { date: "Aug 09", quantity_used: 7 },
      { date: "Aug 10", quantity_used: 6 },
      { date: "Aug 11", quantity_used: 8 },
      { date: "Aug 12", quantity_used: 7 },
      { date: "Aug 13", quantity_used: 6 },
      { date: "Aug 14", quantity_used: 7 },
      { date: "Aug 15", quantity_used: 8 },
      { date: "Aug 16", quantity_used: 7 },
      { date: "Aug 17", quantity_used: 6 },
      { date: "Aug 18", quantity_used: 8 },
      { date: "Aug 19", quantity_used: 7 }
    ]
  },
  {
    id: "med-erd1-ors",
    phc_id: "phc-erd-1",
    name: "ORS",
    unit: "Sachets",
    current_stock: 310,
    consumption_history: [
      { date: "Aug 06", quantity_used: 12 },
      { date: "Aug 07", quantity_used: 14 },
      { date: "Aug 08", quantity_used: 11 },
      { date: "Aug 09", quantity_used: 13 },
      { date: "Aug 10", quantity_used: 12 },
      { date: "Aug 11", quantity_used: 15 },
      { date: "Aug 12", quantity_used: 14 },
      { date: "Aug 13", quantity_used: 13 },
      { date: "Aug 14", quantity_used: 12 },
      { date: "Aug 15", quantity_used: 14 },
      { date: "Aug 16", quantity_used: 15 },
      { date: "Aug 17", quantity_used: 13 },
      { date: "Aug 18", quantity_used: 14 },
      { date: "Aug 19", quantity_used: 15 }
    ]
  },

  // ==========================================
  // PHC 4: Senthamangalam PHC (phc-nmk-2) - MODERATE
  // ==========================================
  {
    id: "med-nmk2-para",
    phc_id: "phc-nmk-2",
    name: "Paracetamol",
    unit: "Tablets",
    current_stock: 310,
    consumption_history: [
      { date: "Aug 06", quantity_used: 8 },
      { date: "Aug 07", quantity_used: 10 },
      { date: "Aug 08", quantity_used: 7 },
      { date: "Aug 09", quantity_used: 9 },
      { date: "Aug 10", quantity_used: 12 },
      { date: "Aug 11", quantity_used: 14 },
      { date: "Aug 12", quantity_used: 18 },
      { date: "Aug 13", quantity_used: 20 },
      { date: "Aug 14", quantity_used: 22 },
      { date: "Aug 15", quantity_used: 25 },
      { date: "Aug 16", quantity_used: 28 },
      { date: "Aug 17", quantity_used: 30 },
      { date: "Aug 18", quantity_used: 32 },
      { date: "Aug 19", quantity_used: 35 } // Moderate uptick due to regional proximity to Namakkal Town
    ]
  },
  {
    id: "med-nmk2-iv",
    phc_id: "phc-nmk-2",
    name: "IV Fluids",
    unit: "Bottles",
    current_stock: 140,
    consumption_history: [
      { date: "Aug 06", quantity_used: 1 },
      { date: "Aug 07", quantity_used: 2 },
      { date: "Aug 08", quantity_used: 1 },
      { date: "Aug 09", quantity_used: 2 },
      { date: "Aug 10", quantity_used: 3 },
      { date: "Aug 11", quantity_used: 4 },
      { date: "Aug 12", quantity_used: 5 },
      { date: "Aug 13", quantity_used: 6 },
      { date: "Aug 14", quantity_used: 8 },
      { date: "Aug 15", quantity_used: 9 },
      { date: "Aug 16", quantity_used: 11 },
      { date: "Aug 17", quantity_used: 12 },
      { date: "Aug 18", quantity_used: 14 },
      { date: "Aug 19", quantity_used: 16 }
    ]
  },
  {
    id: "med-nmk2-ors",
    phc_id: "phc-nmk-2",
    name: "ORS",
    unit: "Sachets",
    current_stock: 195,
    consumption_history: [
      { date: "Aug 06", quantity_used: 4 },
      { date: "Aug 07", quantity_used: 5 },
      { date: "Aug 08", quantity_used: 3 },
      { date: "Aug 09", quantity_used: 4 },
      { date: "Aug 10", quantity_used: 5 },
      { date: "Aug 11", quantity_used: 6 },
      { date: "Aug 12", quantity_used: 8 },
      { date: "Aug 13", quantity_used: 9 },
      { date: "Aug 14", quantity_used: 10 },
      { date: "Aug 15", quantity_used: 11 },
      { date: "Aug 16", quantity_used: 13 },
      { date: "Aug 17", quantity_used: 14 },
      { date: "Aug 18", quantity_used: 16 },
      { date: "Aug 19", quantity_used: 18 }
    ]
  }
];

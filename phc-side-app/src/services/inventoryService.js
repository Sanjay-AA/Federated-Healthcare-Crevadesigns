// Inventory Service Layer - Refactored for Phase 3 (Firestore READ & WRITE)
// Connects to the same Firestore database used by the Command Center.

import { doc, getDoc, collection, getDocs, query, where, runTransaction, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { mockNotifications } from '../data/mockData';

const PHC_TARGET_ID = "phc-nmk-1"; // Namakkal Town PHC Document ID from seed data

// Initialize local storage keys for alerts
const KEYS = {
  NOTIFS: 'creva_phc_notifications'
};

const initLocalFallbacks = () => {
  if (typeof localStorage !== 'undefined') {
    if (!localStorage.getItem(KEYS.NOTIFS)) {
      localStorage.setItem(KEYS.NOTIFS, JSON.stringify(mockNotifications));
    }
  }
};
initLocalFallbacks();

export const inventoryService = {
  // Get PHC Information from Firestore
  getPHCIdentity: async () => {
    try {
      console.log(`[Firestore READ] Fetching PHC doc: phcs/${PHC_TARGET_ID}`);
      const docRef = doc(db, "phcs", PHC_TARGET_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "Not available",
          district: data.district || "Not available",
          state: data.state || "Not available",
          officerName: "Raman Kumar", // Default fallback (not in seed schema)
          officerRole: "PHC Inventory Officer",
          status: data.status === "ACTIVE" ? "Operational" : (data.status || "Not available"),
          lastSync: "Today, 10:32 AM"
        };
      } else {
        throw new Error(`PHC identity document ${PHC_TARGET_ID} does not exist in Firestore.`);
      }
    } catch (err) {
      console.error(`[Firestore ERROR] getPHCIdentity failed:`, err);
      throw err; // Throw to trigger UI error states
    }
  },

  // Get list of all medicines for targeted PHC from Firestore
  getMedicines: async () => {
    try {
      console.log(`[Firestore READ] Fetching medicines where phc_id == ${PHC_TARGET_ID}`);
      const q = query(collection(db, "medicines"), where("phc_id", "==", PHC_TARGET_ID));
      const querySnapshot = await getDocs(q);
      
      const list = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        let uiStatus = "Healthy";
        if (data.status === "CRITICAL") {
          uiStatus = "Critical";
        } else if (data.status === "LOW_STOCK") {
          uiStatus = "Low";
        }

        list.push({
          id: doc.id, // e.g. "med-nmk1-paracetamol"
          name: data.medicine_name || "Not available",
          currentStock: Number(data.current_stock ?? 0),
          dailyConsumption: Number(data.daily_consumption ?? 0),
          safetyStock: Number(data.reorder_level ?? 0),
          status: uiStatus,
          unit: data.unit || "Tablets",
          lastUpdated: data.last_updated || "Today, 10:32 AM",
          category: data.category || "General",
          shelfLocation: "Not available",
          description: data.description || "Not available",
          recentActivity: []
        });
      });
      
      return list;
    } catch (err) {
      console.error(`[Firestore ERROR] getMedicines failed:`, err);
      throw err;
    }
  },

  // Get detail of a specific medicine by ID from Firestore
  getMedicineById: async (id) => {
    try {
      console.log(`[Firestore READ] Fetching medicine doc: medicines/${id}`);
      const docRef = doc(db, "medicines", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        let uiStatus = "Healthy";
        if (data.status === "CRITICAL") {
          uiStatus = "Critical";
        } else if (data.status === "LOW_STOCK") {
          uiStatus = "Low";
        }

        // Fetch recent history logs for this medicine from Firestore
        const recentActivity = [];
        try {
          const q = query(
            collection(db, "inventoryHistory"), 
            where("medicine_id", "==", id)
          );
          const histSnap = await getDocs(q);
          const historyLogs = [];
          histSnap.forEach(hDoc => {
            historyLogs.push({ id: hDoc.id, ...hDoc.data() });
          });
          
          // Sort by updated_at desc
          historyLogs.sort((a,b) => {
            const timeA = a.updated_at?.toDate().getTime() || 0;
            const timeB = b.updated_at?.toDate().getTime() || 0;
            return timeB - timeA;
          });

          historyLogs.slice(0, 4).forEach((log) => {
            let dateLabel = "Recently";
            if (log.updated_at) {
              const jsDate = log.updated_at.toDate();
              dateLabel = jsDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            recentActivity.push({
              date: dateLabel,
              event: log.reason || "Stock update",
              detail: `${log.previous_stock} → ${log.new_stock} ${data.unit || 'Tablets'} (${log.notes || 'No notes'})`,
              type: log.change > 0 ? "receive" : "update"
            });
          });
        } catch (hErr) {
          console.error("Failed to query history logs for medicine details, using fallback:", hErr);
        }

        // If no history logs in DB, fallback to seeded consumption_history
        if (recentActivity.length === 0 && Array.isArray(data.consumption_history)) {
          data.consumption_history.slice(-4).reverse().forEach((usage) => {
            recentActivity.push({
              date: usage.date || "Past date",
              event: "Dispensed",
              detail: `${usage.quantity_used || 0} ${data.unit || 'Tablets'} consumed`,
              type: "update"
            });
          });
        }

        return {
          id: docSnap.id,
          name: data.medicine_name || "Not available",
          currentStock: Number(data.current_stock ?? 0),
          dailyConsumption: Number(data.daily_consumption ?? 0),
          safetyStock: Number(data.reorder_level ?? 0),
          status: uiStatus,
          unit: data.unit || "Tablets",
          lastUpdated: data.last_updated || "Today, 10:32 AM",
          category: data.category || "General",
          shelfLocation: "Not available",
          description: data.description || "Not available",
          recentActivity: recentActivity
        };
      } else {
        throw new Error(`Medicine detail document ${id} does not exist in Firestore.`);
      }
    } catch (err) {
      console.error(`[Firestore ERROR] getMedicineById failed:`, err);
      throw err;
    }
  },

  // Update physical stock of a medicine using a secure Firestore transaction
  updatePhysicalStock: async (id, physicalCount, reason, notes = "") => {
    try {
      const countNum = Number(physicalCount);
      if (physicalCount === '' || isNaN(countNum) || countNum < 0 || !Number.isInteger(countNum)) {
        throw new Error("Invalid stock quantity. Physical count must be a non-negative whole number.");
      }

      const medicineRef = doc(db, "medicines", id);
      
      console.log(`[Firestore TX] Initializing transaction for update: medicines/${id}`);

      let prevStockVal = 0;
      let newStockVal = countNum;
      let medNameVal = "Paracetamol";
      let medUnitVal = "Tablets";

      await runTransaction(db, async (transaction) => {
        const medDoc = await transaction.get(medicineRef);
        if (!medDoc.exists()) {
          throw new Error(`Medicine document ${id} not found.`);
        }

        const data = medDoc.data();
        prevStockVal = Number(data.current_stock ?? 0);
        medNameVal = data.medicine_name || data.name || "Paracetamol";
        medUnitVal = data.unit || "Tablets";
        
        const reorderLevel = Number(data.reorder_level ?? 0);

        // Calculate status to match Command Center schema constraints
        let newStatus = "HEALTHY";
        if (countNum <= 0.6 * reorderLevel) {
          newStatus = "CRITICAL";
        } else if (countNum <= reorderLevel) {
          newStatus = "LOW_STOCK";
        }

        const dateStr = `Today, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

        // 1. Update stock levels and status on medicine
        transaction.update(medicineRef, {
          current_stock: countNum,
          status: newStatus,
          last_updated: dateStr
        });

        // 2. Append history transaction audit log
        const newHistDocRef = doc(collection(db, "inventoryHistory"));
        const changeOffset = countNum - prevStockVal;

        transaction.set(newHistDocRef, {
          phc_id: PHC_TARGET_ID,
          phc_name: "Namakkal Town PHC",
          medicine_id: id,
          medicine_name: medNameVal,
          previous_stock: prevStockVal,
          new_stock: countNum,
          change: changeOffset,
          reason: reason,
          notes: notes,
          updated_by: "Raman Kumar (PHC Inventory Officer)",
          updated_at: serverTimestamp()
        });
      });

      console.log(`[Firestore TX SUCCESS] Mapped physical count to ${newStockVal} on ${medNameVal}`);
      
      // Update local storage alerts based on status change for Phase 3 UI alerts sync
      if (typeof localStorage !== 'undefined') {
        const notifications = JSON.parse(localStorage.getItem(KEYS.NOTIFS)) || [];
        const dateStr = `Today, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        
        // Load current threshold to trigger alert
        const updatedMedSnap = await getDoc(medicineRef);
        const updatedMedData = updatedMedSnap.data();
        const reorderLevel = Number(updatedMedData.reorder_level ?? 0);
        
        let updatedNotifications = [...notifications];
        if (countNum <= 0.6 * reorderLevel) {
          const newAlert = {
            id: `NOTIF-${Date.now()}`,
            type: "critical",
            title: `Critical Stock Alert`,
            message: `${medNameVal} is critically low.`,
            detail: `Current stock is ${countNum} ${medUnitVal} (Safety Stock: ${reorderLevel}).`,
            time: dateStr,
            read: false
          };
          updatedNotifications = [newAlert, ...updatedNotifications];
        } else if (countNum <= reorderLevel) {
          const newAlert = {
            id: `NOTIF-${Date.now()}`,
            type: "warning",
            title: `Low Stock Alert`,
            message: `${medNameVal} is low.`,
            detail: `Current stock is ${countNum} ${medUnitVal} (Safety Stock: ${reorderLevel}).`,
            time: dateStr,
            read: false
          };
          updatedNotifications = [newAlert, ...updatedNotifications];
        }
        localStorage.setItem(KEYS.NOTIFS, JSON.stringify(updatedNotifications));
      }

      return {
        medicine: {
          id: id,
          name: medNameVal,
          currentStock: newStockVal,
          unit: medUnitVal
        },
        history: {
          previousStock: prevStockVal,
          newStock: newStockVal
        }
      };
    } catch (err) {
      console.error(`[Firestore TX ERROR] updatePhysicalStock failed:`, err);
      throw err;
    }
  },

  // Get history logs directly from Firestore
  getHistory: async () => {
    try {
      console.log(`[Firestore READ] Fetching inventoryHistory logs`);
      const q = query(collection(db, "inventoryHistory"), orderBy("updated_at", "desc"));
      const querySnapshot = await getDocs(q);

      const logs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        let dateStr = "Recently";
        if (data.updated_at) {
          const jsDate = data.updated_at.toDate();
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          const isToday = jsDate.toDateString() === today.toDateString();
          const isYesterday = jsDate.toDateString() === yesterday.toDateString();

          const timeStr = jsDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          if (isToday) {
            dateStr = `Today, ${timeStr}`;
          } else if (isYesterday) {
            dateStr = `Yesterday, ${timeStr}`;
          } else {
            dateStr = `${jsDate.toLocaleDateString()} ${timeStr}`;
          }
        }

        logs.push({
          id: doc.id,
          date: dateStr,
          medicineId: data.medicine_id || "",
          medicineName: data.medicine_name || "Not available",
          previousStock: Number(data.previous_stock ?? 0),
          newStock: Number(data.new_stock ?? 0),
          change: Number(data.change ?? 0),
          reason: data.reason || "Routine verification",
          notes: data.notes || "",
          updatedBy: data.updated_by || "PHC Officer"
        });
      });

      return logs;
    } catch (err) {
      console.error(`[Firestore ERROR] getHistory failed:`, err);
      return [];
    }
  },

  // Get active notifications (read-only alerts from local storage)
  getNotifications: async () => {
    if (typeof localStorage !== 'undefined') {
      return JSON.parse(localStorage.getItem(KEYS.NOTIFS)) || [];
    }
    return [];
  },

  // Mark all or single notification as read
  markNotificationAsRead: async (id) => {
    if (typeof localStorage !== 'undefined') {
      const notifications = JSON.parse(localStorage.getItem(KEYS.NOTIFS)) || [];
      const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(KEYS.NOTIFS, JSON.stringify(updated));
      return updated;
    }
    return [];
  },

  // Clear notifications
  clearAllNotifications: async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.NOTIFS, JSON.stringify([]));
    }
    return [];
  }
};

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";

export async function getCountries() {
  const snapshot = await getDocs(collection(db, "countries"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getDistricts() {
  const snapshot = await getDocs(collection(db, "districts"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getPHCs() {
  const snapshot = await getDocs(collection(db, "phcs"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getMedicines() {
  const snapshot = await getDocs(collection(db, "medicines"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getAlerts() {
  const snapshot = await getDocs(collection(db, "alerts"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getDiseaseReports() {
  const snapshot = await getDocs(
    collection(db, "diseaseReports")
  );

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getTransfers() {
  const snapshot = await getDocs(
    collection(db, "transfers")
  );

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getFederatedModel() {
  const snapshot = await getDocs(
    collection(db, "federatedModels")
  );

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
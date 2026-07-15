const { initializeApp, getApps, getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const firebaseConfig = require("./firebase-applet-config.json");

console.log("Firebase config project ID:", firebaseConfig.projectId);

const firebaseApp = getApps().length === 0 
  ? initializeApp({
      projectId: firebaseConfig.projectId
    })
  : getApp();

const adminDb = getFirestore(firebaseApp); // Uses (default) database

async function test() {
  try {
    console.log("Testing read from profiles collection on (default) database...");
    const profileSnap = await adminDb.collection("profiles").limit(1).get();
    console.log("Read success on (default)! Profiles size:", profileSnap.size);
  } catch (err) {
    console.error("Read failed on (default):", err);
  }
}

test();

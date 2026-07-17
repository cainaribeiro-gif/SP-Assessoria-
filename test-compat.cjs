const firebaseCompat = require("firebase/compat/app");
require("firebase/compat/firestore");
const firebaseConfig = require("./firebase-applet-config.json");

// Initialize using the compat library
const app = firebaseCompat.default.initializeApp(firebaseConfig);
const adminDb = app.firestore(firebaseConfig.firestoreDatabaseId || "ai-studio-spassessoria-4002b994-54e7-4144-9335-b5bd2a7f7102");

async function test() {
  console.log("--- TEST Compat Web SDK on Server ---");
  try {
    console.log("Reading profiles with compat...");
    const snap = await adminDb.collection("profiles").limit(1).get();
    console.log("SUCCESS! Profiles size:", snap.size);
    
    console.log("Writing a test document to test_compat...");
    await adminDb.collection("test_compat").doc("test_doc").set({
      timestamp: new Date(),
      compatWorking: true
    });
    console.log("SUCCESS! Write completed!");
  } catch (err) {
    console.error("FAILED! Error:", err);
  }
}

test();

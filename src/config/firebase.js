import admin from "firebase-admin";
import fs from "fs";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { env } from "./env.js";

function loadServiceAccount() {
  if (env.firebaseConfigRaw) {
    const parsed = JSON.parse(env.firebaseConfigRaw);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }

  if (env.hasLocalServiceAccount && fs.existsSync(env.localServiceAccountPath)) {
    const parsed = JSON.parse(fs.readFileSync(env.localServiceAccountPath, "utf8"));
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }

  return null;
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
}

export const db = getFirestore();
export { Timestamp };
export default admin;

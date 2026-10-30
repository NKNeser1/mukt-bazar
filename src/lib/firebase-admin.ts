import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!projectId) {
  throw new Error("Firebase project ID is not configured.");
}

const credential = serviceAccountJson
  ? (() => {
      const account = JSON.parse(serviceAccountJson);
      account.private_key = account.private_key?.replace(/\\n/g, "\n");

      if (
        account.project_id !== projectId ||
        !account.client_email ||
        !account.private_key
      ) {
        throw new Error("Firebase service account configuration is invalid.");
      }

      return cert(account);
    })()
  : applicationDefault();

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential,
      projectId,
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

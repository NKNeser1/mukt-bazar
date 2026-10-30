
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  const email = process.env.ROOT_ADMIN_EMAIL?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      "ROOT_ADMIN_EMAIL environment variable is required."
    );
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId,
      });

  const auth = getAuth(app);
  const user = await auth.getUserByEmail(email);

  if (user.disabled) {
    throw new Error("This Firebase user is disabled.");
  }

  if (user.customClaims?.role === "root_admin") {
    console.log("This user is already a Root Admin.");
    return;
  }

  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    role: "root_admin",
  });

  console.log("Root Admin role assigned successfully.");
  console.log(`UID: ${user.uid}`);
}

main().catch((error: unknown) => {
  console.error(
    "Could not assign Root Admin role:",
    error instanceof Error ? error.message : "Unknown error"
  );
  process.exitCode = 1;
});

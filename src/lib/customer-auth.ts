import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import app from "@/lib/firebase";

const customerApp =
  getApps().find((item) => item.name === "mukt-bazar-customer") ??
  initializeApp(app.options, "mukt-bazar-customer");

export const customerAuth = getAuth(customerApp);

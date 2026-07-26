import type { DairyTransaction, TransactionInput } from "./types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let clientPromise: Promise<{
  app: import("firebase/app").FirebaseApp;
  auth: import("firebase/auth").Auth;
  db: import("firebase/firestore").Firestore;
  uid: string;
}> | null = null;

async function getFirebaseClient() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured yet.");
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ getApps, initializeApp }, authModule, firestoreModule] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);

      const app = getApps()[0] ?? initializeApp(firebaseConfig);

      const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
      if (recaptchaKey && typeof window !== "undefined") {
        try {
          const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("firebase/app-check");
          initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
            isTokenAutoRefreshEnabled: true,
          });
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.info("App Check is already active or unavailable in this preview.", error);
          }
        }
      }

      const auth = authModule.getAuth(app);
      if (!auth.currentUser) {
        await authModule.signInAnonymously(auth);
      }
      const user = auth.currentUser;
      if (!user) throw new Error("Anonymous Firebase sign-in did not complete.");

      return {
        app,
        auth,
        db: firestoreModule.getFirestore(app),
        uid: user.uid,
      };
    })();
  }
  return clientPromise;
}

export async function subscribeToTransactions(
  onData: (transactions: DairyTransaction[]) => void,
  onError: (error: Error) => void,
) {
  const { db, uid } = await getFirebaseClient();
  const { collection, onSnapshot, orderBy, query } = await import("firebase/firestore");
  const reference = collection(db, "users", uid, "transactions");
  const ordered = query(reference, orderBy("createdAt", "desc"));

  return onSnapshot(
    ordered,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => ({
          ...(item.data() as Omit<DairyTransaction, "id">),
          id: item.id,
        })),
      );
    },
    (error) => onError(error),
  );
}

export async function saveTransaction(input: TransactionInput) {
  const { db, uid } = await getFirebaseClient();
  const { addDoc, collection } = await import("firebase/firestore");
  const createdAt = Date.now();
  const reference = await addDoc(collection(db, "users", uid, "transactions"), {
    ...input,
    createdAt,
  });
  return { ...input, id: reference.id, createdAt } satisfies DairyTransaction;
}

export async function removeTransaction(transactionId: string) {
  const { db, uid } = await getFirebaseClient();
  const { deleteDoc, doc } = await import("firebase/firestore");
  await deleteDoc(doc(db, "users", uid, "transactions", transactionId));
}

const SYSTEM_INSTRUCTION = `You are Rozana Mashwara, a careful business coach for small dairy farmers, milk collectors, and dairy shop owners in Pakistan. Analyze only the transaction summary supplied by the app. Use simple, respectful English with occasional familiar Urdu business words such as hisaab, udhaar, and mashwara. Start with one clear headline. Then give exactly three short bullet points: Cash, Stock, and Next step. Mention rupee amounts when useful. Never invent transactions, market prices, or guarantees. If data is limited, say so. Keep the full response under 130 words.`;

export async function generateBusinessAdvice(transactions: DairyTransaction[]) {
  const { app } = await getFirebaseClient();
  const { GoogleAIBackend, getAI, getGenerativeModel } = await import("firebase/ai");
  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: process.env.NEXT_PUBLIC_FIREBASE_AI_MODEL || "gemini-3.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 500,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows = transactions.slice(0, 80).map((item) => ({
    date: item.date,
    kind: item.kind,
    party: item.party,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    total: item.quantity * item.rate,
    paid: item.paid,
  }));
  const result = await model.generateContent(
    `Today is ${today}. Review this dairy business data and produce the daily briefing. Transactions: ${JSON.stringify(rows)}`,
  );
  return result.response.text();
}

export { SYSTEM_INSTRUCTION };

import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    GithubAuthProvider
} from "firebase/auth";
// Your web app's Firebase configuration
// These values should be provided via environment variables in .env.local
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
// Initialize Firebase
// We check getApps().length to prevent multiple initializations during HMR (Hot Module Replacement)
// We also check for configuration to prevent crashes during static generation in Vercel if env vars are missing
let app;
const isBuildTime = !firebaseConfig.apiKey;

if (getApps().length > 0) {
    app = getApp();
} else if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
} else {
    // Fallback if no firebase config is found during build
    // We initialize with a "mock" app only to prevent following Firebase calls from crashing the build
    // Auth won't work in this state, but the build will finish.
    console.warn("⚠️ Firebase configuration missing. Using dummy initialization for build resilience.");
    app = initializeApp({
        apiKey: "mock-key",
        authDomain: "mock.firebaseapp.com",
        projectId: "mock-project",
        storageBucket: "mock.appspot.com",
        messagingSenderId: "000000000000",
        appId: "1:000000000000:web:0000000000000000000000"
    });
}

// Initialize Firebase Auth
const auth = getAuth(app);
// Configure Social Providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
export {
    auth,
    googleProvider,
    githubProvider
};
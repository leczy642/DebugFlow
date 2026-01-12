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
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
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
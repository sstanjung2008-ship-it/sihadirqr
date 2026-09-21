import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, DocumentReference } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: "AIzaSyBobFyxFK-tHXX5JEr4EDbyf-KPGpGhiMI",
  authDomain: "gen-lang-client-0849619056.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0849619056-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gen-lang-client-0849619056",
  storageBucket: "gen-lang-client-0849619056.firebasestorage.app",
  messagingSenderId: "292586558022",
  appId: "1:292586558022:web:fa2d62c1be9ddcd7b27047"
};

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if available
export const db = firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

export { doc, setDoc, getDoc, onSnapshot };
export type { DocumentReference };

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAvOXcIp-x-2IL_fpK9FuzdKmYrZ0GbH7g",
  authDomain: "zpoom-9c448.firebaseapp.com",
  projectId: "zpoom-9c448",
  storageBucket: "zpoom-9c448.firebasestorage.app",
  messagingSenderId: "598701002219",
  appId: "1:598701002219:web:9241c187dbfd030aa7ddae",
  measurementId: "G-FDZGH1LTL6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
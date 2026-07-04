import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAS0yNscZglx8KW4P_Rfibgw9S-SUYVoe8",
  authDomain: "thyroid-tracker-36727.firebaseapp.com",
  projectId: "thyroid-tracker-36727",
  storageBucket: "thyroid-tracker-36727.firebasestorage.app",
  messagingSenderId: "764725506238",
  appId: "1:764725506238:web:61cf84eb2697d850e76eef"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

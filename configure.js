
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrBSZR4SQLSmiWD6oyJKdyk_Oh-NI4XAI",
  authDomain: "myhabitly-9afb6.firebaseapp.com",
  projectId: "myhabitly-9afb6",
  storageBucket: "myhabitly-9afb6.firebasestorage.app",
  messagingSenderId: "595129942923",
  appId: "1:595129942923:web:c306a225e3461ef9e4258e"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

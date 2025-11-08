const admin = require('firebase-admin');

const app1ServiceAccount = require('./serviceAccountKey.json');
// const app2ServiceAccount = require('./kubercabdriver-ab5bb-firebase-adminsdk-fbsvc-f10a858fb9.json');

// 🔹 Initialize both apps
const firebaseKuberCab = admin.initializeApp({
  credential: admin.credential.cert(app1ServiceAccount),
}, 'kubercab');

// const firebaseKuberCabDriver = admin.initializeApp({
//   credential: admin.credential.cert(app2ServiceAccount),
// }, 'kubercabDriver');

// 🔹 Export both for use in routes/controllers
module.exports = {
  firebaseKuberCab
  // firebaseKuberCabDriver,
};
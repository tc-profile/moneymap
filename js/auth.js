/**
 * Firebase Authentication gate — shows a login screen until the user
 * signs in with Google, then reveals the app.
 */
const Auth = (() => {
  const app  = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  const loginScreen = document.getElementById('login-screen');
  const appShell    = document.getElementById('app-shell');
  const btnGoogle   = document.getElementById('btn-google-signin');
  const btnSignOut  = document.getElementById('btn-signout');
  const userAvatar  = document.getElementById('user-avatar');
  const userName    = document.getElementById('user-name');

  function showApp(user) {
    loginScreen.hidden = true;
    appShell.hidden = false;

    if (user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.hidden = false;
    }
    userName.textContent = user.displayName || user.email;

    if (typeof AppInit === 'function') AppInit();
  }

  function showLogin() {
    loginScreen.hidden = false;
    appShell.hidden = true;
  }

  btnGoogle.addEventListener('click', () => {
    auth.signInWithPopup(provider).catch(err => {
      console.error('Sign-in failed:', err);
      alert('Sign-in failed. Please try again.');
    });
  });

  btnSignOut.addEventListener('click', () => {
    auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      showApp(user);
    } else {
      showLogin();
    }
  });

  return { getUser: () => auth.currentUser };
})();

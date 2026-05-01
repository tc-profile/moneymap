/**
 * Firebase Authentication gate — shows a login screen until the user
 * signs in with Google, then reveals the app.
 * Uses redirect flow to avoid popup issues.
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
    loginScreen.style.display = 'none';
    appShell.hidden = false;

    if (user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.hidden = false;
    }
    userName.textContent = user.displayName || user.email;

    if (typeof AppInit === 'function') AppInit();
  }

  function showLogin() {
    loginScreen.style.display = '';
    appShell.hidden = true;
  }

  // Use redirect flow — navigates away to Google, then returns cleanly
  btnGoogle.addEventListener('click', () => {
    auth.signInWithRedirect(provider);
  });

  // Handle redirect result on page load
  auth.getRedirectResult().catch(err => {
    if (err.code !== 'auth/no-auth-event') {
      console.error('Sign-in redirect failed:', err);
      alert('Sign-in failed. Please try again.');
    }
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

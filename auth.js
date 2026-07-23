// Firebase Authentication for the web app.
// Localhost uses an offline preview mode so the interface can be tested without Google.
const isLocalPreview = ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location.hostname);

const firebaseConfig = {
  apiKey: 'AIzaSyA1m7wKFsUcUxJ2fimc-Z29xgOLKJzMRsU',
  authDomain: 'que-me-pongo-503015.firebaseapp.com',
  projectId: 'que-me-pongo-503015',
  storageBucket: 'que-me-pongo-503015.firebasestorage.app',
  messagingSenderId: '545542271515',
  appId: '1:545542271515:web:57a6b83e4f14942e50febe'
};

let auth = null;
let provider = null;
let onAuthStateChanged = null;
let signInWithPopup = null;
let signOut = null;

if (!isLocalPreview) {
  const [{ initializeApp }, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js')
  ]);
  const firebaseApp = initializeApp(firebaseConfig);
  auth = authModule.getAuth(firebaseApp);
  provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  onAuthStateChanged = authModule.onAuthStateChanged;
  signInWithPopup = authModule.signInWithPopup;
  signOut = authModule.signOut;
}

globalThis.QMPAuth = {
  getUser: () => auth?.currentUser || null,
  getIdToken: async (forceRefresh = false) => {
    if (isLocalPreview) throw new Error('La sincronización no está disponible en la vista local.');
    if (!auth?.currentUser) throw new Error('No hay una sesión iniciada.');
    return auth.currentUser.getIdToken(forceRefresh);
  }
};

const elements = {
  gate: document.querySelector('#authGate'),
  gateSignIn: document.querySelector('#welcomeGoogleBtn'),
  gateStatus: document.querySelector('#authGateStatus'),
  avatar: document.querySelector('#authAvatar'),
  title: document.querySelector('#authTitle'),
  description: document.querySelector('#authDescription'),
  signIn: document.querySelector('#googleSignInBtn'),
  signOut: document.querySelector('#authSignOutBtn'),
  status: document.querySelector('#authStatus')
};

function updateStatus(element, message = '', isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function setStatus(message = '', isError = false) {
  updateStatus(elements.status, message, isError);
}

function setGateStatus(message = '', isError = false) {
  updateStatus(elements.gateStatus, message, isError);
}

function setSignInBusy(isBusy) {
  elements.signIn.disabled = isBusy;
  elements.gateSignIn.disabled = isBusy;
}

function renderUser(user) {
  if (!user) {
    document.body.classList.add('auth-locked');
    elements.gate.hidden = false;
    elements.gate.setAttribute('aria-busy', 'false');
    elements.avatar.innerHTML = '<span>G</span>';
    elements.title.textContent = 'Ingresá con Google';
    elements.description.textContent = 'Así cada persona puede tener su propio usuario.';
    elements.signIn.hidden = false;
    elements.signOut.hidden = true;
    setSignInBusy(false);
    setGateStatus('');
    setStatus();
    globalThis.dispatchEvent(new CustomEvent('qmp-auth-changed', { detail: { user: null } }));
    return;
  }

  document.body.classList.remove('auth-locked');
  elements.gate.hidden = true;
  elements.gate.setAttribute('aria-busy', 'false');

  const fallbackInitial = (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase();
  elements.avatar.replaceChildren();
  if (user.photoURL) {
    const image = document.createElement('img');
    image.src = user.photoURL;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    elements.avatar.append(image);
  } else {
    const initial = document.createElement('span');
    initial.textContent = fallbackInitial;
    elements.avatar.append(initial);
  }
  elements.title.textContent = user.displayName || 'Usuario de Google';
  elements.description.textContent = user.email || 'Sesión iniciada';
  elements.signIn.hidden = true;
  elements.signOut.hidden = false;
  setSignInBusy(false);
  setStatus('Sesión iniciada correctamente.');
  globalThis.dispatchEvent(new CustomEvent('qmp-auth-changed', { detail: { user } }));
}

function renderLocalPreview() {
  document.body.classList.remove('auth-locked');
  elements.gate.hidden = true;
  elements.gate.setAttribute('aria-busy', 'false');
  elements.avatar.innerHTML = '<span>L</span>';
  elements.title.textContent = 'Vista local';
  elements.description.textContent = 'Prueba sin cuenta ni sincronización.';
  elements.signIn.hidden = true;
  elements.signOut.hidden = true;
  setSignInBusy(false);
  setGateStatus('');
  setStatus('Modo local: los datos quedan solamente en este navegador.');
  globalThis.dispatchEvent(new CustomEvent('qmp-auth-changed', { detail: { user: null, localPreview: true } }));
}

function friendlyAuthError(error) {
  if (error?.code === 'auth/popup-closed-by-user') return 'Se cerró la ventana antes de completar el ingreso.';
  if (error?.code === 'auth/popup-blocked') return 'El navegador bloqueó la ventana de Google. Permití ventanas emergentes e intentá otra vez.';
  if (error?.code === 'auth/network-request-failed') return 'No pudimos conectar con Google. Revisá internet e intentá nuevamente.';
  if (error?.code === 'auth/unauthorized-domain') return 'Este dominio todavía no está autorizado para iniciar sesión.';
  return 'No pudimos iniciar sesión. Intentá nuevamente.';
}

async function beginGoogleSignIn() {
  setSignInBusy(true);
  setGateStatus('Abriendo Google…');
  setStatus('Abriendo Google…');
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Firebase Auth:', error);
    const message = friendlyAuthError(error);
    setGateStatus(message, true);
    setStatus(message, true);
  } finally {
    setSignInBusy(false);
  }
}

if (isLocalPreview) {
  renderLocalPreview();
} else {
  elements.gateSignIn.addEventListener('click', beginGoogleSignIn);
  elements.signIn.addEventListener('click', beginGoogleSignIn);

  elements.signOut.addEventListener('click', async () => {
    elements.signOut.disabled = true;
    setStatus('Cerrando sesión…');
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase Auth sign out:', error);
      setStatus('No pudimos cerrar la sesión. Intentá nuevamente.', true);
    } finally {
      elements.signOut.disabled = false;
    }
  });

  onAuthStateChanged(auth, renderUser, (error) => {
    console.error('Firebase Auth state:', error);
    elements.gate.setAttribute('aria-busy', 'false');
    setGateStatus('No pudimos verificar la sesión. Recargá la página.', true);
    setStatus('No pudimos verificar la sesión.', true);
  });
}

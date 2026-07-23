'use strict';

(() => {
  const DISMISS_KEY = 'qmpInstallPromptDismissedAt';
  const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;
  const standaloneQuery = globalThis.matchMedia('(display-mode: standalone)');
  let deferredInstallPrompt = null;
  let uiReady = false;
  let authenticatedUser = false;
  let promptElement;
  let promptTitle;
  let promptText;
  let iosInstructions;
  let installButton;
  let closeButton;
  let serviceWorkerRegistration = null;
  let reloadOnControllerChange = Boolean(navigator.serviceWorker?.controller);
  let reloadingForUpdate = false;
  let pendingUpdateReload = false;
  let pendingReloadTimer = null;
  let lastUpdateCheck = 0;

  function isStandalone() {
    return standaloneQuery.matches || navigator.standalone === true;
  }

  function isIOSSafari() {
    const userAgent = navigator.userAgent || '';
    const isiOS = /iPad|iPhone|iPod/i.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(userAgent);
    return isiOS && isSafari;
  }

  function wasRecentlyDismissed() {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
      return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
    } catch {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // La instalación sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }

  function hideInstallPrompt() {
    if (promptElement) promptElement.hidden = true;
  }

  function hasGarmentWorkInProgress() {
    return Boolean(document.querySelector('#garmentFlowDialog[open], #garmentDetailDialog[open], #recommendationsDialog[open]'));
  }

  function reloadForNewVersionWhenSafe() {
    if (reloadingForUpdate) return;
    if (hasGarmentWorkInProgress()) {
      pendingUpdateReload = true;
      if (!pendingReloadTimer) {
        pendingReloadTimer = setInterval(() => {
          if (!pendingUpdateReload || document.visibilityState !== 'visible' || hasGarmentWorkInProgress()) return;
          clearInterval(pendingReloadTimer);
          pendingReloadTimer = null;
          pendingUpdateReload = false;
          reloadForNewVersionWhenSafe();
        }, 1000);
      }
      return;
    }
    reloadingForUpdate = true;
    globalThis.location.reload();
  }

  async function checkForAppUpdate(force = false) {
    if (!serviceWorkerRegistration || navigator.onLine === false) return;
    const now = Date.now();
    if (!force && now - lastUpdateCheck < 15000) return;
    lastUpdateCheck = now;
    try {
      await serviceWorkerRegistration.update();
    } catch {
      // La versiÃ³n instalada sigue funcionando aunque no haya conexiÃ³n.
    }
  }

  function showInstallPrompt(mode) {
    if (!uiReady || !authenticatedUser || isStandalone() || wasRecentlyDismissed()) return;
    const isIOS = mode === 'ios';
    promptTitle.textContent = isIOS ? 'Agregá ¿Qué me pongo? a tu inicio' : 'Instalá ¿Qué me pongo?';
    promptText.textContent = isIOS
      ? 'Usala como una app, sin buscarla cada vez en Safari.'
      : 'Tené la app siempre a mano en tu teléfono.';
    iosInstructions.hidden = !isIOS;
    installButton.hidden = isIOS;
    promptElement.dataset.platform = mode;
    promptElement.hidden = false;
  }

  function refreshInstallPrompt() {
    if (!uiReady || !authenticatedUser || isStandalone() || wasRecentlyDismissed()) {
      hideInstallPrompt();
      return;
    }
    if (deferredInstallPrompt) showInstallPrompt('android');
    else if (isIOSSafari()) showInstallPrompt('ios');
    else hideInstallPrompt();
  }

  function initInstallUI() {
    promptElement = document.querySelector('#installPrompt');
    promptTitle = document.querySelector('#installPromptTitle');
    promptText = document.querySelector('#installPromptText');
    iosInstructions = document.querySelector('#installIosInstructions');
    installButton = document.querySelector('#installAppBtn');
    closeButton = document.querySelector('#closeInstallPrompt');
    if (!promptElement || !installButton || !closeButton) return;

    uiReady = true;
    closeButton.addEventListener('click', () => {
      rememberDismissal();
      hideInstallPrompt();
    });

    installButton.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      installButton.disabled = true;
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice?.outcome === 'dismissed') rememberDismissal();
      } finally {
        deferredInstallPrompt = null;
        installButton.disabled = false;
        hideInstallPrompt();
      }
    });

    refreshInstallPrompt();
  }

  globalThis.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshInstallPrompt();
  });

  globalThis.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallPrompt();
  });

  globalThis.addEventListener('qmp-auth-changed', (event) => {
    authenticatedUser = Boolean(event.detail?.user);
    refreshInstallPrompt();
  });

  standaloneQuery.addEventListener?.('change', refreshInstallPrompt);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initInstallUI, { once: true });
  else initInstallUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadOnControllerChange) {
        reloadOnControllerChange = true;
        return;
      }
      reloadForNewVersionWhenSafe();
    });

    globalThis.addEventListener('load', async () => {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        await checkForAppUpdate(true);
      } catch {
        // La app continÃºa disponible aunque el registro falle.
      }
    }, { once: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (pendingUpdateReload) reloadForNewVersionWhenSafe();
      checkForAppUpdate();
    });

    globalThis.addEventListener('pageshow', () => { checkForAppUpdate(); });
    globalThis.addEventListener('focus', () => { checkForAppUpdate(); });
  }
})();

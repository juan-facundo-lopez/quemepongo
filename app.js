'use strict';

const FALLBACK_LOCATIONS = {
  buenosAires: { lat: -34.6037, lon: -58.3816, name: 'Buenos Aires' },
  bariloche: { lat: -41.1335, lon: -71.3103, name: 'Bariloche' },
  madrid: { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
  torino: { lat: 45.0703, lon: 7.6869, name: 'Torino' },
  barcelona: { lat: 41.3874, lon: 2.1686, name: 'Barcelona' },
  copenhagen: { lat: 55.6761, lon: 12.5683, name: 'Copenhague' },
  galicia: { lat: 42.8782, lon: -8.5448, name: 'Galicia' },
  santiago: { lat: -33.4489, lon: -70.6693, name: 'Santiago' },
  cdmx: { lat: 19.4326, lon: -99.1332, name: 'Ciudad de México' },
  miami: { lat: 25.7617, lon: -80.1918, name: 'Miami' },
  london: { lat: 51.5072, lon: -0.1276, name: 'Londres' }
};

const WARDROBE_STORAGE_KEY = 'qmpWardrobe';
const RECOMMENDATION_FEEDBACK_KEY = 'qmpRecommendationFeedback';
const WARDROBE_API_BASE = 'api';
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const PWA_THEME_COLORS = { clear: '#ff9b73', cloudy: '#9dd9ed', rainy: '#495e7e', snowy: '#dcd5f5', windy: '#b6a9ee', night: '#433566' };

const AppState = {
  coords: null,
  locationName: '',
  isCelsius: localStorage.getItem('isCelsius') !== 'false',
  sensitivity: localStorage.getItem('tempSensitivity') || 'normal',
  fallbackLocation: localStorage.getItem('fallbackLocation') || 'buenosAires',
  weatherData: null,
  rainWindow: null,
  isFallback: false,
  selectedHourIndex: null,
  wardrobe: [],
  wardrobeRemote: false,
  wardrobeSyncing: false,
  aiQuota: { limit: 5, remaining: 5, resetAt: null, mode: 'gemini', available: false, unlimited: false },
  aiQuotaLoading: false,
  garmentDraft: null,
  editingGarmentId: null,
  selectedGarmentId: null,
  outfitOccasion: localStorage.getItem('outfitOccasion') === 'training' ? 'training' : 'casual',
  outfitVariation: 0,
  outfitContextKey: '',
  outfitSpec: null,
  currentOutfitPieces: null,
  swappingOutfitSlot: null,
  recommendationFilter: 'all',
  selectedRecommendationId: null,
  recommendationDetailOrigin: 'overview',
  recommendationsReturnView: 'wardrobeView',
  recommendationFeedback: {},
  recommendationFeedbackRemote: false,
  recommendationFeedbackSyncing: false
};

const GARMENT_SVGS = {
  remera: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 12c2.8 4.8 16.8 4.8 20 0l12 7-7 12-6-3v25H23V28l-6 3-7-12 12-7Z"/><path d="M25 13c1 6 13 6 15 0"/></svg>',
  shorts: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 13h30l3 38-14 2-4-20-4 20-14-2 3-38Z"/><path d="M17 21h30M32 22v11"/></svg>',
  pantalon: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l2 43-13 1-3-28-3 28-13-1 2-43Z"/><path d="M18 18h28"/></svg>',
  campera: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 10c4 4 14 4 18 0l11 9-6 11-5-3v27H23V27l-5 3-6-11 11-9Z"/><path d="M32 14v40M27 34h-4m18 0h-4M27 10l5 4 5-4"/></svg>',
  buzo: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 16c-2-9 20-9 18 0l11 7-5 12-6-4v23H23V31l-6 4-5-12 11-7Z"/><path d="M25 14c1 7 13 7 14 0M25 47h14"/></svg>',
  calzado: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 16h16c1 13 8 20 20 23 4 1 6 4 5 9H13c-4 0-6-3-5-7l7-25Z"/><path d="M12 37c9 3 17 1 23-6M18 48h37"/></svg>',
  paraguas: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 30a23 23 0 0 1 46 0c-6-5-10 0-10 0s-7-5-13 0c-6-5-13 0-13 0s-4-5-10 0ZM32 8v39c0 10 12 10 12 1"/></svg>',
  gorro: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 43V29a16 16 0 0 1 32 0v14M12 43h40v10H12z"/><circle cx="32" cy="10" r="5"/></svg>',
  percha: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 23c-6 0-6-9 0-9s7 8 1 12L9 45h46L33 26"/></svg>'
};

const OUTFIT_SLOTS = {
  top: { label: 'Arriba', categories: ['Remera', 'Camisa', 'Vestido'], icon: 'remera', color: 'var(--color-warm)' },
  mid: { label: 'Capa media', categories: ['Buzo', 'Sweater'], icon: 'buzo', color: 'var(--color-sunny)' },
  outer: { label: 'Abrigo', categories: ['Campera', 'Abrigo'], icon: 'campera', color: 'var(--color-windy)' },
  bottom: { label: 'Abajo', categories: ['Pantalón', 'Short', 'Pollera'], icon: 'pantalon', color: 'var(--color-emerald)' },
  feet: { label: 'Calzado', categories: ['Calzado'], icon: 'calzado', color: 'var(--color-rainy)' }
};

const WARMTH_VALUES = { 'Muy liviano': 0, Liviano: 1, Medio: 2, Abrigado: 3, 'Muy abrigado': 4, Alto: 3 };
const NEUTRAL_COLOR_KEYS = new Set(['negro', 'blanco', 'gris', 'beige', 'marron', 'crema']);
const COLOR_COMPANIONS = {
  azul: ['blanco', 'gris', 'beige', 'marron', 'rojo', 'rosa', 'naranja'],
  rojo: ['negro', 'blanco', 'gris', 'beige', 'azul', 'rosa'],
  verde: ['negro', 'blanco', 'gris', 'beige', 'marron', 'amarillo', 'azul'],
  amarillo: ['negro', 'blanco', 'gris', 'beige', 'azul', 'verde', 'violeta'],
  rosa: ['negro', 'blanco', 'gris', 'beige', 'azul', 'rojo', 'violeta'],
  violeta: ['negro', 'blanco', 'gris', 'beige', 'rosa', 'amarillo'],
  naranja: ['negro', 'blanco', 'gris', 'beige', 'azul', 'marron'],
  multicolor: ['negro', 'blanco', 'gris', 'beige', 'marron']
};
const STYLE_COMPATIBILITY = {
  casual: { casual: 6, formal: 1, urbano: 3, deportivo: 2 },
  formal: { casual: 1, formal: 7, urbano: -3, deportivo: -12 },
  urbano: { casual: 3, formal: -3, urbano: 7, deportivo: 2 },
  deportivo: { casual: 2, formal: -12, urbano: 2, deportivo: 7 }
};
const STATEMENT_PATTERNS = new Set(['rayado', 'cuadros', 'estampado', 'animal_print', 'lunares']);

const $ = (selector) => document.querySelector(selector);
const elements = {
  bg: $('#weatherBg'), locationBtn: $('#locationBtn'), locationText: $('#locationText'), loadingDot: $('#loadingDot'),
  garmentVisual: $('#garmentVisual'), outfitTitle: $('#outfitTitle'), outfitContext: $('#outfitContext'), outfitDetails: $('#outfitDetails'), outfitChips: $('#outfitChips'),
  feels: $('#feelsLikeTemp'), actual: $('#actualTemp'), minMax: $('#minMaxTemp'), humidity: $('#humidityVal'),
  dayComparison: $('#dayComparison'), comparisonLabel: $('#comparisonLabel'), comparisonText: $('#comparisonText'), comparisonDelta: $('#comparisonDelta'),
  uv: $('#uvIndexVal'), uvStatus: $('#uvStatus'), wind: $('#windSpeedVal'), windStatus: $('#windStatus'),
  rain: $('#rainProbVal'), rainStatus: $('#rainStatus'), updateTime: $('#updateTime'), unitToggle: $('#unitToggle'),
  fallbackSelect: $('#fallbackLocationSelect'), settingsForm: $('#settingsForm'), saveFeedback: $('#saveFeedback'),
  laterBtn: $('#laterBtn'), nowBtn: $('#nowBtn'), laterDialog: $('#laterDialog'), hourOptions: $('#hourOptions'),
  closeLaterDialog: $('#closeLaterDialog'), metricInfoDialog: $('#metricInfoDialog'), closeMetricInfo: $('#closeMetricInfo'),
  metricInfoIcon: $('#metricInfoIcon'), metricInfoEyebrow: $('#metricInfoEyebrow'), metricInfoTitle: $('#metricInfoTitle'),
  metricInfoValue: $('#metricInfoValue'), metricInfoStatus: $('#metricInfoStatus'), metricInfoSummary: $('#metricInfoSummary'),
  metricInfoAdvice: $('#metricInfoAdvice'), metricInfoAdviceText: $('#metricInfoAdviceText'),
  weatherAlert: $('#weatherAlert'), weatherAlertIcon: $('#weatherAlertIcon'), weatherAlertLabel: $('#weatherAlertLabel'), weatherAlertText: $('#weatherAlertText'),
  wardrobeCount: $('#wardrobeCount'), wardrobeEmpty: $('#wardrobeEmpty'), wardrobeGrid: $('#wardrobeGrid'), wardrobeToast: $('#wardrobeToast'), wardrobeInsights: $('#wardrobeInsights'),
  addGarmentBtn: $('#addGarmentBtn'), addGarmentEmptyBtn: $('#addGarmentEmptyBtn'), garmentFlowDialog: $('#garmentFlowDialog'),
  closeGarmentFlow: $('#closeGarmentFlow'), garmentStages: document.querySelectorAll('[data-garment-stage]'), openCameraBtn: $('#openCameraBtn'), cameraInput: $('#cameraInput'), galleryInput: $('#galleryInput'),
  desktopCameraVideo: $('#desktopCameraVideo'), desktopCameraLoading: $('#desktopCameraLoading'), desktopCameraStatus: $('#desktopCameraStatus'),
  captureDesktopPhoto: $('#captureDesktopPhoto'), cancelDesktopCamera: $('#cancelDesktopCamera'),
  garmentFlowError: $('#garmentFlowError'), methodGarmentImage: $('#methodGarmentImage'), repeatGarmentPhoto: $('#repeatGarmentPhoto'), manualGarmentBtn: $('#manualGarmentBtn'), aiGarmentBtn: $('#aiGarmentBtn'),
  aiQuotaRemaining: $('#aiQuotaRemaining'), aiQuotaLimit: $('#aiQuotaLimit'), aiQuotaLimitedCopy: $('#aiQuotaLimitedCopy'), aiQuotaUnlimitedCopy: $('#aiQuotaUnlimitedCopy'), aiQuotaReset: $('#aiQuotaReset'), aiQuotaDots: $('#aiQuotaDots'), aiQuotaError: $('#aiQuotaError'), aiQuotaSummary: $('#aiQuotaSummary'),
  analysisImage: $('#analysisImage'), confirmGarmentImage: $('#confirmGarmentImage'), changeGarmentPhoto: $('#changeGarmentPhoto'),
  garmentFormEyebrow: $('#garmentFormEyebrow'), garmentFormDescription: $('#garmentFormDescription'), garmentSubmitLabel: $('#garmentSubmitLabel'),
  garmentForm: $('#garmentForm'), garmentCategory: $('#garmentCategory'), garmentColor: $('#garmentColor'), garmentSubtype: $('#garmentSubtype'), garmentSecondaryColors: $('#garmentSecondaryColors'),
  garmentPattern: $('#garmentPattern'), garmentMaterial: $('#garmentMaterial'), garmentWaterproof: $('#garmentWaterproof'), garmentOccasions: $('#garmentOccasions'),
  garmentDescription: $('#garmentDescription'), garmentConfidence: $('#garmentConfidence'), garmentSaveError: $('#garmentSaveError'), cancelGarment: $('#cancelGarment'),
  garmentDetailDialog: $('#garmentDetailDialog'), closeGarmentDetail: $('#closeGarmentDetail'), garmentDetailImage: $('#garmentDetailImage'),
  garmentDetailTitle: $('#garmentDetailTitle'), garmentDetailDescription: $('#garmentDetailDescription'), garmentDetailTags: $('#garmentDetailTags'), garmentDetailActions: $('#garmentDetailActions'), editGarmentBtn: $('#editGarmentBtn'), deleteGarmentBtn: $('#deleteGarmentBtn'),
  deleteConfirmation: $('#deleteConfirmation'), cancelDeleteGarment: $('#cancelDeleteGarment'), confirmDeleteGarment: $('#confirmDeleteGarment'),
  outfitOccasionButtons: document.querySelectorAll('[data-outfit-occasion]'),
  outfitSwapDialog: $('#outfitSwapDialog'), closeOutfitSwap: $('#closeOutfitSwap'), outfitSwapTitle: $('#outfitSwapTitle'),
  outfitSwapDescription: $('#outfitSwapDescription'), outfitSwapOptions: $('#outfitSwapOptions'),
  recommendationsDialog: $('#recommendationsDialog'), closeRecommendations: $('#closeRecommendations'), recommendationsBack: $('#recommendationsBack'),
  recommendationsHeading: $('#recommendationsHeading'), recommendationsOverview: $('#recommendationsOverview'), recommendationFilters: $('#recommendationFilters'),
  recommendationsList: $('#recommendationsList'), recommendationDetail: $('#recommendationDetail'), recommendationsToast: $('#recommendationsToast'),
  recommendationSavedCount: $('#recommendationSavedCount')
};

function init() {
  hydrateSettings();
  bindNavigation();
  bindSettings();
  bindLaterPlanning();
  bindOutfitOccasion();
  bindMetricInfo();
  initWardrobe();
  initOutfitBuilder();
  elements.locationBtn.addEventListener('click', () => locateAndLoad(true));
  locateAndLoad();
}

let garmentAnalysisTimer;
let wardrobeToastTimer;
let activeCameraStream;
let aiQuotaRefreshTimer;
let recommendationsToastTimer;

function initWardrobe() {
  AppState.wardrobe = loadWardrobe();
  initWardrobeInsights();
  renderWardrobe();

  globalThis.addEventListener('qmp-auth-changed', handleWardrobeAuthChange);
  if (globalThis.QMPAuth?.getUser()) {
    loadRemoteWardrobe();
    loadAiQuota();
    loadRemoteRecommendationFeedback();
  }

  elements.addGarmentBtn.addEventListener('click', openGarmentSource);
  elements.addGarmentEmptyBtn.addEventListener('click', openGarmentSource);
  elements.openCameraBtn.addEventListener('click', openCamera);
  elements.cameraInput.addEventListener('change', handleGarmentInput);
  elements.galleryInput.addEventListener('change', handleGarmentInput);
  elements.cameraInput.addEventListener('cancel', handleGarmentPickerCancel);
  elements.galleryInput.addEventListener('cancel', handleGarmentPickerCancel);
  document.querySelectorAll('label.photo-source-option').forEach((option) => option.addEventListener('keydown', activatePhotoSourceWithKeyboard));
  elements.captureDesktopPhoto.addEventListener('click', captureDesktopCameraPhoto);
  elements.repeatGarmentPhoto.addEventListener('click', () => setGarmentStage('source'));
  elements.manualGarmentBtn.addEventListener('click', chooseManualGarmentEntry);
  elements.aiGarmentBtn.addEventListener('click', analyzeGarmentWithAi);
  elements.cancelDesktopCamera.addEventListener('click', () => setGarmentStage('source'));
  elements.closeGarmentFlow.addEventListener('click', cancelGarmentFlow);
  elements.cancelGarment.addEventListener('click', cancelGarmentFlow);
  elements.changeGarmentPhoto.addEventListener('click', () => setGarmentStage('source'));
  elements.garmentFlowDialog.addEventListener('cancel', () => resetGarmentDraft());
  elements.garmentForm.addEventListener('submit', saveGarment);

  elements.closeGarmentDetail.addEventListener('click', () => elements.garmentDetailDialog.close());
  elements.garmentDetailDialog.addEventListener('cancel', resetDeleteConfirmation);
  elements.garmentDetailDialog.addEventListener('click', (event) => {
    if (event.target !== elements.garmentDetailDialog) return;
    const rect = elements.garmentDetailDialog.getBoundingClientRect();
    const clickedOutside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (!clickedOutside) return;
    elements.garmentDetailDialog.close();
    resetDeleteConfirmation();
  });
  elements.editGarmentBtn.addEventListener('click', editSelectedGarment);
  elements.deleteGarmentBtn.addEventListener('click', () => {
    elements.garmentDetailActions.hidden = true;
    elements.deleteConfirmation.hidden = false;
  });
  elements.cancelDeleteGarment.addEventListener('click', resetDeleteConfirmation);
  elements.confirmDeleteGarment.addEventListener('click', deleteSelectedGarment);
}

function activatePhotoSourceWithKeyboard(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  const input = document.getElementById(event.currentTarget.htmlFor);
  input?.click();
}

function handleGarmentPickerCancel() {
  elements.garmentFlowError.textContent = 'No se seleccionó ninguna foto. Podés volver a intentarlo.';
}

function shouldUseNativeCamera() {
  const reportedMobile = navigator.userAgentData?.mobile;
  const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const ipadDesktopMode = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return reportedMobile === true || mobileUserAgent || ipadDesktopMode;
}

function openCamera() {
  elements.garmentFlowError.textContent = '';
  if (shouldUseNativeCamera()) {
    elements.cameraInput.click();
    return;
  }
  openDesktopCamera();
}

async function openDesktopCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    elements.garmentFlowError.textContent = 'La cámara web necesita abrir la app desde localhost o una conexión HTTPS.';
    return;
  }

  setGarmentStage('camera');
  elements.desktopCameraLoading.textContent = 'Activando cámara…';
  elements.desktopCameraStatus.textContent = '';
  elements.captureDesktopPhoto.disabled = true;

  try {
    activeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    elements.desktopCameraVideo.srcObject = activeCameraStream;
    await elements.desktopCameraVideo.play();
    elements.desktopCameraVideo.closest('.desktop-camera-frame').classList.add('is-ready');
    elements.captureDesktopPhoto.disabled = false;
  } catch (error) {
    stopDesktopCamera();
    elements.desktopCameraLoading.textContent = 'No pudimos activar la cámara.';
    elements.desktopCameraStatus.textContent = getCameraErrorMessage(error);
  }
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'El navegador no tiene permiso para usar la cámara. Habilitalo desde el candado de la barra de direcciones.';
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'No encontramos ninguna cámara conectada a esta computadora.';
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return 'Otra aplicación está usando la cámara. Cerrala y volvé a intentar.';
  return 'No pudimos iniciar la cámara. Revisá los permisos del navegador e intentá otra vez.';
}

function stopDesktopCamera() {
  activeCameraStream?.getTracks().forEach((track) => track.stop());
  activeCameraStream = null;
  elements.desktopCameraVideo.pause();
  elements.desktopCameraVideo.srcObject = null;
  elements.desktopCameraVideo.closest('.desktop-camera-frame').classList.remove('is-ready');
  elements.captureDesktopPhoto.disabled = true;
}

function captureDesktopCameraPhoto() {
  const video = elements.desktopCameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    elements.desktopCameraStatus.textContent = 'La cámara todavía no está lista. Esperá un momento.';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    elements.desktopCameraStatus.textContent = 'No pudimos preparar la foto. Volvé a intentarlo.';
    return;
  }
  elements.captureDesktopPhoto.disabled = true;
  context.drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) {
      elements.desktopCameraStatus.textContent = 'No pudimos tomar la foto. Volvé a intentarlo.';
      elements.captureDesktopPhoto.disabled = false;
      return;
    }
    const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg' });
    processGarmentFile(file);
  }, 'image/jpeg', .9);
}

function initOutfitBuilder() {
  elements.closeOutfitSwap.addEventListener('click', () => elements.outfitSwapDialog.close());
  elements.outfitSwapDialog.addEventListener('click', (event) => {
    if (event.target === elements.outfitSwapDialog) elements.outfitSwapDialog.close();
  });
  elements.outfitSwapDialog.addEventListener('close', () => { AppState.swappingOutfitSlot = null; });

  elements.garmentVisual.addEventListener('click', (event) => {
    const rerollButton = event.target.closest('[data-reroll-outfit]');
    if (rerollButton) {
      AppState.outfitVariation += 1;
      AppState.currentOutfitPieces = buildAutomaticOutfit(AppState.outfitSpec, AppState.outfitVariation);
      renderOutfitPieces();
      return;
    }

    const actionButton = event.target.closest('[data-outfit-slot]');
    if (!actionButton) return;
    if (actionButton.dataset.outfitAction === 'recommend') {
      openRecommendationsDialog('all', actionButton.dataset.recommendationId || null);
      return;
    }
    if (actionButton.dataset.outfitAction === 'add') {
      openGarmentSource();
      return;
    }
    openOutfitSwap(actionButton.dataset.outfitSlot);
  });

  elements.outfitSwapOptions.addEventListener('click', (event) => {
    const option = event.target.closest('[data-outfit-garment-id]');
    if (!option || !AppState.swappingOutfitSlot) return;
    replaceOutfitPiece(AppState.swappingOutfitSlot, option.dataset.outfitGarmentId);
    elements.outfitSwapDialog.close();
  });
}

function bindOutfitOccasion() {
  renderOutfitOccasionControl();
  elements.outfitOccasionButtons.forEach((button) => button.addEventListener('click', () => {
    const occasion = button.dataset.outfitOccasion;
    if (!['casual', 'training'].includes(occasion) || occasion === AppState.outfitOccasion) return;
    AppState.outfitOccasion = occasion;
    localStorage.setItem('outfitOccasion', occasion);
    renderOutfitOccasionControl();
    refreshWardrobeOutfit();
  }));
}

function renderOutfitOccasionControl() {
  elements.outfitOccasionButtons.forEach((button) => {
    const active = button.dataset.outfitOccasion === AppState.outfitOccasion;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderWardrobeOutfit(outfit, conditions) {
  const contextKey = [conditions.time, Math.round(conditions.temp), conditions.isRain, conditions.isWindy, conditions.isSnow, conditions.isLate, AppState.outfitOccasion].join('|');
  AppState.outfitSpec = { outfit, ...conditions };
  if (AppState.outfitContextKey !== contextKey || !AppState.currentOutfitPieces) {
    AppState.outfitContextKey = contextKey;
    AppState.outfitVariation = 0;
    AppState.currentOutfitPieces = buildAutomaticOutfit(AppState.outfitSpec, 0);
  }
  renderOutfitPieces();
}

function refreshWardrobeOutfit() {
  if (!AppState.outfitSpec) return;
  AppState.outfitVariation = 0;
  AppState.currentOutfitPieces = buildAutomaticOutfit(AppState.outfitSpec, 0);
  renderOutfitPieces();
}

function buildAutomaticOutfit(spec, variation = 0) {
  if (!spec) return null;
  const pieces = {};
  const usedIds = new Set();
  const preferredStyle = getPreferredOutfitStyle(variation);
  const selectionOrder = ['top', 'bottom', 'mid', 'outer', 'feet'];
  const relevantStyles = AppState.outfitOccasion === 'training' ? ['Deportivo'] : ['Casual', 'Urbano'];
  const availableStyleCount = new Set(AppState.wardrobe.filter((item) => relevantStyles.includes(item.style)).map((item) => item.style)).size;
  const singleStyleVariationSlot = selectionOrder.find((slot) => getOutfitCandidates(slot).length > 1);

  selectionOrder.forEach((slot) => {
    if (slot === 'bottom' && pieces.top?.item?.category === 'Vestido') {
      pieces.bottom = makeGenericOutfitPiece(slot, spec, 'El vestido ya completa la parte de abajo.', true);
      return;
    }
    if (slot === 'mid' && !outfitNeedsMidLayer(spec)) {
      pieces.mid = makeGenericOutfitPiece(slot, spec, 'No hace falta una capa media.', true);
      return;
    }
    if (slot === 'outer' && !outfitNeedsOuterLayer(spec)) {
      pieces.outer = makeGenericOutfitPiece(slot, spec, 'No hace falta otra capa de abrigo.', true);
      return;
    }

    const selectedItems = Object.values(pieces).map((piece) => piece.item).filter(Boolean);
    const ranked = rankOutfitCandidates(slot, spec, selectedItems, preferredStyle)
      .filter((item) => !usedIds.has(item.id));
    if (!ranked.length) {
      pieces[slot] = makeGenericOutfitPiece(slot, spec, getOutfitSlotAdvice(slot, spec));
      return;
    }

    const choicePool = Math.min(ranked.length, 3);
    const choiceIndex = variation > 0 && availableStyleCount <= 1 && slot === singleStyleVariationSlot
      ? variation % choicePool
      : 0;
    const item = ranked[choiceIndex];
    usedIds.add(item.id);
    pieces[slot] = { slot, item, genericText: '', isOptional: false };
  });

  return pieces;
}

function makeGenericOutfitPiece(slot, spec, customText = '', isOptional = false) {
  return {
    slot,
    item: null,
    genericText: customText || spec?.outfit?.details?.[slot] || 'Sugerencia general',
    isOptional
  };
}

function getPreferredOutfitStyle(variation = 0) {
  if (AppState.outfitOccasion === 'training') return 'Deportivo';
  const counts = AppState.wardrobe.reduce((styles, item) => {
    if (!['Casual', 'Urbano'].includes(item.style)) return styles;
    styles[item.style] = (styles[item.style] || 0) + 1;
    return styles;
  }, {});
  const styles = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  return styles.length ? styles[variation % styles.length] : 'Casual';
}

function getOutfitCandidates(slot) {
  const definition = OUTFIT_SLOTS[slot];
  if (!definition) return [];
  return AppState.wardrobe.filter((item) => (
    definition.categories.includes(item.category)
    && (AppState.outfitOccasion !== 'training' || normalizeOutfitText(item.style) === 'deportivo')
  ));
}

function rankOutfitCandidates(slot, spec, selectedItems = [], preferredStyle = 'Casual') {
  return getOutfitCandidates(slot)
    .filter((item) => !hasHardOutfitConflict(item, selectedItems))
    .filter((item) => meetsOutfitWarmthRequirement(item, slot, spec.temp))
    .map((item) => ({
      item,
      warmthDistance: Math.abs((WARMTH_VALUES[item.warmth] ?? 2) - getTargetWarmth(slot, spec.temp)),
      score: scoreOutfitGarment(item, slot, spec, selectedItems, preferredStyle)
    }))
    .sort((a, b) => (
      slot === 'outer' && spec.temp < 5
        ? a.warmthDistance - b.warmthDistance || b.score - a.score || a.item.id.localeCompare(b.item.id)
        : b.score - a.score || a.item.id.localeCompare(b.item.id)
    ))
    .map(({ item }) => item);
}

function meetsOutfitWarmthRequirement(item, slot, temp) {
  if (slot !== 'outer' || temp >= 10) return true;
  return (WARMTH_VALUES[item.warmth] ?? 2) >= 3;
}

function scoreOutfitGarment(item, slot, spec, selectedItems, preferredStyle) {
  let score = item.style === preferredStyle ? 7 : item.style === 'Casual' ? 2 : 0;
  score += getOutfitOccasionScore(item);
  const warmth = WARMTH_VALUES[item.warmth] ?? 1;
  const targetWarmth = getTargetWarmth(slot, spec.temp);
  score += 6 - Math.abs(warmth - targetWarmth) * 4;
  score += getSeasonScore(item, spec.temp);

  if (slot === 'top') {
    if (item.category === 'Remera') score += 4;
    if (spec.temp >= 24 && ['Remera', 'Vestido'].includes(item.category)) score += 5;
    if (AppState.outfitOccasion === 'training' && item.category === 'Remera') score += 8;
    if (AppState.outfitOccasion === 'training' && ['Camisa', 'Vestido'].includes(item.category)) score -= 12;
  }
  if (slot === 'mid') {
    if (spec.temp < 16 && item.category === 'Buzo') score += 5;
    if (spec.temp >= 20) score -= 7;
  }
  if (slot === 'outer') {
    if ((spec.isRain || spec.isWindy || spec.temp < 12) && item.category === 'Campera') score += 6;
    if (spec.temp >= 18 && item.category === 'Buzo') score += 3;
    if (spec.isRain && item.waterproof === true) score += 8;
    if (spec.isRain && item.waterproof === false) score -= 4;
  }
  if (slot === 'bottom') {
    if (spec.temp >= 25 && item.category === 'Short') score += 6;
    if (spec.temp < 18 && item.category === 'Pantalón') score += 7;
    if (spec.temp < 14 && item.category === 'Short') score -= 12;
  }
  if (slot === 'feet' && spec.isRain) {
    if (item.waterproof === true) score += 7;
    if (item.waterproof === false) score -= 3;
  }

  selectedItems.forEach((selected) => { score += getGarmentPairScore(item, selected); });
  return score;
}

function getOutfitOccasionScore(item) {
  const style = normalizeOutfitText(item?.style);
  if (AppState.outfitOccasion === 'training') {
    if (style === 'deportivo') return 16;
    if (style === 'formal') return -14;
    return -4;
  }
  if (style === 'casual') return 8;
  if (style === 'urbano') return 6;
  if (style === 'deportivo') return -7;
  return 0;
}

function getTargetWarmth(slot, temp) {
  if (slot === 'top') return temp < 10 ? 2 : temp < 20 ? 1 : 0;
  if (slot === 'mid') return temp < 5 ? 4 : temp < 10 ? 3 : temp < 20 ? 2 : temp < 25 ? 1 : 0;
  if (slot === 'outer') return temp < 5 ? 4 : temp < 10 ? 3 : temp < 19 ? 2 : temp < 24 ? 1 : 0;
  if (slot === 'feet') return temp < 5 ? 4 : temp < 10 ? 3 : 2;
  return temp < 5 ? 3 : temp < 18 ? 2 : temp < 25 ? 1 : 0;
}

function getColorHarmonyScore(first, second) {
  const firstKey = normalizeOutfitText(first);
  const secondKey = normalizeOutfitText(second);
  if (!firstKey || !secondKey || firstKey === 'sin definir' || secondKey === 'sin definir') return 0;
  if (firstKey === secondKey) return 3;
  if (NEUTRAL_COLOR_KEYS.has(firstKey) || NEUTRAL_COLOR_KEYS.has(secondKey)) return 4;
  if (COLOR_COMPANIONS[firstKey]?.includes(secondKey) || COLOR_COMPANIONS[secondKey]?.includes(firstKey)) return 3;
  if (firstKey === 'multicolor' || secondKey === 'multicolor') return -4;
  return -2;
}

function normalizeOutfitText(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getGarmentColors(item) {
  const colors = [item?.color].concat(Array.isArray(item?.secondaryColors) ? item.secondaryColors : []);
  return [...new Set(colors.map(normalizeOutfitText).filter((color) => color && color !== 'sin definir'))];
}

function getGarmentColorScore(first, second) {
  const firstColors = getGarmentColors(first);
  const secondColors = getGarmentColors(second);
  if (!firstColors.length || !secondColors.length) return 0;
  let best = -4;
  firstColors.forEach((firstColor) => {
    secondColors.forEach((secondColor) => {
      best = Math.max(best, getColorHarmonyScore(firstColor, secondColor));
    });
  });
  return best;
}

function getStyleCompatibilityScore(first, second) {
  const firstStyle = normalizeOutfitText(first?.style);
  const secondStyle = normalizeOutfitText(second?.style);
  if (!firstStyle || !secondStyle) return 0;
  return STYLE_COMPATIBILITY[firstStyle]?.[secondStyle] ?? STYLE_COMPATIBILITY[secondStyle]?.[firstStyle] ?? 0;
}

function getPatternCompatibilityScore(first, second) {
  const firstPattern = normalizeOutfitText(first?.pattern);
  const secondPattern = normalizeOutfitText(second?.pattern);
  const firstStrong = STATEMENT_PATTERNS.has(firstPattern);
  const secondStrong = STATEMENT_PATTERNS.has(secondPattern);
  if (firstStrong && secondStrong) return firstPattern === secondPattern ? -6 : -9;
  if (firstStrong || secondStrong) {
    const plainPiece = firstStrong ? second : first;
    const plainPattern = firstStrong ? secondPattern : firstPattern;
    if (getGarmentColors(plainPiece).includes('multicolor')) return -5;
    return !plainPattern || plainPattern === 'liso' ? 3 : 0;
  }
  return 1;
}

function getOccasionGroups(item) {
  const groups = new Set();
  const occasions = Array.isArray(item?.occasions) ? item.occasions : [];
  occasions.map(normalizeOutfitText).forEach((occasion) => {
    if (/formal|evento|fiesta|oficina|trabajo/.test(occasion)) groups.add('formal');
    if (/deport|gimnas|entren/.test(occasion)) groups.add('deportivo');
    if (/casual|diario|cotidiano/.test(occasion)) groups.add('casual');
    if (/urbano|salida|noche/.test(occasion)) groups.add('urbano');
  });
  return groups;
}

function getOccasionCompatibilityScore(first, second) {
  const firstGroups = getOccasionGroups(first);
  const secondGroups = getOccasionGroups(second);
  if (!firstGroups.size || !secondGroups.size) return 0;
  if ([...firstGroups].some((group) => secondGroups.has(group))) return 3;
  if ((firstGroups.has('formal') && secondGroups.has('deportivo')) || (firstGroups.has('deportivo') && secondGroups.has('formal'))) return -8;
  return -1;
}

function getSilhouette(item) {
  const text = normalizeOutfitText(`${item?.subtype || ''} ${item?.description || ''}`);
  if (/oversize|holgad|ancho|wide|baggy/.test(text)) return 'loose';
  if (/ajustad|entallad|skinny|chupin/.test(text)) return 'fitted';
  return '';
}

function getProportionScore(first, second) {
  const firstSilhouette = getSilhouette(first);
  const secondSilhouette = getSilhouette(second);
  if (!firstSilhouette || !secondSilhouette) return 0;
  if (firstSilhouette === 'loose' && secondSilhouette === 'loose') return -5;
  if (firstSilhouette !== secondSilhouette) return 3;
  return 0;
}

function getLayerCompatibilityScore(first, second) {
  const softLayers = new Set(['Buzo', 'Sweater']);
  if (first.category === second.category && softLayers.has(first.category)) return -7;
  if (softLayers.has(first.category) && softLayers.has(second.category)) return -5;
  return 0;
}

function getGarmentPairScore(first, second) {
  return getGarmentColorScore(first, second)
    + getStyleCompatibilityScore(first, second)
    + getPatternCompatibilityScore(first, second)
    + getOccasionCompatibilityScore(first, second)
    + getProportionScore(first, second)
    + getLayerCompatibilityScore(first, second);
}

function hasHardOutfitConflict(item, selectedItems) {
  return selectedItems.some((selected) => (
    getStyleCompatibilityScore(item, selected) <= -10
    || getPatternCompatibilityScore(item, selected) <= -8
    || getLayerCompatibilityScore(item, selected) <= -7
  ));
}

function getSeasonScore(item, temp) {
  const seasons = Array.isArray(item?.seasons) ? item.seasons.map(normalizeOutfitText).filter(Boolean) : [];
  if (!seasons.length) return 0;
  const suitable = temp >= 25
    ? ['verano']
    : temp >= 18
      ? ['verano', 'primavera']
      : temp >= 10
        ? ['otono', 'primavera']
        : ['invierno', 'otono'];
  return seasons.some((season) => suitable.includes(season)) ? 4 : -7;
}

function outfitNeedsMidLayer(spec) {
  const details = spec?.outfit?.details || {};
  return /buzo|sweater|cardigan/i.test(`${details.top || ''} ${details.outer || ''}`);
}

function outfitNeedsOuterLayer(spec) {
  const advice = spec?.outfit?.details?.outer || '';
  if (/^(no hace falta abrigo|sin abrigo)/i.test(advice)) return false;
  return /campera|abrigo|piloto|impermeable|rompeviento|cortaviento|acolchada|tapado/i.test(advice);
}

function getOutfitSlotAdvice(slot, spec) {
  if (AppState.outfitOccasion === 'training') return getTrainingSlotAdvice(slot, spec);
  const details = spec?.outfit?.details || {};
  if (slot === 'top') return String(details.top || 'Remera o camisa').split('+')[0].trim();
  if (slot === 'mid') {
    const advice = [details.top, details.outer].find((value) => /buzo|sweater|cardigan/i.test(value || '')) || '';
    const layer = String(advice).split('+').find((value) => /buzo|sweater|cardigan/i.test(value));
    return layer?.trim() || 'Buzo o sweater';
  }
  if (slot === 'outer' && String(details.outer || '').includes('+')) {
    return String(details.outer).split('+').pop().trim();
  }
  return details[slot] || 'Sugerencia general';
}

function getTrainingSlotAdvice(slot, spec) {
  const temp = Number(spec?.temp ?? 20);
  if (slot === 'top') return temp < 10 ? 'Remera térmica deportiva' : 'Remera deportiva respirable';
  if (slot === 'mid') return temp < 10 ? 'Buzo deportivo abrigado' : 'Buzo deportivo liviano';
  if (slot === 'outer') return spec?.isRain ? 'Campera deportiva impermeable' : 'Campera deportiva cortaviento';
  if (slot === 'bottom') return temp >= 18 ? 'Short o calza deportiva' : 'Pantalón o calza deportiva';
  if (slot === 'feet') return 'Zapatillas deportivas y medias cómodas';
  return 'Prenda deportiva';
}

function renderOutfitPieces() {
  const pieces = AppState.currentOutfitPieces;
  const spec = AppState.outfitSpec;
  if (!pieces || !spec) return;
  const order = ['top', 'mid', 'outer', 'bottom', 'feet'];
  const visibleOrder = order.filter((slot) => !pieces[slot]?.isOptional);
  const ownCount = visibleOrder.filter((slot) => pieces[slot]?.item).length;
  const hasAlternatives = visibleOrder.some((slot) => {
    const currentId = pieces[slot]?.item?.id;
    return getOutfitCandidates(slot).some((item) => item.id !== currentId);
  });
  const occasionLabel = AppState.outfitOccasion === 'training' ? 'Entrenar' : 'Casual';
  const wardrobeLabel = ownCount
    ? `Combinado con ${ownCount} ${ownCount === 1 ? 'prenda tuya' : 'prendas tuyas'} · ${occasionLabel} · sin IA`
    : `Sugerencia ${occasionLabel.toLowerCase()} · sin IA`;

  elements.garmentVisual.innerHTML = `
    <div class="outfit-wardrobe-heading">
      <span class="outfit-wardrobe-label"><i></i>${wardrobeLabel}</span>
      <button class="outfit-reroll-button" type="button" data-reroll-outfit ${hasAlternatives ? '' : 'disabled'} aria-label="Probar otra combinación">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 10a7 7 0 0 0-12-3L4 10m16 4-2.5 3a7 7 0 0 1-12-3"/></svg>
        Otra combinación
      </button>
    </div>
    <div class="outfit-piece-grid">
      ${visibleOrder.map((slot) => renderOutfitPiece(pieces[slot], spec)).join('')}
    </div>
  `;
}

function renderOutfitPiece(piece, spec) {
  const definition = OUTFIT_SLOTS[piece.slot];
  const candidates = getOutfitCandidates(piece.slot);
  if (piece.item) {
    const item = piece.item;
    return `
      <article class="outfit-piece">
        <div class="outfit-piece-media">
          <img src="${item.image}" alt="${escapeHtml(item.category)} ${escapeHtml(item.color)}">
          <span class="outfit-piece-source">Tu ropa</span>
        </div>
        <div class="outfit-piece-copy">
          <small>${definition.label}</small>
          <strong>${escapeHtml(item.category)}</strong>
          <span>${escapeHtml(item.color)} · ${escapeHtml(item.style)}</span>
        </div>
        <button class="outfit-piece-action" type="button" data-outfit-action="swap" data-outfit-slot="${piece.slot}" aria-label="Cambiar ${definition.label.toLowerCase()}">Cambiar</button>
      </article>`;
  }

  const canChoose = !piece.isOptional && candidates.length > 0;
  const canAdd = !piece.isOptional && !candidates.length;
  const additionRecommendation = canAdd ? findRecommendationForOutfitSlot(piece.slot) : null;
  const action = canChoose
    ? `<button class="outfit-piece-action" type="button" data-outfit-action="swap" data-outfit-slot="${piece.slot}" aria-label="Ver opciones para ${definition.label.toLowerCase()}">Ver opciones</button>`
    : canAdd
      ? additionRecommendation
        ? `<button class="outfit-piece-action" type="button" data-outfit-action="recommend" data-outfit-slot="${piece.slot}" data-recommendation-id="${escapeHtml(additionRecommendation.id)}" aria-label="Ver recomendación para ${definition.label.toLowerCase()}">Ver qué conviene sumar</button>`
        : `<button class="outfit-piece-action" type="button" data-outfit-action="add" data-outfit-slot="${piece.slot}" aria-label="Agregar prenda para ${definition.label.toLowerCase()} a Mi ropa">Agregar a Mi ropa</button>`
      : '';
  return `
    <article class="outfit-piece is-generic">
      <div class="outfit-piece-media">
        <span class="outfit-piece-generic" style="--piece-color:${definition.color}">${GARMENT_SVGS[definition.icon]}</span>
        <span class="outfit-piece-source">Sugerencia</span>
      </div>
      <div class="outfit-piece-copy">
        <small>${definition.label}</small>
        <strong>${piece.isOptional && piece.slot === 'bottom' ? 'Ya está resuelto' : 'Opción genérica'}</strong>
        <span>${escapeHtml(piece.genericText || spec.outfit.details[piece.slot])}</span>
      </div>
      ${action}
    </article>`;
}

function findRecommendationForOutfitSlot(slot) {
  const recommendations = analyzeWardrobeRecommendations('all')?.recommendations || [];
  return recommendations.find((recommendation) => globalThis.QMPRecommendations?.getSlot(recommendation) === slot) || null;
}

function openOutfitSwap(slot) {
  const spec = AppState.outfitSpec;
  const pieces = AppState.currentOutfitPieces;
  if (!spec || !pieces?.[slot]) return;
  const currentId = pieces[slot].item?.id;
  const usedElsewhere = new Set(Object.entries(pieces)
    .filter(([pieceSlot, piece]) => pieceSlot !== slot && piece.item)
    .map(([, piece]) => piece.item.id));
  const selectedItems = Object.entries(pieces)
    .filter(([pieceSlot, piece]) => pieceSlot !== slot && piece.item)
    .map(([, piece]) => piece.item);
  const candidates = rankOutfitCandidates(slot, spec, selectedItems, getPreferredOutfitStyle(AppState.outfitVariation))
    .filter((item) => item.id !== currentId && !usedElsewhere.has(item.id));

  AppState.swappingOutfitSlot = slot;
  const definition = OUTFIT_SLOTS[slot];
  elements.outfitSwapTitle.textContent = `Cambiar ${definition.label.toLowerCase()}`;
  elements.outfitSwapDescription.textContent = `Ordenamos tus prendas de ${definition.label.toLowerCase()} según el clima, el estilo y los colores del look.`;
  elements.outfitSwapOptions.innerHTML = candidates.length
    ? candidates.map((item, index) => `
      <button class="outfit-swap-option" type="button" data-outfit-garment-id="${escapeHtml(item.id)}">
        <span class="outfit-swap-image"><img src="${item.image}" alt="${escapeHtml(item.category)} ${escapeHtml(item.color)}"></span>
        <span class="outfit-swap-copy"><strong>${escapeHtml(item.category)}</strong><span>${escapeHtml(item.color)} · ${escapeHtml(item.style)} · Abrigo ${escapeHtml(item.warmth.toLowerCase())}</span></span>
        <span class="outfit-swap-choice">${index === 0 ? 'Combina mejor' : 'Elegir'}</span>
      </button>`).join('')
    : `<div class="outfit-swap-empty">${GARMENT_SVGS.percha}<strong>No hay otra opción cargada</strong><p>Podés sumar otra prenda desde Mi ropa y aparecerá automáticamente entre las alternativas.</p></div>`;
  elements.outfitSwapDialog.showModal();
}

function replaceOutfitPiece(slot, garmentId) {
  const item = AppState.wardrobe.find((garment) => garment.id === garmentId);
  if (!item || !AppState.currentOutfitPieces) return;
  const previousTopWasDress = AppState.currentOutfitPieces.top?.item?.category === 'Vestido';
  AppState.currentOutfitPieces[slot] = { slot, item, genericText: '', isOptional: false };

  if (slot === 'top' && item.category === 'Vestido') {
    AppState.currentOutfitPieces.bottom = makeGenericOutfitPiece('bottom', AppState.outfitSpec, 'El vestido ya completa la parte de abajo.', true);
  } else if (slot === 'top' && previousTopWasDress) {
    const usedItems = Object.entries(AppState.currentOutfitPieces)
      .filter(([pieceSlot, piece]) => pieceSlot !== 'bottom' && piece.item)
      .map(([, piece]) => piece.item);
    const replacement = rankOutfitCandidates('bottom', AppState.outfitSpec, usedItems, item.style)
      .find((candidate) => !usedItems.some((used) => used.id === candidate.id));
    AppState.currentOutfitPieces.bottom = replacement
      ? { slot: 'bottom', item: replacement, genericText: '', isOptional: false }
      : makeGenericOutfitPiece('bottom', AppState.outfitSpec);
  }
  renderOutfitPieces();
}

function loadWardrobe() {
  try {
    const saved = JSON.parse(localStorage.getItem(WARDROBE_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const validImage = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
    return saved.filter((item) => item && typeof item.id === 'string' && typeof item.image === 'string' && validImage.test(item.image))
      .map((item) => ({
        id: item.id,
        image: item.image,
        category: typeof item.category === 'string' ? item.category : 'Prenda',
        color: typeof item.color === 'string' ? item.color : 'Sin definir',
        warmth: typeof item.warmth === 'string' ? item.warmth : 'Medio',
        style: typeof item.style === 'string' ? item.style : 'Casual',
        subtype: typeof item.subtype === 'string' ? item.subtype : '',
        secondaryColors: Array.isArray(item.secondaryColors) ? item.secondaryColors.filter((value) => typeof value === 'string') : [],
        pattern: typeof item.pattern === 'string' ? item.pattern : '',
        material: typeof item.material === 'string' ? item.material : '',
        waterproof: typeof item.waterproof === 'boolean' ? item.waterproof : null,
        seasons: Array.isArray(item.seasons) ? item.seasons.filter((value) => typeof value === 'string') : [],
        occasions: Array.isArray(item.occasions) ? item.occasions.filter((value) => typeof value === 'string') : [],
        description: typeof item.description === 'string' ? item.description : '',
        confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : null,
        createdAt: item.createdAt || ''
      }));
  } catch (_) {
    return [];
  }
}

function handleWardrobeAuthChange(event) {
  AppState.recommendationFeedback = loadRecommendationFeedback();
  if (event.detail?.user) {
    loadRemoteWardrobe();
    loadAiQuota();
    loadRemoteRecommendationFeedback();
    return;
  }
  AppState.recommendationFeedbackRemote = false;
  clearTimeout(aiQuotaRefreshTimer);
  AppState.aiQuota = { limit: 5, remaining: 5, resetAt: null, mode: 'gemini', available: false, unlimited: false };
  renderAiQuota();
  releaseWardrobeImages(AppState.wardrobe);
  AppState.wardrobeRemote = false;
  AppState.wardrobe = [];
  renderWardrobe();
  refreshWardrobeOutfit();
}

async function wardrobeApi(path, options = {}, forceRefresh = false) {
  if (!globalThis.QMPAuth) throw new Error('La autenticación todavía no está lista.');
  const token = await globalThis.QMPAuth.getIdToken(forceRefresh);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${WARDROBE_API_BASE}/${path}`, { ...options, headers });
  if (response.status === 401 && !forceRefresh) return wardrobeApi(path, options, true);
  if (!response.ok) {
    let message = 'No pudimos conectar con tu guardarropa.';
    let payload = null;
    try {
      payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch (_) {}
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response;
}

async function loadRemoteWardrobe() {
  if (AppState.wardrobeSyncing) return;
  AppState.wardrobeSyncing = true;
  const localItems = loadWardrobe();
  showWardrobeToast('Sincronizando tu ropa…');
  try {
    let response = await wardrobeApi('garments.php');
    let payload = await response.json();

    const remoteIds = new Set((payload.garments || []).map((item) => item.id));
    const pendingLocalItems = localItems.filter((item) => !remoteIds.has(item.id));
    if (pendingLocalItems.length) {
      for (const item of pendingLocalItems) await saveGarmentToServer(item);
      response = await wardrobeApi('garments.php');
      payload = await response.json();
      localStorage.removeItem(WARDROBE_STORAGE_KEY);
    }

    const remoteItems = await Promise.all((payload.garments || []).map(async (item) => {
      const imageResponse = await wardrobeApi(`image.php?id=${encodeURIComponent(item.id)}`);
      const image = URL.createObjectURL(await imageResponse.blob());
      return { ...item, image, remoteImage: true };
    }));

    releaseWardrobeImages(AppState.wardrobe);
    AppState.wardrobe = remoteItems;
    AppState.wardrobeRemote = true;
    renderWardrobe();
    refreshWardrobeOutfit();
    showWardrobeToast(remoteItems.length ? '✓ Tu ropa está sincronizada' : 'Tu guardarropa está listo');
  } catch (error) {
    AppState.wardrobeRemote = false;
    AppState.wardrobe = localItems;
    renderWardrobe();
    showWardrobeToast(error.message || 'No pudimos sincronizar tu ropa.', true);
  } finally {
    AppState.wardrobeSyncing = false;
  }
}

function releaseWardrobeImages(items) {
  items.forEach((item) => {
    if (item.remoteImage && typeof item.image === 'string' && item.image.startsWith('blob:')) URL.revokeObjectURL(item.image);
  });
}

async function garmentImageBlob(image) {
  const response = await fetch(image);
  if (!response.ok) throw new Error('No pudimos preparar la foto.');
  return response.blob();
}

async function saveGarmentToServer(garment) {
  const body = new FormData();
  body.set('id', garment.id);
  body.set('category', garment.category);
  body.set('color', garment.color);
  body.set('warmth', garment.warmth);
  body.set('style', garment.style);
  body.set('subtype', garment.subtype || '');
  body.set('secondaryColors', JSON.stringify(garment.secondaryColors || []));
  body.set('pattern', garment.pattern || '');
  body.set('material', garment.material || '');
  body.set('waterproof', typeof garment.waterproof === 'boolean' ? (garment.waterproof ? '1' : '0') : '');
  body.set('seasons', JSON.stringify(garment.seasons || []));
  body.set('occasions', JSON.stringify(garment.occasions || []));
  body.set('description', garment.description || '');
  body.set('confidence', garment.confidence == null ? '' : String(garment.confidence));
  const imageBlob = await garmentImageBlob(garment.image);
  body.set('image', imageBlob, `${garment.id}.jpg`);
  await wardrobeApi('garments.php', { method: 'POST', body });
}

function persistWardrobe(items) {
  if (AppState.wardrobeRemote) {
    AppState.wardrobe = items;
    return true;
  }
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(items));
    AppState.wardrobe = items;
    return true;
  } catch (_) {
    const message = 'No queda espacio local. Eliminá alguna prenda e intentá otra vez.';
    elements.garmentSaveError.textContent = message;
    showWardrobeToast(message, true);
    return false;
  }
}

function renderWardrobe() {
  const count = AppState.wardrobe.length;
  elements.wardrobeCount.textContent = count === 0 ? 'Todavía no agregaste prendas' : `${count} ${count === 1 ? 'prenda guardada' : 'prendas guardadas'}`;
  elements.wardrobeEmpty.hidden = count > 0;
  elements.wardrobeGrid.hidden = count === 0;
  renderWardrobeInsights();

  if (!count) {
    elements.wardrobeGrid.replaceChildren();
    return;
  }

  elements.wardrobeGrid.innerHTML = AppState.wardrobe.map((item) => `
    <button class="garment-card" type="button" data-garment-id="${escapeHtml(item.id)}" aria-label="Ver ${escapeHtml(item.category)} ${escapeHtml(item.color)}">
      <div class="garment-card-image">
        <img src="${item.image}" alt="${escapeHtml(item.category)} ${escapeHtml(item.color)}" loading="lazy">
      </div>
      <div class="garment-card-copy">
        <strong>${escapeHtml(item.category)}</strong>
        <span><i class="garment-color-dot" style="--garment-swatch:${getGarmentSwatch(item.color)}"></i>${escapeHtml(item.color)}</span>
      </div>
    </button>
  `).join('');

  elements.wardrobeGrid.querySelectorAll('[data-garment-id]').forEach((card) => card.addEventListener('click', () => openGarmentDetail(card.dataset.garmentId)));
}

function initWardrobeInsights() {
  AppState.recommendationFeedback = loadRecommendationFeedback();
  if (!elements.wardrobeInsights || !elements.recommendationsDialog || !globalThis.QMPRecommendations) return;

  elements.wardrobeInsights.addEventListener('click', (event) => {
    const action = event.target.closest('[data-wardrobe-insight-action]');
    if (!action) return;
    if (action.dataset.wardrobeInsightAction === 'add') {
      openGarmentSource();
      return;
    }
    const filter = action.dataset.wardrobeInsightAction === 'saved' ? 'saved' : 'all';
    openRecommendationsDialog(filter, action.dataset.recommendationId || null);
  });

  elements.closeRecommendations.addEventListener('click', () => elements.recommendationsDialog.close());
  elements.recommendationsBack.addEventListener('click', handleRecommendationsBack);
  elements.recommendationsDialog.addEventListener('cancel', showRecommendationsOverview);
  elements.recommendationsDialog.addEventListener('close', showRecommendationsOverview);
  elements.recommendationsDialog.addEventListener('click', (event) => {
    if (event.target === elements.recommendationsDialog) elements.recommendationsDialog.close();
  });

  elements.recommendationFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recommendation-filter]');
    if (!button) return;
    AppState.recommendationFilter = button.dataset.recommendationFilter || 'all';
    renderRecommendationsOverview();
  });

  elements.recommendationsList.addEventListener('click', async (event) => {
    const resetButton = event.target.closest('[data-recommendation-reset]');
    if (resetButton) {
      AppState.recommendationFeedback = {};
      saveRecommendationFeedback();
      renderWardrobeInsights();
      renderRecommendationsOverview();
      try {
        await clearRecommendationFeedbackOnServer();
        showRecommendationsToast('Volvimos a mostrar todas las opciones.');
      } catch (error) {
        showRecommendationsToast('Las opciones volvieron a mostrarse en este dispositivo. La cuenta se sincronizará al reconectar.');
      }
      return;
    }
    const card = event.target.closest('[data-recommendation-id]');
    if (card) {
      AppState.recommendationDetailOrigin = 'overview';
      showRecommendationDetail(card.dataset.recommendationId);
    }
  });

  elements.recommendationDetail.addEventListener('click', handleRecommendationDetailAction);
}

function loadRecommendationFeedback() {
  try {
    const feedback = JSON.parse(localStorage.getItem(recommendationFeedbackStorageKey()) || '{}');
    if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return {};
    return Object.fromEntries(Object.entries(feedback).filter(([recommendationId, entry]) => (
      /^[A-Za-z0-9-]{3,80}$/.test(recommendationId)
      && entry
      && ['saved', 'owned', 'dismissed', 'removed'].includes(entry.status)
    )));
  } catch (_) {
    return {};
  }
}

function recommendationFeedbackStorageKey() {
  const userId = globalThis.QMPAuth?.getUser()?.uid;
  return `${RECOMMENDATION_FEEDBACK_KEY}:${userId || 'local'}`;
}

function saveRecommendationFeedback() {
  try {
    localStorage.setItem(recommendationFeedbackStorageKey(), JSON.stringify(AppState.recommendationFeedback));
  } catch (_) {
    // Las recomendaciones siguen funcionando aunque el navegador bloquee el almacenamiento.
  }
}

function recommendationFeedbackTimestamp(entry) {
  const timestamp = Date.parse(entry?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recommendationSnapshot(recommendation) {
  if (!recommendation) return null;
  return {
    id: recommendation.id,
    label: recommendation.label,
    icon: recommendation.icon,
    colorsCopy: recommendation.colorsCopy,
    searchText: recommendation.searchText,
    reason: recommendation.reason,
    impactLabel: recommendation.impactLabel,
    looksNew: recommendation.looksNew,
    compatibleCount: recommendation.compatibleCount,
    compatibleGarmentIds: Array.isArray(recommendation.compatibleGarmentIds) ? recommendation.compatibleGarmentIds : [],
    specs: Array.isArray(recommendation.specs) ? recommendation.specs : []
  };
}

function recommendationFeedbackFromRemote(item) {
  if (!item || typeof item.id !== 'string' || typeof item.status !== 'string') return null;
  return {
    status: item.status,
    snapshot: item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : null,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : ''
  };
}

async function saveRecommendationFeedbackToServer(recommendationId, entry) {
  if (!globalThis.QMPAuth?.getUser()) return null;
  const body = new FormData();
  body.set('id', recommendationId);
  body.set('status', entry.status);
  if (entry.snapshot) body.set('snapshot', JSON.stringify(entry.snapshot));
  const response = await wardrobeApi('recommendations.php', { method: 'POST', body });
  const payload = await response.json();
  return recommendationFeedbackFromRemote(payload.feedback);
}

async function persistRecommendationFeedback(recommendationId, entry) {
  const remoteEntry = await saveRecommendationFeedbackToServer(recommendationId, entry);
  const currentEntry = AppState.recommendationFeedback[recommendationId];
  if (remoteEntry && currentEntry?.updatedAt === entry.updatedAt) {
    AppState.recommendationFeedback[recommendationId] = {
      ...currentEntry,
      ...remoteEntry,
      snapshot: remoteEntry.snapshot || currentEntry.snapshot || null
    };
    AppState.recommendationFeedbackRemote = true;
    saveRecommendationFeedback();
  }
  return remoteEntry;
}

async function clearRecommendationFeedbackOnServer() {
  if (!globalThis.QMPAuth?.getUser()) return;
  await wardrobeApi('recommendations.php', { method: 'DELETE' });
}

async function loadRemoteRecommendationFeedback() {
  if (!globalThis.QMPAuth?.getUser() || AppState.recommendationFeedbackSyncing) return;
  AppState.recommendationFeedbackSyncing = true;
  const localFeedback = loadRecommendationFeedback();
  try {
    const response = await wardrobeApi('recommendations.php');
    const payload = await response.json();
    const remoteFeedback = {};
    (payload.feedback || []).forEach((item) => {
      const entry = recommendationFeedbackFromRemote(item);
      if (entry) remoteFeedback[item.id] = entry;
    });

    const mergedFeedback = { ...remoteFeedback };
    for (const [recommendationId, localEntry] of Object.entries(localFeedback)) {
      const remoteEntry = remoteFeedback[recommendationId];
      if (remoteEntry && recommendationFeedbackTimestamp(remoteEntry) >= recommendationFeedbackTimestamp(localEntry)) {
        continue;
      }
      const savedEntry = await saveRecommendationFeedbackToServer(recommendationId, localEntry);
      mergedFeedback[recommendationId] = savedEntry || localEntry;
    }

    AppState.recommendationFeedback = mergedFeedback;
    AppState.recommendationFeedbackRemote = true;
    saveRecommendationFeedback();
  } catch (error) {
    AppState.recommendationFeedback = localFeedback;
    AppState.recommendationFeedbackRemote = false;
  } finally {
    AppState.recommendationFeedbackSyncing = false;
    renderWardrobeInsights();
    if (elements.recommendationsDialog?.open) renderRecommendationsOverview();
  }
}

function analyzeWardrobeRecommendations(filter = 'all') {
  if (!globalThis.QMPRecommendations) return null;
  return globalThis.QMPRecommendations.analyze(AppState.wardrobe, {
    filter,
    feedback: AppState.recommendationFeedback
  });
}

function recommendationSavedCount() {
  return Object.values(AppState.recommendationFeedback)
    .filter((entry) => entry?.status === 'saved').length;
}

function recommendationFromSavedSnapshot(recommendationId, entry) {
  const snapshot = entry?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    id: recommendationId,
    label: typeof snapshot.label === 'string' ? snapshot.label : 'Recomendación guardada',
    icon: typeof snapshot.icon === 'string' ? snapshot.icon : 'percha',
    colorsCopy: typeof snapshot.colorsCopy === 'string' ? snapshot.colorsCopy : '',
    searchText: typeof snapshot.searchText === 'string' ? snapshot.searchText : '',
    reason: typeof snapshot.reason === 'string' ? snapshot.reason : 'La guardaste para revisarla más adelante.',
    impactLabel: 'Guardada',
    looksNew: Number.isFinite(Number(snapshot.looksNew)) ? Number(snapshot.looksNew) : 0,
    compatibleCount: Number.isFinite(Number(snapshot.compatibleCount)) ? Number(snapshot.compatibleCount) : 0,
    compatibleGarmentIds: Array.isArray(snapshot.compatibleGarmentIds) ? snapshot.compatibleGarmentIds.filter((id) => typeof id === 'string') : [],
    specs: Array.isArray(snapshot.specs)
      ? snapshot.specs.filter((spec) => Array.isArray(spec) && spec.length >= 2)
      : [],
    saved: true
  };
}

function savedRecommendationsForDisplay(currentRecommendations = []) {
  const recommendations = [...currentRecommendations];
  const existingIds = new Set(recommendations.map((recommendation) => recommendation.id));
  Object.entries(AppState.recommendationFeedback).forEach(([recommendationId, entry]) => {
    if (entry?.status !== 'saved' || existingIds.has(recommendationId)) return;
    const recommendation = recommendationFromSavedSnapshot(recommendationId, entry);
    if (recommendation) recommendations.push(recommendation);
  });
  return recommendations;
}

function recommendationIcon(recommendation) {
  return GARMENT_SVGS[recommendation?.icon] || GARMENT_SVGS.percha;
}

function renderWardrobeInsights() {
  if (!elements.wardrobeInsights || !globalThis.QMPRecommendations) {
    if (elements.wardrobeInsights) elements.wardrobeInsights.hidden = true;
    return;
  }

  const savedCount = recommendationSavedCount();
  if (AppState.wardrobe.length === 0) {
    if (!savedCount) {
      elements.wardrobeInsights.hidden = true;
      return;
    }
    elements.wardrobeInsights.hidden = false;
    elements.wardrobeInsights.innerHTML = `
      <article class="wardrobe-insight-card glass-card">
        <div class="wardrobe-insight-layout">
          <div class="wardrobe-insight-copy">
            <span class="wardrobe-insight-kicker">Tus próximas compras</span>
            <h3>Tenés ${savedCount} ${savedCount === 1 ? 'recomendación guardada' : 'recomendaciones guardadas'}</h3>
            <p>Siguen disponibles en tu cuenta aunque cambies de dispositivo.</p>
          </div>
          <div class="wardrobe-insight-visual">${GARMENT_SVGS.percha}</div>
        </div>
        <button class="wardrobe-insight-action" type="button" data-wardrobe-insight-action="saved">Ver guardadas</button>
      </article>
    `;
    return;
  }

  const analysis = analyzeWardrobeRecommendations('all');
  if (!analysis) {
    elements.wardrobeInsights.hidden = true;
    return;
  }

  elements.wardrobeInsights.hidden = false;
  if (!analysis.ready) {
    const loaded = AppState.wardrobe.length;
    const remaining = Math.max(1, analysis.minimum - loaded);
    elements.wardrobeInsights.innerHTML = `
      <article class="wardrobe-insight-card glass-card is-progress">
        <div class="wardrobe-insight-layout">
          <div class="wardrobe-insight-copy">
            <span class="wardrobe-insight-kicker">Mejorá tu armario</span>
            <h3>Estamos aprendiendo tu estilo</h3>
            <p>Agregá ${remaining} ${remaining === 1 ? 'prenda más' : 'prendas más'} para detectar qué incorporación te daría más combinaciones.</p>
          </div>
          <div class="wardrobe-insight-visual">${GARMENT_SVGS.percha}</div>
        </div>
        <div class="wardrobe-progress" aria-label="${loaded} de ${analysis.minimum} prendas necesarias"><span style="width:${analysis.progress}%"></span></div>
        <p class="wardrobe-progress-copy">${loaded} de ${analysis.minimum} prendas para activar el análisis</p>
        <button class="wardrobe-insight-action" type="button" data-wardrobe-insight-action="add">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Agregar otra prenda
        </button>
        ${savedCount ? `<button class="wardrobe-insight-action is-secondary" type="button" data-wardrobe-insight-action="saved">Ver guardadas (${savedCount})</button>` : ''}
      </article>
    `;
    return;
  }

  const recommendation = analysis.recommendations[0];
  if (!recommendation) {
    elements.wardrobeInsights.innerHTML = `
      <article class="wardrobe-insight-card glass-card">
        <div class="wardrobe-insight-layout">
          <div class="wardrobe-insight-copy">
            <span class="wardrobe-insight-kicker">Armario analizado</span>
            <h3>Ya revisaste todas las sugerencias</h3>
            <p>Podés recuperar las opciones descartadas desde el análisis completo.</p>
          </div>
          <div class="wardrobe-insight-visual">${GARMENT_SVGS.percha}</div>
        </div>
        <button class="wardrobe-insight-action" type="button" data-wardrobe-insight-action="open">Revisar recomendaciones</button>
        ${savedCount ? `<button class="wardrobe-insight-action is-secondary" type="button" data-wardrobe-insight-action="saved">Ver guardadas (${savedCount})</button>` : ''}
      </article>
    `;
    return;
  }

  const looksMetric = recommendation.looksNew > 0
    ? `<span><strong>+${recommendation.looksNew}</strong> ${recommendation.looksNew === 1 ? 'look posible' : 'looks posibles'}</span>`
    : '<span><strong>Cubre</strong> un hueco del armario</span>';
  elements.wardrobeInsights.innerHTML = `
    <article class="wardrobe-insight-card glass-card">
      <div class="wardrobe-insight-layout">
        <div class="wardrobe-insight-copy">
          <span class="wardrobe-insight-kicker">${escapeHtml(recommendation.impactLabel)}</span>
          <h3>${escapeHtml(recommendation.label)}</h3>
          <p>${escapeHtml(recommendation.reason)}</p>
        </div>
        <div class="wardrobe-insight-visual">${recommendationIcon(recommendation)}</div>
      </div>
      <div class="wardrobe-insight-metrics">
        ${looksMetric}
        <span>Combina con <strong>${recommendation.compatibleCount}</strong> prendas</span>
      </div>
      <button class="wardrobe-insight-action" type="button" data-wardrobe-insight-action="open" data-recommendation-id="${escapeHtml(recommendation.id)}">
        Ver por qué te conviene
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      ${savedCount ? `<button class="wardrobe-insight-action is-secondary" type="button" data-wardrobe-insight-action="saved">Ver guardadas (${savedCount})</button>` : ''}
    </article>
  `;
}

function openRecommendationsDialog(filter = 'all', recommendationId = null) {
  if (!elements.recommendationsDialog || !globalThis.QMPRecommendations) return;
  AppState.recommendationsReturnView = document.querySelector('.view.active')?.id || 'wardrobeView';
  AppState.recommendationDetailOrigin = recommendationId ? 'source' : 'overview';
  AppState.recommendationFilter = filter;
  renderRecommendationsOverview();
  elements.recommendationsDialog.showModal();
  if (recommendationId) showRecommendationDetail(recommendationId);
}

function renderRecommendationsOverview() {
  if (!elements.recommendationsOverview) return;
  AppState.selectedRecommendationId = null;
  elements.recommendationsBack.hidden = true;
  elements.recommendationsHeading.hidden = false;
  elements.recommendationsOverview.hidden = false;
  elements.recommendationDetail.hidden = true;
  const savedCount = recommendationSavedCount();
  if (elements.recommendationSavedCount) elements.recommendationSavedCount.textContent = String(savedCount);

  elements.recommendationFilters.querySelectorAll('[data-recommendation-filter]').forEach((button) => {
    const active = button.dataset.recommendationFilter === AppState.recommendationFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const isSavedFilter = AppState.recommendationFilter === 'saved';
  const analysis = analyzeWardrobeRecommendations(AppState.recommendationFilter);
  const recommendations = isSavedFilter
    ? savedRecommendationsForDisplay(analysis?.recommendations || [])
    : (analysis?.recommendations || []);
  if (!isSavedFilter && !analysis?.ready) {
    elements.recommendationsList.innerHTML = `
      <div class="recommendations-empty">
        <strong>Necesitamos conocer un poco más tu ropa</strong>
        <p>Agregá al menos ${analysis?.minimum || 5} prendas para comparar combinaciones y detectar oportunidades reales.</p>
      </div>
    `;
    return;
  }

  if (!recommendations.length) {
    if (isSavedFilter) {
      elements.recommendationsList.innerHTML = `
        <div class="recommendations-empty">
          <strong>Todavía no guardaste recomendaciones</strong>
          <p>Cuando encuentres una prenda que quieras buscar después, guardala y va a aparecer acá en todos tus dispositivos.</p>
        </div>
      `;
      return;
    }
    elements.recommendationsList.innerHTML = `
      <div class="recommendations-empty">
        <strong>No quedan opciones en este objetivo</strong>
        <p>Ocultaste o marcaste como propias todas las recomendaciones disponibles.</p>
        <button type="button" data-recommendation-reset>Volver a mostrar opciones</button>
      </div>
    `;
    return;
  }

  elements.recommendationsList.innerHTML = recommendations.map((recommendation) => `
    <button class="recommendation-list-card" type="button" data-recommendation-id="${escapeHtml(recommendation.id)}">
      <span class="recommendation-list-icon">${recommendationIcon(recommendation)}</span>
      <span class="recommendation-list-copy">
        <span class="recommendation-impact">${escapeHtml(recommendation.saved ? 'Guardada · ' + recommendation.impactLabel : recommendation.impactLabel)}</span>
        <strong>${escapeHtml(recommendation.label)}</strong>
        <span>${escapeHtml(recommendation.colorsCopy)}</span>
        <span class="recommendation-list-metrics">
          <em>${recommendation.looksNew > 0 ? `+${recommendation.looksNew} looks` : 'Cubre una necesidad'}</em>
          <em>${recommendation.compatibleCount > 0 ? `${recommendation.compatibleCount} prendas compatibles` : 'Guardada en tu cuenta'}</em>
        </span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  `).join('');
}

function showRecommendationsOverview() {
  renderRecommendationsOverview();
  const shell = elements.recommendationsDialog?.querySelector('.recommendations-shell');
  if (shell) shell.scrollTop = 0;
}

function handleRecommendationsBack() {
  if (AppState.recommendationDetailOrigin === 'source') {
    elements.recommendationsDialog.close();
    return;
  }
  showRecommendationsOverview();
}

function recommendationsReturnLabel() {
  const labels = {
    homeView: 'Inicio',
    wardrobeView: 'Mi ropa',
    settingsView: 'Ajustes'
  };
  return labels[AppState.recommendationsReturnView] || 'Mi ropa';
}

function findRecommendation(recommendationId) {
  const current = analyzeWardrobeRecommendations(AppState.recommendationFilter)?.recommendations || [];
  const all = analyzeWardrobeRecommendations('all')?.recommendations || [];
  return current.find((item) => item.id === recommendationId)
    || all.find((item) => item.id === recommendationId)
    || recommendationFromSavedSnapshot(recommendationId, AppState.recommendationFeedback[recommendationId])
    || null;
}

function showRecommendationDetail(recommendationId) {
  const recommendation = findRecommendation(recommendationId);
  if (!recommendation) {
    renderRecommendationsOverview();
    return;
  }

  AppState.selectedRecommendationId = recommendation.id;
  elements.recommendationsBack.hidden = false;
  const backDestination = AppState.recommendationDetailOrigin === 'source'
    ? recommendationsReturnLabel()
    : 'recomendaciones';
  const backLabel = elements.recommendationsBack.querySelector('span');
  if (backLabel) backLabel.textContent = `Volver a ${backDestination}`;
  elements.recommendationsBack.setAttribute('aria-label', `Volver a ${backDestination}`);
  elements.recommendationsHeading.hidden = true;
  elements.recommendationsOverview.hidden = true;
  elements.recommendationDetail.hidden = false;

  const compatibleGarments = recommendation.compatibleGarmentIds
    .map((id) => AppState.wardrobe.find((item) => item.id === id))
    .filter(Boolean);
  const visibleGarments = compatibleGarments.slice(0, 4);
  const remainingGarments = Math.max(0, compatibleGarments.length - visibleGarments.length);
  const compatibleMarkup = visibleGarments.map((garment) => `
    <div class="recommendation-compatible-item">
      <img src="${garment.image}" alt="${escapeHtml(garment.category)} ${escapeHtml(garment.color)}">
    </div>
  `).join('');
  const moreMarkup = remainingGarments > 0
    ? `<div class="recommendation-compatible-item recommendation-compatible-more">+${remainingGarments}</div>`
    : '';

  elements.recommendationDetail.innerHTML = `
    <div class="recommendation-detail-hero">
      <div class="recommendation-detail-icon">${recommendationIcon(recommendation)}</div>
      <div class="recommendation-detail-title">
        <span>${escapeHtml(recommendation.impactLabel)}</span>
        <h3>${escapeHtml(recommendation.label)}</h3>
        <p>${escapeHtml(recommendation.colorsCopy)}</p>
      </div>
    </div>

    <div class="recommendation-detail-metrics">
      <div class="recommendation-detail-metric"><strong>${recommendation.looksNew > 0 ? `+${recommendation.looksNew}` : 'Nueva'}</strong><span>${recommendation.looksNew > 0 ? 'looks posibles' : 'necesidad cubierta'}</span></div>
      <div class="recommendation-detail-metric"><strong>${recommendation.compatibleCount}</strong><span>prendas compatibles</span></div>
    </div>

    <section class="recommendation-section">
      <h4>Por qué te conviene</h4>
      <p>${escapeHtml(recommendation.reason)}</p>
    </section>

    <section class="recommendation-section">
      <h4>Combinaría con lo que ya tenés</h4>
      ${compatibleGarments.length
        ? `<div class="recommendation-compatible-grid">${compatibleMarkup}${moreMarkup}</div>`
        : '<p>Esta prenda cubriría un espacio que hoy está vacío en tu armario.</p>'}
    </section>

    <section class="recommendation-section">
      <h4>Qué buscar</h4>
      <div class="recommendation-specs">
        ${recommendation.specs.map(([label, value]) => `
          <div class="recommendation-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'Flexible')}</strong></div>
        `).join('')}
      </div>
      <a class="recommendation-google-search" href="https://www.google.com/search?q=${encodeURIComponent(recommendation.searchText)}" target="_blank" rel="noopener noreferrer" aria-label="Buscar esta recomendación en Google; se abre en una pestaña nueva">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
        Buscar en Google
      </a>
    </section>

    <div class="recommendation-actions">
      <button class="recommendation-save ${recommendation.saved ? 'is-saved' : ''}" type="button" data-recommendation-action="save">
        ${recommendation.saved ? '✓ Guardada para buscar después' : 'Guardar para buscar después'}
      </button>
      <button class="recommendation-feedback" type="button" data-recommendation-action="owned">Ya tengo algo así</button>
      <button class="recommendation-feedback" type="button" data-recommendation-action="dismiss">No es mi estilo</button>
    </div>
  `;

  const shell = elements.recommendationsDialog.querySelector('.recommendations-shell');
  if (shell) shell.scrollTop = 0;
}

async function handleRecommendationDetailAction(event) {
  const button = event.target.closest('[data-recommendation-action]');
  if (!button || !AppState.selectedRecommendationId) return;
  const recommendation = findRecommendation(AppState.selectedRecommendationId);
  if (!recommendation) return;
  const action = button.dataset.recommendationAction;

  if (action === 'save') {
    const isSaved = AppState.recommendationFeedback[recommendation.id]?.status === 'saved';
    const entry = {
      status: isSaved ? 'removed' : 'saved',
      snapshot: recommendationSnapshot(recommendation),
      updatedAt: new Date().toISOString()
    };
    AppState.recommendationFeedback[recommendation.id] = entry;
    saveRecommendationFeedback();
    renderWardrobeInsights();
    showRecommendationDetail(recommendation.id);
    try {
      const remoteEntry = await persistRecommendationFeedback(recommendation.id, entry);
      if (isSaved) {
        showRecommendationsToast('Quitamos la recomendación de tus guardadas.');
      } else {
        showRecommendationsToast(remoteEntry ? 'Recomendación guardada en tu cuenta.' : 'Recomendación guardada en este dispositivo.');
      }
    } catch (error) {
      showRecommendationsToast(isSaved
        ? 'La quitamos en este dispositivo. Tu cuenta se sincronizará al reconectar.'
        : 'Guardada en este dispositivo. Tu cuenta se sincronizará al reconectar.');
    }
    return;
  }

  if (action === 'owned' || action === 'dismiss') {
    const entry = {
      status: action === 'owned' ? 'owned' : 'dismissed',
      snapshot: recommendationSnapshot(recommendation),
      updatedAt: new Date().toISOString()
    };
    AppState.recommendationFeedback[recommendation.id] = entry;
    saveRecommendationFeedback();
    renderWardrobeInsights();
    renderRecommendationsOverview();
    try {
      await persistRecommendationFeedback(recommendation.id, entry);
      showRecommendationsToast(action === 'owned' ? 'Entendido. No volveremos a sugerir algo igual.' : 'Vamos a priorizar opciones más cercanas a tu estilo.');
    } catch (error) {
      showRecommendationsToast('Actualizado en este dispositivo. Tu cuenta se sincronizará al reconectar.');
    }
  }
}

function showRecommendationsToast(message) {
  clearTimeout(recommendationsToastTimer);
  elements.recommendationsToast.textContent = message;
  elements.recommendationsToast.classList.add('is-visible');
  recommendationsToastTimer = setTimeout(() => {
    elements.recommendationsToast.classList.remove('is-visible');
    elements.recommendationsToast.textContent = '';
  }, 2600);
}

function openGarmentSource() {
  clearTimeout(garmentAnalysisTimer);
  AppState.garmentDraft = null;
  AppState.editingGarmentId = null;
  configureGarmentFormMode(false);
  elements.cameraInput.value = '';
  elements.galleryInput.value = '';
  elements.garmentFlowError.textContent = '';
  elements.garmentSaveError.textContent = '';
  elements.aiQuotaError.textContent = '';
  loadAiQuota();
  setGarmentStage('source');
  elements.garmentFlowDialog.showModal();
}

function setGarmentStage(stage) {
  if (stage !== 'camera') stopDesktopCamera();
  const titleIds = { source: 'garmentFlowTitle', camera: 'desktopCameraTitle', method: 'garmentMethodTitle', analyzing: 'garmentAnalysisTitle', confirm: 'garmentConfirmTitle' };
  elements.garmentStages.forEach((section) => { section.hidden = section.dataset.garmentStage !== stage; });
  elements.closeGarmentFlow.hidden = stage === 'analyzing';
  elements.garmentFlowDialog.setAttribute('aria-labelledby', titleIds[stage]);
  elements.garmentSaveError.textContent = '';
  if (stage === 'source') {
    elements.cameraInput.value = '';
    elements.galleryInput.value = '';
    elements.garmentFlowError.textContent = '';
  }
  if (stage === 'method') renderAiQuota();
}

async function handleGarmentInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  elements.garmentFlowError.textContent = '';
  await processGarmentFile(file);
}

async function processGarmentFile(file) {
  if (!file.type.startsWith('image/')) {
    elements.garmentFlowError.textContent = 'Elegí un archivo de imagen válido.';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    elements.garmentFlowError.textContent = 'La imagen es demasiado grande. Probá con una de menos de 15 MB.';
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await compressGarmentImage(file);
    URL.revokeObjectURL(objectUrl);
    AppState.garmentDraft = {
      image,
      fileSeed: `${file.name}-${file.size}-${file.lastModified || 0}`,
      category: 'Remera',
      color: 'Negro',
      warmth: 'Medio',
      style: 'Casual',
      subtype: '',
      secondaryColors: [],
      pattern: '',
      material: '',
      waterproof: null,
      seasons: [],
      occasions: [],
      description: '',
      confidence: null,
      analysisMode: null
    };
    elements.methodGarmentImage.src = image;
    elements.confirmGarmentImage.src = image;
    setGarmentStage('method');
  } catch (_) {
    URL.revokeObjectURL(objectUrl);
    setGarmentStage('source');
    elements.garmentFlowError.textContent = 'No pudimos leer esa imagen. Probá con otra foto.';
  }
}

function compressGarmentImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const maxSide = 760;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas no disponible'));
        return;
      }
      context.fillStyle = '#f4f5f8';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', .72);
      URL.revokeObjectURL(url);
      resolve(compressed);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida'));
    };
    image.src = url;
  });
}

function chooseManualGarmentEntry() {
  if (!AppState.garmentDraft?.image) return;
  AppState.garmentDraft.analysisMode = 'manual';
  configureGarmentFormMode(false, 'manual');
  applyGarmentDraftToForm();
  setGarmentStage('confirm');
}

async function analyzeGarmentWithAi() {
  const draft = AppState.garmentDraft;
  if (!draft?.image || AppState.aiQuotaLoading) return;
  elements.aiQuotaError.textContent = '';
  if (!AppState.aiQuota.available) {
    elements.aiQuotaError.textContent = 'Gemini todavía no está configurado. Podés completar la prenda manualmente.';
    return;
  }
  if (!AppState.aiQuota.unlimited && AppState.aiQuota.remaining <= 0) {
    elements.aiQuotaError.textContent = `Ya usaste tus ${AppState.aiQuota.limit} análisis. Podés completar la prenda manualmente.`;
    return;
  }

  elements.analysisImage.src = draft.image;
  setGarmentStage('analyzing');

  try {
    const body = new FormData();
    body.set('image', await garmentImageBlob(draft.image), 'prenda.jpg');
    const responsePromise = wardrobeApi('ai-analysis.php', { method: 'POST', body }).then((response) => response.json());
    const [payload] = await Promise.all([responsePromise, new Promise((resolve) => {
      clearTimeout(garmentAnalysisTimer);
      garmentAnalysisTimer = setTimeout(resolve, 700);
    })]);
    AppState.garmentDraft = { ...draft, ...payload.analysis, analysisMode: 'gemini' };
    applyAiQuota(payload.quota);
    elements.confirmGarmentImage.src = draft.image;
    configureGarmentFormMode(false, 'ai');
    applyGarmentDraftToForm();
    setGarmentStage('confirm');
  } catch (error) {
    if (error.payload?.quota) applyAiQuota(error.payload.quota);
    setGarmentStage('method');
    elements.aiQuotaError.textContent = error.message || 'No pudimos completar el análisis.';
    loadAiQuota();
  }
}

async function loadAiQuota() {
  if (!globalThis.QMPAuth?.getUser() || AppState.aiQuotaLoading) return;
  AppState.aiQuotaLoading = true;
  renderAiQuota();
  try {
    const response = await wardrobeApi('ai-analysis.php');
    const payload = await response.json();
    applyAiQuota(payload.quota);
  } catch (_) {
    elements.aiQuotaSummary.textContent = 'IA: no pudimos consultar el cupo';
  } finally {
    AppState.aiQuotaLoading = false;
    renderAiQuota();
  }
}

function applyAiQuota(quota) {
  if (!quota) return;
  AppState.aiQuota = {
    limit: Number(quota.limit) || 5,
    remaining: Math.max(0, Number(quota.remaining) || 0),
    resetAt: quota.resetAt || null,
    mode: quota.mode || 'gemini',
    available: quota.available !== false,
    unlimited: quota.unlimited === true
  };
  clearTimeout(aiQuotaRefreshTimer);
  const resetTime = AppState.aiQuota.resetAt ? Date.parse(AppState.aiQuota.resetAt) : NaN;
  if (Number.isFinite(resetTime)) {
    aiQuotaRefreshTimer = setTimeout(loadAiQuota, Math.max(1000, resetTime - Date.now() + 1000));
  }
  renderAiQuota();
}

function renderAiQuota() {
  const { limit, remaining, resetAt, unlimited } = AppState.aiQuota;
  const resetCopy = unlimited
    ? 'Tu cuenta tiene análisis ilimitados.'
    : resetAt
    ? `Se renuevan ${new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(resetAt))}.`
    : 'Las 24 h empiezan con tu primer análisis.';
  elements.aiQuotaRemaining.textContent = AppState.aiQuotaLoading ? '…' : remaining;
  elements.aiQuotaLimit.textContent = limit;
  elements.aiQuotaLimitedCopy.hidden = unlimited;
  elements.aiQuotaUnlimitedCopy.hidden = !unlimited;
  elements.aiQuotaReset.textContent = resetCopy;
  elements.aiGarmentBtn.disabled = AppState.aiQuotaLoading || !AppState.aiQuota.available || (!unlimited && remaining <= 0);
  elements.aiQuotaSummary.textContent = AppState.aiQuotaLoading
    ? 'IA: consultando disponibilidad…'
    : !AppState.aiQuota.available
      ? 'IA: falta configurar Gemini en el servidor'
      : unlimited
        ? 'IA: análisis ilimitados'
      : `IA: ${remaining} de ${limit} análisis disponibles${resetAt ? ` · ${resetCopy}` : ''}`;
  if (!AppState.aiQuotaLoading && !AppState.aiQuota.available && !elements.aiQuotaError.textContent) {
    elements.aiQuotaError.textContent = 'Gemini todavía no está configurado. Podés completar los datos manualmente.';
  } else if (AppState.aiQuota.available && elements.aiQuotaError.textContent.startsWith('Gemini todavía no está configurado')) {
    elements.aiQuotaError.textContent = '';
  }
  elements.aiQuotaDots.hidden = unlimited;
  elements.aiQuotaDots.innerHTML = unlimited ? '' : Array.from({ length: limit }, (_, index) => `<i class="${index < remaining ? '' : 'is-used'}"></i>`).join('');
}

function applyGarmentDraftToForm() {
  const draft = AppState.garmentDraft;
  if (!draft) return;
  setSelectValue(elements.garmentCategory, draft.category || 'Otra');
  setSelectValue(elements.garmentColor, draft.color || 'Sin definir', true);
  elements.garmentSubtype.value = draft.subtype || '';
  elements.garmentSecondaryColors.value = (draft.secondaryColors || []).join(', ');
  elements.garmentPattern.value = draft.pattern || '';
  elements.garmentMaterial.value = draft.material || '';
  elements.garmentWaterproof.value = typeof draft.waterproof === 'boolean' ? (draft.waterproof ? '1' : '0') : '';
  elements.garmentOccasions.value = (draft.occasions || []).join(', ');
  elements.garmentDescription.value = draft.description || '';
  document.querySelectorAll('input[name="garmentSeason"]').forEach((input) => {
    input.checked = (draft.seasons || []).includes(input.value);
  });
  const confidence = Number(draft.confidence);
  elements.garmentConfidence.hidden = !Number.isFinite(confidence);
  elements.garmentConfidence.textContent = Number.isFinite(confidence) ? `Confianza del análisis: ${Math.round(confidence * 100)}%` : '';
  setGarmentRadio('garmentWarmth', draft.warmth);
  setGarmentRadio('garmentStyle', draft.style);
}

function setSelectValue(select, value, allowCustom = false) {
  const exists = [...select.options].some((option) => option.value === value);
  if (!exists && allowCustom && value) select.add(new Option(value, value));
  select.value = exists || allowCustom ? value : select.options[0].value;
}

function commaSeparatedValues(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).slice(0, 8);
}

function setGarmentRadio(name, value) {
  const normalizedValue = name === 'garmentWarmth' && value === 'Alto' ? 'Abrigado' : value;
  const radio = [...document.querySelectorAll(`input[name="${name}"]`)].find((input) => input.value === normalizedValue);
  if (radio) radio.checked = true;
}

async function saveGarment(event) {
  event.preventDefault();
  if (!AppState.garmentDraft?.image) return;
  const submitButton = elements.garmentForm.querySelector('[type="submit"]');
  const editingId = AppState.editingGarmentId;
  const existingGarment = editingId ? AppState.wardrobe.find((item) => item.id === editingId) : null;
  const formData = new FormData(elements.garmentForm);
  const garment = {
    id: editingId || globalThis.crypto?.randomUUID?.() || `garment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    image: AppState.garmentDraft.image,
    category: elements.garmentCategory.value,
    color: elements.garmentColor.value,
    warmth: formData.get('garmentWarmth') || 'Medio',
    style: formData.get('garmentStyle') || 'Casual',
    subtype: elements.garmentSubtype.value.trim(),
    secondaryColors: commaSeparatedValues(elements.garmentSecondaryColors.value),
    pattern: elements.garmentPattern.value,
    material: elements.garmentMaterial.value.trim(),
    waterproof: elements.garmentWaterproof.value === '' ? null : elements.garmentWaterproof.value === '1',
    seasons: formData.getAll('garmentSeason'),
    occasions: commaSeparatedValues(elements.garmentOccasions.value),
    description: elements.garmentDescription.value.trim(),
    confidence: AppState.garmentDraft.confidence == null ? null : Number(AppState.garmentDraft.confidence),
    createdAt: existingGarment?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const nextWardrobe = editingId
    ? AppState.wardrobe.map((item) => item.id === editingId ? garment : item)
    : [garment, ...AppState.wardrobe];
  submitButton.disabled = true;
  elements.garmentSaveError.textContent = AppState.wardrobeRemote ? 'Guardando en tu cuenta…' : '';
  try {
    if (AppState.wardrobeRemote) await saveGarmentToServer(garment);
    if (!persistWardrobe(nextWardrobe)) return;
  } catch (error) {
    elements.garmentSaveError.textContent = error.message || 'No pudimos guardar la prenda.';
    showWardrobeToast(elements.garmentSaveError.textContent, true);
    return;
  } finally {
    submitButton.disabled = false;
  }
  renderWardrobe();
  refreshWardrobeOutfit();
  elements.garmentFlowDialog.close();
  resetGarmentDraft();
  showWardrobeToast(editingId ? '✓ Cambios guardados' : '✓ Prenda guardada en Mi ropa');
}

function cancelGarmentFlow() {
  if (elements.garmentFlowDialog.open) elements.garmentFlowDialog.close();
  resetGarmentDraft();
}

function resetGarmentDraft() {
  clearTimeout(garmentAnalysisTimer);
  stopDesktopCamera();
  AppState.garmentDraft = null;
  AppState.editingGarmentId = null;
  configureGarmentFormMode(false);
  elements.cameraInput.value = '';
  elements.galleryInput.value = '';
}

function openGarmentDetail(id) {
  const garment = AppState.wardrobe.find((item) => item.id === id);
  if (!garment) return;
  AppState.selectedGarmentId = id;
  elements.garmentDetailImage.src = garment.image;
  elements.garmentDetailImage.alt = `${garment.category} ${garment.color}`;
  elements.garmentDetailTitle.textContent = garment.category;
  elements.garmentDetailDescription.textContent = garment.description || '';
  elements.garmentDetailDescription.hidden = !garment.description;
  const detailTags = [garment.color, garment.subtype, `Abrigo ${garment.warmth.toLowerCase()}`, garment.style, garment.material, garment.pattern]
    .concat(garment.seasons || [])
    .filter(Boolean);
  elements.garmentDetailTags.innerHTML = detailTags
    .map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  resetDeleteConfirmation();
  elements.garmentDetailDialog.showModal();
}

function editSelectedGarment() {
  const garment = AppState.wardrobe.find((item) => item.id === AppState.selectedGarmentId);
  if (!garment) return;
  AppState.editingGarmentId = garment.id;
  AppState.garmentDraft = { ...garment };
  elements.confirmGarmentImage.src = garment.image;
  elements.garmentFlowError.textContent = '';
  elements.garmentSaveError.textContent = '';
  configureGarmentFormMode(true);
  applyGarmentDraftToForm();
  elements.garmentDetailDialog.close();
  setGarmentStage('confirm');
  elements.garmentFlowDialog.showModal();
}

function configureGarmentFormMode(isEditing, method = 'ai') {
  elements.garmentFormEyebrow.textContent = isEditing ? 'Editar prenda' : method === 'manual' ? 'Carga manual' : 'Resultado de Gemini';
  elements.garmentFormDescription.textContent = isEditing ? 'Modificá los datos que necesites.' : method === 'manual' ? 'Completá los datos y guardá la prenda.' : 'Podés corregir todo antes de guardar.';
  elements.garmentSubmitLabel.textContent = isEditing ? 'Guardar cambios' : 'Guardar prenda';
}

function resetDeleteConfirmation() {
  elements.garmentDetailActions.hidden = false;
  elements.deleteConfirmation.hidden = true;
}

async function deleteSelectedGarment() {
  const selectedId = AppState.selectedGarmentId;
  elements.confirmDeleteGarment.disabled = true;
  try {
    if (AppState.wardrobeRemote) {
      await wardrobeApi(`garments.php?id=${encodeURIComponent(selectedId)}`, { method: 'DELETE' });
    }
  } catch (error) {
    showWardrobeToast(error.message || 'No pudimos eliminar la prenda.', true);
    elements.confirmDeleteGarment.disabled = false;
    return;
  }
  const next = AppState.wardrobe.filter((item) => item.id !== AppState.selectedGarmentId);
  if (!persistWardrobe(next)) return;
  AppState.selectedGarmentId = null;
  renderWardrobe();
  refreshWardrobeOutfit();
  elements.garmentDetailDialog.close();
  elements.confirmDeleteGarment.disabled = false;
  showWardrobeToast('Prenda eliminada');
}

function showWardrobeToast(message, isError = false) {
  elements.wardrobeToast.textContent = message;
  elements.wardrobeToast.style.color = isError ? '#dc4c4c' : 'var(--color-emerald)';
  clearTimeout(wardrobeToastTimer);
  wardrobeToastTimer = setTimeout(() => { elements.wardrobeToast.textContent = ''; }, 2600);
}

function getGarmentSwatch(color) {
  const swatches = { Negro: '#20232d', Blanco: '#f8fafc', Gris: '#9ca3af', Azul: '#3b82f6', Rojo: '#ef4444', Verde: '#22c55e', Beige: '#d6c2a4', Marrón: '#8b5e3c', Multicolor: 'linear-gradient(135deg,#ff6b6b,#845ef7,#12b886)' };
  return swatches[color] || '#9ca3af';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function bindMetricInfo() {
  document.querySelectorAll('[data-metric]').forEach((card) => card.addEventListener('click', () => {
    if (!AppState.weatherData) return;
    renderMetricInfo(card.dataset.metric);
    elements.metricInfoDialog.showModal();
  }));
  elements.closeMetricInfo.addEventListener('click', () => elements.metricInfoDialog.close());
  elements.metricInfoDialog.addEventListener('click', (event) => {
    if (event.target === elements.metricInfoDialog) elements.metricInfoDialog.close();
  });
}

function renderMetricInfo(type) {
  const metric = getMetricInfo(type);
  elements.metricInfoDialog.style.setProperty('--metric-accent', metric.accent);
  elements.metricInfoIcon.innerHTML = metric.icon;
  elements.metricInfoEyebrow.textContent = AppState.selectedHourIndex === null ? 'Clima de ahora' : document.querySelector('#heroCard .now-badge').textContent.trim();
  elements.metricInfoTitle.textContent = metric.title;
  elements.metricInfoValue.textContent = metric.value;
  elements.metricInfoStatus.textContent = metric.status;
  elements.metricInfoSummary.textContent = metric.summary;
  elements.metricInfoAdviceText.textContent = metric.advice;
}

function getMetricInfo(type) {
  if (type === 'uv') {
    const uv = Number(elements.uv.textContent) || 0;
    return {
      title: 'Índice UV', value: uv.toFixed(1), status: getUvStatus(uv), accent: 'var(--color-sunny)',
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      summary: 'El índice UV mide la intensidad de la radiación solar. Desde nivel 3 conviene empezar a proteger la piel.',
      advice: uv >= 8 ? 'Evitá el sol directo, usá protector FPS 50, lentes y algo que cubra la cabeza.' : uv >= 6 ? 'Usá protector solar, lentes y buscá sombra en las horas de mayor exposición.' : uv >= 3 ? 'Si vas a estar afuera un rato, usá protector solar y llevá lentes.' : 'La radiación es baja. No necesitás cuidados especiales para una salida breve.'
    };
  }
  if (type === 'wind') {
    const wind = Number.parseFloat(elements.wind.textContent) || 0;
    return {
      title: 'Viento', value: `${Math.round(wind)}`, status: 'km/h · ' + elements.windStatus.textContent, accent: 'var(--color-windy)',
      icon: '<svg viewBox="0 0 24 24"><path d="M3 8h11.5a2.5 2.5 0 1 0-2.2-3.7M3 12h16a2 2 0 1 1-1.7 3M3 16h8"/></svg>',
      summary: 'El viento puede hacer que la temperatura se sienta más baja y volver incómodas algunas prendas sueltas.',
      advice: wind > 35 ? 'Elegí una campera bien cerrada y evitá accesorios o prendas que puedan volarse.' : wind > 22 ? 'Sumá una capa cortaviento. Si llueve, mejor capucha que paraguas.' : wind > 10 ? 'Una capa exterior liviana alcanza si sos sensible al fresco.' : 'El viento está tranquilo; no hace falta adaptar tu look por este factor.'
    };
  }
  const rain = Number.parseFloat(elements.rain.textContent) || 0;
  const wind = Number.parseFloat(elements.wind.textContent) || 0;
  const rainRisk = AppState.rainWindow?.hasRisk || rain >= 30;
  const rainTiming = formatRainTiming(AppState.rainWindow);
  const timingLead = rainTiming === 'ahora' ? 'Hay riesgo de lluvia ahora.' : rainTiming ? `Puede llover ${rainTiming}.` : 'Puede llover en las próximas cuatro horas.';
  return {
    title: 'Probabilidad de lluvia', value: `${Math.round(rain)}%`, status: elements.rainStatus.textContent, accent: 'var(--color-rainy)',
    icon: '<svg viewBox="0 0 24 24"><path d="M7 17h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 8 4.5 4.5 0 0 0 7 17Z"/><path d="m9 20-1 2m5-2-1 2m5-2-1 2"/></svg>',
    summary: 'Este valor es la probabilidad máxima prevista desde la hora consultada hasta cuatro horas después.',
    advice: rainRisk ? (wind > 22 ? `${timingLead} Como hay ráfagas, preferí capucha o campera impermeable antes que paraguas.` : `${timingLead} Llevá paraguas o campera impermeable.`) : 'No se espera lluvia durante las próximas cuatro horas. Podés salir sin llevar protección especial.'
  };
}

function renderWeatherAlert({ uv, wind, rain, rainRisk }) {
  const alerts = [];
  if (rainRisk) alerts.push({ type: 'rain', priority: rain >= 60 ? 100 : 80 });
  if (wind > 35) alerts.push({ type: 'wind', priority: 95 });
  else if (wind > 22) alerts.push({ type: 'wind', priority: 60 });
  if (uv >= 8) alerts.push({ type: 'uv', priority: 90 });
  else if (uv >= 6) alerts.push({ type: 'uv', priority: 70 });

  if (!alerts.length) {
    elements.weatherAlert.hidden = true;
    return;
  }

  const selected = alerts.sort((a, b) => b.priority - a.priority)[0];
  const metric = getMetricInfo(selected.type);
  const valueSuffix = selected.type === 'wind' ? ' km/h' : '';
  elements.weatherAlert.dataset.metric = selected.type;
  elements.weatherAlert.style.setProperty('--alert-accent', metric.accent);
  elements.weatherAlertIcon.innerHTML = metric.icon;
  const rainTiming = formatRainTiming(AppState.rainWindow);
  elements.weatherAlertLabel.textContent = selected.type === 'rain' ? `Lluvia ${rainTiming || 'en las próximas 4 h'} · ${metric.value}` : `${metric.title} · ${metric.value}${valueSuffix}`;
  elements.weatherAlertText.textContent = metric.advice;
  elements.weatherAlert.hidden = false;
}

function bindLaterPlanning() {
  elements.laterBtn.addEventListener('click', () => {
    renderHourOptions();
    elements.laterDialog.showModal();
  });
  elements.closeLaterDialog.addEventListener('click', () => elements.laterDialog.close());
  elements.laterDialog.addEventListener('click', (event) => {
    if (event.target === elements.laterDialog) elements.laterDialog.close();
  });
  elements.nowBtn.addEventListener('click', () => {
    AppState.selectedHourIndex = null;
    renderWeather(AppState.weatherData);
  });
}

function hydrateSettings() {
  elements.unitToggle.classList.toggle('celsius', AppState.isCelsius);
  elements.unitToggle.setAttribute('aria-pressed', String(!AppState.isCelsius));
  elements.fallbackSelect.value = AppState.fallbackLocation;
  const sensitivity = document.querySelector(`input[name="tempSensitivity"][value="${AppState.sensitivity}"]`);
  if (sensitivity) sensitivity.checked = true;
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.toggleAttribute('aria-current', item === button);
    });
    document.querySelectorAll('.view').forEach((view) => {
      const active = view.id === button.dataset.view;
      view.hidden = !active;
      view.classList.toggle('active', active);
      view.classList.remove('view-entering');
      if (active) {
        void view.offsetWidth;
        view.classList.add('view-entering');
      }
    });
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }));
}

function bindSettings() {
  elements.unitToggle.addEventListener('click', () => {
    AppState.isCelsius = !AppState.isCelsius;
    elements.unitToggle.classList.toggle('celsius', AppState.isCelsius);
    elements.unitToggle.setAttribute('aria-pressed', String(!AppState.isCelsius));
    if (AppState.weatherData) renderWeather(AppState.weatherData);
    persistSettings();
  });

  document.querySelectorAll('input[name="tempSensitivity"]').forEach((input) => {
    input.addEventListener('change', () => {
      AppState.sensitivity = input.value;
      if (AppState.weatherData) renderWeather(AppState.weatherData);
      persistSettings();
    });
  });

  elements.fallbackSelect.addEventListener('change', async () => {
    const oldFallback = AppState.fallbackLocation;
    AppState.fallbackLocation = elements.fallbackSelect.value;
    persistSettings();
    if (oldFallback === AppState.fallbackLocation) return;
    const fallback = FALLBACK_LOCATIONS[AppState.fallbackLocation] || FALLBACK_LOCATIONS.buenosAires;
    AppState.selectedHourIndex = null;
    setLoading(true, `Cambiando a ${fallback.name}...`);
    await loadFallback();
    elements.saveFeedback.textContent = `✓ Ubicación cambiada a ${fallback.name}`;
    clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = setTimeout(() => { elements.saveFeedback.textContent = ''; }, 2200);
  });
}

let saveFeedbackTimer;
function persistSettings() {
  localStorage.setItem('isCelsius', String(AppState.isCelsius));
  localStorage.setItem('tempSensitivity', AppState.sensitivity);
  localStorage.setItem('fallbackLocation', AppState.fallbackLocation);
  elements.saveFeedback.textContent = '✓ Preferencia guardada automáticamente';
  clearTimeout(saveFeedbackTimer);
  saveFeedbackTimer = setTimeout(() => { elements.saveFeedback.textContent = ''; }, 1800);
}

async function locateAndLoad(force = false) {
  AppState.selectedHourIndex = null;
  setLoading(true, force ? 'Actualizando ubicación...' : 'Buscando ubicación...');
  if (!navigator.geolocation) return loadFallback();
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      AppState.coords = { lat: coords.latitude, lon: coords.longitude };
      AppState.isFallback = false;
      AppState.locationName = await reverseGeocode(coords.latitude, coords.longitude);
      await fetchWeather();
    },
    () => loadFallback(),
    { enableHighAccuracy: false, timeout: 9000, maximumAge: force ? 0 : 900000 }
  );
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('No se pudo identificar la ciudad');
    const { address = {} } = await response.json();
    return address.city || address.town || address.village || address.municipality || address.state || 'Tu ubicación';
  } catch (_) {
    return 'Tu ubicación';
  }
}

async function loadFallback() {
  const fallback = FALLBACK_LOCATIONS[AppState.fallbackLocation] || FALLBACK_LOCATIONS.buenosAires;
  AppState.coords = { lat: fallback.lat, lon: fallback.lon };
  AppState.locationName = fallback.name;
  AppState.isFallback = true;
  await fetchWeather();
}

async function fetchWeather() {
  try {
    const { lat, lon } = AppState.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&past_days=1&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('El servicio meteorológico no respondió');
    AppState.weatherData = await response.json();
    renderWeather(AppState.weatherData);
    setLoading(false);
  } catch (error) {
    renderError(error.message);
  }
}

function findHourlyReferenceIndex(hourly, referenceTime) {
  if (!hourly?.time?.length) return 0;
  const hourKey = String(referenceTime || '').slice(0, 13);
  const exactIndex = hourly.time.findIndex((time) => time.slice(0, 13) === hourKey);
  if (exactIndex >= 0) return exactIndex;
  const nextIndex = hourly.time.findIndex((time) => time >= referenceTime);
  return nextIndex >= 0 ? nextIndex : Math.max(0, hourly.time.length - 1);
}

function getRainWindow(hourly, startIndex) {
  const safeStart = Math.max(0, Number(startIndex) || 0);
  const endIndex = Math.min(hourly?.time?.length || 0, safeStart + 5);
  let maxProbability = 0;
  let firstRiskTime = null;

  for (let index = safeStart; index < endIndex; index += 1) {
    const probability = Number(hourly.precipitation_probability?.[index] || 0);
    const weatherCode = Number(hourly.weather_code?.[index]);
    maxProbability = Math.max(maxProbability, probability);
    if (!firstRiskTime && (probability >= 30 || RAIN_WEATHER_CODES.has(weatherCode))) {
      firstRiskTime = hourly.time[index];
    }
  }

  return {
    maxProbability,
    firstRiskTime,
    hasRisk: Boolean(firstRiskTime),
    referenceTime: hourly?.time?.[safeStart] || null
  };
}

function formatRainTiming(rainWindow) {
  if (!rainWindow?.firstRiskTime) return '';
  if (rainWindow.firstRiskTime.slice(0, 13) === rainWindow.referenceTime?.slice(0, 13)) return 'ahora';
  return `cerca de las ${rainWindow.firstRiskTime.slice(11, 16)}`;
}

function renderWeather(data) {
  const selectedIndex = AppState.selectedHourIndex;
  const isLater = selectedIndex !== null && Boolean(data.hourly);
  const current = isLater ? getHourlyWeather(data.hourly, selectedIndex) : data.current;
  const daily = data.daily;
  const temp = Number(current.temperature_2m);
  const apparent = Number(current.apparent_temperature);
  const wind = Number(current.wind_speed_10m);
  const code = Number(current.weather_code);
  const selectedDay = Math.max(0, daily.time.indexOf(current.time.slice(0, 10)));
  const hourlyReferenceIndex = isLater ? selectedIndex : findHourlyReferenceIndex(data.hourly, current.time);
  const rainWindow = getRainWindow(data.hourly, hourlyReferenceIndex);
  AppState.rainWindow = rainWindow;
  const rainProbability = rainWindow.maxProbability;
  const isRainingNow = RAIN_WEATHER_CODES.has(code) || Number(current.precipitation) > 0;
  const needsRainProtection = isRainingNow || rainWindow.hasRisk;
  if (isRainingNow && !rainWindow.firstRiskTime) rainWindow.firstRiskTime = current.time;
  rainWindow.hasRisk = needsRainProtection;
  const isSnow = [71,73,75,77,85,86].includes(code);
  const isWindy = wind > 22;
  const offset = AppState.sensitivity === 'cold' ? -3 : AppState.sensitivity === 'hot' ? 3 : 0;
  const adjustedTemp = apparent + offset;
  const uv = Number(current.uv_index || daily.uv_index_max?.[selectedDay] || 0);
  const hour = Number(current.time.slice(11, 13));
  const outfit = getOutfit(adjustedTemp, { isRain: needsRainProtection, isWindy, isSnow, uv, isLate: hour >= 20 || hour < 6 });

  setTheme(code, wind, data.timezone, isLater ? current.time : null);
  renderWardrobeOutfit(outfit, {
    time: current.time,
    temp: adjustedTemp,
    isRain: needsRainProtection,
    isWindy,
    isSnow,
    isLate: hour >= 20 || hour < 6
  });
  elements.outfitTitle.textContent = outfit.title;
  elements.outfitContext.textContent = buildContext(adjustedTemp, needsRainProtection, isWindy, isSnow);
  renderOutfitDetails(outfit.details);
  renderChips({ isRain: needsRainProtection, isWindy, isSnow, uv });

  elements.feels.textContent = formatTemp(apparent);
  elements.actual.textContent = formatTemp(temp);
  elements.minMax.textContent = `${formatTemp(daily.temperature_2m_min[selectedDay])} / ${formatTemp(daily.temperature_2m_max[selectedDay])}`;
  elements.humidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  renderDayComparison(daily, selectedDay);
  elements.uv.textContent = uv.toFixed(1);
  elements.uvStatus.textContent = getUvStatus(uv);
  elements.wind.textContent = `${Math.round(wind)} km/h`;
  elements.windStatus.textContent = wind > 35 ? 'Fuerte' : wind > 22 ? 'Con ráfagas' : wind > 10 ? 'Moderado' : 'Suave';
  elements.rain.textContent = `${Math.round(rainProbability)}%`;
  elements.rainStatus.textContent = needsRainProtection ? (rainProbability >= 60 ? 'Llevá protección' : 'Puede llover') : 'Poco probable';
  renderWeatherAlert({ uv, wind, rain: rainProbability, rainRisk: needsRainProtection });
  document.querySelectorAll('[data-metric]').forEach((card) => { card.disabled = false; });
  const selectedLabel = isLater ? formatForecastLabel(current.time, true) : null;
  document.querySelector('#heroCard .eyebrow').textContent = isLater ? `Tu look para ${selectedLabel}` : 'Tu look de hoy';
  document.querySelector('#heroCard .now-badge').innerHTML = `<i></i>${isLater ? selectedLabel : 'Ahora'}`;
  elements.nowBtn.classList.toggle('active', !isLater);
  elements.laterBtn.classList.toggle('active', isLater);
  elements.nowBtn.setAttribute('aria-pressed', String(!isLater));
  elements.laterBtn.setAttribute('aria-pressed', String(isLater));
  elements.laterBtn.querySelector('span').textContent = isLater ? selectedLabel : 'Salgo más tarde';
  elements.laterBtn.disabled = false;
  elements.updateTime.textContent = isLater
    ? `Pronóstico para ${selectedLabel} · ${AppState.locationName}`
    : `Actualizado ${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date())} · ${AppState.isFallback ? 'ubicación alternativa' : 'ubicación actual'}`;
}

function renderDayComparison(daily, selectedDay) {
  const previousDay = selectedDay - 1;
  if (previousDay < 0 || daily.temperature_2m_max[previousDay] == null) {
    elements.dayComparison.hidden = true;
    return;
  }

  const currentMax = Number(daily.temperature_2m_max[selectedDay]);
  const previousMax = Number(daily.temperature_2m_max[previousDay]);
  const differenceCelsius = currentMax - previousMax;
  const displayDifference = AppState.isCelsius ? differenceCelsius : differenceCelsius * 9 / 5;
  const absoluteDifference = Math.abs(displayDifference);
  const roundedDifference = Math.round(absoluteDifference);
  const currentDate = AppState.weatherData?.current?.time?.slice(0, 10);
  const selectedDate = daily.time[selectedDay];
  const previousDate = daily.time[previousDay];
  const comparisonReference = selectedDate === currentDate ? 'ayer' : previousDate === currentDate ? 'hoy' : 'el día anterior';
  let message;
  let arrow;
  let color;

  if (differenceCelsius >= 5) {
    message = `La máxima estará bastante más alta que ${comparisonReference}.`;
    arrow = '↑';
    color = 'var(--color-warm)';
  } else if (differenceCelsius >= 2) {
    message = `La máxima estará un poco más alta que ${comparisonReference}.`;
    arrow = '↑';
    color = 'var(--color-sunny)';
  } else if (differenceCelsius <= -5) {
    message = `La máxima estará bastante más baja que ${comparisonReference}.`;
    arrow = '↓';
    color = 'var(--color-rainy)';
  } else if (differenceCelsius <= -2) {
    message = `La máxima estará un poco más baja que ${comparisonReference}.`;
    arrow = '↓';
    color = 'var(--color-windy)';
  } else {
    message = `La máxima será muy parecida a la de ${comparisonReference}.`;
    arrow = '≈';
    color = 'var(--color-emerald)';
  }

  elements.dayComparison.hidden = false;
  elements.dayComparison.style.setProperty('--comparison-color', color);
  elements.comparisonLabel.textContent = `Comparación con ${comparisonReference}`;
  elements.comparisonText.textContent = message;
  elements.comparisonDelta.textContent = `${roundedDifference}°${arrow}`;
  elements.comparisonDelta.setAttribute('aria-label', `${roundedDifference} grados ${arrow === '↑' ? 'más' : arrow === '↓' ? 'menos' : 'de diferencia'}`);
}

function getHourlyWeather(hourly, index) {
  return {
    time: hourly.time[index],
    temperature_2m: hourly.temperature_2m[index],
    relative_humidity_2m: hourly.relative_humidity_2m[index],
    apparent_temperature: hourly.apparent_temperature[index],
    precipitation: Number(hourly.precipitation_probability[index]) > 35 ? 0.1 : 0,
    precipitation_probability: hourly.precipitation_probability[index],
    weather_code: hourly.weather_code[index],
    wind_speed_10m: hourly.wind_speed_10m[index],
    uv_index: hourly.uv_index[index]
  };
}

function renderHourOptions() {
  const hourly = AppState.weatherData?.hourly;
  if (!hourly) return;
  const currentTime = AppState.weatherData.current.time;
  const startIndex = Math.max(0, hourly.time.findIndex((time) => time > currentTime));
  const endIndex = Math.min(hourly.time.length, startIndex + 32);
  const options = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const time = hourly.time[index];
    const accessibleLabel = formatForecastLabel(time, true);
    options.push(`<button class="hour-option${AppState.selectedHourIndex === index ? ' selected' : ''}" type="button" data-hour-index="${index}" aria-label="${accessibleLabel}"><span>${time.slice(11, 16)}</span><small>${formatForecastLabel(time, false)}</small></button>`);
  }
  elements.hourOptions.innerHTML = options.join('');
  elements.hourOptions.querySelectorAll('.hour-option').forEach((button) => button.addEventListener('click', () => {
    AppState.selectedHourIndex = Number(button.dataset.hourIndex);
    elements.laterDialog.close();
    renderWeather(AppState.weatherData);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

function formatForecastLabel(isoTime, includeHour) {
  const datePart = isoTime.slice(0, 10);
  const today = AppState.weatherData?.current?.time?.slice(0, 10) || new Date().toLocaleDateString('en-CA');
  const tomorrowDate = new Date(`${today}T12:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const day = datePart === today ? 'hoy' : datePart === tomorrow ? 'mañana' : new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${datePart}T12:00:00Z`));
  return includeHour ? `${day} ${isoTime.slice(11, 16)}` : day;
}

function getOutfit(temp, { isRain, isWindy, isSnow, uv, isLate }) {
  const detail = (top, outer, bottom, feet, extra) => ({ top, outer, bottom, feet, extra });

  if (temp >= 28) return {
    title: isRain ? 'Look fresco contra la lluvia' : 'Look fresco y liviano',
    garments: isRain ? ['remera', 'shorts', 'paraguas'] : ['remera', 'shorts'],
    details: detail(
      'Remera liviana o musculosa',
      isRain ? 'Piloto o impermeable bien fino' : 'No hace falta abrigo',
      'Short o pantalón de lino',
      isRain ? 'Medias finas + calzado que se seque rápido' : 'Medias finas + zapatillas livianas',
      isRain ? 'Paraguas compacto' : uv >= 6 ? 'Lentes, gorra y protector solar' : 'Lentes de sol si vas a estar afuera'
    )
  };

  if (temp >= 20) return {
    title: isRain ? 'Dos capas livianas' : 'Look liviano de una capa',
    garments: isRain ? ['remera', 'campera', 'paraguas'] : ['remera', 'pantalon'],
    details: detail(
      'Remera de algodón',
      isRain ? 'Campera impermeable fina' : (isWindy || isLate ? 'Campera fina o cardigan' : 'Sin abrigo; llevá uno fino si volvés tarde'),
      'Pantalón liviano o jean fino',
      'Medias comunes + zapatillas',
      isRain ? 'Paraguas compacto' : uv >= 6 ? 'Protector solar y lentes' : 'Sin extras necesarios'
    )
  };

  if (temp >= 15) return {
    title: isRain ? 'Tres capas contra la lluvia' : 'Dos capas livianas',
    garments: isRain ? ['buzo', 'campera', 'paraguas'] : isWindy ? ['remera', 'campera'] : ['remera', 'buzo'],
    details: detail(
      'Remera manga corta o larga',
      isRain ? 'Buzo liviano + impermeable' : isWindy ? 'Campera rompeviento' : 'Buzo liviano o cardigan',
      'Jean o pantalón largo',
      isRain ? 'Medias de grosor medio + calzado resistente al agua' : 'Medias de grosor medio + zapatillas cerradas',
      isRain ? 'Paraguas' : isLate ? 'Pañuelo o bufanda fina si sos friolento/a' : 'Una capa fácil de sacar'
    )
  };

  if (temp >= 10) return {
    title: 'Vestite en 2 o 3 capas',
    garments: ['buzo', 'campera'].concat(isRain ? ['paraguas'] : []),
    details: detail(
      'Remera manga larga + sweater o buzo',
      isRain ? 'Campera impermeable' : isWindy ? 'Campera cortaviento' : 'Campera liviana',
      'Jean o pantalón de tela media',
      isRain ? 'Medias largas + calzado impermeable' : 'Medias largas + zapatillas cerradas',
      isRain ? 'Paraguas y capucha' : (isWindy || isLate) ? 'Bufanda liviana' : 'Sin extras necesarios'
    )
  };

  if (temp >= 5) return {
    title: 'Vestite en 3 capas',
    garments: ['buzo', 'campera'].concat(isRain ? ['paraguas'] : []),
    details: detail(
      'Remera manga larga + buzo grueso',
      isRain ? 'Campera abrigada impermeable' : isWindy ? 'Campera acolchada cortaviento' : 'Campera acolchada o tapado',
      'Jean grueso o pantalón de invierno',
      (isRain || isSnow) ? 'Medias gruesas + botas o calzado impermeable' : 'Medias gruesas + calzado bien cerrado',
      isSnow ? 'Gorro, bufanda y guantes' : isLate ? 'Bufanda; sumá gorro si estarás mucho afuera' : 'Bufanda si vas a caminar bastante'
    )
  };

  return {
    title: 'Abrigo completo',
    garments: ['buzo', 'campera', 'gorro'],
    details: detail(
      'Camiseta térmica + sweater o buzo',
      isRain || isSnow ? 'Campera pesada e impermeable' : isWindy ? 'Campera pesada cortaviento' : 'Campera pesada o tapado',
      'Pantalón grueso; calza térmica si salís mucho',
      'Medias térmicas + botas o calzado cerrado',
      'Gorro, bufanda y guantes'
    )
  };
}

function buildContext(temp, isRain, isWindy, isSnow) {
  if (isSnow) return 'Mucho abrigo y calzado cerrado: hay nieve en la zona.';
  if (isRain && isWindy) return 'Está inestable y ventoso. Sumá una capa que resista el agua.';
  if (isRain) return 'Hay lluvia en el radar. Priorizá una capa impermeable.';
  if (isWindy) return 'El viento cambia la sensación. Una capa exterior va a ayudarte.';
  if (temp >= 28) return 'Hace calor: elegí telas frescas, livianas y respirables.';
  if (temp >= 20) return 'Temperatura agradable. Un look liviano funciona todo el día.';
  if (temp >= 15) return 'Está fresco; una capa fácil de sacar es la mejor opción.';
  if (temp >= 5) return 'Día frío. Vestite en capas para conservar mejor el calor.';
  return 'Frío intenso. Cubrí cabeza, cuello y manos si vas a salir.';
}

function renderGarments(garments) {
  const colors = ['var(--color-warm)', 'var(--color-windy)', 'var(--color-rainy)'];
  elements.garmentVisual.innerHTML = garments.map((garment, index) =>
    `<span class="garment-item" style="--garment-color:${colors[index % colors.length]}" title="${garment}">${GARMENT_SVGS[garment] || GARMENT_SVGS.percha}</span>`
  ).join('');
}

function renderOutfitDetails(details) {
  const config = {
    top: { label: 'Arriba', icon: '↑', color: 'var(--color-warm)' },
    outer: { label: 'Abrigo', icon: '◇', color: 'var(--color-windy)' },
    bottom: { label: 'Abajo', icon: '↓', color: 'var(--color-emerald)' },
    feet: { label: 'Medias y calzado', icon: '⌁', color: 'var(--color-rainy)' },
    extra: { label: 'Extras', icon: '✦', color: 'var(--color-sunny)' }
  };
  elements.outfitDetails.innerHTML = Object.entries(details).map(([key, value]) => {
    const item = config[key];
    return `<div class="outfit-detail"><span class="detail-icon" style="--detail-color:${item.color}" aria-hidden="true">${item.icon}</span><div class="detail-copy"><small>${item.label}</small><strong>${value}</strong></div></div>`;
  }).join('');
}

function renderChips({ isRain, isWindy, isSnow, uv }) {
  const chips = [];
  if (isRain) chips.push(['☂', isWindy ? 'Usá capucha o impermeable' : 'Llevá paraguas']);
  if (isWindy) chips.push(['≈', 'Hay viento']);
  if (isSnow) chips.push(['❄', 'Posible nieve']);
  if (uv >= 6) chips.push(['☀', 'Usá protector solar']);
  if (!chips.length) chips.push(['✓', 'Sin alertas importantes']);
  elements.outfitChips.innerHTML = chips.map(([icon, label]) => `<span class="outfit-chip"><b>${icon}</b>${label}</span>`).join('');
}

function setTheme(code, wind, timezone, forecastTime = null) {
  const rainCodes = [61,63,65,66,67,80,81,82,95,96,99];
  const drizzleCodes = [51,53,55,56,57];
  const snowCodes = [71,73,75,77,85,86];
  const hour = forecastTime
    ? Number(forecastTime.slice(11, 13))
    : Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: timezone }).format(new Date()));
  let theme = 'clear';
  let particles = 0;
  if (hour < 6 || hour >= 20) theme = 'night';
  else if (rainCodes.includes(code)) { theme = 'rainy'; particles = 25; }
  else if (snowCodes.includes(code)) { theme = 'snowy'; particles = 30; }
  else if (drizzleCodes.includes(code)) { theme = 'rainy'; particles = 12; }
  else if (wind > 22) theme = 'windy';
  else if ([1,2,3,45,48].includes(code)) theme = 'cloudy';
  document.documentElement.dataset.weatherTheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PWA_THEME_COLORS[theme] || PWA_THEME_COLORS.clear);
  elements.bg.className = theme;
  spawnParticles(theme, particles);
}

function spawnParticles(theme, count) {
  const layer = theme === 'snowy' ? $('.snowy-layer') : $('.rainy-layer');
  $('.rainy-layer').replaceChildren();
  $('.snowy-layer').replaceChildren();
  if (!count || !layer) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement('i');
    particle.className = theme === 'snowy' ? 'snowflake' : 'rain-drop';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${-Math.random() * 8}s`;
    particle.style.animationDuration = `${theme === 'snowy' ? 7 + Math.random() * 6 : 1.4 + Math.random() * 1.4}s`;
    particle.style.opacity = String(.25 + Math.random() * .6);
    fragment.appendChild(particle);
  }
  layer.appendChild(fragment);
}

function formatTemp(celsius) {
  const value = AppState.isCelsius ? Number(celsius) : (Number(celsius) * 9 / 5) + 32;
  return `${Math.round(value)}°`;
}

function getUvStatus(uv) {
  if (uv >= 11) return 'Extremo';
  if (uv >= 8) return 'Muy alto';
  if (uv >= 6) return 'Alto';
  if (uv >= 3) return 'Moderado';
  return 'Bajo';
}

function setLoading(isLoading, message) {
  elements.locationBtn.classList.toggle('is-loading', isLoading);
  elements.loadingDot.classList.toggle('loaded', !isLoading);
  if (message) elements.locationText.textContent = message;
  if (!isLoading) elements.locationText.textContent = AppState.locationName;
}

function renderError(message) {
  elements.locationText.textContent = AppState.locationName || 'Sin conexión';
  elements.loadingDot.classList.remove('loaded');
  elements.outfitTitle.textContent = 'No pudimos ver el clima';
  elements.outfitContext.textContent = 'Revisá tu conexión e intentá actualizar la ubicación.';
  elements.outfitDetails.replaceChildren();
  elements.garmentVisual.innerHTML = `<span class="garment-item">${GARMENT_SVGS.percha}</span>`;
  elements.outfitChips.innerHTML = '<span class="outfit-chip">Intentar de nuevo desde la ubicación</span>';
  elements.updateTime.textContent = message;
}

document.addEventListener('DOMContentLoaded', init);

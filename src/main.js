import './style.css';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

// ===========================================
// Configuration - Coordinates for overlays
// Calibrated for the specific template
// ===========================================
const CONFIG = {
  // Template dimensions (will be set from loaded image)
  templateWidth: 0,
  templateHeight: 0,

  // Photo - в золотой рамке слева
  photo: {
    centerX: 0.35,       // Левая сторона
    centerY: 0.43,       // Чуть выше центра
    radius: 0.17         // Размер фото в рамке
  },

  // Deputy name - ФАМИЛИЯ + ИМЯ ОТЧЕСТВО под фото слева
  deputyName: {
    x: 0.15,             // Слева
    y: 0.65,             // Под фото
    fontSize: 0.06,
    fontWeight: '700',
    color: '#FFFFFF'     // Белый цвет
  },


  // Ответственное лицо - блок внизу
  responsible: {
    // Заголовок "Жауапты тұлға | Ответственное лицо"
    header: {
      x: 0.03,
      y: 0.86,
      fontSize: 0.025,
      color: '#C9A227',
      fontWeight: '700'
    },
    // Имя ответственного
    name: {
      x: 0.03,
      y: 0.90,
      fontSize: 0.02,
      color: '#FFFFFF',
      fontWeight: '700'
    },
    // Телефон ответственного
    phone: {
      x: 0.03,
      y: 0.94,
      fontSize: 0.02,
      color: '#FFFFFF'
    }
  },

  // QR code - внутри телефона справа
  qr: {
    x: 0.695,            // В экране телефона
    y: 0.215,            // Верхняя часть экрана
    size: 0.18           // Размер QR
  }
};

// ===========================================
// DOM Elements
// ===========================================
const photoInput = document.getElementById('photo-input');
const photoUploadArea = document.getElementById('photo-upload-area');
const photoPreview = document.getElementById('photo-preview');
const photoControls = document.getElementById('photo-controls');
const resetPhotoBtn = document.getElementById('reset-photo-btn');
const deputyNameInput = document.getElementById('deputy-name');
const responsibleNameInput = document.getElementById('responsible-name');
const phoneInput = document.getElementById('phone');
const qrUrlInput = document.getElementById('qr-url');
const downloadBtn = document.getElementById('download-btn');
const canvas = document.getElementById('card-canvas');
const ctx = canvas.getContext('2d');

// Settings Elements
const photoShapeSelect = document.getElementById('photo-shape');
const photoScaleInput = document.getElementById('photo-scale-input');
const photoXInput = document.getElementById('photo-x-input');
const photoYInput = document.getElementById('photo-y-input');
const deputyYInput = document.getElementById('deputy-y-input');
const deputySizeInput = document.getElementById('deputy-size-input');
const deputyWeightInput = document.getElementById('deputy-weight-input');
const staticYInput = document.getElementById('static-y-input');
const staticSizeInput = document.getElementById('static-size-input');
const staticWeightInput = document.getElementById('static-weight-input');

// Responsible Person Inputs
const respHeaderX = document.getElementById('resp-header-x');
const respHeaderY = document.getElementById('resp-header-y');
const respHeaderSize = document.getElementById('resp-header-size');
const respHeaderWeight = document.getElementById('resp-header-weight');

const respNameX = document.getElementById('resp-name-x');
const respNameY = document.getElementById('resp-name-y');
const respNameSize = document.getElementById('resp-name-size');
const respNameWeight = document.getElementById('resp-name-weight');

const respPhoneX = document.getElementById('resp-phone-x');
const respPhoneY = document.getElementById('resp-phone-y');
const respPhoneSize = document.getElementById('resp-phone-size');
const respPhoneWeight = document.getElementById('resp-phone-weight');

// State
let templateImage = null;
let template2Image = null;  // Новый шаблон (шаблон.png)
let nadpisImage = null;     // Надпись (надпись.png)
let userPhoto = null;
let qrDataUrl = null;

// Позиции для двигания (настройте под себя)
// Позиции для двигания (настройте под себя)
const OVERLAY_CONFIG = {
  template2: {
    x: 0,       // позиция X (в пикселях от левого края)
    y: 0,       // позиция Y (в пикселях от верхнего края)
    width: 0,   // 0 = оригинальный размер
    height: 0
  },
  nadpis: {
    x: 30,       // позиция X
    y: 50,       // позиция Y  
    width: 600,   // 0 = оригинальный размер
    height: 1000
  },
  staticText: {
    y: 205,       // Позиция Y для текста "Ваш депутат"
    fontSize: 0.025,
    fontWeight: '400'
  },
  photoShape: 'roundRect' // 'circle', 'square', 'roundRect'
};

// Photo transform state
let photoScale = 1;
let photoOffsetX = 0;  // In pixels relative to canvas
let photoOffsetY = 0;

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let initialOffsetX = 0;
let initialOffsetY = 0;

// ===========================================
// Load Template Image
// ===========================================
async function loadTemplate() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      templateImage = img;
      CONFIG.templateWidth = img.width;
      CONFIG.templateHeight = img.height;

      // Set canvas size to match template
      canvas.width = img.width;
      canvas.height = img.height;

      // Scale canvas for display - maintain aspect ratio
      const maxDisplayWidth = 650;
      const scale = Math.min(1, maxDisplayWidth / img.width);
      canvas.style.width = `${img.width * scale}px`;
      canvas.style.height = `${img.height * scale}px`;

      resolve(img);
    };
    img.onerror = reject;
    img.src = '/template2.png';
  });
}

// ===========================================
// Load Additional Images (template2 + nadpis)
// ===========================================
async function loadAdditionalImages() {
  // Загрузка template2.png
  const template2Promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      template2Image = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = '/template2.png';
  });

  // Загрузка nadpis.png
  const nadpisPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      nadpisImage = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = '/nadpis.png';
  });

  await Promise.all([template2Promise, nadpisPromise]);
}

// ===========================================
// Get canvas scale factor (for mouse coordinates)
// ===========================================
function getCanvasScale() {
  const rect = canvas.getBoundingClientRect();
  return canvas.width / rect.width;
}

// ===========================================
// Render Card
// ===========================================
function renderCard() {
  if (!templateImage) return;

  const w = CONFIG.templateWidth;
  const h = CONFIG.templateHeight;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // 1. Draw template background
  ctx.drawImage(templateImage, 0, 0);

  // 1.5. Draw nadpis overlay (если загружен)
  if (nadpisImage) {
    const cfg = OVERLAY_CONFIG.nadpis;
    const aspectRatio = nadpisImage.width / nadpisImage.height;
    
    let drawW, drawH;
    if (cfg.width && cfg.height) {
      // Если заданы оба - используем width и считаем height по пропорции
      drawW = cfg.width;
      drawH = cfg.width / aspectRatio;
    } else if (cfg.width) {
      // Только width - считаем height
      drawW = cfg.width;
      drawH = cfg.width / aspectRatio;
    } else if (cfg.height) {
      // Только height - считаем width
      drawH = cfg.height;
      drawW = cfg.height * aspectRatio;
    } else {
      // Оригинальный размер
      drawW = nadpisImage.width;
      drawH = nadpisImage.height;
    }
    
    // Центрируем nadpis по X относительно фото
    const photoConfig = CONFIG.photo;
    const photoCenterX = w * photoConfig.centerX;
    const nadpisX = photoCenterX - drawW / 2;
    
    // Y берем из конфига (ручное управление)
    const nadpisY = cfg.y;

    ctx.drawImage(nadpisImage, nadpisX, nadpisY, drawW, drawH);
    
    // Статичная надпись под nadpis
    const staticCfg = OVERLAY_CONFIG.staticText;
    const subtitleFontSize = Math.round(w * (staticCfg.fontSize || 0.022));
    const fontWeight = staticCfg.fontWeight || '400';
    
    ctx.font = `${fontWeight} ${subtitleFontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center'; // Центрируем текст
    ctx.textBaseline = 'top';
    
    // Текст рисуем по Y из конфига
    ctx.fillText('Сіздің депутатыңыз | Ваш депутат', photoCenterX, staticCfg.y);
  }

  // 2. Draw user photo (или заглушка)
  const photoConfig = CONFIG.photo;
  const centerX = w * photoConfig.centerX;
  const centerY = h * photoConfig.centerY;
  const size = w * photoConfig.radius * 2;  // Размер квадрата
  const borderRadius = size * 0.08;  // Радиус скругления углов

  const x = centerX - size / 2;
  const y = centerY - size / 2;

  ctx.save();
  ctx.beginPath();
  
  // Форма фото
  if (OVERLAY_CONFIG.photoShape === 'circle') {
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  } else if (OVERLAY_CONFIG.photoShape === 'square') {
    ctx.rect(x, y, size, size);
  } else {
    // roundRect (default)
    ctx.roundRect(x, y, size, size, borderRadius);
  }
  
  ctx.closePath();
  ctx.clip();

  if (userPhoto) {
    // Calculate photo dimensions
    const imgRatio = userPhoto.width / userPhoto.height;
    let drawWidth, drawHeight;

    // Cover mode - fill the square, then apply scale
    if (imgRatio > 1) {
      drawHeight = size * photoScale;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = size * photoScale;
      drawHeight = drawWidth / imgRatio;
    }

    // Position with offset
    const offsetX = centerX - drawWidth / 2 + photoOffsetX;
    const offsetY = centerY - drawHeight / 2 + photoOffsetY;

    ctx.drawImage(userPhoto, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    // ЗАГЛУШКА (Placeholder)
    ctx.fillStyle = '#e5e7eb'; // Серый фон
    ctx.fill();
    
    // Силуэт
    ctx.fillStyle = '#9ca3af'; // Темно-серый силуэт
    const iconSize = size * 0.5;
    ctx.translate(centerX - iconSize/2, centerY - iconSize/2);
    const scale = iconSize / 24;
    ctx.scale(scale, scale);
    const path = new Path2D("M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z");
    ctx.fill(path);
  }
  ctx.restore();

  // 3. Draw deputy name - ФАМИЛИЯ + ИМЯ ОТЧЕСТВО (по центру под фото)
  // Если пусто, используем заглушку
  const deputyName = deputyNameInput.value.trim() || 'АСАНОВ БЕРИК';
  const isPlaceholder = !deputyNameInput.value.trim();

  if (deputyName) {
    const nameConfig = CONFIG.deputyName;
    const photoConfig = CONFIG.photo;
    const fontSize = Math.round(w * nameConfig.fontSize);
    
    // Используем centerX от фото для центрирования по X
    const photoCenterX = w * photoConfig.centerX;
    
    // Y берем из конфига (ручное управление)
    const nameY = h * nameConfig.y;

    ctx.fillStyle = isPlaceholder ? 'rgba(255, 255, 255, 0.5)' : nameConfig.color;
    ctx.textAlign = 'center';  // Центрируем по горизонтали
    ctx.textBaseline = 'top';

    // Разбиваем: первое слово = фамилия, остальное = имя отчество
    const parts = deputyName.split(' ');
    if (parts.length >= 2) {
      const lastName = parts[0];  // Фамилия
      const firstName = parts.slice(1).join(' ');  // Имя Отчество

      // Фамилия (крупнее, жирнее) - используем выбранный вес или 700
      const weight = nameConfig.fontWeight || '700';
      ctx.font = `${weight} ${fontSize}px "Playfair Display", serif`;
      ctx.fillText(lastName, photoCenterX, nameY);

      // Имя Отчество (чуть меньше)
      ctx.font = `500 ${Math.round(fontSize * 0.7)}px "Playfair Display", serif`;
      ctx.fillText(firstName, photoCenterX, nameY + fontSize * 1.2);
    } else {
      const weight = nameConfig.fontWeight || '700';
      ctx.font = `${weight} ${fontSize}px "Playfair Display", serif`;
      ctx.fillText(deputyName, photoCenterX, nameY);
    }
  }

  // 4. Draw responsible person header (статичный темно-синий)
  const hConfig = CONFIG.responsible.header;
  const headerFontSize = Math.round(w * hConfig.fontSize);
  ctx.font = `${hConfig.fontWeight} ${headerFontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = '#002855';  // Темно-синий статичный
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Жауапты тұлға | Ответственное лицо', w * hConfig.x, h * hConfig.y);

  // 5. Draw responsible person name
  const responsibleName = responsibleNameInput.value.trim() || 'Серикова Алия';
  const isRespPlaceholder = !responsibleNameInput.value.trim();
  
  if (responsibleName) {
    const rConfig = CONFIG.responsible.name;
    const fontSize = Math.round(w * rConfig.fontSize);

    ctx.font = `${rConfig.fontWeight} ${fontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = isRespPlaceholder ? 'rgba(255, 255, 255, 0.5)' : rConfig.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(responsibleName, w * rConfig.x, h * rConfig.y);
  }

  // Телефон ответственного лица (просто текст)
  const respPhone = phoneInput.value.trim() || '+7 (700) 123-45-67';
  const isPhonePlaceholder = !phoneInput.value.trim();

  if (respPhone) {
    const pConfig = CONFIG.responsible.phone;
    const fontSize = Math.round(w * pConfig.fontSize);
    const phoneX = w * pConfig.x;
    const phoneY = h * pConfig.y;

    // Текст номера
    ctx.font = `${pConfig.fontWeight || '500'} ${fontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = isPhonePlaceholder ? 'rgba(255, 255, 255, 0.5)' : pConfig.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(respPhone, phoneX, phoneY);
  }

  // 7. Draw QR code
  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.onload = () => {
      const qrConfig = CONFIG.qr;
      const size = w * qrConfig.size;
      const x = w * qrConfig.x;
      const y = h * qrConfig.y;

      ctx.drawImage(qrImg, x, y, size, size);
    };
    qrImg.src = qrDataUrl;
  }
}

// ===========================================
// Generate QR Code
// ===========================================
async function generateQRCode(url) {
  if (!url) {
    qrDataUrl = null;
    renderCard();
    return;
  }

  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: {
        dark: '#002855',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
    renderCard();
  } catch (err) {
    console.error('QR generation error:', err);
  }
}

// ===========================================
// Photo Upload Handler
// ===========================================
function initPhotoUpload() {
  photoUploadArea.addEventListener('click', () => photoInput.click());

  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.classList.add('dragover');
  });

  photoUploadArea.addEventListener('dragleave', () => {
    photoUploadArea.classList.remove('dragover');
  });

  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handlePhotoFile(e.dataTransfer.files[0]);
    }
  });

  photoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handlePhotoFile(e.target.files[0]);
    }
  });

  // Reset button
  resetPhotoBtn.addEventListener('click', resetPhotoSettings);
}

function resetPhotoSettings() {
  photoScale = 1;
  photoOffsetX = 0;
  photoOffsetY = 0;
  renderCard();
}

function handlePhotoFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите изображение (JPG или PNG)');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      userPhoto = img;
      photoPreview.innerHTML = `<img src="${e.target.result}" alt="Фото">`;

      // Show controls
      photoControls.style.display = 'block';

      // Reset settings
      resetPhotoSettings();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ===========================================
// Canvas Drag & Zoom
// ===========================================
function initCanvasInteraction() {
  // Mouse down - start drag
  canvas.addEventListener('mousedown', (e) => {
    if (!userPhoto) return;
    isDragging = true;
    const scale = getCanvasScale();
    dragStartX = e.clientX * scale;
    dragStartY = e.clientY * scale;
    initialOffsetX = photoOffsetX;
    initialOffsetY = photoOffsetY;
  });

  // Mouse move - drag
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !userPhoto) return;
    const scale = getCanvasScale();
    const dx = e.clientX * scale - dragStartX;
    const dy = e.clientY * scale - dragStartY;
    photoOffsetX = initialOffsetX + dx;
    photoOffsetY = initialOffsetY + dy;
    renderCard();
  });

  // Mouse up - end drag
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  // Wheel - zoom
  canvas.addEventListener('wheel', (e) => {
    if (!userPhoto) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    photoScale = Math.max(0.3, Math.min(3, photoScale + delta));
    renderCard();
  }, { passive: false });

  // Touch support for mobile
  let lastTouchDist = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (!userPhoto) return;
    if (e.touches.length === 1) {
      isDragging = true;
      const scale = getCanvasScale();
      const touch = e.touches[0];
      dragStartX = touch.clientX * scale;
      dragStartY = touch.clientY * scale;
      initialOffsetX = photoOffsetX;
      initialOffsetY = photoOffsetY;
    } else if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!userPhoto) return;
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      const scale = getCanvasScale();
      const touch = e.touches[0];
      const dx = touch.clientX * scale - dragStartX;
      const dy = touch.clientY * scale - dragStartY;
      photoOffsetX = initialOffsetX + dx;
      photoOffsetY = initialOffsetY + dy;
      renderCard();
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist > 0) {
        const delta = (dist - lastTouchDist) * 0.005;
        photoScale = Math.max(0.3, Math.min(3, photoScale + delta));
        renderCard();
      }
      lastTouchDist = dist;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
    lastTouchDist = 0;
  });
}

// ===========================================
// Phone Mask
// ===========================================
function initPhoneMask() {
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0 && value[0] !== '7') value = '7' + value;
    value = value.substring(0, 11);

    let formatted = '';
    if (value.length > 0) formatted = '+7';
    if (value.length > 1) formatted += ' (' + value.substring(1, 4);
    if (value.length >= 4) formatted += ') ' + value.substring(4, 7);
    if (value.length >= 7) formatted += '-' + value.substring(7, 9);
    if (value.length >= 9) formatted += '-' + value.substring(9, 11);

    e.target.value = formatted;
    renderCard();
  });
}

// ===========================================
// Export to PDF
// ===========================================
function exportToPDF() {
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Генерация...';

  // Get image data from canvas
  const imgData = canvas.toDataURL('image/png', 1.0);

  // Calculate PDF dimensions (in mm)
  const pdfWidth = 148;
  const pdfHeight = pdfWidth * (CONFIG.templateHeight / CONFIG.templateWidth);

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  });

  // Add image
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  // Download
  const deputyName = deputyNameInput.value.trim() || 'open-deputy';
  const fileName = `id-card-${deputyName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  pdf.save(fileName);

  downloadBtn.disabled = false;
  downloadBtn.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
    </svg>
    Скачать макет (PDF)
  `;
}

// ===========================================
// Initialize
// ===========================================
async function init() {
  try {
    await loadTemplate();
    await loadAdditionalImages();  // Загружаем template2 и nadpis

    initPhotoUpload();
    initPhoneMask();
    initCanvasInteraction();

    // Input listeners
    deputyNameInput.addEventListener('input', renderCard);
    responsibleNameInput.addEventListener('input', renderCard);
    qrUrlInput.addEventListener('input', () => generateQRCode(qrUrlInput.value.trim()));

    // Settings listeners
    photoShapeSelect.addEventListener('change', (e) => {
      OVERLAY_CONFIG.photoShape = e.target.value;
      renderCard();
    });
    
    photoScaleInput.addEventListener('input', (e) => {
      CONFIG.photo.radius = 0.17 * parseFloat(e.target.value);
      renderCard();
    });

    photoXInput.addEventListener('input', (e) => {
      CONFIG.photo.centerX = parseFloat(e.target.value);
      renderCard();
    });

    photoYInput.addEventListener('input', (e) => {
      CONFIG.photo.centerY = parseFloat(e.target.value);
      renderCard();
    });

    deputyYInput.addEventListener('input', (e) => {
      CONFIG.deputyName.y = parseFloat(e.target.value);
      renderCard();
    });

    deputySizeInput.addEventListener('input', (e) => {
      CONFIG.deputyName.fontSize = parseFloat(e.target.value);
      renderCard();
    });

    staticYInput.addEventListener('input', (e) => {
      OVERLAY_CONFIG.staticText.y = parseInt(e.target.value);
      renderCard();
    });

    deputyWeightInput.addEventListener('change', (e) => {
      CONFIG.deputyName.fontWeight = e.target.value;
      renderCard();
    });

    staticWeightInput.addEventListener('change', (e) => {
      OVERLAY_CONFIG.staticText.fontWeight = e.target.value;
      renderCard();
    });

    // Responsible Header Controls
    respHeaderX.addEventListener('input', (e) => { CONFIG.responsible.header.x = parseFloat(e.target.value); renderCard(); });
    respHeaderY.addEventListener('input', (e) => { CONFIG.responsible.header.y = parseFloat(e.target.value); renderCard(); });
    respHeaderSize.addEventListener('input', (e) => { CONFIG.responsible.header.fontSize = parseFloat(e.target.value); renderCard(); });
    respHeaderWeight.addEventListener('change', (e) => { CONFIG.responsible.header.fontWeight = e.target.value; renderCard(); });

    // Responsible Name Controls
    respNameX.addEventListener('input', (e) => { CONFIG.responsible.name.x = parseFloat(e.target.value); renderCard(); });
    respNameY.addEventListener('input', (e) => { CONFIG.responsible.name.y = parseFloat(e.target.value); renderCard(); });
    respNameSize.addEventListener('input', (e) => { CONFIG.responsible.name.fontSize = parseFloat(e.target.value); renderCard(); });
    respNameWeight.addEventListener('change', (e) => { CONFIG.responsible.name.fontWeight = e.target.value; renderCard(); });

    // Responsible Phone Controls
    respPhoneX.addEventListener('input', (e) => { CONFIG.responsible.phone.x = parseFloat(e.target.value); renderCard(); });
    respPhoneY.addEventListener('input', (e) => { CONFIG.responsible.phone.y = parseFloat(e.target.value); renderCard(); });
    respPhoneSize.addEventListener('input', (e) => { CONFIG.responsible.phone.fontSize = parseFloat(e.target.value); renderCard(); });
    respPhoneWeight.addEventListener('change', (e) => { CONFIG.responsible.phone.fontWeight = e.target.value; renderCard(); });

    // Download button
    downloadBtn.addEventListener('click', exportToPDF);

    // Initial render
    renderCard();

  } catch (err) {
    console.error('Failed to load template:', err);
    alert('Ошибка загрузки шаблона');
  }
}

init();

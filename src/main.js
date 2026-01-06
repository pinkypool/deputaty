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

  // Photo circle - center of the circular frame
  photo: {
    centerX: 0.5,     // Slightly left of center
    centerY: 0.35,     // Upper half
    radius: 0.15       // Radius of the photo circle
  },

  // Deputy name position (below photo, centered)
  deputyName: {
    x: 0.5,           // Same as photo center
    y: 0.715,           // Below the circle
    fontSize: 0.04,
    fontWeight: '700',
    color: '#002855'
  },

  // Left side block - Responsible person
  responsible: {
    // Fixed header "ЖАУАПТЫ ТҰЛҒА / ОТВЕТСТВЕННОЕ ЛИЦО"
    header: {
      x: 0.04,
      y: 0.2,
      fontSize: 0.02,
      color: '#002855',
      fontWeight: '700'
    },
    // Name below header
    name: {
      x: 0.04,
      y: 0.32,
      fontSize: 0.02,
      color: '#374151'
    },
    // Phone
    phone: {
      x: 0.04,
      y: 0.4,
      fontSize: 0.02,
      color: '#4b5563'
    }
  },

  // QR code position (right side)
  qr: {
    x: 0.75,           // Right area
    y: 0.2,           // Top
    size: 0.21         // QR size
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

// State
let templateImage = null;
let userPhoto = null;
let qrDataUrl = null;

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
    img.src = '/template.jpg';
  });
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

  // 2. Draw user photo (circular, clipped, with scale/offset)
  if (userPhoto) {
    const photoConfig = CONFIG.photo;
    const centerX = w * photoConfig.centerX;
    const centerY = h * photoConfig.centerY;
    const radius = w * photoConfig.radius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calculate photo dimensions
    const imgRatio = userPhoto.width / userPhoto.height;
    let drawWidth, drawHeight;

    // Cover mode - fill the circle, then apply scale
    if (imgRatio > 1) {
      drawHeight = radius * 2 * photoScale;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = radius * 2 * photoScale;
      drawHeight = drawWidth / imgRatio;
    }

    // Position with offset
    const offsetX = centerX - drawWidth / 2 + photoOffsetX;
    const offsetY = centerY - drawHeight / 2 + photoOffsetY;

    ctx.drawImage(userPhoto, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();
  }

  // 3. Draw fixed header "ЖАУАПТЫ ТҰЛҒА / ОТВЕТСТВЕННОЕ ЛИЦО"
  const hConfig = CONFIG.responsible.header;
  const headerFontSize = Math.round(w * hConfig.fontSize);
  ctx.font = `${hConfig.fontWeight} ${headerFontSize}px Inter, sans-serif`;
  ctx.fillStyle = hConfig.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ЖАУАПТЫ ТҰЛҒА /', w * hConfig.x, h * hConfig.y);
  ctx.fillText('ОТВЕТСТВЕННОЕ ЛИЦО', w * hConfig.x, h * hConfig.y + headerFontSize * 1.2);

  // 4. Draw responsible person name
  const responsibleName = responsibleNameInput.value.trim();
  if (responsibleName) {
    const rConfig = CONFIG.responsible.name;
    const fontSize = Math.round(w * rConfig.fontSize);

    ctx.font = `400 ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = rConfig.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillText('Аты-жөні /', w * rConfig.x, h * rConfig.y);
    ctx.fillText(responsibleName, w * rConfig.x, h * rConfig.y + fontSize * 1.3);
  }

  // 5. Draw phone
  const phone = phoneInput.value.trim();
  if (phone) {
    const pConfig = CONFIG.responsible.phone;
    const fontSize = Math.round(w * pConfig.fontSize);

    ctx.font = `400 ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = pConfig.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillText(`Тел.: ${phone}`, w * pConfig.x, h * pConfig.y);
  }

  // 6. Draw deputy name (centered below photo)
  const deputyName = deputyNameInput.value.trim();
  if (deputyName) {
    const nameConfig = CONFIG.deputyName;
    const fontSize = Math.round(w * nameConfig.fontSize);

    ctx.fillStyle = nameConfig.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Split into two lines (first name + last name)
    const parts = deputyName.split(' ');
    if (parts.length >= 2) {
      const firstName = parts.slice(0, -1).join(' ');
      const lastName = parts[parts.length - 1];

      // First name (smaller)
      ctx.font = `600 ${Math.round(fontSize * 0.85)}px Inter, sans-serif`;
      ctx.fillText(firstName.toUpperCase(), w * nameConfig.x, h * nameConfig.y - fontSize * 0.7);

      // Last name (larger, bolder)
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      ctx.fillText(lastName.toUpperCase(), w * nameConfig.x, h * nameConfig.y + fontSize * 0.5);
    } else {
      ctx.font = `${nameConfig.fontWeight} ${fontSize}px Inter, sans-serif`;
      ctx.fillText(deputyName.toUpperCase(), w * nameConfig.x, h * nameConfig.y);
    }
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

    initPhotoUpload();
    initPhoneMask();
    initCanvasInteraction();

    // Input listeners
    deputyNameInput.addEventListener('input', renderCard);
    responsibleNameInput.addEventListener('input', renderCard);
    qrUrlInput.addEventListener('input', () => generateQRCode(qrUrlInput.value.trim()));

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

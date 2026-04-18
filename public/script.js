/* ========================================
   2MM Contractor — Script
   ======================================== */

// ============ SCROLL TO TOP ON LOAD ============
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ============ LOADER ============
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 1800);
});

// ============ NAVBAR ============
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
  });
});

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ============ HERO VIDEO — PLAY ONCE, STOP CLEAN ============
const heroVideo = document.getElementById('heroVideo');
const scrollIndicator = document.querySelector('.scroll-indicator');

heroVideo.play().catch(() => {});

heroVideo.addEventListener('timeupdate', () => {
  if (heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.5) {
    heroVideo.pause();
  }
});

window.addEventListener('scroll', () => {
  scrollIndicator.classList.toggle('hide', window.scrollY > 100);
});

// ============ SECTION VIDEO AUTO-PLAY ============
const sectionVideos = document.querySelectorAll('.section-video');
const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.play().catch(() => {});
    } else {
      entry.target.pause();
    }
  });
}, { threshold: 0.2 });

sectionVideos.forEach(v => videoObserver.observe(v));

// ============ CARD SCROLL ANIMATIONS ============
const cards = document.querySelectorAll('.card');
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, i * 80);
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

cards.forEach(card => cardObserver.observe(card));

// ============ MULTI-SELECT SERVICE DROPDOWN ============
const serviceSelect = document.getElementById('serviceSelect');
const serviceTrigger = document.getElementById('serviceTrigger');
const serviceDropdown = document.getElementById('serviceDropdown');
const serviceCheckboxes = serviceDropdown.querySelectorAll('input[type="checkbox"]');

serviceTrigger.addEventListener('click', () => {
  serviceSelect.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!serviceSelect.contains(e.target)) {
    serviceSelect.classList.remove('open');
  }
});

serviceCheckboxes.forEach(cb => {
  cb.addEventListener('change', updateServiceDisplay);
});

function updateServiceDisplay() {
  const selected = Array.from(serviceCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
  serviceTrigger.innerHTML = '';

  if (selected.length === 0) {
    serviceTrigger.innerHTML = '<span class="multi-select-placeholder">Select Service Type</span>';
  } else {
    selected.forEach(val => {
      const tag = document.createElement('span');
      tag.className = 'multi-select-tag';
      tag.textContent = val;
      serviceTrigger.appendChild(tag);
    });
  }
}

// ============ CHARACTER COUNTER ============
const formMessage = document.getElementById('formMessage');
const charCount = document.getElementById('charCount');
const charCounter = charCount.parentElement;

formMessage.addEventListener('input', () => {
  const len = formMessage.value.length;
  charCount.textContent = len;
  charCounter.classList.toggle('near-limit', len >= 400 && len < 500);
  charCounter.classList.toggle('at-limit', len >= 500);
});

// ============ PHOTO UPLOAD WITH PREVIEW & COMPRESSION ============
const formPhotos = document.getElementById('formPhotos');
const photoPreview = document.getElementById('photoPreview');
const uploadedPhotos = [];
const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

formPhotos.addEventListener('change', async () => {
  const files = Array.from(formPhotos.files);

  for (const file of files) {
    if (uploadedPhotos.length >= MAX_PHOTOS) {
      showPhotoError('Maximum ' + MAX_PHOTOS + ' photos allowed');
      break;
    }

    if (!/\.(jpe?g|png)$/i.test(file.name)) {
      showPhotoError(file.name + ': Only JPG and PNG files accepted');
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      showPhotoError(file.name + ': File too large (max 10MB)');
      continue;
    }

    const compressed = await compressImage(file);
    const id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    uploadedPhotos.push({ file: compressed, id: id });
    addPhotoPreview(compressed, id);
  }

  formPhotos.value = '';
});

function showPhotoError(msg) {
  var existing = photoPreview.querySelector('.photo-error');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.className = 'photo-error';
  el.textContent = msg;
  photoPreview.appendChild(el);
  setTimeout(function() { el.remove(); }, 3000);
}

function addPhotoPreview(file, id) {
  var div = document.createElement('div');
  div.className = 'photo-thumb';
  div.dataset.id = id;

  var img = document.createElement('img');
  img.src = URL.createObjectURL(file);

  var info = document.createElement('span');
  info.className = 'photo-size';
  var sizeKB = (file.size / 1024).toFixed(0);
  info.textContent = sizeKB > 1024 ? (file.size / (1024 * 1024)).toFixed(1) + 'MB' : sizeKB + 'KB';

  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'photo-delete';
  del.innerHTML = '&times;';
  del.addEventListener('click', function() {
    var idx = uploadedPhotos.findIndex(function(p) { return p.id === id; });
    if (idx !== -1) uploadedPhotos.splice(idx, 1);
    URL.revokeObjectURL(img.src);
    div.remove();
    updateUploadLabel();
  });

  div.appendChild(img);
  div.appendChild(info);
  div.appendChild(del);
  photoPreview.appendChild(div);
  updateUploadLabel();
}

function updateUploadLabel() {
  var text = document.querySelector('.file-upload-text');
  if (uploadedPhotos.length > 0) {
    text.textContent = '\uD83D\uDCF7 ' + uploadedPhotos.length + '/' + MAX_PHOTOS + ' Photos';
  } else {
    text.textContent = '\uD83D\uDCF7 Upload Photos (optional, max 5)';
  }
}

function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || 1920;
  quality = quality || 0.8;

  return new Promise(function(resolve) {
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var w = img.width;
      var h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) {
        var name = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = function() { resolve(file); };
    img.src = url;
  });
}

// ============ COUNTY "OTHER" TOGGLE ============
const countySelect = document.getElementById('countySelect');
const countyOther = document.getElementById('countyOther');

countySelect.addEventListener('change', () => {
  if (countySelect.value === 'Other') {
    countyOther.style.display = 'block';
    countyOther.focus();
  } else {
    countyOther.style.display = 'none';
    countyOther.value = '';
  }
});

// ============ CONTACT FORM — VALIDATION & SEND ============
const contactForm = document.getElementById('contactForm');
const formErrors = document.getElementById('formErrors');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('formName').value.trim();
  const phone = document.getElementById('formPhone').value.trim();
  const email = document.getElementById('formEmail').value.trim();
  const services = Array.from(serviceCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
  const message = formMessage.value.trim();
  const county = countySelect.value === 'Other' ? countyOther.value.trim() : countySelect.value;

  // Clear previous errors
  formErrors.style.display = 'none';
  formErrors.innerHTML = '';
  formErrors.style.borderColor = '';
  formErrors.style.background = '';
  document.querySelectorAll('.contact-form .error').forEach(el => el.classList.remove('error'));
  serviceTrigger.classList.remove('error');
  countySelect.classList.remove('error');
  countyOther.classList.remove('error');

  // Validate
  const errors = [];

  if (!name) {
    errors.push('Name is required');
    document.getElementById('formName').classList.add('error');
  }

  if (!phone && !email) {
    errors.push('Phone number or email is required');
    document.getElementById('formPhone').classList.add('error');
    document.getElementById('formEmail').classList.add('error');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address');
    document.getElementById('formEmail').classList.add('error');
  }

  if (services.length === 0 && !message) {
    errors.push('Please select a service type or describe the service you need');
    serviceTrigger.classList.add('error');
    formMessage.classList.add('error');
  }

  if (!county) {
    errors.push('Service area (county) is required');
    countySelect.classList.add('error');
  }

  if (countySelect.value === 'Other' && !countyOther.value.trim()) {
    errors.push('Please enter your county name');
    countyOther.classList.add('error');
  }

  if (errors.length > 0) {
    formErrors.innerHTML = '<ul>' + errors.map(e => '<li>' + e + '</li>').join('') + '</ul>';
    formErrors.style.display = 'block';
    formErrors.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Disable submit button while sending
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  // Build FormData for backend
  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('email', email);
  formData.append('services', services.join(', '));
  formData.append('message', message);
  formData.append('county', county);
  uploadedPhotos.forEach(p => formData.append('photos', p.file));

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      formErrors.innerHTML = '<ul><li style="color: #4ade80;">\u2713 Request sent!</li></ul>';
      formErrors.style.display = 'block';
      formErrors.style.borderColor = 'rgba(74, 222, 128, 0.3)';
      formErrors.style.background = 'rgba(74, 222, 128, 0.1)';

      // Reset form
      document.getElementById('formName').value = '';
      document.getElementById('formPhone').value = '';
      document.getElementById('formEmail').value = '';
      formMessage.value = '';
      charCount.textContent = '0';
      charCounter.classList.remove('near-limit', 'at-limit');
      serviceCheckboxes.forEach(cb => { cb.checked = false; });
      updateServiceDisplay();
      countySelect.selectedIndex = 0;
      countyOther.style.display = 'none';
      countyOther.value = '';
      uploadedPhotos.length = 0;
      photoPreview.innerHTML = '';
      formPhotos.value = '';
      updateUploadLabel();

      setTimeout(() => { formErrors.style.display = 'none'; }, 3000);
    } else {
      formErrors.innerHTML = '<ul><li>Failed to send request. Please try again or call us directly.</li></ul>';
      formErrors.style.display = 'block';
    }
  } catch (err) {
    formErrors.innerHTML = '<ul><li>Connection error. Please try again or call (650) 740-7475.</li></ul>';
    formErrors.style.display = 'block';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Send Request';
});

// ============ SMOOTH SCROLL FOR NAV ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

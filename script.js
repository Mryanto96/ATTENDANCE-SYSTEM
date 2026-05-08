// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND
// Versi: 26.0 - KHUSUS PAPUA (WIT)
// FITUR BARU: Laporan Per Guru, Preview, Cetak PDF, Kirim Email
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbz0vfEEHdTnNyZniOvS5ArC7vakppAc3QDjdFmxLzn7NL_25xWZBBAAq4ox47a7lTDOfg/exec";

let currentUser = null;
let isSubmitting = false;
let otpTimer = null;
let forgotEmailGlobal = '';

// Camera & Location variables
let mediaStream = null;
let capturedPhoto = null;
let currentLocation = null;

// ============================================================
// DEFAULT ADMIN ACCOUNT
// ============================================================
const DEFAULT_ADMIN = {
  email: 'admin@sekolah.com',
  password: 'admin123',
  nama: 'Administrator Utama',
  role: 'admin',
  status: 'Verified'
};

// ==================== PAPUA TIME HELPER (WIT) ====================
function getPapuaTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 9));
}

function formatPapuaTime(date, format) {
  const witDate = getPapuaTime();
  const year = witDate.getFullYear();
  const month = String(witDate.getMonth() + 1).padStart(2, '0');
  const day = String(witDate.getDate()).padStart(2, '0');
  const hours = String(witDate.getHours()).padStart(2, '0');
  const minutes = String(witDate.getMinutes()).padStart(2, '0');
  const seconds = String(witDate.getSeconds()).padStart(2, '0');

  if (format === "yyyy-MM-dd") return year + '-' + month + '-' + day;
  if (format === "HH:mm") return hours + ':' + minutes;
  if (format === "HH:mm:ss") return hours + ':' + minutes + ':' + seconds;
  return hours + ':' + minutes;
}

function updateClock() {
  const now = getPapuaTime();
  const dateEl = document.getElementById('dateStr');
  const timeEl = document.getElementById('timeStr');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jayapura'
    });
  }
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jayapura'
    });
  }
}

// ==================== FORMAT TIME HELPER ====================
function formatTimeFromBackend(value) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
    var parts = value.split(':');
    var hours = parseInt(parts[0]);
    var minutes = parts[1];
    return String(hours).padStart(2, '0') + ':' + minutes;
  }
  if (typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.substring(0, 5);
  }
  if (typeof value === 'string' && value.indexOf('T') !== -1) {
    var match = value.match(/T(\d{2}):(\d{2}):/);
    if (match) return match[1] + ':' + match[2];
    match = value.match(/(\d{2}):(\d{2}):/);
    if (match) return match[1] + ':' + match[2];
  }
  if (typeof value === 'number') {
    var totalMinutes = Math.round(value * 24 * 60);
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }
  var str = value.toString();
  return str.substring(0, 5);
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  return hours * 60 + minutes;
}

// ==================== SWITCH TAB LOGIN/REGISTER ====================
function switchAuthTab(tabName) {
  const tabs = document.querySelectorAll('.tab-two');
  tabs.forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.querySelector(`.tab-two[data-tab="${tabName}"]`);
  if (activeTab) activeTab.classList.add('active');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (tabName === 'login') {
    if (loginForm) loginForm.classList.add('active');
    if (registerForm) registerForm.classList.remove('active');
  } else {
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.add('active');
  }
}

// ==================== DARK MODE ====================
function initDarkMode() {
  const darkModeBtn = document.getElementById('darkModeBtn');
  if (!darkModeBtn) return;

  const sunIcon = darkModeBtn.querySelector('.sun-icon');
  const moonIcon = darkModeBtn.querySelector('.moon-icon');
  const toggleText = darkModeBtn.querySelector('.toggle-text');

  const savedMode = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedMode === 'enabled' || (!savedMode && prefersDark)) {
    document.body.classList.add('dark-mode');
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'block';
    if (toggleText) toggleText.textContent = 'Light';
  } else {
    document.body.classList.remove('dark-mode');
    if (sunIcon) sunIcon.style.display = 'block';
    if (moonIcon) moonIcon.style.display = 'none';
    if (toggleText) toggleText.textContent = 'Dark';
  }

  darkModeBtn.addEventListener('click', function () {
    const isDark = document.body.classList.toggle('dark-mode');
    if (isDark) {
      localStorage.setItem('darkMode', 'enabled');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
      if (toggleText) toggleText.textContent = 'Light';
    } else {
      localStorage.setItem('darkMode', 'disabled');
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
      if (toggleText) toggleText.textContent = 'Dark';
    }
  });
}

// ==================== MODAL KONFIRMASI ====================
function showConfirmModal(title, message, onConfirm, onCancel) {
  let modal = document.getElementById('confirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-container" style="max-width:400px">
        <div class="modal-header">
          <h3 id="confirmTitle">Konfirmasi</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage">Apakah Anda yakin?</p>
        </div>
        <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end">
          <button id="confirmCancelBtn" class="btn-secondary">Batal</button>
          <button id="confirmOkBtn" class="btn-primary">Ya, Lanjutkan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;

  const closeBtn = modal.querySelector('.close-modal');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const okBtn = document.getElementById('confirmOkBtn');

  const closeModal = () => {
    modal.classList.remove('open');
    if (onCancel) onCancel();
  };

  const confirmAction = () => {
    modal.classList.remove('open');
    if (onConfirm) onConfirm();
  };

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  newCloseBtn.addEventListener('click', closeModal);
  newCancelBtn.addEventListener('click', closeModal);
  newOkBtn.addEventListener('click', confirmAction);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  modal.classList.add('open');
}

// ==================== JSONP API CALL ====================
function apiCall(params) {
  return new Promise((resolve) => {
    const cbName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    let url = API_URL + '?callback=' + cbName;
    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    }
    url += '&_=' + Date.now();

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ status: 'error', message: 'Request timeout. Periksa koneksi internet Anda.' });
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    window[cbName] = function (data) {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = cbName;
    script.src = url;
    script.onerror = function () {
      cleanup();
      resolve({ status: 'error', message: 'Gagal terhubung ke server. Coba lagi.' });
    };
    document.head.appendChild(script);
  });
}

// ==================== POST API CALL ====================
function apiCallPost(data) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ status: 'error', message: 'Request timeout. Periksa koneksi internet Anda.' });
    }, 30000);

    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      redirect: 'follow'
    })
      .then(res => res.json())
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeout);
        resolve({ status: 'error', message: 'Gagal mengirim data. Pastikan koneksi stabil.' });
      });
  });
}

// ==================== UI HELPERS ====================
function showMsg(id, type, text, isAuth = true) {
  const el = document.getElementById(id);
  if (!el) return;

  if (isAuth) {
    el.className = 'msg-two ' + type + ' show';
  } else {
    el.className = 'msg ' + type + ' show';
  }
  el.textContent = text;
  setTimeout(() => {
    if (el.classList.contains('show')) {
      el.classList.remove('show');
      if (isAuth) {
        el.className = 'msg-two';
      } else {
        el.className = 'msg';
      }
      el.textContent = '';
    }
  }, 5000);
}

function setBtn(id, loading, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (text) btn.textContent = loading ? '⏳ ' + text + '...' : text;
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const d2 = new Date(parts[0], parts[1] - 1, parts[2]);
      return d2.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    return str;
  }
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ==================== AUTH ====================
function saveAuth(userData) {
  currentUser = userData;
  sessionStorage.setItem('absensiUser', JSON.stringify(userData));
}

function checkAuth() {
  const stored = sessionStorage.getItem('absensiUser');
  if (stored) {
    try { currentUser = JSON.parse(stored); return true; }
    catch (e) { return false; }
  }
  return false;
}

function logout() {
  sessionStorage.removeItem('absensiUser');
  currentUser = null;
  window.location.href = 'index.html';
}

// ==================== LOGIN ====================
async function handleLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('loginEmail')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showMsg('loginMsg', 'error', 'Email dan password wajib diisi', true);
    return;
  }

  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    saveAuth(DEFAULT_ADMIN);
    showMsg('loginMsg', 'success', 'Login sebagai Admin! Mengarahkan...', true);
    setTimeout(() => {
      window.location.href = 'dashboard-admin.html';
    }, 800);
    return;
  }

  setBtn('loginBtn', true, 'Masuk');
  showMsg('loginMsg', 'loading', 'Memverifikasi akun...', true);

  const result = await apiCall({ action: 'login', email, password });

  setBtn('loginBtn', false, 'Masuk');

  if (result.status === 'success') {
    saveAuth(result.data);
    showMsg('loginMsg', 'success', 'Login berhasil! Mengarahkan...', true);
    setTimeout(() => {
      const role = result.data.role;
      if (role === 'admin') window.location.href = 'dashboard-admin.html';
      else if (role === 'kepsek') window.location.href = 'dashboard-kepsek.html';
      else window.location.href = 'dashboard-guru.html';
    }, 800);
  } else {
    showMsg('loginMsg', 'error', result.message || 'Login gagal', true);
    if (result.unverified) {
      const rw = document.getElementById('resendWrap');
      if (rw) rw.style.display = 'block';
    }
  }
}

// ==================== REGISTER ====================
async function handleRegister(e) {
  if (e) e.preventDefault();

  const nama = document.getElementById('regNama')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim();
  const password = document.getElementById('regPassword')?.value;
  const role = document.getElementById('regRole')?.value || 'guru';

  if (!nama || !email || !password) {
    showMsg('registerMsg', 'error', 'Semua field wajib diisi', true);
    return;
  }

  if (password.length < 6) {
    showMsg('registerMsg', 'error', 'Password minimal 6 karakter', true);
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMsg('registerMsg', 'error', 'Format email tidak valid', true);
    return;
  }

  setBtn('registerBtn', true, 'Daftar Akun');
  showMsg('registerMsg', 'loading', 'Mendaftarkan akun...', true);

  const result = await apiCall({ action: 'signup', nama, email, password, role });

  setBtn('registerBtn', false, 'Daftar Akun');

  if (result.status === 'success') {
    showMsg('registerMsg', 'success', result.message, true);
    document.getElementById('regNama').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    setTimeout(() => {
      switchAuthTab('login');
      document.getElementById('loginEmail').value = email;
    }, 2500);
  } else {
    showMsg('registerMsg', 'error', result.message || 'Registrasi gagal', true);
  }
}

// ==================== RESEND VERIFICATION ====================
async function resendVerif() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  if (!email) { showMsg('loginMsg', 'error', 'Masukkan email terlebih dahulu', true); return; }
  showMsg('loginMsg', 'loading', 'Mengirim ulang...', true);
  const r = await apiCall({ action: 'resendVerification', email });
  showMsg('loginMsg', r.status === 'success' ? 'success' : 'error', r.message, true);
}

// ==================== OTP / FORGOT PASSWORD ====================
function openForgotModal() {
  document.getElementById('step1').classList.add('active');
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step3').classList.remove('active');
  document.getElementById('forgotEmail').value = '';
  document.getElementById('otpInput').value = '';
  document.getElementById('newPwd').value = '';
  document.getElementById('confirmPwd').value = '';
  const msgEl = document.getElementById('forgotMsg');
  if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }
  if (otpTimer) clearInterval(otpTimer);
  document.getElementById('forgotModal').classList.add('open');
}

function closeForgotModal() {
  const modal = document.getElementById('forgotModal');
  if (modal) modal.classList.remove('open');
  if (otpTimer) clearInterval(otpTimer);
}

function goStep(stepName) {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step3').classList.remove('active');
  document.getElementById(stepName).classList.add('active');
}

function startOtpCountdown() {
  let secs = 600;
  const el = document.getElementById('otpTimer');
  if (otpTimer) clearInterval(otpTimer);

  function tick() {
    if (!el) return;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent = 'OTP berlaku: ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    if (secs <= 0) {
      clearInterval(otpTimer);
      el.textContent = 'OTP telah kadaluarsa';
    }
    secs--;
  }
  tick();
  otpTimer = setInterval(tick, 1000);
}

async function sendOtp() {
  const email = document.getElementById('forgotEmail')?.value?.trim();
  if (!email) { showMsg('forgotMsg', 'error', 'Masukkan email Anda', false); return; }
  forgotEmailGlobal = email;
  setBtn('sendOtpBtn', true, 'Kirim Kode OTP');
  showMsg('forgotMsg', 'loading', 'Mengirim OTP...', false);

  const r = await apiCall({ action: 'sendPasswordResetOTP', email });

  setBtn('sendOtpBtn', false, 'Kirim Kode OTP');
  if (r.status === 'success') {
    showMsg('forgotMsg', 'success', r.message, false);
    setTimeout(() => {
      goStep('step2');
      const msgEl = document.getElementById('forgotMsg');
      if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }
      startOtpCountdown();
    }, 800);
  } else {
    showMsg('forgotMsg', 'error', r.message, false);
  }
}

async function resendOtp() {
  if (!forgotEmailGlobal) return;
  showMsg('forgotMsg', 'loading', 'Mengirim ulang OTP...', false);
  const r = await apiCall({ action: 'sendPasswordResetOTP', email: forgotEmailGlobal });
  showMsg('forgotMsg', r.status === 'success' ? 'success' : 'error', r.message, false);
  if (r.status === 'success') startOtpCountdown();
}

async function verifyOtp() {
  const otp = document.getElementById('otpInput')?.value?.trim();
  if (!otp || otp.length !== 6) { showMsg('forgotMsg', 'error', 'Masukkan 6 digit OTP', false); return; }
  setBtn('verifyOtpBtn', true, 'Verifikasi');
  showMsg('forgotMsg', 'loading', 'Memverifikasi...', false);

  const r = await apiCall({ action: 'verifyOTP', email: forgotEmailGlobal, otp });

  setBtn('verifyOtpBtn', false, 'Verifikasi');
  if (r.status === 'success') {
    if (otpTimer) clearInterval(otpTimer);
    showMsg('forgotMsg', 'success', 'OTP valid!', false);
    setTimeout(() => {
      goStep('step3');
      const msgEl = document.getElementById('forgotMsg');
      if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }
    }, 600);
  } else {
    showMsg('forgotMsg', 'error', r.message, false);
  }
}

async function doResetPassword() {
  const pwd = document.getElementById('newPwd')?.value;
  const confirm = document.getElementById('confirmPwd')?.value;
  if (!pwd || pwd.length < 6) { showMsg('forgotMsg', 'error', 'Password minimal 6 karakter', false); return; }
  if (pwd !== confirm) { showMsg('forgotMsg', 'error', 'Konfirmasi password tidak cocok', false); return; }

  setBtn('resetPwdBtn', true, 'Simpan');
  showMsg('forgotMsg', 'loading', 'Menyimpan...', false);

  const r = await apiCall({ action: 'resetPassword', email: forgotEmailGlobal, newPassword: pwd });

  setBtn('resetPwdBtn', false, 'Simpan');
  if (r.status === 'success') {
    showMsg('forgotMsg', 'success', 'Password berhasil direset! Silakan login.', false);
    setTimeout(() => closeForgotModal(), 2000);
  } else {
    showMsg('forgotMsg', 'error', r.message, false);
  }
}

// ==================== SCHOOL NAME ====================
async function loadSchoolName() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status === 'success' && r.data?.school_name?.value) {
    const el = document.getElementById('schoolName');
    if (el) el.textContent = r.data.school_name.value;
  }
}

// ==================== DASHBOARD PROFILE ====================
function loadProfile() {
  if (!currentUser) return;
  const nameEls = ['userName', 'profileName'];
  nameEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = currentUser.nama;
  });
  const emailEl = document.getElementById('profileEmail');
  if (emailEl) emailEl.textContent = currentUser.email;

  const roleMap = { guru: 'Guru', kepsek: 'Kepala Sekolah', admin: 'Administrator' };
  const roleEl = document.getElementById('profileRole');
  if (roleEl) roleEl.textContent = roleMap[currentUser.role] || currentUser.role;

  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl && currentUser.nama) {
    avatarEl.textContent = currentUser.nama.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
}

// ==================== CAMERA FUNCTIONS ====================
async function initCamera() {
  try {
    if (mediaStream) stopCamera();
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    const video = document.getElementById('video');
    if (video) {
      video.srcObject = mediaStream;
      await video.play();
    }
    return true;
  } catch (e) {
    const msgEl = document.getElementById('attendMsg');
    if (msgEl) {
      msgEl.className = 'msg error show';
      msgEl.textContent = 'Tidak dapat mengakses kamera: ' + e.message;
      setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000);
    }
    return false;
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  capturedPhoto = canvas.toDataURL('image/jpeg', 0.6);

  const preview = document.getElementById('previewImg');
  const previewWrap = document.getElementById('photoPreview');
  const cameraWrap = document.getElementById('cameraWrap');
  if (preview) preview.src = capturedPhoto;
  if (previewWrap) previewWrap.style.display = 'block';
  if (cameraWrap) cameraWrap.style.display = 'none';
  updateAttendBtns();
}

function retakePhoto() {
  capturedPhoto = null;
  const previewWrap = document.getElementById('photoPreview');
  const cameraWrap = document.getElementById('cameraWrap');
  if (previewWrap) previewWrap.style.display = 'none';
  if (cameraWrap) cameraWrap.style.display = 'block';
  updateAttendBtns();
}

function updateAttendBtns() {
  const ready = !!capturedPhoto && !!currentLocation;
  const ci = document.getElementById('checkInBtn');
  const co = document.getElementById('checkOutBtn');
  if (ci && !ci.dataset.done) ci.disabled = !ready;
  if (co && !co.dataset.done) co.disabled = !ready;
}

// ==================== LOCATION FUNCTIONS ====================
async function getLocation() {
  const btn = document.getElementById('getLocBtn');
  const info = document.getElementById('locationInfo');
  if (btn) { btn.disabled = true; btn.textContent = '📡 Mendapatkan lokasi...'; }
  if (info) info.style.display = 'block';

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      if (info) { info.textContent = '❌ Browser tidak mendukung geolocation'; info.className = 'location-info failed'; }
      if (btn) { btn.disabled = false; btn.textContent = '📍 Dapatkan Lokasi'; }
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (info) {
          info.textContent = '✅ Lokasi ditemukan (' + currentLocation.lat.toFixed(5) + ', ' + currentLocation.lng.toFixed(5) + ') ±' + Math.round(currentLocation.accuracy) + 'm';
          info.className = 'location-info found';
        }
        if (btn) { btn.disabled = false; btn.textContent = '✅ Lokasi Didapat'; }
        updateAttendBtns();
        resolve(true);
      },
      (err) => {
        let msg = 'Gagal mendapatkan lokasi';
        if (err.code === 1) msg = 'Izin lokasi ditolak. Aktifkan izin lokasi di browser.';
        else if (err.code === 2) msg = 'Lokasi tidak tersedia.';
        else if (err.code === 3) msg = 'Waktu habis. Coba lagi.';
        if (info) { info.textContent = '❌ ' + msg; info.className = 'location-info failed'; }
        if (btn) { btn.disabled = false; btn.textContent = '📍 Coba Lagi'; }
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

// ==================== ATTENDANCE FUNCTIONS ====================
async function loadTodayStatus() {
  if (!currentUser) return;
  const box = document.getElementById('todayStatusBox');
  const dashBox = document.getElementById('dashAttendStatus');
  if (box) box.innerHTML = '<div class="info-box info">Memeriksa status...</div>';

  const r = await apiCall({ action: 'checkTodayAttendance', email: currentUser.email });
  if (r.status !== 'success') return;

  const d = r.data;
  const ci = document.getElementById('checkInBtn');
  const co = document.getElementById('checkOutBtn');

  if (box) {
    let html = '';
    if (d.hasCheckedIn) {
      html += '<div class="info-box success">✅ Absen masuk: <strong>' + d.checkInTime + '</strong> di ' + (d.lokasi || '-') + '</div>';
      if (ci) { ci.disabled = true; ci.dataset.done = '1'; }
    } else {
      html += '<div class="info-box info">📝 Belum absen masuk hari ini</div>';
    }
    if (d.hasCheckedOut) {
      html += '<div class="info-box success">✅ Absen pulang: <strong>' + d.checkOutTime + '</strong></div>';
      if (co) { co.disabled = true; co.dataset.done = '1'; }
    } else if (d.hasCheckedIn) {
      html += '<div class="info-box warning">⏰ Belum absen pulang</div>';
    }
    box.innerHTML = html;
  }

  if (dashBox) {
    if (d.hasCheckedIn && d.hasCheckedOut) {
      dashBox.innerHTML = '<div class="info-box success">✅ Absensi hari ini sudah lengkap!</div>';
    } else if (d.hasCheckedIn) {
      dashBox.innerHTML = '<div class="info-box warning">⏰ Sudah absen masuk, belum absen pulang</div>';
    } else {
      dashBox.innerHTML = '<div class="info-box info">📝 Belum absen hari ini</div>';
    }
  }
}

// ==================== LOAD SCHEDULE INFO ====================
async function loadAdminScheduleInfo() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;
  const el = document.getElementById('adminScheduleInfo');
  if (!el) return;

  const jadwalSeninRabu = {
    masukMulai: formatTimeFromBackend(s.senin_rabu_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.senin_rabu_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.senin_rabu_pulang_mulai?.value) || '12:00',
    pulangSelesai: formatTimeFromBackend(s.senin_rabu_pulang_selesai?.value) || '12:15'
  };

  const jadwalKamisJumat = {
    masukMulai: formatTimeFromBackend(s.kamis_jumat_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.kamis_jumat_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.kamis_jumat_pulang_mulai?.value) || '12:00',
    pulangSelesai: formatTimeFromBackend(s.kamis_jumat_pulang_selesai?.value) || '12:00'
  };

  el.innerHTML = `
    <div class="info-box info">
      <strong>📅 Senin – Rabu</strong><br>
      🟢 Masuk: ${jadwalSeninRabu.masukMulai} – ${jadwalSeninRabu.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalSeninRabu.pulangMulai} – ${jadwalSeninRabu.pulangSelesai} WIT
    </div>
    <div class="info-box info" style="margin-top: 10px;">
      <strong>📅 Kamis – Jumat</strong><br>
      🟢 Masuk: ${jadwalKamisJumat.masukMulai} – ${jadwalKamisJumat.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalKamisJumat.pulangMulai} – ${jadwalKamisJumat.pulangSelesai} WIT
    </div>
  `;
}

async function loadKepsekScheduleInfo() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;
  const el = document.getElementById('kepsekScheduleInfo');
  if (!el) return;

  const jadwalSeninRabu = {
    masukMulai: formatTimeFromBackend(s.senin_rabu_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.senin_rabu_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.senin_rabu_pulang_mulai?.value) || '12:00',
    pulangSelesai: formatTimeFromBackend(s.senin_rabu_pulang_selesai?.value) || '12:15'
  };

  const jadwalKamisJumat = {
    masukMulai: formatTimeFromBackend(s.kamis_jumat_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.kamis_jumat_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.kamis_jumat_pulang_mulai?.value) || '12:00',
    pulangSelesai: formatTimeFromBackend(s.kamis_jumat_pulang_selesai?.value) || '12:00'
  };

  el.innerHTML = `
    <div class="info-box info">
      <strong>📅 Senin – Rabu</strong><br>
      🟢 Masuk: ${jadwalSeninRabu.masukMulai} – ${jadwalSeninRabu.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalSeninRabu.pulangMulai} – ${jadwalSeninRabu.pulangSelesai} WIT
    </div>
    <div class="info-box info" style="margin-top: 10px;">
      <strong>📅 Kamis – Jumat</strong><br>
      🟢 Masuk: ${jadwalKamisJumat.masukMulai} – ${jadwalKamisJumat.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalKamisJumat.pulangMulai} – ${jadwalKamisJumat.pulangSelesai} WIT
    </div>
  `;
}

async function loadScheduleInfo() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;
  const now = getPapuaTime();
  const day = now.getDay();
  const el = document.getElementById('scheduleInfo');
  if (!el) return;

  if (day === 0 || day === 6) {
    el.innerHTML = '<div class="info-box warning">🏖️ Hari ini libur akhir pekan</div>';
    return;
  }

  let label, jadwal;
  if (day >= 1 && day <= 3) {
    label = 'Senin – Rabu';
    jadwal = {
      masukMulai: formatTimeFromBackend(s.senin_rabu_masuk_mulai?.value) || '07:00',
      masukSelesai: formatTimeFromBackend(s.senin_rabu_masuk_selesai?.value) || '08:30',
      pulangMulai: formatTimeFromBackend(s.senin_rabu_pulang_mulai?.value) || '12:00',
      pulangSelesai: formatTimeFromBackend(s.senin_rabu_pulang_selesai?.value) || '12:15'
    };
  } else {
    label = 'Kamis – Jumat';
    jadwal = {
      masukMulai: formatTimeFromBackend(s.kamis_jumat_masuk_mulai?.value) || '07:00',
      masukSelesai: formatTimeFromBackend(s.kamis_jumat_masuk_selesai?.value) || '08:30',
      pulangMulai: formatTimeFromBackend(s.kamis_jumat_pulang_mulai?.value) || '12:00',
      pulangSelesai: formatTimeFromBackend(s.kamis_jumat_pulang_selesai?.value) || '12:00'
    };
  }
  el.innerHTML = '<div class="info-box info">' +
    '<strong>📅 ' + label + '</strong><br>' +
    '🟢 Masuk: ' + jadwal.masukMulai + ' – ' + jadwal.masukSelesai + ' WIT<br>' +
    '🔴 Pulang: ' + jadwal.pulangMulai + ' – ' + jadwal.pulangSelesai + ' WIT' +
    '</div>';
}

// ==================== CHECK IN ====================
async function handleCheckIn() {
  if (isSubmitting) return;
  if (!capturedPhoto) {
    const msgEl = document.getElementById('attendMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Ambil foto selfie terlebih dahulu'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }
  if (!currentLocation) {
    const msgEl = document.getElementById('attendMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Dapatkan lokasi Anda terlebih dahulu'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  const btn = document.getElementById('checkInBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  const msgEl = document.getElementById('attendMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Mengirim data absen masuk...'; }

  const result = await apiCallPost({
    action: 'checkIn',
    email: currentUser.email,
    photo: capturedPhoto,
    lat: currentLocation.lat,
    lng: currentLocation.lng
  });

  isSubmitting = false;
  if (btn) { btn.disabled = false; btn.textContent = '✅ Absen Masuk'; }

  if (result.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = result.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    if (btn) { btn.disabled = true; btn.dataset.done = '1'; }
    setTimeout(() => loadTodayStatus(), 1500);
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = result.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== CHECK OUT ====================
async function handleCheckOut() {
  if (isSubmitting) return;
  if (!capturedPhoto) {
    const msgEl = document.getElementById('attendMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Ambil foto selfie terlebih dahulu'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }
  if (!currentLocation) {
    const msgEl = document.getElementById('attendMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Dapatkan lokasi Anda terlebih dahulu'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  const btn = document.getElementById('checkOutBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  const msgEl = document.getElementById('attendMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Mengirim data absen pulang...'; }

  const result = await apiCallPost({
    action: 'checkOut',
    email: currentUser.email,
    photo: capturedPhoto,
    lat: currentLocation.lat,
    lng: currentLocation.lng
  });

  isSubmitting = false;
  if (btn) { btn.disabled = false; btn.textContent = '🔚 Absen Pulang'; }

  if (result.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = result.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    if (btn) { btn.disabled = true; btn.dataset.done = '1'; }
    setTimeout(() => loadTodayStatus(), 1500);
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = result.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== HISTORY ====================
async function loadHistory() {
  const month = document.getElementById('histMonth')?.value;
  const year = document.getElementById('histYear')?.value;
  if (!month || !year || !currentUser) return;

  const tbody = document.getElementById('histBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Memuat...</td></tr>';

  const r = await apiCall({ action: 'getAttendanceHistory', email: currentUser.email, month, year });
  if (!tbody) return;

  if (r.status === 'success' && r.data && r.data.length > 0) {
    tbody.innerHTML = r.data.map(row =>
      '<tr>' +
      '<td>' + formatDate(row.tanggal) + '</td>' +
      '<td>' + (row.checkIn || '-') + '</td>' +
      '<td>' + (row.checkOut || '-') + '</td>' +
      '<td>' + (row.lokasi || '-') + '</td>' +
      '<td><span class="badge badge-success">' + (row.status || 'Hadir') + '</span></td>' +
      '</tr>'
    ).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data untuk periode ini</td></tr>';
  }

  if (r.status === 'success' && r.data) {
    const total = r.data.length;
    const persen = Math.round((total / 22) * 100);
    const totEl = document.getElementById('statHadir');
    const perEl = document.getElementById('statPersen');
    if (totEl) totEl.textContent = total;
    if (perEl) perEl.textContent = persen + '%';
  }
}

// ==================== DASHBOARD STATS ====================
async function loadDashboardStats() {
  const r = await apiCall({ action: 'getAllUsers' });
  if (r.status === 'success' && r.data) {
    const guru = r.data.filter(u => u.role === 'guru').length;
    const kepsek = r.data.filter(u => u.role === 'kepsek').length;
    const admin = r.data.filter(u => u.role === 'admin').length;
    const g = document.getElementById('statGuru');
    const k = document.getElementById('statKepsek');
    const a = document.getElementById('statAdmin');
    if (g) g.textContent = guru;
    if (k) k.textContent = kepsek;
    if (a) a.textContent = admin;
  }

  if (currentUser && currentUser.role === 'guru') {
    const now = getPapuaTime();
    const r2 = await apiCall({ action: 'getAttendanceHistory', email: currentUser.email, month: now.getMonth() + 1, year: now.getFullYear() });
    if (r2.status === 'success' && r2.data) {
      const total = r2.data.length;
      const persen = Math.round((total / 22) * 100);
      const t = document.getElementById('statHadir');
      const p = document.getElementById('statPersen');
      if (t) t.textContent = total;
      if (p) p.textContent = persen + '%';
    }
  }
}

// ==================== TEACHERS ====================
async function loadAllTeachers() {
  const tbody = document.getElementById('teachersBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Memuat data...</td></tr>';

  const searchVal = document.getElementById('searchTeacher')?.value?.toLowerCase() || '';
  const roleFilter = document.getElementById('filterRole')?.value || 'all';
  const r = await apiCall({ action: 'getAllUsers' });

  if (!tbody) return;
  if (r.status !== 'success' || !r.data || !r.data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data pengguna</td></tr>';
    return;
  }

  let data = r.data;
  if (searchVal) data = data.filter(u => u.nama?.toLowerCase().includes(searchVal) || u.email?.toLowerCase().includes(searchVal));
  if (roleFilter !== 'all') data = data.filter(u => u.role === roleFilter);

  const isAdmin = currentUser?.role === 'admin';
  tbody.innerHTML = data.map((u, i) =>
    '<tr>' +
    '<td>' + (i + 1) + '</td>' +
    '<td><strong>' + (u.nama || '-') + '</strong></td>' +
    '<td style="color:var(--text2)">' + (u.email || '-') + '</td>' +
    '<td><span class="badge badge-info">' + (u.role === 'guru' ? 'Guru' : u.role === 'kepsek' ? 'Kepsek' : 'Admin') + '</span></td>' +
    '<td>' + (u.status === 'Verified' ? '<span class="badge badge-success">Aktif</span>' : u.status === 'Pending' ? '<span class="badge badge-warning">Pending</span>' : '<span class="badge badge-error">Diblokir</span>') + '</td>' +
    '<td><div class="td-actions">' +
    '<button class="btn-secondary btn-sm" onclick="viewTeacherAttendance(\'' + u.email + '\')">📋 Absensi</button>' +
    (isAdmin ? '<button class="btn-secondary btn-sm" onclick="editTeacher(\'' + u.email + '\')">✏️ Edit</button>' : '') +
    (isAdmin ? '<button class="' + (u.status === 'Blocked' ? 'btn-success' : 'btn-danger') + ' btn-sm" onclick="confirmToggleBlock(\'' + u.email + '\',\'' + u.status + '\')">' + (u.status === 'Blocked' ? '🔓 Aktifkan' : '🔒 Blokir') + '</button>' : '') +
    '</div></td>' +
    '</tr>'
  ).join('');
}

// ==================== LOAD TEACHER LIST FOR DROPDOWN (KEPSEK) ====================
async function loadTeacherList() {
  const r = await apiCall({ action: 'getAllUsers' });
  if (r.status === 'success' && r.data) {
    const guruOnly = r.data.filter(u => u.role === 'guru');

    const selectedTeacher = document.getElementById('selectedTeacher');
    const previewTeacher = document.getElementById('previewTeacher');

    const options = guruOnly.map(g => `<option value="${g.email}">${g.nama} (${g.email})</option>`).join('');

    if (selectedTeacher) selectedTeacher.innerHTML = '<option value="">-- Pilih Guru --</option>' + options;
    if (previewTeacher) previewTeacher.innerHTML = '<option value="">-- Pilih Guru --</option>' + options;
  }
}

// ==================== PREVIEW LAPORAN PER GURU (KEPSEK) ====================
async function previewTeacherReport() {
  const email = document.getElementById('previewTeacher')?.value;
  const month = document.getElementById('previewMonth')?.value;
  const year = document.getElementById('previewYear')?.value;

  if (!email) {
    showMsg('teacherReportMsg', 'error', 'Pilih guru terlebih dahulu', false);
    return;
  }

  setBtn('previewReportBtn', true, 'Memuat preview...');
  const r = await apiCall({ action: 'getAttendanceHistory', email, month, year });
  setBtn('previewReportBtn', false, '👁️ Preview Laporan');

  if (r.status !== 'success') {
    showMsg('teacherReportMsg', 'error', 'Gagal mengambil data', false);
    return;
  }

  const teacherName = document.getElementById('previewTeacher').options[document.getElementById('previewTeacher').selectedIndex]?.text.split(' (')[0] || email;
  const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthName = monthNames[parseInt(month)] || month;

  let html = `
    <div style="margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
        <h4 style="margin: 0;">📋 Laporan Absensi Guru</h4>
        <button class="btn-secondary btn-sm" onclick="printPreviewReport()">🖨️ Cetak / PDF</button>
      </div>
      <p><strong>Nama Guru:</strong> ${teacherName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Periode:</strong> ${monthName} ${year}</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Lokasi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (r.data.length === 0) {
    html += `<tr><td colspan="6" class="empty-state">Belum ada data absensi bulan ini</td></tr>`;
  } else {
    r.data.forEach((item, i) => {
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(item.tanggal)}</td>
          <td>${item.checkIn}</td>
          <td>${item.checkOut}</td>
          <td>${item.lokasi}</td>
          <td><span class="badge badge-success">${item.status}</span></td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>
      <p style="color: var(--text2); font-size: 11px; margin-top: 12px;">Dicetak: ${new Date().toLocaleString()}</p>
    </div>
  `;

  const previewContainer = document.getElementById('previewContainer');
  const previewContent = document.getElementById('previewContent');
  if (previewContainer && previewContent) {
    previewContent.innerHTML = html;
    previewContainer.style.display = 'block';

    // Simpan data untuk print
    window.previewData = { html: previewContent.innerHTML, teacherName, email, monthName, year };
  }
}

// ==================== PRINT PREVIEW REPORT (PDF) ====================
function printPreviewReport() {
  if (!window.previewData) return;

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan ${window.previewData.teacherName} - ${window.previewData.monthName} ${window.previewData.year}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', Arial, sans-serif; padding: 20px; background: white; }
        h1 { color: #1a1a2e; text-align: center; margin-bottom: 20px; }
        .info { margin-bottom: 20px; }
        .info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #1a1a2e; color: white; }
        .footer { margin-top: 20px; font-size: 11px; color: #666; text-align: center; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="margin-bottom: 20px; padding: 8px 16px; cursor: pointer;">🖨️ Cetak / Simpan PDF</button>
      <h1>📋 Laporan Absensi Guru</h1>
      <div class="info">
        <p><strong>Nama Guru:</strong> ${window.previewData.teacherName}</p>
        <p><strong>Email:</strong> ${window.previewData.email}</p>
        <p><strong>Periode:</strong> ${window.previewData.monthName} ${window.previewData.year}</p>
      </div>
      ${window.previewData.html}
      <div class="footer">
        <p>Dicetak otomatis dari Sistem Absensi Digital | ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}

// ==================== KIRIM LAPORAN PER GURU KE EMAIL (KEPSEK) ====================
async function sendTeacherReport() {
  const email = document.getElementById('selectedTeacher')?.value;
  const month = document.getElementById('repMonthTeacher')?.value;
  const year = document.getElementById('repYearTeacher')?.value;
  const sendTo = document.getElementById('teacherReportEmail')?.value;

  if (!email) {
    showMsg('teacherReportMsg', 'error', 'Pilih guru terlebih dahulu', false);
    return;
  }

  if (!sendTo) {
    showMsg('teacherReportMsg', 'error', 'Masukkan email tujuan', false);
    return;
  }

  setBtn('genTeacherReportBtn', true, 'Mengirim...');
  const r = await apiCall({ action: 'generateMonthlyReport', month, year, sendToEmail: sendTo, filterEmail: email });
  setBtn('genTeacherReportBtn', false, '📤 Kirim Laporan Guru Terpilih');

  if (r.status === 'success') {
    showMsg('teacherReportMsg', 'success', r.message, false);
  } else {
    showMsg('teacherReportMsg', 'error', r.message || 'Gagal mengirim laporan', false);
  }
}

// ==================== CETAK/PDF LAPORAN PER GURU (KEPSEK) ====================
async function printTeacherReport() {
  const email = document.getElementById('selectedTeacher')?.value;
  const month = document.getElementById('repMonthTeacher')?.value;
  const year = document.getElementById('repYearTeacher')?.value;

  if (!email) {
    showMsg('teacherReportMsg', 'error', 'Pilih guru terlebih dahulu', false);
    return;
  }

  setBtn('printTeacherReportBtn', true, 'Memuat...');
  const r = await apiCall({ action: 'getAttendanceHistory', email, month, year });
  setBtn('printTeacherReportBtn', false, '🖨️ Cetak / PDF Guru Terpilih');

  if (r.status !== 'success') {
    showMsg('teacherReportMsg', 'error', 'Gagal mengambil data', false);
    return;
  }

  const teacherName = document.getElementById('selectedTeacher').options[document.getElementById('selectedTeacher').selectedIndex]?.text.split(' (')[0] || email;
  const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthName = monthNames[parseInt(month)] || month;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan ${teacherName} - ${monthName} ${year}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', Arial, sans-serif; padding: 20px; background: white; }
        h1 { color: #1a1a2e; text-align: center; margin-bottom: 20px; }
        .info { margin-bottom: 20px; }
        .info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #1a1a2e; color: white; }
        .footer { margin-top: 20px; font-size: 11px; color: #666; text-align: center; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="margin-bottom: 20px; padding: 8px 16px; cursor: pointer;">🖨️ Cetak / Simpan PDF</button>
      <h1>📋 Laporan Absensi Guru</h1>
      <div class="info">
        <p><strong>Nama Guru:</strong> ${teacherName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Periode:</strong> ${monthName} ${year}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Lokasi</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (r.data.length === 0) {
    html += `<tr><td colspan="6" style="text-align: center;">Belum ada data absensi bulan ini</td></tr>`;
  } else {
    r.data.forEach((item, i) => {
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(item.tanggal)}</td>
          <td>${item.checkIn}</td>
          <td>${item.checkOut}</td>
          <td>${item.lokasi}</td>
          <td>${item.status}</td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
      <div class="footer">
        <p>Dicetak otomatis dari Sistem Absensi Digital | ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ==================== GENERATE REPORT (SEMUA GURU) ====================
async function generateReport() {
  if (isSubmitting) return;
  const month = document.getElementById('repMonth')?.value;
  const year = document.getElementById('repYear')?.value;
  const email = document.getElementById('repEmail')?.value?.trim() || currentUser?.email;
  if (!month || !year || !email) {
    const msgEl = document.getElementById('repMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Lengkapi semua field'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  setBtn('genRepBtn', true, 'Generate Laporan');
  const msgEl = document.getElementById('repMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Mengirim laporan...'; }

  const r = await apiCall({ action: 'generateMonthlyReport', month, year, sendToEmail: email });
  isSubmitting = false; setBtn('genRepBtn', false, '📤 Kirim Laporan Semua Guru');
  if (msgEl) { msgEl.className = 'msg ' + (r.status === 'success' ? 'success' : 'error') + ' show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
}

// ==================== CONFIRM TOGGLE BLOCK ====================
window.confirmToggleBlock = function (email, currentStatus) {
  const isBlocked = currentStatus === 'Blocked';
  const actionText = isBlocked ? 'mengaktifkan' : 'memblokir';
  const title = isBlocked ? 'Aktifkan User' : 'Blokir User';
  const message = `Apakah Anda yakin ingin ${actionText} user dengan email: ${email}?`;

  showConfirmModal(title, message, async function () {
    const blocked = !isBlocked;
    const r = await apiCall({ action: 'blockUser', email, blocked: blocked ? 'true' : 'false' });
    if (r.status === 'success') {
      const msgEl = document.getElementById('setMsg');
      if (msgEl) {
        msgEl.className = 'msg success show';
        msgEl.textContent = r.message;
        setTimeout(() => {
          if (msgEl.classList.contains('show')) {
            msgEl.classList.remove('show');
            msgEl.className = 'msg';
            msgEl.textContent = '';
          }
        }, 5000);
      }
      loadAllTeachers();
    } else {
      const msgEl = document.getElementById('setMsg');
      if (msgEl) {
        msgEl.className = 'msg error show';
        msgEl.textContent = r.message;
        setTimeout(() => {
          if (msgEl.classList.contains('show')) {
            msgEl.classList.remove('show');
            msgEl.className = 'msg';
            msgEl.textContent = '';
          }
        }, 5000);
      }
    }
  });
};

window.viewTeacherAttendance = async function (email) {
  const now = getPapuaTime();
  const r = await apiCall({ action: 'getAttendanceHistory', email, month: now.getMonth() + 1, year: now.getFullYear() });
  const detBox = document.getElementById('teacherDetail');
  const detContent = document.getElementById('teacherDetailContent');
  if (!detBox || !detContent) return;

  detBox.style.display = 'block';
  document.getElementById('teacherDetailEmail').textContent = email;

  if (r.status === 'success' && r.data && r.data.length > 0) {
    detContent.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Check In</th><th>Check Out</th><th>Lokasi</th></tr></thead><tbody>' +
      r.data.map(d => '<td>' + formatDate(d.tanggal) + '</td><td>' + (d.checkIn || '-') + '</td><td>' + (d.checkOut || '-') + '</td><td>' + (d.lokasi || '-') + '</td></tr>').join('') +
      '</tbody></table></div>';
  } else {
    detContent.innerHTML = '<div class="empty-state"><span class="icon">📭</span>Belum ada data absensi bulan ini</div>';
  }
};

window.editTeacher = async function (email) {
  const r = await apiCall({ action: 'getUserByEmail', email });
  if (r.status !== 'success') { alert('Gagal memuat data user'); return; }
  const u = r.data;
  document.getElementById('editEmailHidden').value = email;
  document.getElementById('editNama').value = u.nama || '';
  document.getElementById('editEmailDisplay').value = u.email || '';
  document.getElementById('editRole').value = u.role || 'guru';
  document.getElementById('editStatus').value = u.status === 'Verified' ? 'Verified' : 'Blocked';
  document.getElementById('editPassword').value = '';
  document.getElementById('editModalTitle').textContent = 'Edit Data: ' + u.nama;
  openModal('editTeacherModal');
};

async function saveEditTeacher() {
  if (isSubmitting) return;
  const email = document.getElementById('editEmailHidden').value;
  const newRole = document.getElementById('editRole').value;
  const newStatus = document.getElementById('editStatus').value;
  const newPassword = document.getElementById('editPassword').value;

  isSubmitting = true;
  setBtn('saveEditBtn', true, 'Simpan');
  const msgEl = document.getElementById('editMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Menyimpan perubahan...'; }

  const r1 = await apiCall({ action: 'updateUserRole', email, newRole });
  if (r1.status !== 'success') {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = r1.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    isSubmitting = false; setBtn('saveEditBtn', false, 'Simpan');
    return;
  }

  await apiCall({ action: 'blockUser', email, blocked: newStatus === 'Blocked' ? 'true' : 'false' });

  if (newPassword && newPassword.length >= 6) {
    await apiCall({ action: 'resetPassword', email, newPassword });
  }

  isSubmitting = false; setBtn('saveEditBtn', false, 'Simpan');
  if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = 'Data berhasil disimpan'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  setTimeout(() => { closeModal('editTeacherModal'); loadAllTeachers(); }, 1200);
}

function openAddTeacher() {
  document.getElementById('addNama').value = '';
  document.getElementById('addEmail').value = '';
  document.getElementById('addPassword').value = '';
  document.getElementById('addRole').value = 'guru';
  const msgEl = document.getElementById('addMsg');
  if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }
  openModal('addTeacherModal');
}

async function saveAddTeacher() {
  if (isSubmitting) return;
  const nama = document.getElementById('addNama').value.trim();
  const email = document.getElementById('addEmail').value.trim();
  const password = document.getElementById('addPassword').value;
  const role = document.getElementById('addRole').value;

  if (!nama || !email || !password) {
    const msgEl = document.getElementById('addMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Semua field wajib diisi'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }
  if (password.length < 6) {
    const msgEl = document.getElementById('addMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Password minimal 6 karakter'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  setBtn('saveAddBtn', true, 'Tambah');
  const msgEl = document.getElementById('addMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Mendaftarkan...'; }

  const r = await apiCall({ action: 'signup', nama, email, password, role });
  isSubmitting = false; setBtn('saveAddBtn', false, 'Tambah');

  if (r.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    setTimeout(() => { closeModal('addTeacherModal'); loadAllTeachers(); }, 1500);
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== LOCATIONS ====================
async function loadLocations() {
  const tbody = document.getElementById('locationsBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Memuat...</td></tr>';

  const r = await apiCall({ action: 'getLocations' });
  if (!tbody) return;
  if (r.status === 'success' && r.data && r.data.length > 0) {
    tbody.innerHTML = r.data.map(loc =>
      '<tr>' +
      '<td><strong>' + loc.nama_kelas + '</strong><td>' +
      '<td>' + loc.lat + '</td>' +
      '<td>' + loc.lng + '</td>' +
      '<td><span class="badge badge-info">' + loc.radius_meter + ' m</span></td>' +
      '<td><button class="btn-danger btn-sm" onclick="alert(\'Hapus lokasi: ' + loc.nama_kelas + ' (implementasi nanti)\')">🗑️ Hapus</button></td>' +
      '</tr>'
    ).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada lokasi terdaftar</tbody>';
  }
}

async function addLocation() {
  if (isSubmitting) return;
  const nama = document.getElementById('locNama').value.trim();
  const lat = document.getElementById('locLat').value.trim();
  const lng = document.getElementById('locLng').value.trim();
  const radius = document.getElementById('locRadius').value || 50;

  if (!nama || !lat || !lng) {
    const msgEl = document.getElementById('locMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Nama, Latitude, Longitude wajib diisi'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  setBtn('addLocBtn', true, 'Tambah Lokasi');
  const msgEl = document.getElementById('locMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Menyimpan...'; }

  const r = await apiCall({ action: 'addLocation', nama_kelas: nama, lat, lng, radius });
  isSubmitting = false; setBtn('addLocBtn', false, 'Tambah Lokasi');

  if (r.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    document.getElementById('locNama').value = '';
    document.getElementById('locLat').value = '';
    document.getElementById('locLng').value = '';
    document.getElementById('locRadius').value = '50';
    loadLocations();
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== SETTINGS ====================
async function loadSettings() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;

  const setVal = function (key, defaultValue) {
    return formatTimeFromBackend(s[key]?.value) || defaultValue;
  };

  const setSeninRabuMasukMulai = document.getElementById('set_senin_rabu_masuk_mulai');
  const setSeninRabuMasukSelesai = document.getElementById('set_senin_rabu_masuk_selesai');
  const setSeninRabuPulangMulai = document.getElementById('set_senin_rabu_pulang_mulai');
  const setSeninRabuPulangSelesai = document.getElementById('set_senin_rabu_pulang_selesai');
  const setKamisJumatMasukMulai = document.getElementById('set_kamis_jumat_masuk_mulai');
  const setKamisJumatMasukSelesai = document.getElementById('set_kamis_jumat_masuk_selesai');
  const setKamisJumatPulangMulai = document.getElementById('set_kamis_jumat_pulang_mulai');
  const setKamisJumatPulangSelesai = document.getElementById('set_kamis_jumat_pulang_selesai');
  const setSchoolName = document.getElementById('set_school_name');

  if (setSeninRabuMasukMulai) setSeninRabuMasukMulai.value = setVal('senin_rabu_masuk_mulai', '07:00');
  if (setSeninRabuMasukSelesai) setSeninRabuMasukSelesai.value = setVal('senin_rabu_masuk_selesai', '08:30');
  if (setSeninRabuPulangMulai) setSeninRabuPulangMulai.value = setVal('senin_rabu_pulang_mulai', '12:00');
  if (setSeninRabuPulangSelesai) setSeninRabuPulangSelesai.value = setVal('senin_rabu_pulang_selesai', '12:15');
  if (setKamisJumatMasukMulai) setKamisJumatMasukMulai.value = setVal('kamis_jumat_masuk_mulai', '07:00');
  if (setKamisJumatMasukSelesai) setKamisJumatMasukSelesai.value = setVal('kamis_jumat_masuk_selesai', '08:30');
  if (setKamisJumatPulangMulai) setKamisJumatPulangMulai.value = setVal('kamis_jumat_pulang_mulai', '12:00');
  if (setKamisJumatPulangSelesai) setKamisJumatPulangSelesai.value = setVal('kamis_jumat_pulang_selesai', '12:00');
  if (setSchoolName) setSchoolName.value = s.school_name?.value || '';
}

async function saveSettings() {
  if (isSubmitting) return;
  const settings = {};

  const getVal = function (id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  settings.senin_rabu_masuk_mulai = getVal('set_senin_rabu_masuk_mulai');
  settings.senin_rabu_masuk_selesai = getVal('set_senin_rabu_masuk_selesai');
  settings.senin_rabu_pulang_mulai = getVal('set_senin_rabu_pulang_mulai');
  settings.senin_rabu_pulang_selesai = getVal('set_senin_rabu_pulang_selesai');
  settings.kamis_jumat_masuk_mulai = getVal('set_kamis_jumat_masuk_mulai');
  settings.kamis_jumat_masuk_selesai = getVal('set_kamis_jumat_masuk_selesai');
  settings.kamis_jumat_pulang_mulai = getVal('set_kamis_jumat_pulang_mulai');
  settings.kamis_jumat_pulang_selesai = getVal('set_kamis_jumat_pulang_selesai');
  settings.school_name = getVal('set_school_name');

  isSubmitting = true;
  setBtn('saveSetBtn', true, 'Simpan Pengaturan');
  const msgEl = document.getElementById('setMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Menyimpan...'; }

  const r = await apiCall({ action: 'updateSettings', settings: JSON.stringify(settings) });
  isSubmitting = false; setBtn('saveSetBtn', false, 'Simpan Pengaturan');

  if (r.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = 'Pengaturan berhasil disimpan'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    loadAdminScheduleInfo();
    loadKepsekScheduleInfo();
    loadScheduleInfo();
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = r.message || 'Gagal menyimpan'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== CHANGE PASSWORD ====================
async function changePassword() {
  if (isSubmitting) return;
  const pwd1 = document.getElementById('newPwd1')?.value;
  const pwd2 = document.getElementById('newPwd2')?.value;
  if (!pwd1 || pwd1.length < 6) {
    const msgEl = document.getElementById('changePwMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Password minimal 6 karakter'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }
  if (pwd1 !== pwd2) {
    const msgEl = document.getElementById('changePwMsg');
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = 'Password tidak cocok'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    return;
  }

  isSubmitting = true;
  setBtn('changePwBtn', true, 'Simpan');
  const msgEl = document.getElementById('changePwMsg');
  if (msgEl) { msgEl.className = 'msg loading show'; msgEl.textContent = 'Menyimpan...'; }

  const r = await apiCall({ action: 'resetPassword', email: currentUser.email, newPassword: pwd1 });
  isSubmitting = false; setBtn('changePwBtn', false, 'Simpan');

  if (r.status === 'success') {
    if (msgEl) { msgEl.className = 'msg success show'; msgEl.textContent = 'Password berhasil diganti!'; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
    setTimeout(() => { closeModal('changePwModal'); document.getElementById('newPwd1').value = ''; document.getElementById('newPwd2').value = ''; }, 1800);
  } else {
    if (msgEl) { msgEl.className = 'msg error show'; msgEl.textContent = r.message; setTimeout(() => { if (msgEl.classList.contains('show')) { msgEl.classList.remove('show'); msgEl.className = 'msg'; msgEl.textContent = ''; } }, 5000); }
  }
}

// ==================== MODAL HELPERS ====================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (id === 'addTeacherModal') {
    document.getElementById('addNama').value = '';
    document.getElementById('addEmail').value = '';
    document.getElementById('addPassword').value = '';
    const msg = document.getElementById('addMsg');
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
  }
  if (id === 'editTeacherModal') {
    document.getElementById('editPassword').value = '';
    const msg = document.getElementById('editMsg');
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
  }
  if (id === 'changePwModal') {
    document.getElementById('newPwd1').value = '';
    document.getElementById('newPwd2').value = '';
    const msg = document.getElementById('changePwMsg');
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
  }
}

function initAllModals() {
  const allCloseButtons = document.querySelectorAll('.close-modal:not(#confirmModal .close-modal)');
  allCloseButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const modal = this.closest('.modal-overlay');
      if (modal?.id) {
        closeModal(modal.id);
      }
    });
  });

  const allModals = document.querySelectorAll('.modal-overlay:not(#confirmModal)');
  allModals.forEach(modal => {
    modal.addEventListener('click', function (e) {
      if (e.target === this && this.id) {
        closeModal(this.id);
      }
    });
  });
}

// ==================== MOBILE MENU ====================
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('mobileBackdrop');

  if (hamburger && sidebar && backdrop) {
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);

    newHamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          backdrop.classList.remove('show');
        }
      });
    });
  }
}

// ==================== NAVIGATION ====================
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page' + pageId);
  if (page) page.classList.add('active');

  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');

  const title = document.getElementById('pageTitle');
  if (title && nav) title.textContent = nav.textContent.trim();

  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  }

  if (pageId === 'Dashboard') {
    loadDashboardStats();
    if (currentUser?.role === 'admin') loadAdminScheduleInfo();
    if (currentUser?.role === 'guru') {
      loadTodayStatus();
      loadScheduleInfo();
    }
    if (currentUser?.role === 'kepsek') loadKepsekScheduleInfo();
  } else if (pageId === 'Attendance') {
    setTimeout(() => { initCamera(); loadTodayStatus(); }, 100);
  } else if (pageId === 'History') {
    loadHistory();
  } else if (pageId === 'Teachers') {
    loadAllTeachers();
  } else if (pageId === 'Locations') {
    loadLocations();
  } else if (pageId === 'Settings') {
    loadSettings();
  }
}

// ==================== YEAR SELECT ====================
function populateYears() {
  const now = getPapuaTime();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const histYear = document.getElementById('histYear');
  if (histYear) {
    for (let yr = currentYear - 2; yr <= currentYear + 1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === currentYear) opt.selected = true;
      histYear.appendChild(opt);
    }
  }

  const repYear = document.getElementById('repYear');
  if (repYear) {
    for (let yr = currentYear - 2; yr <= currentYear + 1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === currentYear) opt.selected = true;
      repYear.appendChild(opt);
    }
  }

  const repYearTeacher = document.getElementById('repYearTeacher');
  if (repYearTeacher) {
    for (let yr = currentYear - 2; yr <= currentYear + 1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === currentYear) opt.selected = true;
      repYearTeacher.appendChild(opt);
    }
  }

  const previewYear = document.getElementById('previewYear');
  if (previewYear) {
    for (let yr = currentYear - 2; yr <= currentYear + 1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === currentYear) opt.selected = true;
      previewYear.appendChild(opt);
    }
  }

  const histMonth = document.getElementById('histMonth');
  if (histMonth) histMonth.value = currentMonth;

  const repMonth = document.getElementById('repMonth');
  if (repMonth) repMonth.value = currentMonth;

  const repMonthTeacher = document.getElementById('repMonthTeacher');
  if (repMonthTeacher) repMonthTeacher.value = currentMonth;

  const previewMonth = document.getElementById('previewMonth');
  if (previewMonth) previewMonth.value = currentMonth;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Aplikasi dimulai v26.0 - KHUSUS PAPUA (WIT)');

  updateClock();
  setInterval(updateClock, 1000);

  initDarkMode();

  const path = window.location.pathname;
  const isDashboard = path.includes('dashboard-');

  if (isDashboard) {
    initMobileMenu();
    initAllModals();

    if (!checkAuth()) {
      window.location.href = 'index.html';
      return;
    }

    const role = currentUser.role;
    if (path.includes('dashboard-guru') && role !== 'guru') {
      window.location.href = 'index.html';
      return;
    }
    if (path.includes('dashboard-kepsek') && role !== 'kepsek') {
      window.location.href = 'index.html';
      return;
    }
    if (path.includes('dashboard-admin') && role !== 'admin') {
      window.location.href = 'index.html';
      return;
    }

    loadProfile();
    populateYears();
    loadDashboardStats();

    if (role === 'guru') {
      loadScheduleInfo();
      loadTodayStatus();
    }
    if (role === 'admin') {
      loadAdminScheduleInfo();
    }
    if (role === 'kepsek') {
      loadKepsekScheduleInfo();
      loadTeacherList(); // Load dropdown guru

      // Event listeners untuk fitur laporan per guru
      document.getElementById('previewReportBtn')?.addEventListener('click', previewTeacherReport);
      document.getElementById('genTeacherReportBtn')?.addEventListener('click', sendTeacherReport);
      document.getElementById('printTeacherReportBtn')?.addEventListener('click', printTeacherReport);
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.getAttribute('data-page'));
      });
    });

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('openChangePwBtn')?.addEventListener('click', () => openModal('changePwModal'));
    document.getElementById('changePwBtn')?.addEventListener('click', changePassword);
    document.getElementById('closePwModalBtn')?.addEventListener('click', () => closeModal('changePwModal'));

    if (role === 'guru') {
      document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);
      document.getElementById('retakeBtn')?.addEventListener('click', retakePhoto);
      document.getElementById('getLocBtn')?.addEventListener('click', getLocation);
      document.getElementById('checkInBtn')?.addEventListener('click', handleCheckIn);
      document.getElementById('checkOutBtn')?.addEventListener('click', handleCheckOut);
      document.getElementById('quickCheckInBtn')?.addEventListener('click', () => navigate('Attendance'));
      document.getElementById('quickCheckOutBtn')?.addEventListener('click', () => navigate('Attendance'));
      document.getElementById('loadHistBtn')?.addEventListener('click', loadHistory);
    }

    if (role === 'kepsek') {
      document.getElementById('searchTeacher')?.addEventListener('input', loadAllTeachers);
      document.getElementById('genRepBtn')?.addEventListener('click', generateReport);
      document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
        document.getElementById('teacherDetail').style.display = 'none';
      });
    }

    if (role === 'admin') {
      document.getElementById('searchTeacher')?.addEventListener('input', loadAllTeachers);
      document.getElementById('filterRole')?.addEventListener('change', loadAllTeachers);
      document.getElementById('addTeacherBtn')?.addEventListener('click', openAddTeacher);
      document.getElementById('saveAddBtn')?.addEventListener('click', saveAddTeacher);
      document.getElementById('saveEditBtn')?.addEventListener('click', saveEditTeacher);
      document.getElementById('addLocBtn')?.addEventListener('click', addLocation);
      document.getElementById('saveSetBtn')?.addEventListener('click', saveSettings);
      document.getElementById('genRepBtn')?.addEventListener('click', generateReport);
      document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
        document.getElementById('teacherDetail').style.display = 'none';
      });
      document.getElementById('closeAddModalBtn')?.addEventListener('click', () => closeModal('addTeacherModal'));
      document.getElementById('closeEditModalBtn')?.addEventListener('click', () => closeModal('editTeacherModal'));
    }

    navigate('Dashboard');
    return;
  }

  // ===== HALAMAN INDEX (LOGIN/REGISTER) =====
  loadSchoolName();

  document.querySelectorAll('.tab-two').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      switchAuthTab(targetTab);
    });
  });

  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click', handleRegister);
  document.getElementById('resendVerifBtn')?.addEventListener('click', resendVerif);
  document.getElementById('forgotBtn')?.addEventListener('click', openForgotModal);
  document.getElementById('closeForgotBtn')?.addEventListener('click', closeForgotModal);
  document.getElementById('forgotModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeForgotModal();
  });
  document.getElementById('sendOtpBtn')?.addEventListener('click', sendOtp);
  document.getElementById('verifyOtpBtn')?.addEventListener('click', verifyOtp);
  document.getElementById('resendOtpBtn')?.addEventListener('click', resendOtp);
  document.getElementById('resetPwdBtn')?.addEventListener('click', doResetPassword);
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin(e);
  });

  console.log('✅ Aplikasi siap digunakan v26.0 - Khusus Papua (WIT)');
});
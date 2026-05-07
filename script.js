// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND JS v4.0
// Fix: updateSettings via apiCallPost
// Fix: Jam & Tanggal WIT konsisten di semua dashboard
// Fix: Tidak ada konflik fungsi duplikat
// Fix: Dark mode stabil
// ============================================================

'use strict';

// ============================================================
// KONFIGURASI
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyAiP5NvqqJDqxATOD1d_KmSfiRlJN9241jQUYoaqnddk25ahVFBOH52sdlVlHx_ASo/exec";

const DEFAULT_ADMIN = {
  email: 'admin@sekolah.com',
  password: 'admin123',
  nama: 'Administrator Utama',
  role: 'admin',
  status: 'Verified'
};

// ============================================================
// STATE GLOBAL
// ============================================================
let currentUser = null;
let isSubmitting = false;
let otpTimer = null;
let forgotEmailGlobal = '';
let mediaStream = null;
let capturedPhoto = null;
let currentLocation = null;
let clockInterval = null;

// ============================================================
// WAKTU WIT (UTC+9) — SATU SUMBER, DIPAKAI SEMUA
// ============================================================
function getWITDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 9));
}

function formatWIT(format) {
  const d = getWITDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (format === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
  if (format === 'HH:mm') return `${hours}:${minutes}`;
  if (format === 'HH:mm:ss') return `${hours}:${minutes}:${seconds}`;
  return `${hours}:${minutes}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

// ============================================================
// CLOCK — Update setiap detik, konsisten WIT
// ============================================================
function updateClock() {
  const d = getWITDate();

  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dateStr = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} WIT`;

  // Update semua elemen dateStr & timeStr di halaman
  document.querySelectorAll('#dateStr').forEach(el => { el.textContent = dateStr; });
  document.querySelectorAll('#timeStr').forEach(el => { el.textContent = timeStr; });
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

// ============================================================
// FORMAT TIME FROM BACKEND / SHEET
// ============================================================
function formatTimeFromBackend(value) {
  if (!value && value !== 0) return null;

  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const p = value.split(':');
      return String(parseInt(p[0])).padStart(2, '0') + ':' + p[1];
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value.substring(0, 5);
    if (value.indexOf('T') !== -1) {
      const m = value.match(/T(\d{2}):(\d{2}):/);
      if (m) return m[1] + ':' + m[2];
    }
  }

  if (typeof value === 'number') {
    const totalMin = Math.round(value * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const min = totalMin % 60;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  const str = value.toString().trim();
  return str.length >= 5 ? str.substring(0, 5) : str;
}

// ============================================================
// DARK MODE
// ============================================================
function initDarkMode() {
  const btn = document.getElementById('darkModeBtn');
  if (!btn) return;

  const sunIcon = btn.querySelector('.sun-icon');
  const moonIcon = btn.querySelector('.moon-icon');
  const toggleText = btn.querySelector('.toggle-text');

  function applyMode(isDark) {
    if (isDark) {
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
  }

  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyMode(saved === 'enabled' || (!saved && prefersDark));

  btn.addEventListener('click', function () {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    applyMode(isDark);
  });
}

// ============================================================
// API — JSONP (GET)
// ============================================================
function apiCall(params) {
  return new Promise((resolve) => {
    const cbName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    let url = API_URL + '?callback=' + cbName;

    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    }
    url += '&_t=' + Date.now();

    console.log('📡 JSONP:', params.action, url.substring(0, 120) + '...');

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ status: 'error', message: 'Request timeout. Periksa koneksi internet.' });
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    window[cbName] = function (data) {
      console.log('✅ JSONP Response:', params.action, data);
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

// ============================================================
// API — POST (untuk checkIn, checkOut, updateSettings)
// ============================================================
function apiCallPost(data) {
  return new Promise((resolve) => {
    console.log('📡 POST:', data.action);

    const timeout = setTimeout(() => {
      resolve({ status: 'error', message: 'Request timeout. Periksa koneksi internet.' });
    }, 30000);

    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      redirect: 'follow'
    })
      .then(res => res.json())
      .then(result => {
        clearTimeout(timeout);
        console.log('✅ POST Response:', data.action, result);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error('❌ POST Error:', err);
        resolve({ status: 'error', message: 'Gagal mengirim data. Pastikan koneksi stabil.' });
      });
  });
}

// ============================================================
// UI HELPERS
// ============================================================
function showMsg(id, type, text, isAuth = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = (isAuth ? 'msg-two ' : 'msg ') + type + ' show';
  el.textContent = text;
  setTimeout(() => {
    if (el.classList.contains('show')) {
      el.classList.remove('show');
      el.className = isAuth ? 'msg-two' : 'msg';
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
  const parts = str.toString().split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return str;
}

// ============================================================
// AUTH HELPERS
// ============================================================
function saveAuth(userData) {
  currentUser = userData;
  sessionStorage.setItem('absensiUser', JSON.stringify(userData));
}

function checkAuth() {
  const stored = sessionStorage.getItem('absensiUser');
  if (!stored) return false;
  try {
    currentUser = JSON.parse(stored);
    return !!currentUser;
  } catch (e) {
    return false;
  }
}

function logout() {
  sessionStorage.removeItem('absensiUser');
  currentUser = null;
  if (clockInterval) clearInterval(clockInterval);
  window.location.href = 'index.html';
}

// ============================================================
// LOGIN
// ============================================================
async function handleLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('loginEmail')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showMsg('loginMsg', 'error', 'Email dan password wajib diisi', true);
    return;
  }

  // Default admin
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    saveAuth(DEFAULT_ADMIN);
    showMsg('loginMsg', 'success', 'Login sebagai Admin! Mengarahkan...', true);
    setTimeout(() => { window.location.href = 'dashboard-admin.html'; }, 800);
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

// ============================================================
// REGISTER
// ============================================================
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
    ['regNama', 'regEmail', 'regPassword'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    setTimeout(() => {
      switchAuthTab('login');
      const loginEmail = document.getElementById('loginEmail');
      if (loginEmail) loginEmail.value = email;
    }, 2500);
  } else {
    showMsg('registerMsg', 'error', result.message || 'Registrasi gagal', true);
  }
}

// ============================================================
// AUTH TAB SWITCH
// ============================================================
function switchAuthTab(tabName) {
  document.querySelectorAll('.tab-two').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form-panel').forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.tab-two[data-tab="${tabName}"]`);
  const panel = document.getElementById(`panel-${tabName}`);
  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');
}

// ============================================================
// RESEND VERIFICATION
// ============================================================
async function resendVerif() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  if (!email) { showMsg('loginMsg', 'error', 'Masukkan email terlebih dahulu', true); return; }
  showMsg('loginMsg', 'loading', 'Mengirim ulang...', true);
  const r = await apiCall({ action: 'resendVerification', email });
  showMsg('loginMsg', r.status === 'success' ? 'success' : 'error', r.message, true);
}

// ============================================================
// FORGOT PASSWORD — OTP
// ============================================================
function openForgotModal() {
  ['step1', 'step2', 'step3'].forEach(s => document.getElementById(s)?.classList.remove('active'));
  document.getElementById('step1')?.classList.add('active');
  ['forgotEmail', 'otpInput', 'newPwd', 'confirmPwd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  clearForgotMsg();
  if (otpTimer) clearInterval(otpTimer);
  document.getElementById('forgotModal')?.classList.add('open');
}

function closeForgotModal() {
  document.getElementById('forgotModal')?.classList.remove('open');
  if (otpTimer) clearInterval(otpTimer);
}

function goStep(stepId) {
  ['step1', 'step2', 'step3'].forEach(s => document.getElementById(s)?.classList.remove('active'));
  document.getElementById(stepId)?.classList.add('active');
}

function clearForgotMsg() {
  const el = document.getElementById('forgotMsg');
  if (el) { el.className = 'msg'; el.textContent = ''; }
}

function startOtpCountdown() {
  let secs = 600;
  const el = document.getElementById('otpTimer');
  if (otpTimer) clearInterval(otpTimer);

  const tick = () => {
    if (!el) return;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent = `OTP berlaku: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (secs <= 0) { clearInterval(otpTimer); el.textContent = 'OTP telah kadaluarsa'; }
    secs--;
  };
  tick();
  otpTimer = setInterval(tick, 1000);
}

async function sendOtp() {
  const email = document.getElementById('forgotEmail')?.value?.trim();
  if (!email) { showMsg('forgotMsg', 'error', 'Masukkan email Anda'); return; }
  forgotEmailGlobal = email;
  setBtn('sendOtpBtn', true, 'Kirim Kode OTP');
  showMsg('forgotMsg', 'loading', 'Mengirim OTP...');

  const r = await apiCall({ action: 'sendPasswordResetOTP', email });
  setBtn('sendOtpBtn', false, 'Kirim Kode OTP');

  if (r.status === 'success') {
    showMsg('forgotMsg', 'success', r.message);
    setTimeout(() => { goStep('step2'); clearForgotMsg(); startOtpCountdown(); }, 800);
  } else {
    showMsg('forgotMsg', 'error', r.message);
  }
}

async function resendOtp() {
  if (!forgotEmailGlobal) return;
  showMsg('forgotMsg', 'loading', 'Mengirim ulang OTP...');
  const r = await apiCall({ action: 'sendPasswordResetOTP', email: forgotEmailGlobal });
  showMsg('forgotMsg', r.status === 'success' ? 'success' : 'error', r.message);
  if (r.status === 'success') startOtpCountdown();
}

async function verifyOtp() {
  const otp = document.getElementById('otpInput')?.value?.trim();
  if (!otp || otp.length !== 6) { showMsg('forgotMsg', 'error', 'Masukkan 6 digit OTP'); return; }
  setBtn('verifyOtpBtn', true, 'Verifikasi');
  showMsg('forgotMsg', 'loading', 'Memverifikasi...');

  const r = await apiCall({ action: 'verifyOTP', email: forgotEmailGlobal, otp });
  setBtn('verifyOtpBtn', false, 'Verifikasi');

  if (r.status === 'success') {
    if (otpTimer) clearInterval(otpTimer);
    showMsg('forgotMsg', 'success', 'OTP valid!');
    setTimeout(() => { goStep('step3'); clearForgotMsg(); }, 600);
  } else {
    showMsg('forgotMsg', 'error', r.message);
  }
}

async function doResetPassword() {
  const pwd = document.getElementById('newPwd')?.value;
  const confirm = document.getElementById('confirmPwd')?.value;
  if (!pwd || pwd.length < 6) { showMsg('forgotMsg', 'error', 'Password minimal 6 karakter'); return; }
  if (pwd !== confirm) { showMsg('forgotMsg', 'error', 'Konfirmasi password tidak cocok'); return; }

  setBtn('resetPwdBtn', true, 'Simpan');
  showMsg('forgotMsg', 'loading', 'Menyimpan...');

  const r = await apiCall({ action: 'resetPassword', email: forgotEmailGlobal, newPassword: pwd });
  setBtn('resetPwdBtn', false, 'Simpan');

  if (r.status === 'success') {
    showMsg('forgotMsg', 'success', 'Password berhasil direset! Silakan login.');
    setTimeout(() => closeForgotModal(), 2000);
  } else {
    showMsg('forgotMsg', 'error', r.message);
  }
}

// ============================================================
// SCHOOL NAME
// ============================================================
async function loadSchoolName() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status === 'success' && r.data?.school_name?.value) {
    document.querySelectorAll('#schoolName').forEach(el => {
      el.textContent = r.data.school_name.value;
    });
  }
}

// ============================================================
// PROFILE
// ============================================================
function loadProfile() {
  if (!currentUser) return;

  ['userName', 'profileName'].forEach(id => {
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
    avatarEl.textContent = currentUser.nama
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}

// ============================================================
// CAMERA
// ============================================================
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
    showMsg('attendMsg', 'error', 'Tidak dapat mengakses kamera: ' + e.message);
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

// ============================================================
// LOCATION
// ============================================================
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
          info.textContent = `✅ Lokasi ditemukan (${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}) ±${Math.round(currentLocation.accuracy)}m`;
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

// ============================================================
// ATTENDANCE STATUS
// ============================================================
async function loadTodayStatus() {
  if (!currentUser) return;

  const box = document.getElementById('todayStatusBox');
  const dashBox = document.getElementById('dashAttendStatus');
  if (box) box.innerHTML = '<div class="info-box info">⏳ Memeriksa status...</div>';

  const r = await apiCall({ action: 'checkTodayAttendance', email: currentUser.email });
  if (r.status !== 'success') return;

  const d = r.data;
  const ci = document.getElementById('checkInBtn');
  const co = document.getElementById('checkOutBtn');

  if (box) {
    let html = '';
    if (d.hasCheckedIn) {
      html += `<div class="info-box success">✅ Absen masuk: <strong>${d.checkInTime}</strong> di ${d.lokasi || '-'}</div>`;
      if (ci) { ci.disabled = true; ci.dataset.done = '1'; }
    } else {
      html += '<div class="info-box info">📝 Belum absen masuk hari ini</div>';
    }
    if (d.hasCheckedOut) {
      html += `<div class="info-box success">✅ Absen pulang: <strong>${d.checkOutTime}</strong></div>`;
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

// ============================================================
// SCHEDULE INFO — dipakai oleh guru, kepsek, admin
// ============================================================
async function loadScheduleInfo(targetElementId) {
  const el = document.getElementById(targetElementId);
  if (!el) return;

  el.innerHTML = '<div class="info-box info">⏳ Memuat jadwal...</div>';

  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') {
    el.innerHTML = '<div class="info-box warning">⚠️ Gagal memuat jadwal</div>';
    return;
  }

  const s = r.data;

  const jadwalSR = {
    masukMulai: formatTimeFromBackend(s.senin_rabu_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.senin_rabu_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.senin_rabu_pulang_mulai?.value) || '12:00',
    pulangSelesai: formatTimeFromBackend(s.senin_rabu_pulang_selesai?.value) || '12:15'
  };

  const jadwalKJ = {
    masukMulai: formatTimeFromBackend(s.kamis_jumat_masuk_mulai?.value) || '07:00',
    masukSelesai: formatTimeFromBackend(s.kamis_jumat_masuk_selesai?.value) || '08:30',
    pulangMulai: formatTimeFromBackend(s.kamis_jumat_pulang_mulai?.value) || '11:45',
    pulangSelesai: formatTimeFromBackend(s.kamis_jumat_pulang_selesai?.value) || '12:00'
  };

  // Untuk guru: tampilkan hanya hari ini
  const d = getWITDate();
  const day = d.getDay();

  if (targetElementId === 'scheduleInfo') {
    // Khusus halaman guru — tampilkan hari aktif saja
    if (day === 0 || day === 6) {
      el.innerHTML = '<div class="info-box warning">🏖️ Hari ini libur akhir pekan</div>';
      return;
    }
    const isMonWed = day >= 1 && day <= 3;
    const label = isMonWed ? 'Senin – Rabu' : 'Kamis – Jumat';
    const jadwal = isMonWed ? jadwalSR : jadwalKJ;
    el.innerHTML = `
      <div class="info-box info">
        <strong>📅 Jadwal Hari Ini (${label})</strong><br>
        🟢 Masuk: ${jadwal.masukMulai} – ${jadwal.masukSelesai} WIT<br>
        🔴 Pulang: ${jadwal.pulangMulai} – ${jadwal.pulangSelesai} WIT
      </div>`;
    return;
  }

  // Untuk admin/kepsek — tampilkan semua jadwal
  el.innerHTML = `
    <div class="info-box info">
      <strong>📅 Senin – Rabu</strong><br>
      🟢 Masuk: ${jadwalSR.masukMulai} – ${jadwalSR.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalSR.pulangMulai} – ${jadwalSR.pulangSelesai} WIT
    </div>
    <div class="info-box info" style="margin-top:10px">
      <strong>📅 Kamis – Jumat</strong><br>
      🟢 Masuk: ${jadwalKJ.masukMulai} – ${jadwalKJ.masukSelesai} WIT<br>
      🔴 Pulang: ${jadwalKJ.pulangMulai} – ${jadwalKJ.pulangSelesai} WIT
    </div>`;
}

// ============================================================
// CHECK IN
// ============================================================
async function handleCheckIn() {
  if (isSubmitting) return;

  if (!capturedPhoto) {
    showMsg('attendMsg', 'error', 'Ambil foto selfie terlebih dahulu');
    return;
  }
  if (!currentLocation) {
    showMsg('attendMsg', 'error', 'Dapatkan lokasi Anda terlebih dahulu');
    return;
  }

  isSubmitting = true;
  const btn = document.getElementById('checkInBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  showMsg('attendMsg', 'loading', 'Mengirim data absen masuk...');

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
    showMsg('attendMsg', 'success', result.message);
    if (btn) { btn.disabled = true; btn.dataset.done = '1'; }
    setTimeout(() => loadTodayStatus(), 1500);
  } else {
    showMsg('attendMsg', 'error', result.message);
  }
}

// ============================================================
// CHECK OUT
// ============================================================
async function handleCheckOut() {
  if (isSubmitting) return;

  if (!capturedPhoto) {
    showMsg('attendMsg', 'error', 'Ambil foto selfie terlebih dahulu');
    return;
  }
  if (!currentLocation) {
    showMsg('attendMsg', 'error', 'Dapatkan lokasi Anda terlebih dahulu');
    return;
  }

  isSubmitting = true;
  const btn = document.getElementById('checkOutBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  showMsg('attendMsg', 'loading', 'Mengirim data absen pulang...');

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
    showMsg('attendMsg', 'success', result.message);
    if (btn) { btn.disabled = true; btn.dataset.done = '1'; }
    setTimeout(() => loadTodayStatus(), 1500);
  } else {
    showMsg('attendMsg', 'error', result.message);
  }
}

// ============================================================
// HISTORY
// ============================================================
async function loadHistory() {
  const month = document.getElementById('histMonth')?.value;
  const year = document.getElementById('histYear')?.value;
  if (!month || !year || !currentUser) return;

  const tbody = document.getElementById('histBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">⏳ Memuat...</td></tr>';

  const r = await apiCall({
    action: 'getAttendanceHistory',
    email: currentUser.email,
    month,
    year
  });

  if (!tbody) return;

  if (r.status === 'success' && r.data && r.data.length > 0) {
    tbody.innerHTML = r.data.map(row => `
      <tr>
        <td>${formatDate(row.tanggal)}</td>
        <td>${row.checkIn || '-'}</td>
        <td>${row.checkOut || '-'}</td>
        <td>${row.lokasi || '-'}</td>
        <td><span class="badge badge-success">${row.status || 'Hadir'}</span></td>
      </tr>`).join('');
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

// ============================================================
// DASHBOARD STATS
// ============================================================
async function loadDashboardStats() {
  const r = await apiCall({ action: 'getAllUsers' });
  if (r.status === 'success' && r.data) {
    const guru = r.data.filter(u => u.role === 'guru').length;
    const kepsek = r.data.filter(u => u.role === 'kepsek').length;
    const admin = r.data.filter(u => u.role === 'admin').length;
    const gEl = document.getElementById('statGuru');
    const kEl = document.getElementById('statKepsek');
    const aEl = document.getElementById('statAdmin');
    if (gEl) gEl.textContent = guru;
    if (kEl) kEl.textContent = kepsek;
    if (aEl) aEl.textContent = admin;
  }

  if (currentUser?.role === 'guru') {
    const d = getWITDate();
    const r2 = await apiCall({
      action: 'getAttendanceHistory',
      email: currentUser.email,
      month: d.getMonth() + 1,
      year: d.getFullYear()
    });
    if (r2.status === 'success' && r2.data) {
      const total = r2.data.length;
      const persen = Math.round((total / 22) * 100);
      const tEl = document.getElementById('statHadir');
      const pEl = document.getElementById('statPersen');
      if (tEl) tEl.textContent = total;
      if (pEl) pEl.textContent = persen + '%';
    }
  }
}

// ============================================================
// TEACHERS LIST
// ============================================================
async function loadAllTeachers() {
  const tbody = document.getElementById('teachersBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">⏳ Memuat data...</td></tr>';

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

  tbody.innerHTML = data.map((u, i) => {
    const roleBadge = u.role === 'guru' ? 'Guru' : u.role === 'kepsek' ? 'Kepsek' : 'Admin';
    const statusBadge = u.status === 'Verified'
      ? '<span class="badge badge-success">Aktif</span>'
      : u.status === 'Pending'
        ? '<span class="badge badge-warning">Pending</span>'
        : '<span class="badge badge-error">Diblokir</span>';

    const adminActions = isAdmin ? `
      <button class="btn-secondary btn-sm" onclick="editTeacher('${u.email}')">✏️ Edit</button>
      <button class="${u.status === 'Blocked' ? 'btn-success' : 'btn-danger'} btn-sm"
        onclick="confirmToggleBlock('${u.email}','${u.status}')">
        ${u.status === 'Blocked' ? '🔓 Aktifkan' : '🔒 Blokir'}
      </button>` : '';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${u.nama || '-'}</strong></td>
      <td style="color:var(--text2)">${u.email || '-'}</td>
      <td><span class="badge badge-info">${roleBadge}</span></td>
      <td>${statusBadge}</td>
      <td><div class="td-actions">
        <button class="btn-secondary btn-sm" onclick="viewTeacherAttendance('${u.email}')">📋 Absensi</button>
        ${adminActions}
      </div></td>
    </tr>`;
  }).join('');
}

// ============================================================
// CONFIRM TOGGLE BLOCK
// ============================================================
window.confirmToggleBlock = function (email, currentStatus) {
  const isBlocked = currentStatus === 'Blocked';
  const actionText = isBlocked ? 'mengaktifkan' : 'memblokir';
  showConfirmModal(
    isBlocked ? 'Aktifkan User' : 'Blokir User',
    `Apakah Anda yakin ingin ${actionText} user: ${email}?`,
    async function () {
      const r = await apiCall({ action: 'blockUser', email, blocked: isBlocked ? 'false' : 'true' });
      showMsg('setMsg', r.status === 'success' ? 'success' : 'error', r.message);
      if (r.status === 'success') loadAllTeachers();
    }
  );
};

// ============================================================
// VIEW TEACHER ATTENDANCE
// ============================================================
window.viewTeacherAttendance = async function (email) {
  const d = getWITDate();
  const r = await apiCall({ action: 'getAttendanceHistory', email, month: d.getMonth() + 1, year: d.getFullYear() });
  const box = document.getElementById('teacherDetail');
  const cnt = document.getElementById('teacherDetailContent');
  if (!box || !cnt) return;

  box.style.display = 'block';
  const emailEl = document.getElementById('teacherDetailEmail');
  if (emailEl) emailEl.textContent = email;

  if (r.status === 'success' && r.data && r.data.length > 0) {
    cnt.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Tanggal</th><th>Check In</th><th>Check Out</th><th>Lokasi</th></tr></thead>
      <tbody>${r.data.map(d => `<tr>
        <td>${formatDate(d.tanggal)}</td>
        <td>${d.checkIn || '-'}</td>
        <td>${d.checkOut || '-'}</td>
        <td>${d.lokasi || '-'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } else {
    cnt.innerHTML = '<div class="empty-state"><span class="icon">📭</span> Belum ada data absensi bulan ini</div>';
  }
};

// ============================================================
// EDIT TEACHER
// ============================================================
window.editTeacher = async function (email) {
  const r = await apiCall({ action: 'getUserByEmail', email });
  if (r.status !== 'success') { alert('Gagal memuat data user'); return; }

  const u = r.data;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('editEmailHidden', email);
  setVal('editNama', u.nama);
  setVal('editEmailDisplay', u.email);
  setVal('editRole', u.role);
  setVal('editStatus', u.status === 'Verified' ? 'Verified' : 'Blocked');
  setVal('editPassword', '');

  const titleEl = document.getElementById('editModalTitle');
  if (titleEl) titleEl.textContent = 'Edit Data: ' + u.nama;
  openModal('editTeacherModal');
};

async function saveEditTeacher() {
  if (isSubmitting) return;
  const email = document.getElementById('editEmailHidden')?.value;
  const newRole = document.getElementById('editRole')?.value;
  const newStatus = document.getElementById('editStatus')?.value;
  const newPassword = document.getElementById('editPassword')?.value;

  isSubmitting = true;
  setBtn('saveEditBtn', true, 'Simpan');
  showMsg('editMsg', 'loading', 'Menyimpan perubahan...');

  const r1 = await apiCall({ action: 'updateUserRole', email, newRole });
  if (r1.status !== 'success') {
    showMsg('editMsg', 'error', r1.message);
    isSubmitting = false;
    setBtn('saveEditBtn', false, 'Simpan');
    return;
  }

  await apiCall({ action: 'blockUser', email, blocked: newStatus === 'Blocked' ? 'true' : 'false' });

  if (newPassword && newPassword.length >= 6) {
    await apiCall({ action: 'resetPassword', email, newPassword });
  }

  isSubmitting = false;
  setBtn('saveEditBtn', false, 'Simpan');
  showMsg('editMsg', 'success', 'Data berhasil disimpan');
  setTimeout(() => { closeModal('editTeacherModal'); loadAllTeachers(); }, 1200);
}

function openAddTeacher() {
  ['addNama', 'addEmail', 'addPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const roleEl = document.getElementById('addRole');
  if (roleEl) roleEl.value = 'guru';
  const msg = document.getElementById('addMsg');
  if (msg) { msg.className = 'msg'; msg.textContent = ''; }
  openModal('addTeacherModal');
}

async function saveAddTeacher() {
  if (isSubmitting) return;
  const nama = document.getElementById('addNama')?.value?.trim();
  const email = document.getElementById('addEmail')?.value?.trim();
  const password = document.getElementById('addPassword')?.value;
  const role = document.getElementById('addRole')?.value;

  if (!nama || !email || !password) {
    showMsg('addMsg', 'error', 'Semua field wajib diisi');
    return;
  }
  if (password.length < 6) {
    showMsg('addMsg', 'error', 'Password minimal 6 karakter');
    return;
  }

  isSubmitting = true;
  setBtn('saveAddBtn', true, 'Tambah');
  showMsg('addMsg', 'loading', 'Mendaftarkan...');

  const r = await apiCall({ action: 'signup', nama, email, password, role });
  isSubmitting = false;
  setBtn('saveAddBtn', false, 'Tambah');

  if (r.status === 'success') {
    showMsg('addMsg', 'success', r.message);
    setTimeout(() => { closeModal('addTeacherModal'); loadAllTeachers(); }, 1500);
  } else {
    showMsg('addMsg', 'error', r.message);
  }
}

// ============================================================
// LOCATIONS
// ============================================================
async function loadLocations() {
  const tbody = document.getElementById('locationsBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">⏳ Memuat...</td></tr>';

  const r = await apiCall({ action: 'getLocations' });
  if (!tbody) return;

  if (r.status === 'success' && r.data && r.data.length > 0) {
    tbody.innerHTML = r.data.map(loc => `
      <tr>
        <td><strong>${loc.nama_kelas}</strong></td>
        <td>${loc.lat}</td>
        <td>${loc.lng}</td>
        <td><span class="badge badge-info">${loc.radius_meter} m</span></td>
        <td><span class="badge badge-success">Aktif</span></td>
      </tr>`).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada lokasi terdaftar</td></tr>';
  }
}

async function addLocation() {
  if (isSubmitting) return;
  const nama = document.getElementById('locNama')?.value?.trim();
  const lat = document.getElementById('locLat')?.value?.trim();
  const lng = document.getElementById('locLng')?.value?.trim();
  const radius = document.getElementById('locRadius')?.value || 50;

  if (!nama || !lat || !lng) {
    showMsg('locMsg', 'error', 'Nama, Latitude, Longitude wajib diisi');
    return;
  }

  isSubmitting = true;
  setBtn('addLocBtn', true, 'Tambah Lokasi');
  showMsg('locMsg', 'loading', 'Menyimpan...');

  const r = await apiCall({ action: 'addLocation', nama_kelas: nama, lat, lng, radius });
  isSubmitting = false;
  setBtn('addLocBtn', false, 'Tambah Lokasi');

  if (r.status === 'success') {
    showMsg('locMsg', 'success', r.message);
    ['locNama', 'locLat', 'locLng'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const locRadius = document.getElementById('locRadius');
    if (locRadius) locRadius.value = '50';
    loadLocations();
  } else {
    showMsg('locMsg', 'error', r.message);
  }
}

// ============================================================
// SETTINGS — Load
// ============================================================
async function loadSettings() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') {
    showMsg('setMsg', 'error', 'Gagal memuat pengaturan');
    return;
  }

  const s = r.data;

  const fields = [
    ['set_senin_rabu_masuk_mulai', 'senin_rabu_masuk_mulai', '07:00'],
    ['set_senin_rabu_masuk_selesai', 'senin_rabu_masuk_selesai', '08:30'],
    ['set_senin_rabu_pulang_mulai', 'senin_rabu_pulang_mulai', '12:00'],
    ['set_senin_rabu_pulang_selesai', 'senin_rabu_pulang_selesai', '12:15'],
    ['set_kamis_jumat_masuk_mulai', 'kamis_jumat_masuk_mulai', '07:00'],
    ['set_kamis_jumat_masuk_selesai', 'kamis_jumat_masuk_selesai', '08:30'],
    ['set_kamis_jumat_pulang_mulai', 'kamis_jumat_pulang_mulai', '11:45'],
    ['set_kamis_jumat_pulang_selesai', 'kamis_jumat_pulang_selesai', '12:00'],
  ];

  fields.forEach(([elId, key, def]) => {
    const el = document.getElementById(elId);
    if (el) el.value = formatTimeFromBackend(s[key]?.value) || def;
  });

  const schoolEl = document.getElementById('set_school_name');
  if (schoolEl) schoolEl.value = s.school_name?.value || '';
}

// ============================================================
// SETTINGS — Save (FIX: pakai apiCallPost)
// ============================================================
async function saveSettings() {
  if (isSubmitting) return;

  const getVal = (id) => document.getElementById(id)?.value || '';

  const settings = {
    senin_rabu_masuk_mulai: getVal('set_senin_rabu_masuk_mulai'),
    senin_rabu_masuk_selesai: getVal('set_senin_rabu_masuk_selesai'),
    senin_rabu_pulang_mulai: getVal('set_senin_rabu_pulang_mulai'),
    senin_rabu_pulang_selesai: getVal('set_senin_rabu_pulang_selesai'),
    kamis_jumat_masuk_mulai: getVal('set_kamis_jumat_masuk_mulai'),
    kamis_jumat_masuk_selesai: getVal('set_kamis_jumat_masuk_selesai'),
    kamis_jumat_pulang_mulai: getVal('set_kamis_jumat_pulang_mulai'),
    kamis_jumat_pulang_selesai: getVal('set_kamis_jumat_pulang_selesai'),
    school_name: getVal('set_school_name')
  };

  // Validasi: semua field waktu harus terisi
  const timeKeys = Object.keys(settings).filter(k => k !== 'school_name');
  for (const key of timeKeys) {
    if (!settings[key]) {
      showMsg('setMsg', 'error', 'Semua field jadwal wajib diisi');
      return;
    }
  }

  isSubmitting = true;
  setBtn('saveSetBtn', true, 'Simpan Pengaturan');
  showMsg('setMsg', 'loading', 'Menyimpan pengaturan...');

  // POST — agar tidak terkena limit URL panjang dan agar updateSettings bisa diproses
  const r = await apiCallPost({ action: 'updateSettings', settings });

  isSubmitting = false;
  setBtn('saveSetBtn', false, 'Simpan Pengaturan');

  if (r.status === 'success') {
    showMsg('setMsg', 'success', '✅ Pengaturan berhasil disimpan');
    // Reload jadwal di semua elemen yang ada
    loadScheduleInfo('adminScheduleInfo');
    loadScheduleInfo('kepsekScheduleInfo');
    loadScheduleInfo('scheduleInfo');
    // Update nama sekolah
    loadSchoolName();
  } else {
    showMsg('setMsg', 'error', r.message || 'Gagal menyimpan pengaturan');
  }
}

// ============================================================
// REPORT
// ============================================================
async function generateReport() {
  if (isSubmitting) return;
  const month = document.getElementById('repMonth')?.value;
  const year = document.getElementById('repYear')?.value;
  const email = document.getElementById('repEmail')?.value?.trim() || currentUser?.email;

  if (!month || !year || !email) {
    showMsg('repMsg', 'error', 'Lengkapi semua field laporan');
    return;
  }

  isSubmitting = true;
  setBtn('genRepBtn', true, 'Generate Laporan');
  showMsg('repMsg', 'loading', 'Mengirim laporan...');

  const r = await apiCall({ action: 'generateMonthlyReport', month, year, sendToEmail: email });
  isSubmitting = false;
  setBtn('genRepBtn', false, 'Generate Laporan');
  showMsg('repMsg', r.status === 'success' ? 'success' : 'error', r.message);
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function changePassword() {
  if (isSubmitting) return;
  const pwd1 = document.getElementById('newPwd1')?.value;
  const pwd2 = document.getElementById('newPwd2')?.value;

  if (!pwd1 || pwd1.length < 6) { showMsg('changePwMsg', 'error', 'Password minimal 6 karakter'); return; }
  if (pwd1 !== pwd2) { showMsg('changePwMsg', 'error', 'Password tidak cocok'); return; }

  isSubmitting = true;
  setBtn('changePwBtn', true, 'Simpan');
  showMsg('changePwMsg', 'loading', 'Menyimpan...');

  const r = await apiCall({ action: 'resetPassword', email: currentUser.email, newPassword: pwd1 });
  isSubmitting = false;
  setBtn('changePwBtn', false, 'Simpan');

  if (r.status === 'success') {
    showMsg('changePwMsg', 'success', 'Password berhasil diganti!');
    setTimeout(() => {
      closeModal('changePwModal');
      ['newPwd1', 'newPwd2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }, 1800);
  } else {
    showMsg('changePwMsg', 'error', r.message);
  }
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');

  // Reset form fields on close
  const resets = {
    addTeacherModal: ['addNama', 'addEmail', 'addPassword'],
    editTeacherModal: ['editPassword'],
    changePwModal: ['newPwd1', 'newPwd2']
  };
  const msgMap = {
    addTeacherModal: 'addMsg',
    editTeacherModal: 'editMsg',
    changePwModal: 'changePwMsg'
  };

  if (resets[id]) {
    resets[id].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) el.value = '';
    });
  }
  if (msgMap[id]) {
    const msg = document.getElementById(msgMap[id]);
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
  }
}

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
          <button class="close-modal" id="confirmCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage"></p>
        </div>
        <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end">
          <button id="confirmCancelBtn" class="btn-secondary">Batal</button>
          <button id="confirmOkBtn" class="btn-primary">Ya, Lanjutkan</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;

  const close = () => { modal.classList.remove('open'); if (onCancel) onCancel(); };
  const confirm = () => { modal.classList.remove('open'); if (onConfirm) onConfirm(); };

  // Ganti elemen agar listener lama tidak berganda
  ['confirmCloseBtn', 'confirmCancelBtn', 'confirmOkBtn'].forEach(btnId => {
    const old = document.getElementById(btnId);
    if (!old) return;
    const neo = old.cloneNode(true);
    old.parentNode.replaceChild(neo, old);
    neo.addEventListener('click', btnId === 'confirmOkBtn' ? confirm : close);
  });

  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.classList.add('open');
}

function initAllModals() {
  document.querySelectorAll('.modal-overlay:not(#confirmModal)').forEach(modal => {
    // Close button
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => closeModal(modal.id));
    });
    // Click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
}

// ============================================================
// MOBILE MENU
// ============================================================
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('mobileBackdrop');
  if (!hamburger || !sidebar || !backdrop) return;

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

// ============================================================
// SWAP LAYOUT (Login Page)
// ============================================================
function initSwapLayout() {
  const authContainer = document.getElementById('authContainer');
  const illustrationSide = document.getElementById('illustrationSide');
  const formSide = document.getElementById('formSide');
  if (!authContainer) return;

  let isSwapping = false;

  if (illustrationSide) {
    illustrationSide.addEventListener('click', (e) => {
      if (isSwapping || authContainer.classList.contains('swapped')) return;
      if (e.target.closest('button,input,select,a')) return;
      isSwapping = true;
      authContainer.classList.add('swapped');
      setTimeout(() => { isSwapping = false; }, 700);
    });
  }

  if (formSide) {
    formSide.addEventListener('click', (e) => {
      if (isSwapping || !authContainer.classList.contains('swapped')) return;
      if (e.target.closest('button,input,select,.tab-two')) return;
      isSwapping = true;
      authContainer.classList.remove('swapped');
      setTimeout(() => { isSwapping = false; }, 700);
    });
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page' + pageId);
  if (page) page.classList.add('active');

  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');

  const titleEl = document.getElementById('pageTitle');
  if (titleEl && nav) titleEl.textContent = nav.textContent.trim();

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('mobileBackdrop')?.classList.remove('show');
  }

  // Load konten sesuai halaman
  const role = currentUser?.role;

  switch (pageId) {
    case 'Dashboard':
      loadDashboardStats();
      if (role === 'admin') loadScheduleInfo('adminScheduleInfo');
      if (role === 'kepsek') loadScheduleInfo('kepsekScheduleInfo');
      if (role === 'guru') { loadTodayStatus(); loadScheduleInfo('scheduleInfo'); }
      break;
    case 'Attendance':
      setTimeout(() => { initCamera(); loadTodayStatus(); }, 100);
      break;
    case 'History':
      loadHistory();
      break;
    case 'Teachers':
      loadAllTeachers();
      break;
    case 'Locations':
      loadLocations();
      break;
    case 'Settings':
      loadSettings();
      break;
  }
}

// ============================================================
// POPULATE YEAR & MONTH SELECTS
// ============================================================
function populateYearMonthSelects() {
  const d = getWITDate();
  const currentYear = d.getFullYear();
  const currentMonth = d.getMonth() + 1;

  ['histYear', 'repYear'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '';
    for (let yr = currentYear - 2; yr <= currentYear + 1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === currentYear) opt.selected = true;
      sel.appendChild(opt);
    }
  });

  const histMonth = document.getElementById('histMonth');
  if (histMonth) histMonth.value = currentMonth;

  const repMonth = document.getElementById('repMonth');
  if (repMonth) repMonth.value = currentMonth;
}

// ============================================================
// INIT — DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 Absensi Digital v4.0 — Papua (WIT UTC+9)');

  // Clock jalan di semua halaman
  startClock();

  // Dark mode
  initDarkMode();

  const path = window.location.pathname;
  const isDashboard = path.includes('dashboard-');

  // ---- HALAMAN DASHBOARD ----
  if (isDashboard) {
    if (!checkAuth()) { window.location.href = 'index.html'; return; }

    const role = currentUser.role;
    if (path.includes('dashboard-guru') && role !== 'guru') { window.location.href = 'index.html'; return; }
    if (path.includes('dashboard-kepsek') && role !== 'kepsek') { window.location.href = 'index.html'; return; }
    if (path.includes('dashboard-admin') && role !== 'admin') { window.location.href = 'index.html'; return; }

    initMobileMenu();
    initAllModals();
    loadProfile();
    populateYearMonthSelects();

    // Nav links
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.getAttribute('data-page'));
      });
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // Change password
    document.getElementById('openChangePwBtn')?.addEventListener('click', () => openModal('changePwModal'));
    document.getElementById('changePwBtn')?.addEventListener('click', changePassword);

    // ---- GURU ----
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

    // ---- KEPSEK ----
    if (role === 'kepsek') {
      document.getElementById('searchTeacher')?.addEventListener('input', loadAllTeachers);
      document.getElementById('genRepBtn')?.addEventListener('click', generateReport);
      document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
        document.getElementById('teacherDetail').style.display = 'none';
      });
    }

    // ---- ADMIN ----
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
    }

    // Navigasi awal ke Dashboard
    navigate('Dashboard');
    return;
  }

  // ---- HALAMAN INDEX (LOGIN/REGISTER) ----
  loadSchoolName();
  initSwapLayout();

  document.querySelectorAll('.tab-two').forEach(tab => {
    tab.addEventListener('click', function () {
      switchAuthTab(this.getAttribute('data-tab'));
    });
  });

  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click', handleRegister);
  document.getElementById('resendVerifBtn')?.addEventListener('click', resendVerif);
  document.getElementById('forgotBtn')?.addEventListener('click', openForgotModal);
  document.getElementById('closeForgotBtn')?.addEventListener('click', closeForgotModal);

  document.getElementById('forgotModal')?.addEventListener('click', function (e) {
    if (e.target === this) closeForgotModal();
  });

  document.getElementById('sendOtpBtn')?.addEventListener('click', sendOtp);
  document.getElementById('verifyOtpBtn')?.addEventListener('click', verifyOtp);
  document.getElementById('resendOtpBtn')?.addEventListener('click', resendOtp);
  document.getElementById('resetPwdBtn')?.addEventListener('click', doResetPassword);

  // Enter key di field password login
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin(e);
  });

  console.log('✅ Siap — v4.0 WIT');
});
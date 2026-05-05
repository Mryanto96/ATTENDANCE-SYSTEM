// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND
// Versi: 14.0 - FULLY WORKING (ALL ROLES)
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbw9RcTNBBw2CtQ3Rq5BPiS61JI4N9Mn6HoWY4vgUq1vOT50AGYCVmvgm-UvVvxG2kM6jA/exec";

let currentUser = null;
let isSubmitting = false;
let otpTimer = null;
let forgotEmailGlobal = '';

// Camera & Location variables
let mediaStream = null;
let capturedPhoto = null;
let currentLocation = null;

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

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ status: 'error', message: 'Request timeout. Periksa koneksi internet Anda.' });
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    window[cbName] = function(data) {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = cbName;
    script.src = url;
    script.onerror = function() {
      cleanup();
      resolve({ status: 'error', message: 'Gagal terhubung ke server. Coba lagi.' });
    };
    document.head.appendChild(script);
  });
}

// ==================== UI HELPERS ====================
function showMsg(id, type, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'msg ' + type + ' show';
  el.textContent = text;
}

function hideMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.className = 'msg'; el.textContent = ''; }
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
      const d2 = new Date(parts[0], parts[1]-1, parts[2]);
      return d2.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    }
    return str;
  }
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
}

function updateClock() {
  const now = new Date();
  const dateEl = document.getElementById('dateStr');
  const timeEl = document.getElementById('timeStr');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
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
    catch(e) { return false; }
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
    showMsg('loginMsg', 'error', 'Email dan password wajib diisi'); 
    return; 
  }

  setBtn('loginBtn', true, 'Masuk');
  showMsg('loginMsg', 'loading', 'Memverifikasi akun...');

  const result = await apiCall({ action: 'login', email, password });

  setBtn('loginBtn', false, 'Masuk');

  if (result.status === 'success') {
    saveAuth(result.data);
    showMsg('loginMsg', 'success', 'Login berhasil! Mengarahkan...');
    setTimeout(() => {
      const role = result.data.role;
      if (role === 'admin') window.location.href = 'dashboard-admin.html';
      else if (role === 'kepsek') window.location.href = 'dashboard-kepsek.html';
      else window.location.href = 'dashboard-guru.html';
    }, 800);
  } else {
    showMsg('loginMsg', 'error', result.message || 'Login gagal');
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
    showMsg('registerMsg', 'error', 'Semua field wajib diisi'); 
    return; 
  }
  
  if (password.length < 6) { 
    showMsg('registerMsg', 'error', 'Password minimal 6 karakter'); 
    return; 
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
    showMsg('registerMsg', 'error', 'Format email tidak valid'); 
    return; 
  }

  setBtn('registerBtn', true, 'Daftar Akun');
  showMsg('registerMsg', 'loading', 'Mendaftarkan akun...');

  const result = await apiCall({ action: 'signup', nama, email, password, role });

  setBtn('registerBtn', false, 'Daftar Akun');

  if (result.status === 'success') {
    showMsg('registerMsg', 'success', result.message);
    document.getElementById('regNama').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    setTimeout(() => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[data-tab="login"]').classList.add('active');
      document.getElementById('loginForm').classList.add('active');
      document.getElementById('registerForm').classList.remove('active');
      document.getElementById('loginEmail').value = email;
    }, 2500);
  } else {
    showMsg('registerMsg', 'error', result.message || 'Registrasi gagal');
  }
}

// ==================== RESEND VERIFICATION ====================
async function resendVerif() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  if (!email) { showMsg('loginMsg', 'error', 'Masukkan email terlebih dahulu'); return; }
  showMsg('loginMsg', 'loading', 'Mengirim ulang...');
  const r = await apiCall({ action: 'resendVerification', email });
  showMsg('loginMsg', r.status === 'success' ? 'success' : 'error', r.message);
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
  hideMsg('forgotMsg');
  if (otpTimer) clearInterval(otpTimer);
  document.getElementById('forgotModal').classList.add('open');
}

function closeForgotModal() {
  document.getElementById('forgotModal').classList.remove('open');
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
    el.textContent = `OTP berlaku: ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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
  if (!email) { showMsg('forgotMsg', 'error', 'Masukkan email Anda'); return; }
  forgotEmailGlobal = email;
  setBtn('sendOtpBtn', true, 'Kirim Kode OTP');
  showMsg('forgotMsg', 'loading', 'Mengirim OTP...');
  
  const r = await apiCall({ action: 'sendPasswordResetOTP', email });
  
  setBtn('sendOtpBtn', false, 'Kirim Kode OTP');
  if (r.status === 'success') {
    showMsg('forgotMsg', 'success', r.message);
    setTimeout(() => { 
      goStep('step2'); 
      hideMsg('forgotMsg');
      startOtpCountdown();
    }, 800);
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
    setTimeout(() => { 
      goStep('step3'); 
      hideMsg('forgotMsg');
    }, 600);
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
    avatarEl.textContent = currentUser.nama.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
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
  } catch(e) {
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
  capturedPhoto = canvas.toDataURL('image/jpeg', 0.75);
  
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
      html += `<div class="info-box success">✅ Absen masuk: <strong>${d.checkInTime}</strong> di ${d.lokasi || '-'}</div>`;
      if (ci) { ci.disabled = true; ci.dataset.done = '1'; }
    } else {
      html += `<div class="info-box info">📝 Belum absen masuk hari ini</div>`;
    }
    if (d.hasCheckedOut) {
      html += `<div class="info-box success">✅ Absen pulang: <strong>${d.checkOutTime}</strong></div>`;
      if (co) { co.disabled = true; co.dataset.done = '1'; }
    } else if (d.hasCheckedIn) {
      html += `<div class="info-box warning">⏰ Belum absen pulang</div>`;
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

async function loadScheduleInfo() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;
  const day = new Date().getDay();
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
      masukMulai: s.senin_rabu_masuk_mulai?.value || '07:30',
      masukSelesai: s.senin_rabu_masuk_selesai?.value || '08:00',
      pulangMulai: s.senin_rabu_pulang_mulai?.value || '12:00',
      pulangSelesai: s.senin_rabu_pulang_selesai?.value || '12:15'
    };
  } else {
    label = 'Kamis – Jumat';
    jadwal = {
      masukMulai: s.kamis_jumat_masuk_mulai?.value || '07:30',
      masukSelesai: s.kamis_jumat_masuk_selesai?.value || '08:00',
      pulangMulai: s.kamis_jumat_pulang_mulai?.value || '11:30',
      pulangSelesai: s.kamis_jumat_pulang_selesai?.value || '11:45'
    };
  }
  el.innerHTML = `
    <div class="info-box info">
      <strong>📅 ${label}</strong><br>
      🟢 Masuk: ${jadwal.masukMulai} – ${jadwal.masukSelesai}<br>
      🔴 Pulang: ${jadwal.pulangMulai} – ${jadwal.pulangSelesai}
    </div>`;
}

async function handleCheckIn() {
  if (isSubmitting) return;
  if (!capturedPhoto) { showMsg('attendMsg', 'error', 'Ambil foto selfie terlebih dahulu'); return; }
  if (!currentLocation) { showMsg('attendMsg', 'error', 'Dapatkan lokasi Anda terlebih dahulu'); return; }
  
  isSubmitting = true;
  const btn = document.getElementById('checkInBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  showMsg('attendMsg', 'loading', 'Mengirim data absen masuk...');
  
  const result = await apiCall({
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

async function handleCheckOut() {
  if (isSubmitting) return;
  if (!capturedPhoto) { showMsg('attendMsg', 'error', 'Ambil foto selfie terlebih dahulu'); return; }
  if (!currentLocation) { showMsg('attendMsg', 'error', 'Dapatkan lokasi Anda terlebih dahulu'); return; }
  
  isSubmitting = true;
  const btn = document.getElementById('checkOutBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
  showMsg('attendMsg', 'loading', 'Mengirim data absen pulang...');
  
  const result = await apiCall({
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
    tbody.innerHTML = r.data.map(row => `
      <tr>
        <td>${formatDate(row.tanggal)}</td>
        <td>${row.checkIn || '-'}</td>
        <td>${row.checkOut || '-'}</td>
        <td>${row.lokasi || '-'}</td>
        <td><span class="badge badge-success">${row.status || 'Hadir'}</span></td>
      </tr>
    `).join('');
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
    const now = new Date();
    const r2 = await apiCall({ action: 'getAttendanceHistory', email: currentUser.email, month: now.getMonth()+1, year: now.getFullYear() });
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

// ==================== TEACHERS (KEPSEK & ADMIN) ====================
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
  tbody.innerHTML = data.map((u, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${u.nama || '-'}</strong></td>
      <td style="color:var(--text2)">${u.email || '-'}</td>
      <td><span class="badge badge-info">${u.role === 'guru' ? 'Guru' : u.role === 'kepsek' ? 'Kepsek' : 'Admin'}</span></td>
      <td>${u.status === 'Verified' ? '<span class="badge badge-success">Aktif</span>' : u.status === 'Pending' ? '<span class="badge badge-warning">Pending</span>' : '<span class="badge badge-error">Diblokir</span>'}</td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="viewTeacherAttendance('${u.email}')">📋 Absensi</button>
          ${isAdmin ? `<button class="btn-secondary btn-sm" onclick="editTeacher('${u.email}')">✏️ Edit</button>` : ''}
          ${isAdmin ? `<button class="${u.status === 'Blocked' ? 'btn-success' : 'btn-danger'} btn-sm" onclick="toggleBlock('${u.email}','${u.status}')">${u.status === 'Blocked' ? '🔓 Aktifkan' : '🔒 Blokir'}</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

window.viewTeacherAttendance = async function(email) {
  const now = new Date();
  const r = await apiCall({ action: 'getAttendanceHistory', email, month: now.getMonth()+1, year: now.getFullYear() });
  const detBox = document.getElementById('teacherDetail');
  const detContent = document.getElementById('teacherDetailContent');
  if (!detBox || !detContent) return;
  
  detBox.style.display = 'block';
  document.getElementById('teacherDetailEmail').textContent = email;
  
  if (r.status === 'success' && r.data && r.data.length > 0) {
    detContent.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tanggal</th><th>Check In</th><th>Check Out</th><th>Lokasi</th></tr></thead>
          <tbody>${r.data.map(d => `<tr><td>${formatDate(d.tanggal)}</td><td>${d.checkIn||'-'}</td><td>${d.checkOut||'-'}</td><td>${d.lokasi||'-'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  } else {
    detContent.innerHTML = '<div class="empty-state"><span class="icon">📭</span>Belum ada data absensi bulan ini</div>';
  }
};

window.toggleBlock = async function(email, currentStatus) {
  const blocked = currentStatus !== 'Blocked';
  const r = await apiCall({ action: 'blockUser', email, blocked: blocked ? 'true' : 'false' });
  if (r.status === 'success') {
    showMsg('setMsg', 'success', r.message);
    loadAllTeachers();
  } else {
    showMsg('setMsg', 'error', r.message);
  }
};

window.editTeacher = async function(email) {
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
  showMsg('editMsg', 'loading', 'Menyimpan perubahan...');
  
  const r1 = await apiCall({ action: 'updateUserRole', email, newRole });
  if (r1.status !== 'success') {
    showMsg('editMsg', 'error', r1.message);
    isSubmitting = false; setBtn('saveEditBtn', false, 'Simpan');
    return;
  }
  
  await apiCall({ action: 'blockUser', email, blocked: newStatus === 'Blocked' ? 'true' : 'false' });
  
  if (newPassword && newPassword.length >= 6) {
    await apiCall({ action: 'resetPassword', email, newPassword });
  }
  
  isSubmitting = false; setBtn('saveEditBtn', false, 'Simpan');
  showMsg('editMsg', 'success', 'Data berhasil disimpan');
  setTimeout(() => { closeModal('editTeacherModal'); loadAllTeachers(); }, 1200);
}

function openAddTeacher() {
  document.getElementById('addNama').value = '';
  document.getElementById('addEmail').value = '';
  document.getElementById('addPassword').value = '';
  document.getElementById('addRole').value = 'guru';
  hideMsg('addMsg');
  openModal('addTeacherModal');
}

async function saveAddTeacher() {
  if (isSubmitting) return;
  const nama = document.getElementById('addNama').value.trim();
  const email = document.getElementById('addEmail').value.trim();
  const password = document.getElementById('addPassword').value;
  const role = document.getElementById('addRole').value;
  
  if (!nama || !email || !password) { showMsg('addMsg', 'error', 'Semua field wajib diisi'); return; }
  if (password.length < 6) { showMsg('addMsg', 'error', 'Password minimal 6 karakter'); return; }
  
  isSubmitting = true;
  setBtn('saveAddBtn', true, 'Tambah');
  showMsg('addMsg', 'loading', 'Mendaftarkan...');
  
  const r = await apiCall({ action: 'signup', nama, email, password, role });
  isSubmitting = false; setBtn('saveAddBtn', false, 'Tambah');
  
  if (r.status === 'success') {
    showMsg('addMsg', 'success', r.message);
    setTimeout(() => { closeModal('addTeacherModal'); loadAllTeachers(); }, 1500);
  } else {
    showMsg('addMsg', 'error', r.message);
  }
}

// ==================== LOCATIONS (ADMIN) ====================
async function loadLocations() {
  const tbody = document.getElementById('locationsBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Memuat...</td></tr>';
  
  const r = await apiCall({ action: 'getLocations' });
  if (!tbody) return;
  if (r.status === 'success' && r.data && r.data.length > 0) {
    tbody.innerHTML = r.data.map(loc => `
      <tr>
        <td><strong>${loc.nama_kelas}</strong></td>
        <td>${loc.lat}</td>
        <td>${loc.lng}</td>
        <td><span class="badge badge-info">${loc.radius_meter} m</span></td>
        <td><button class="btn-danger btn-sm" onclick="alert('Hapus lokasi: ${loc.nama_kelas} (implementasi nanti)')">🗑️ Hapus</button></td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Belum ada lokasi terdaftar</td></tr>';
  }
}

async function addLocation() {
  if (isSubmitting) return;
  const nama = document.getElementById('locNama').value.trim();
  const lat = document.getElementById('locLat').value.trim();
  const lng = document.getElementById('locLng').value.trim();
  const radius = document.getElementById('locRadius').value || 50;
  
  if (!nama || !lat || !lng) { showMsg('locMsg', 'error', 'Nama, Latitude, Longitude wajib diisi'); return; }
  
  isSubmitting = true;
  setBtn('addLocBtn', true, 'Tambah Lokasi');
  showMsg('locMsg', 'loading', 'Menyimpan...');
  
  const r = await apiCall({ action: 'addLocation', nama_kelas: nama, lat, lng, radius });
  isSubmitting = false; setBtn('addLocBtn', false, 'Tambah Lokasi');
  
  if (r.status === 'success') {
    showMsg('locMsg', 'success', r.message);
    document.getElementById('locNama').value = '';
    document.getElementById('locLat').value = '';
    document.getElementById('locLng').value = '';
    document.getElementById('locRadius').value = '50';
    loadLocations();
  } else {
    showMsg('locMsg', 'error', r.message);
  }
}

// ==================== SETTINGS (ADMIN) ====================
async function loadSettings() {
  const r = await apiCall({ action: 'getSettings' });
  if (r.status !== 'success') return;
  const s = r.data;
  const keys = ['senin_rabu_masuk_mulai', 'senin_rabu_masuk_selesai','senin_rabu_pulang_mulai','senin_rabu_pulang_selesai',
    'kamis_jumat_masuk_mulai','kamis_jumat_masuk_selesai','kamis_jumat_pulang_mulai','kamis_jumat_pulang_selesai','school_name'];
  keys.forEach(k => {
    const el = document.getElementById('set_' + k);
    if (el && s[k]) el.value = s[k].value;
  });
}

async function saveSettings() {
  if (isSubmitting) return;
  const keys = ['senin_rabu_masuk_mulai','senin_rabu_masuk_selesai','senin_rabu_pulang_mulai','senin_rabu_pulang_selesai',
    'kamis_jumat_masuk_mulai','kamis_jumat_masuk_selesai','kamis_jumat_pulang_mulai','kamis_jumat_pulang_selesai','school_name'];
  const settings = {};
  keys.forEach(k => {
    const el = document.getElementById('set_' + k);
    if (el) settings[k] = el.value;
  });
  
  isSubmitting = true;
  setBtn('saveSetBtn', true, 'Simpan Pengaturan');
  showMsg('setMsg', 'loading', 'Menyimpan...');
  
  const r = await apiCall({ action: 'updateSettings', settings: JSON.stringify(settings) });
  isSubmitting = false; setBtn('saveSetBtn', false, 'Simpan Pengaturan');
  
  if (r.status === 'success') showMsg('setMsg', 'success', 'Pengaturan berhasil disimpan');
  else showMsg('setMsg', 'error', r.message || 'Gagal menyimpan');
}

// ==================== REPORT ====================
async function generateReport() {
  if (isSubmitting) return;
  const month = document.getElementById('repMonth')?.value;
  const year = document.getElementById('repYear')?.value;
  const email = document.getElementById('repEmail')?.value?.trim() || currentUser?.email;
  if (!month || !year || !email) { showMsg('repMsg', 'error', 'Lengkapi semua field'); return; }
  
  isSubmitting = true;
  setBtn('genRepBtn', true, 'Generate Laporan');
  showMsg('repMsg', 'loading', 'Mengirim laporan...');
  
  const r = await apiCall({ action: 'generateMonthlyReport', month, year, sendToEmail: email });
  isSubmitting = false; setBtn('genRepBtn', false, 'Generate Laporan');
  showMsg('repMsg', r.status === 'success' ? 'success' : 'error', r.message);
}

// ==================== CHANGE PASSWORD ====================
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
  isSubmitting = false; setBtn('changePwBtn', false, 'Simpan');
  
  if (r.status === 'success') {
    showMsg('changePwMsg', 'success', 'Password berhasil diganti!');
    setTimeout(() => { closeModal('changePwModal'); document.getElementById('newPwd1').value=''; document.getElementById('newPwd2').value=''; }, 1800);
  } else {
    showMsg('changePwMsg', 'error', r.message);
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
  
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('mobileBackdrop')?.classList.remove('show');
  
  if (pageId === 'Dashboard') {
    loadDashboardStats();
    if (currentUser?.role === 'guru') {
      loadTodayStatus();
      loadScheduleInfo();
    }
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
  ['histYear', 'repYear'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = new Date().getFullYear();
    for (let yr = y-2; yr <= y+1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr; opt.textContent = yr;
      if (yr === y) opt.selected = true;
      el.appendChild(opt);
    }
  });
  ['histMonth', 'repMonth'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = new Date().getMonth() + 1;
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Aplikasi dimulai');
  updateClock();
  setInterval(updateClock, 1000);
  
  const path = window.location.pathname;
  const isDashboard = path.includes('dashboard-');
  
  if (isDashboard) {
    if (!checkAuth()) { window.location.href = 'index.html'; return; }
    
    const role = currentUser.role;
    if (path.includes('dashboard-guru') && role !== 'guru') { window.location.href = 'index.html'; return; }
    if (path.includes('dashboard-kepsek') && role !== 'kepsek') { window.location.href = 'index.html'; return; }
    if (path.includes('dashboard-admin') && role !== 'admin') { window.location.href = 'index.html'; return; }
    
    loadProfile();
    populateYears();
    loadDashboardStats();
    if (role === 'guru') { loadScheduleInfo(); loadTodayStatus(); }
    
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    document.getElementById('openChangePwBtn')?.addEventListener('click', () => openModal('changePwModal'));
    document.getElementById('changePwBtn')?.addEventListener('click', changePassword);
    
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
    }
    
    navigate('Dashboard');
    return;
  }
  
  // ===== HALAMAN INDEX (LOGIN/REGISTER) =====
  loadSchoolName();
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
      document.getElementById(target + 'Form').classList.add('active');
    });
  });
  
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click', handleRegister);
  document.getElementById('resendVerifBtn')?.addEventListener('click', resendVerif);
  document.getElementById('forgotBtn')?.addEventListener('click', openForgotModal);
  document.getElementById('closeForgotBtn')?.addEventListener('click', closeForgotModal);
  document.getElementById('forgotModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('forgotModal')) closeForgotModal();
  });
  document.getElementById('sendOtpBtn')?.addEventListener('click', sendOtp);
  document.getElementById('verifyOtpBtn')?.addEventListener('click', verifyOtp);
  document.getElementById('resendOtpBtn')?.addEventListener('click', resendOtp);
  document.getElementById('resetPwdBtn')?.addEventListener('click', doResetPassword);
  
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin(e);
  });
  
  console.log('✅ Aplikasi siap digunakan');
});
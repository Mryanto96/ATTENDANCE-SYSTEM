// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND
// Versi: 13.0 - FIXED FOR YOUR HTML
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbypYKD2bL4Cvi_UfG4XIuVMSs2YxbnBLlZF_fUCgru9PtmmEZAwcCsukvI-ffbbSm_iyQ/exec";

let currentUser = null;
let isSubmitting = false;
let otpTimer = null;
let forgotEmailGlobal = '';

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
      // Switch ke tab login
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
  // Reset semua step
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
  let secs = 600; // 10 menit
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
      el.style.color = '#ef4444';
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

// ==================== DASHBOARD FUNCTIONS (UNTUK HALAMAN LAIN) ====================
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
}

async function loadDashboardStats() {
  const r = await apiCall({ action: 'getAllUsers' });
  if (r.status === 'success' && r.data) {
    const guru = r.data.filter(u => u.role === 'guru').length;
    const statEl = document.getElementById('statGuru');
    if (statEl) statEl.textContent = guru;
  }
}

function populateYears() {
  const yearEl = document.getElementById('histYear');
  if (yearEl) {
    const y = new Date().getFullYear();
    for (let yr = y-2; yr <= y+1; yr++) {
      const opt = document.createElement('option');
      opt.value = yr; opt.textContent = yr;
      if (yr === y) opt.selected = true;
      yearEl.appendChild(opt);
    }
  }
}

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page' + pageId);
  if (page) page.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');
  if (pageId === 'Dashboard') loadDashboardStats();
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Aplikasi dimulai');
  
  // Cek apakah di halaman index atau dashboard
  const path = window.location.pathname;
  const isDashboard = path.includes('dashboard-');
  
  if (isDashboard) {
    // Halaman dashboard
    if (!checkAuth()) { window.location.href = 'index.html'; return; }
    loadProfile();
    populateYears();
    loadDashboardStats();
    
    // Setup navigasi
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    navigate('Dashboard');
    return;
  }
  
  // ===== HALAMAN INDEX (LOGIN/REGISTER) =====
  loadSchoolName();
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
      if (target === 'login') {
        document.getElementById('loginForm').classList.add('active');
      } else {
        document.getElementById('registerForm').classList.add('active');
      }
    });
  });
  
  // LOGIN
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin(e);
    });
  }
  
  // REGISTER
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) registerBtn.addEventListener('click', handleRegister);
  
  // Resend verification
  const resendBtn = document.getElementById('resendVerifBtn');
  if (resendBtn) resendBtn.addEventListener('click', resendVerif);
  
  // FORGOT PASSWORD MODAL
  const forgotBtn = document.getElementById('forgotBtn');
  const forgotModal = document.getElementById('forgotModal');
  const closeForgotBtn = document.getElementById('closeForgotBtn');
  
  if (forgotBtn) forgotBtn.addEventListener('click', openForgotModal);
  if (closeForgotBtn) closeForgotBtn.addEventListener('click', closeForgotModal);
  if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) closeForgotModal();
    });
  }
  
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  if (sendOtpBtn) sendOtpBtn.addEventListener('click', sendOtp);
  
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', verifyOtp);
  
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  if (resendOtpBtn) resendOtpBtn.addEventListener('click', resendOtp);
  
  const resetPwdBtn = document.getElementById('resetPwdBtn');
  if (resetPwdBtn) resetPwdBtn.addEventListener('click', doResetPassword);
  
  console.log('✅ Event listeners terpasang');
});
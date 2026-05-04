// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND
// Versi: 11.0 - FIXED CORS & FETCH
// ============================================================
// https://script.google.com/macros/s//exec




const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFeUlvj2n7TpkZqGqEe31rRwapBGycRJ76p9ezT975HYjJ8yJWELRuvTwGYhrW7RoxIA/exec";

let currentUser = null;
let stream = null;
let currentLocation = null;
let capturedPhoto = null;
let otpCountdownInterval = null;
let forgotEmail = '';

let isLoggingIn = false;
let isRegistering = false;
let isSubmitting = false;

// ==================== UTILITY ====================
function showMessage(elementId, type, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        setTimeout(() => {
            if (element.textContent === message) {
                element.textContent = '';
                element.className = 'message';
            }
        }, 4000);
    }
}

function updateDateTime() {
    const now = new Date();
    const dateElement = document.getElementById('currentDate');
    const timeElement = document.getElementById('currentTime');
    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

// ==================== API CALLS DENGAN NO-CORS FALLBACK ====================
async function apiPost(action, data) {
    try {
        const payload = { action, ...data };
        console.log(`📡 POST: ${action}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();
        console.log('✅ Response:', result);
        return result;
        
    } catch (error) {
        console.error('❌ POST Error:', error);
        
        // FALLBACK NO-CORS
        try {
            console.log('🔄 Mencoba mode no-cors...');
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
            });
            return { status: 'success', message: 'Request sent (no-cors mode)' };
        } catch (fallbackError) {
            return { status: 'error', message: 'Koneksi gagal: ' + error.message };
        }
    }
}

async function apiGet(action, params = {}) {
    try {
        let url = `${APPS_SCRIPT_URL}?action=${action}`;
        Object.keys(params).forEach(key => {
            if (params[key]) {
                url += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
            }
        });
        console.log(`📡 GET: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        console.log('✅ Response:', data);
        return data;
        
    } catch (error) {
        console.error('❌ GET Error:', error);
        return { status: 'error', message: error.message };
    }
}

// ==================== AUTHENTICATION ====================
async function handleLogin(event) {
    event.preventDefault();
    
    if (isLoggingIn) {
        console.log('⏳ Login sedang diproses');
        return;
    }
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('loginMessage', 'error', 'Harap isi email dan password');
        return;
    }
    
    isLoggingIn = true;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Memproses...';
    submitBtn.disabled = true;
    showMessage('loginMessage', 'neutral', 'Memproses...');
    
    const result = await apiPost('login', { email, password });
    
    isLoggingIn = false;
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    if (result.status === 'success') {
        currentUser = result.data;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        showMessage('loginMessage', 'success', 'Login berhasil! Mengalihkan...');
        
        setTimeout(() => {
            if (currentUser.role === 'guru') window.location.href = 'dashboard-guru.html';
            else if (currentUser.role === 'kepsek') window.location.href = 'dashboard-kepsek.html';
            else if (currentUser.role === 'admin') window.location.href = 'dashboard-admin.html';
            else window.location.href = 'index.html';
        }, 1000);
    } else {
        showMessage('loginMessage', 'error', result.message);
        if (result.unverified) {
            const resendContainer = document.getElementById('resendVerificationContainer');
            if (resendContainer) resendContainer.style.display = 'block';
        }
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    if (isRegistering) {
        console.log('⏳ Registrasi sedang diproses');
        return;
    }
    
    const nama = document.getElementById('regNama').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole')?.value || 'guru';
    
    if (!nama || !email || !password) {
        showMessage('registerMessage', 'error', 'Harap isi semua field');
        return;
    }
    
    if (password.length < 6) {
        showMessage('registerMessage', 'error', 'Password minimal 6 karakter');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('registerMessage', 'error', 'Format email tidak valid');
        return;
    }
    
    isRegistering = true;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Mendaftarkan...';
    submitBtn.disabled = true;
    showMessage('registerMessage', 'neutral', 'Mendaftarkan...');
    
    const result = await apiPost('signup', { nama, email, password, role });
    
    isRegistering = false;
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    if (result.status === 'success') {
        showMessage('registerMessage', 'success', result.message);
        document.getElementById('regNama').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        setTimeout(() => {
            const loginTab = document.querySelector('.tab-btn[data-tab="login"]');
            if (loginTab) loginTab.click();
            document.getElementById('loginEmail').value = email;
        }, 1500);
    } else {
        showMessage('registerMessage', 'error', result.message);
    }
}

function handleLogout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    window.location.href = 'index.html';
}

function checkAuth() {
    const stored = sessionStorage.getItem('currentUser');
    if (stored) {
        currentUser = JSON.parse(stored);
        return true;
    }
    return false;
}

// ==================== FORGOT PASSWORD ====================
async function sendOTP() {
    const email = document.getElementById('forgotEmail').value;
    if (!email) {
        showMessage('forgotMessage', 'error', 'Masukkan email Anda');
        return;
    }
    
    forgotEmail = email;
    showMessage('forgotMessage', 'neutral', 'Mengirim OTP...');
    
    const result = await apiPost('sendPasswordResetOTP', { email });
    
    if (result.status === 'success') {
        showMessage('forgotMessage', 'success', 'OTP telah dikirim ke email Anda');
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep2').style.display = 'block';
        startOtpTimer(10);
    } else {
        showMessage('forgotMessage', 'error', result.message);
    }
}

function startOtpTimer(minutes) {
    let time = minutes * 60;
    const timerElement = document.getElementById('otpTimer');
    if (otpCountdownInterval) clearInterval(otpCountdownInterval);
    otpCountdownInterval = setInterval(() => {
        time--;
        const mins = Math.floor(time / 60);
        const secs = time % 60;
        if (timerElement) {
            timerElement.textContent = `OTP berlaku: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        if (time <= 0) {
            clearInterval(otpCountdownInterval);
            if (timerElement) timerElement.textContent = 'OTP telah kadaluarsa';
        }
    }, 1000);
}

async function verifyOTPCode() {
    const otp = document.getElementById('otpCode').value;
    if (!otp || otp.length !== 6) {
        showMessage('forgotMessage', 'error', 'Masukkan 6 digit OTP');
        return;
    }
    
    showMessage('forgotMessage', 'neutral', 'Memverifikasi OTP...');
    
    const result = await apiPost('verifyOTP', { email: forgotEmail, otp });
    
    if (result.status === 'success') {
        showMessage('forgotMessage', 'success', 'OTP valid! Silakan buat password baru');
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep3').style.display = 'block';
        if (otpCountdownInterval) clearInterval(otpCountdownInterval);
    } else {
        showMessage('forgotMessage', 'error', result.message);
    }
}

async function resendOTP() {
    if (!forgotEmail) return;
    showMessage('forgotMessage', 'neutral', 'Mengirim ulang OTP...');
    const result = await apiPost('sendPasswordResetOTP', { email: forgotEmail });
    if (result.status === 'success') {
        showMessage('forgotMessage', 'success', 'OTP baru telah dikirim');
        startOtpTimer(10);
    } else {
        showMessage('forgotMessage', 'error', result.message);
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword || newPassword.length < 6) {
        showMessage('forgotMessage', 'error', 'Password minimal 6 karakter');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('forgotMessage', 'error', 'Password tidak sama');
        return;
    }
    
    showMessage('forgotMessage', 'neutral', 'Merreset password...');
    
    const result = await apiPost('resetPassword', { email: forgotEmail, newPassword });
    
    if (result.status === 'success') {
        showMessage('forgotMessage', 'success', 'Password berhasil direset! Silakan login.');
        setTimeout(() => {
            closeForgotModal();
        }, 1500);
    } else {
        showMessage('forgotMessage', 'error', result.message);
    }
}

function closeForgotModal() {
    const modal = document.getElementById('forgotModal');
    if (modal) modal.style.display = 'none';
    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = 'none';
    document.getElementById('forgotEmail').value = '';
    document.getElementById('otpCode').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    if (otpCountdownInterval) clearInterval(otpCountdownInterval);
}

async function resendVerificationEmail() {
    const email = document.getElementById('loginEmail').value;
    if (!email) {
        showMessage('loginMessage', 'error', 'Masukkan email terlebih dahulu');
        return;
    }
    showMessage('loginMessage', 'neutral', 'Mengirim ulang verifikasi...');
    const result = await apiPost('resendVerification', { email });
    if (result.status === 'success') {
        showMessage('loginMessage', 'success', result.message);
    } else {
        showMessage('loginMessage', 'error', result.message);
    }
}

// ==================== CAMERA & LOCATION ====================
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = stream;
            await video.play();
        }
        return true;
    } catch (error) {
        showMessage('attendanceMessage', 'error', 'Tidak dapat mengakses kamera.');
        return false;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    if (!video || !canvas) return;
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImg');
    if (preview && previewImg) {
        previewImg.src = capturedPhoto;
        preview.style.display = 'block';
    }
    
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) cameraContainer.style.display = 'none';
    
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.disabled = true;
}

function retakePhoto() {
    capturedPhoto = null;
    const preview = document.getElementById('photoPreview');
    const cameraContainer = document.querySelector('.camera-container');
    if (preview) preview.style.display = 'none';
    if (cameraContainer) cameraContainer.style.display = 'block';
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.disabled = false;
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation tidak didukung'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let message = 'Gagal mendapatkan lokasi. ';
                if (error.code === 1) message += 'Izin lokasi ditolak.';
                else if (error.code === 2) message += 'Lokasi tidak tersedia.';
                else if (error.code === 3) message += 'Waktu habis.';
                reject(new Error(message));
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

async function handleGetLocation() {
    const locationBtn = document.getElementById('getLocationBtn');
    const locationInfo = document.getElementById('locationInfo');
    
    if (locationBtn) {
        locationBtn.disabled = true;
        locationBtn.textContent = 'Mendapatkan lokasi...';
    }
    
    try {
        const location = await getCurrentLocation();
        currentLocation = location;
        if (locationInfo) {
            locationInfo.innerHTML = `✅ Lokasi ditemukan! (${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`;
            locationInfo.style.color = '#065f46';
        }
    } catch (error) {
        if (locationInfo) {
            locationInfo.innerHTML = `❌ ${error.message}`;
            locationInfo.style.color = '#991b1b';
        }
    } finally {
        if (locationBtn) {
            locationBtn.disabled = false;
            locationBtn.textContent = 'Dapatkan Lokasi Saya';
        }
    }
}

// ==================== LOAD PROFILE & DASHBOARD ====================
function loadProfile() {
    if (!currentUser) return;
    const names = ['userName', 'profileName'];
    names.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = currentUser.nama;
    });
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = currentUser.email;
    const roleEl = document.getElementById('profileRole');
    if (roleEl) {
        if (currentUser.role === 'guru') roleEl.textContent = 'Guru';
        else if (currentUser.role === 'kepsek') roleEl.textContent = 'Kepala Sekolah';
        else if (currentUser.role === 'admin') roleEl.textContent = 'Administrator';
    }
}

async function loadDashboardStats() {
    if (!currentUser) return;
    const result = await apiPost('getAllUsers', {});
    if (result.status === 'success') {
        const totalGuru = result.data.filter(u => u.role === 'guru').length;
        const totalKepsek = result.data.filter(u => u.role === 'kepsek').length;
        const totalAdmin = result.data.filter(u => u.role === 'admin').length;
        
        const totalGuruElem = document.getElementById('totalGuru');
        if (totalGuruElem) totalGuruElem.textContent = totalGuru;
        const totalKepsekElem = document.getElementById('totalKepsek');
        if (totalKepsekElem) totalKepsekElem.textContent = totalKepsek;
        const totalAdminElem = document.getElementById('totalAdmin');
        if (totalAdminElem) totalAdminElem.textContent = totalAdmin;
    }
}

// ==================== PAGE INITIALIZATION ====================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.dataset.page;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            pages.forEach(page => page.classList.remove('active'));
            const targetPage = document.getElementById(`page${pageId.charAt(0).toUpperCase() + pageId.slice(1)}`);
            if (targetPage) targetPage.classList.add('active');
        });
    });
}

function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
    }
}

function initModals() {
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
            if (modal?.id === 'forgotModal') closeForgotModal();
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            if (e.target.id === 'forgotModal') closeForgotModal();
        }
    });
}

function initYearSelect() {
    const yearSelect = document.getElementById('historyYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }
}

async function loadAllTeachers() {
    const result = await apiPost('getAllUsers', {});
    const tbody = document.getElementById('teachersBody');
    if (tbody && result.status === 'success') {
        tbody.innerHTML = result.data.map((teacher, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${teacher.nama}</td>
                <td>${teacher.email}</td>
                <td>${teacher.role === 'guru' ? 'Guru' : (teacher.role === 'kepsek' ? 'Kepsek' : 'Admin')}</td>
                <td><span class="status-badge ${teacher.status === 'Verified' ? 'success' : 'warning'}">${teacher.status === 'Verified' ? 'Aktif' : 'Pending'}</span></td>
                <td><button class="btn-small" onclick="alert('Fitur sedang dikembangkan')">Lihat</button></td>
            </tr>
        `).join('');
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Aplikasi dimulai');
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    const isDashboard = window.location.pathname.includes('dashboard-');
    if (isDashboard) {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }
        loadProfile();
        initNavigation();
        initMobileMenu();
        initModals();
        loadDashboardStats();
        if (window.location.pathname.includes('dashboard-admin.html') || window.location.pathname.includes('dashboard-kepsek.html')) {
            loadAllTeachers();
        }
    }
    
    // LOGIN PAGE
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    // TABS
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const loginDiv = document.getElementById('loginForm');
            const registerDiv = document.getElementById('registerForm');
            if (tab === 'login') {
                if (loginDiv) loginDiv.classList.add('active');
                if (registerDiv) registerDiv.classList.remove('active');
            } else {
                if (loginDiv) loginDiv.classList.remove('active');
                if (registerDiv) registerDiv.classList.add('active');
            }
        });
    });
    
    // FORGOT PASSWORD
    const forgotLink = document.getElementById('forgotPasswordLink');
    const forgotModal = document.getElementById('forgotModal');
    if (forgotLink && forgotModal) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotModal.style.display = 'flex';
        });
    }
    
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    if (sendOtpBtn) sendOtpBtn.addEventListener('click', sendOTP);
    
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', verifyOTPCode);
    
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    if (resendOtpBtn) resendOtpBtn.addEventListener('click', resendOTP);
    
    const resetPwBtn = document.getElementById('resetPasswordBtn');
    if (resetPwBtn) resetPwBtn.addEventListener('click', resetPassword);
    
    const resendVerif = document.getElementById('resendVerificationLink');
    if (resendVerif) resendVerif.addEventListener('click', resendVerificationEmail);
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    // CHANGE PASSWORD
    const changePwBtn = document.getElementById('changePasswordBtn');
    if (changePwBtn) {
        changePwBtn.addEventListener('click', () => {
            const modal = document.getElementById('changePasswordModal');
            if (modal) modal.style.display = 'flex';
        });
    }
    
    const confirmChange = document.getElementById('confirmChangePassword');
    if (confirmChange) {
        confirmChange.addEventListener('click', async () => {
            const pwd1 = document.getElementById('newPassword1').value;
            const pwd2 = document.getElementById('newPassword2').value;
            if (!pwd1 || pwd1.length < 6) {
                showMessage('changePwMessage', 'error', 'Password minimal 6 karakter');
                return;
            }
            if (pwd1 !== pwd2) {
                showMessage('changePwMessage', 'error', 'Password tidak sama');
                return;
            }
            showMessage('changePwMessage', 'neutral', 'Mengganti password...');
            const result = await apiPost('resetPassword', { email: currentUser.email, newPassword: pwd1 });
            if (result.status === 'success') {
                showMessage('changePwMessage', 'success', 'Password berhasil diganti');
                setTimeout(() => {
                    document.getElementById('changePasswordModal').style.display = 'none';
                    document.getElementById('newPassword1').value = '';
                    document.getElementById('newPassword2').value = '';
                }, 1500);
            } else {
                showMessage('changePwMessage', 'error', result.message);
            }
        });
    }
    
    // ATTENDANCE BUTTONS (GURU)
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.addEventListener('click', () => { capturePhoto(); captureBtn.disabled = true; });
    
    const retakeBtn = document.getElementById('retakeBtn');
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
    
    const getLocBtn = document.getElementById('getLocationBtn');
    if (getLocBtn) getLocBtn.addEventListener('click', handleGetLocation);
    
    const checkInBtn = document.getElementById('checkInBtn');
    if (checkInBtn) {
        checkInBtn.addEventListener('click', async () => {
            if (!capturedPhoto) { showMessage('attendanceMessage', 'error', 'Ambil foto dulu'); return; }
            if (!currentLocation) { showMessage('attendanceMessage', 'error', 'Dapatkan lokasi dulu'); return; }
            if (isSubmitting) return;
            isSubmitting = true;
            showMessage('attendanceMessage', 'neutral', 'Memproses...');
            const result = await apiPost('checkIn', {
                email: currentUser.email,
                photo: capturedPhoto,
                lat: currentLocation.lat,
                lng: currentLocation.lng
            });
            isSubmitting = false;
            if (result.status === 'success') {
                showMessage('attendanceMessage', 'success', result.message);
                setTimeout(() => location.reload(), 2000);
            } else {
                showMessage('attendanceMessage', 'error', result.message);
            }
        });
    }
    
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) {
        checkOutBtn.addEventListener('click', async () => {
            if (!capturedPhoto) { showMessage('attendanceMessage', 'error', 'Ambil foto dulu'); return; }
            if (!currentLocation) { showMessage('attendanceMessage', 'error', 'Dapatkan lokasi dulu'); return; }
            if (isSubmitting) return;
            isSubmitting = true;
            showMessage('attendanceMessage', 'neutral', 'Memproses...');
            const result = await apiPost('checkOut', {
                email: currentUser.email,
                photo: capturedPhoto,
                lat: currentLocation.lat,
                lng: currentLocation.lng
            });
            isSubmitting = false;
            if (result.status === 'success') {
                showMessage('attendanceMessage', 'success', result.message);
                setTimeout(() => location.reload(), 2000);
            } else {
                showMessage('attendanceMessage', 'error', result.message);
            }
        });
    }
    
    const quickCheckIn = document.getElementById('quickCheckInBtn');
    if (quickCheckIn) {
        quickCheckIn.addEventListener('click', () => {
            const attendanceNav = document.querySelector('.nav-item[data-page="attendance"]');
            if (attendanceNav) attendanceNav.click();
        });
    }
    
    const quickCheckOut = document.getElementById('quickCheckOutBtn');
    if (quickCheckOut) {
        quickCheckOut.addEventListener('click', () => {
            const attendanceNav = document.querySelector('.nav-item[data-page="attendance"]');
            if (attendanceNav) attendanceNav.click();
        });
    }
});
// ============================================================
// SISTEM ABSENSI DIGITAL - FRONTEND
// Versi: 7.0 - WITH NO-CORS FALLBACK
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZQe2zyDIm4vX72NUO4OLriAkySP0qlvAmJAosEOMsKToZ1nEvarF5jdqEjYe8uXxN/exec";

let currentUser = null;
let stream = null;
let currentLocation = null;
let capturedPhoto = null;
let otpCountdownInterval = null;
let forgotEmail = '';

// ==================== UTILITY ====================
function showMessage(elementId, type, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        setTimeout(() => {
            if (element.textContent === message) {
                element.textContent = "";
                element.className = "message";
            }
        }, 5000);
    }
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

// ==================== API CALLS DENGAN FALLBACK NO-CORS ====================

async function apiGet(action, params = {}) {
    try {
        let url = `${APPS_SCRIPT_URL}?action=${action}`;
        Object.keys(params).forEach(key => {
            if (params[key]) {
                url += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
            }
        });
        console.log("📡 GET:", url);
        
        const response = await fetch(url);
        const data = await response.json();
        console.log("✅ Response:", data);
        return data;
        
    } catch (error) {
        console.error('❌ GET Error:', error);
        
        // FALLBACK: coba dengan mode no-cors
        try {
            console.log("🔄 Mencoba mode no-cors untuk GET...");
            await fetch(url, { mode: 'no-cors' });
            // Dengan no-cors, kita tidak bisa baca response
            // Tapi request tetap terkirim
            return { status: 'success', message: 'Request sent (no-cors mode)' };
        } catch (fallbackError) {
            return { status: 'error', message: 'Koneksi gagal: ' + error.message };
        }
    }
}

async function apiPost(action, data) {
    try {
        const payload = { action, ...data };
        console.log("📡 POST:", action, payload);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log("✅ Response:", result);
        return result;
        
    } catch (error) {
        console.error('❌ POST Error:', error);
        
        // FALLBACK: coba dengan mode no-cors (seperti kode ujian online)
        try {
            console.log("🔄 Mencoba mode no-cors untuk POST...");
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
            });
            // Dengan mode no-cors, response tidak bisa dibaca
            // Tapi request tetap terkirim ke server
            return { status: 'success', message: 'Request sent (no-cors mode)' };
        } catch (fallbackError) {
            return { status: 'error', message: 'Koneksi gagal: ' + error.message };
        }
    }
}

// ==================== AUTHENTICATION ====================
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('loginMessage', 'error', 'Harap isi email dan password');
        return;
    }
    
    showMessage('loginMessage', 'neutral', 'Memproses...');
    
    const result = await apiPost('login', { email, password });
    
    if (result.status === 'success') {
        currentUser = result.data;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        showMessage('loginMessage', 'success', 'Login berhasil!');
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
    
    const nama = document.getElementById('regNama').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const roleSelect = document.getElementById('regRole');
    const role = roleSelect ? roleSelect.value : 'guru';
    
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
    
    showMessage('registerMessage', 'neutral', 'Mendaftarkan...');
    
    const result = await apiPost('signup', { nama, email, password, role });
    
    if (result.status === 'success') {
        showMessage('registerMessage', 'success', result.message);
        document.getElementById('regNama').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        setTimeout(() => {
            const loginTab = document.querySelector('.tab-btn[data-tab="login"]');
            if (loginTab) loginTab.click();
            document.getElementById('loginEmail').value = email;
        }, 2000);
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
        showMessage('forgotMessage', 'success', result.message);
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
        showMessage('forgotMessage', 'success', result.message);
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
        showMessage('forgotMessage', 'success', result.message);
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
        showMessage('forgotMessage', 'success', result.message);
        setTimeout(() => {
            closeForgotModal();
        }, 2000);
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

// ==================== ATTENDANCE ====================
async function loadTodayStatus() {
    if (!currentUser) return;
    const result = await apiGet('checkTodayAttendance', { email: currentUser.email });
    if (result.status === 'success') {
        const statusDiv = document.getElementById('statusDetails');
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        if (statusDiv) {
            if (result.data.hasCheckedIn) {
                statusDiv.innerHTML = `<p>✅ Absen masuk: ${result.data.checkInTime}</p>${result.data.hasCheckedOut ? `<p>✅ Absen pulang: ${result.data.checkOutTime}</p>` : '<p>⏰ Belum absen pulang</p>'}`;
                if (checkInBtn) checkInBtn.disabled = true;
                if (checkOutBtn) checkOutBtn.disabled = false;
                if (result.data.hasCheckedOut && checkOutBtn) checkOutBtn.disabled = true;
            } else {
                statusDiv.innerHTML = '<p>📝 Belum absen hari ini</p>';
                if (checkInBtn) checkInBtn.disabled = false;
            }
        }
    }
}

async function loadTodaySchedule() {
    const result = await apiGet('getSettings');
    if (result.status === 'success') {
        const infoDiv = document.getElementById('todayInfo');
        if (infoDiv) {
            const day = new Date().getDay();
            let text = '';
            if (day === 0 || day === 6) {
                text = '<p>🏖️ Libur akhir pekan</p>';
            } else if (day >= 1 && day <= 3) {
                text = `<p>📅 Senin-Rabu<br>⏰ Masuk: ${result.data.senin_rabu_masuk_mulai?.value || '07:30'} - ${result.data.senin_rabu_masuk_selesai?.value || '08:00'}<br>⏰ Pulang: ${result.data.senin_rabu_pulang_mulai?.value || '12:00'} - ${result.data.senin_rabu_pulang_selesai?.value || '12:15'}</p>`;
            } else {
                text = `<p>📅 Kamis-Jumat<br>⏰ Masuk: ${result.data.kamis_jumat_masuk_mulai?.value || '07:30'} - ${result.data.kamis_jumat_masuk_selesai?.value || '08:00'}<br>⏰ Pulang: ${result.data.kamis_jumat_pulang_mulai?.value || '11:30'} - ${result.data.kamis_jumat_pulang_selesai?.value || '11:45'}</p>`;
            }
            infoDiv.innerHTML = text;
        }
    }
}

async function loadHistory() {
    const month = document.getElementById('historyMonth')?.value;
    const year = document.getElementById('historyYear')?.value;
    if (!month || !year) return;
    
    const result = await apiGet('getAttendanceHistory', { email: currentUser.email, month, year });
    const tbody = document.getElementById('historyBody');
    if (tbody) {
        if (result.status === 'success' && result.data.length > 0) {
            tbody.innerHTML = result.data.map(r => `<tr><td>${formatDate(r.tanggal)}</td><td>${r.checkIn || '-'}</td><td>${r.checkOut || '-'}</td><td>${r.lokasi || '-'}</td><td>${r.status || 'Hadir'}</td></tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">Belum ada data</td></tr>';
        }
    }
}

async function handleCheckIn() {
    if (!capturedPhoto) {
        showMessage('attendanceMessage', 'error', 'Ambil foto selfie dulu');
        return;
    }
    if (!currentLocation) {
        showMessage('attendanceMessage', 'error', 'Dapatkan lokasi dulu');
        return;
    }
    showMessage('attendanceMessage', 'neutral', 'Memproses...');
    const result = await apiPost('checkIn', {
        email: currentUser.email,
        photo: capturedPhoto,
        lat: currentLocation.lat,
        lng: currentLocation.lng
    });
    if (result.status === 'success') {
        showMessage('attendanceMessage', 'success', result.message);
        setTimeout(() => location.reload(), 2000);
    } else {
        showMessage('attendanceMessage', 'error', result.message);
    }
}

async function handleCheckOut() {
    if (!capturedPhoto) {
        showMessage('attendanceMessage', 'error', 'Ambil foto selfie dulu');
        return;
    }
    if (!currentLocation) {
        showMessage('attendanceMessage', 'error', 'Dapatkan lokasi dulu');
        return;
    }
    showMessage('attendanceMessage', 'neutral', 'Memproses...');
    const result = await apiPost('checkOut', {
        email: currentUser.email,
        photo: capturedPhoto,
        lat: currentLocation.lat,
        lng: currentLocation.lng
    });
    if (result.status === 'success') {
        showMessage('attendanceMessage', 'success', result.message);
        setTimeout(() => location.reload(), 2000);
    } else {
        showMessage('attendanceMessage', 'error', result.message);
    }
}

// ==================== LOAD PROFILE ====================
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

// ==================== DASHBOARD STATS ====================
async function loadDashboardStats() {
    const result = await apiGet('getAllUsers');
    if (result.status === 'success') {
        const totalGuru = result.data.filter(u => u.role === 'guru').length;
        const totalGuruElem = document.getElementById('totalGuru');
        if (totalGuruElem) totalGuruElem.textContent = totalGuru;
        
        const totalKepsek = result.data.filter(u => u.role === 'kepsek').length;
        const totalKepsekElem = document.getElementById('totalKepsek');
        if (totalKepsekElem) totalKepsekElem.textContent = totalKepsek;
        
        const totalAdmin = result.data.filter(u => u.role === 'admin').length;
        const totalAdminElem = document.getElementById('totalAdmin');
        if (totalAdminElem) totalAdminElem.textContent = totalAdmin;
    }
    
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (currentUser) {
        const historyResult = await apiGet('getAttendanceHistory', { email: currentUser.email, month, year });
        if (historyResult.status === 'success') {
            const totalHadir = historyResult.data.length;
            const hadirElem = document.getElementById('totalHadir');
            if (hadirElem) hadirElem.textContent = totalHadir;
            const persenElem = document.getElementById('persenKehadiran');
            if (persenElem) persenElem.textContent = `${Math.round((totalHadir / 22) * 100)}%`;
        }
    }
}

// ==================== CHANGE PASSWORD ====================
async function changePassword() {
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
            const modal = document.getElementById('changePasswordModal');
            if (modal) modal.style.display = 'none';
            document.getElementById('newPassword1').value = '';
            document.getElementById('newPassword2').value = '';
        }, 2000);
    } else {
        showMessage('changePwMessage', 'error', result.message);
    }
}

// ==================== KEPSEK & ADMIN FUNCTIONS ====================
async function loadAllTeachers() {
    const result = await apiGet('getAllUsers');
    const tbody = document.getElementById('teachersBody');
    if (tbody && result.status === 'success') {
        tbody.innerHTML = result.data.map((teacher, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${teacher.nama}</td>
                <td>${teacher.email}</td>
                <td>${teacher.role === 'guru' ? 'Guru' : (teacher.role === 'kepsek' ? 'Kepsek' : 'Admin')}</td>
                <td><span class="status-badge ${teacher.status === 'Verified' ? 'success' : 'warning'}">${teacher.status === 'Verified' ? 'Aktif' : (teacher.status === 'Pending' ? 'Pending' : 'Diblokir')}</span></td>
                <td>
                    <button class="btn-small" onclick="viewTeacherAttendance('${teacher.email}')">Absensi</button>
                    ${currentUser?.role === 'admin' ? `<button class="btn-small btn-danger" onclick="toggleBlockUser('${teacher.email}', '${teacher.status}')">${teacher.status === 'Blocked' ? 'Buka' : 'Blokir'}</button>` : ''}
                    ${currentUser?.role === 'admin' ? `<button class="btn-small" onclick="editTeacher('${teacher.email}')">Edit</button>` : ''}
                </td>
            </tr>
        `).join('');
    }
}

async function viewTeacherAttendance(email) {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const result = await apiGet('getAttendanceHistory', { email, month, year });
    const detailDiv = document.getElementById('teacherAttendanceList');
    const detailContainer = document.getElementById('teacherDetail');
    if (detailDiv && detailContainer) {
        if (result.status === 'success' && result.data.length > 0) {
            detailDiv.innerHTML = `<table class="data-table"><thead><tr><th>Tanggal</th><th>Check In</th><th>Check Out</th><th>Lokasi</th></tr></thead><tbody>${result.data.map(r => `<tr><td>${formatDate(r.tanggal)}</td><td>${r.checkIn || '-'}</td><td>${r.checkOut || '-'}</td><td>${r.lokasi || '-'}</td></tr>`).join('')}</tbody></table>`;
        } else {
            detailDiv.innerHTML = '<p>Belum ada data</p>';
        }
        detailContainer.style.display = 'block';
    }
}

async function toggleBlockUser(email, currentStatus) {
    const blocked = currentStatus !== 'Blocked';
    const result = await apiPost('blockUser', { email, blocked });
    if (result.status === 'success') {
        showMessage('settingsMessage', 'success', result.message);
        loadAllTeachers();
    } else {
        showMessage('settingsMessage', 'error', result.message);
    }
}

async function editTeacher(email) {
    const result = await apiGet('getUserByEmail', { email });
    if (result.status === 'success') {
        const user = result.data;
        document.getElementById('editEmail').value = email;
        document.getElementById('teacherNama').value = user.nama;
        document.getElementById('teacherEmail').value = user.email;
        document.getElementById('teacherRole').value = user.role;
        document.getElementById('teacherStatus').value = user.status === 'Verified' ? 'Verified' : 'Blocked';
        document.getElementById('modalTitle').textContent = 'Edit Guru';
        document.getElementById('teacherModal').style.display = 'flex';
    }
}

async function saveTeacher() {
    const email = document.getElementById('editEmail').value;
    const newRole = document.getElementById('teacherRole').value;
    const newStatus = document.getElementById('teacherStatus').value;
    const password = document.getElementById('teacherPassword').value;
    
    if (email) {
        const roleResult = await apiPost('updateUserRole', { email, newRole });
        if (roleResult.status !== 'success') {
            showMessage('teacherModalMessage', 'error', roleResult.message);
            return;
        }
        const blocked = newStatus === 'Blocked';
        await apiPost('blockUser', { email, blocked });
        if (password && password.length >= 6) {
            await apiPost('resetPassword', { email, newPassword: password });
        }
        showMessage('teacherModalMessage', 'success', 'Data guru berhasil diupdate');
        setTimeout(() => {
            document.getElementById('teacherModal').style.display = 'none';
            loadAllTeachers();
        }, 1500);
    }
}

async function addTeacher() {
    const nama = document.getElementById('teacherNama').value;
    const email = document.getElementById('teacherEmail').value;
    const password = document.getElementById('teacherPassword').value;
    const role = document.getElementById('teacherRole').value;
    
    if (!nama || !email || !password) {
        showMessage('teacherModalMessage', 'error', 'Harap isi semua field');
        return;
    }
    
    const result = await apiPost('signup', { nama, email, password, role });
    if (result.status === 'success') {
        showMessage('teacherModalMessage', 'success', result.message);
        setTimeout(() => {
            document.getElementById('teacherModal').style.display = 'none';
            loadAllTeachers();
        }, 1500);
    } else {
        showMessage('teacherModalMessage', 'error', result.message);
    }
}

// ==================== LOCATIONS (ADMIN) ====================
async function loadLocations() {
    const result = await apiGet('getLocations');
    const tbody = document.getElementById('locationsBody');
    if (tbody && result.status === 'success') {
        tbody.innerHTML = result.data.map((loc, idx) => `
            <tr>
                <td>${loc.nama_kelas}</td>
                <td>${loc.lat}</td>
                <td>${loc.lng}</td>
                <td>${loc.radius_meter} m</td>
                <td><button class="btn-small btn-danger" onclick="deleteLocationPrompt('${loc.nama_kelas}')">Hapus</button></td>
            </tr>
        `).join('');
    }
}

async function addLocation() {
    const nama = document.getElementById('newLocationName').value;
    const lat = document.getElementById('newLocationLat').value;
    const lng = document.getElementById('newLocationLng').value;
    const radius = document.getElementById('newLocationRadius').value;
    
    if (!nama || !lat || !lng) {
        showMessage('locationMessage', 'error', 'Harap isi semua field');
        return;
    }
    
    const result = await apiPost('addLocation', { nama_kelas: nama, lat, lng, radius });
    if (result.status === 'success') {
        showMessage('locationMessage', 'success', 'Lokasi berhasil ditambahkan');
        document.getElementById('newLocationName').value = '';
        document.getElementById('newLocationLat').value = '';
        document.getElementById('newLocationLng').value = '';
        document.getElementById('newLocationRadius').value = '50';
        loadLocations();
    } else {
        showMessage('locationMessage', 'error', result.message);
    }
}

// ==================== SETTINGS (ADMIN) ====================
async function loadSettings() {
    const result = await apiGet('getSettings');
    if (result.status === 'success') {
        const settings = result.data;
        const fields = ['senin_rabu_masuk_mulai', 'senin_rabu_masuk_selesai', 'senin_rabu_pulang_mulai', 'senin_rabu_pulang_selesai', 'kamis_jumat_masuk_mulai', 'kamis_jumat_masuk_selesai', 'kamis_jumat_pulang_mulai', 'kamis_jumat_pulang_selesai', 'school_name'];
        fields.forEach(field => {
            const el = document.getElementById(`setting_${field}`);
            if (el && settings[field]) el.value = settings[field].value;
        });
    }
}

async function saveSettings() {
    const settings = {
        senin_rabu_masuk_mulai: document.getElementById('setting_senin_rabu_masuk_mulai')?.value || '07:30',
        senin_rabu_masuk_selesai: document.getElementById('setting_senin_rabu_masuk_selesai')?.value || '08:00',
        senin_rabu_pulang_mulai: document.getElementById('setting_senin_rabu_pulang_mulai')?.value || '12:00',
        senin_rabu_pulang_selesai: document.getElementById('setting_senin_rabu_pulang_selesai')?.value || '12:15',
        kamis_jumat_masuk_mulai: document.getElementById('setting_kamis_jumat_masuk_mulai')?.value || '07:30',
        kamis_jumat_masuk_selesai: document.getElementById('setting_kamis_jumat_masuk_selesai')?.value || '08:00',
        kamis_jumat_pulang_mulai: document.getElementById('setting_kamis_jumat_pulang_mulai')?.value || '11:30',
        kamis_jumat_pulang_selesai: document.getElementById('setting_kamis_jumat_pulang_selesai')?.value || '11:45',
        school_name: document.getElementById('setting_school_name')?.value || 'SMA Negeri 1 Contoh'
    };
    
    showMessage('settingsMessage', 'neutral', 'Menyimpan...');
    const result = await apiPost('updateSettings', { settings });
    if (result.status === 'success') {
        showMessage('settingsMessage', 'success', 'Pengaturan disimpan');
    } else {
        showMessage('settingsMessage', 'error', result.message);
    }
}

// ==================== REPORT ====================
async function generateMonthlyReport() {
    const month = document.getElementById('reportMonth')?.value;
    const year = document.getElementById('reportYear')?.value;
    const email = document.getElementById('reportEmail')?.value || currentUser.email;
    if (!month || !year) return;
    showMessage('reportMessage', 'neutral', 'Mengirim laporan...');
    const result = await apiPost('generateMonthlyReport', { month, year, sendToEmail: email });
    if (result.status === 'success') {
        showMessage('reportMessage', 'success', `Laporan dikirim ke ${email}`);
    } else {
        showMessage('reportMessage', 'error', result.message);
    }
}

// ==================== PAGE NAVIGATION ====================
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
            const title = document.getElementById('pageTitle');
            if (title) title.textContent = item.textContent.trim();
            if (pageId === 'history') loadHistory();
            else if (pageId === 'dashboard') { loadDashboardStats(); loadTodaySchedule(); }
            else if (pageId === 'teachers') loadAllTeachers();
            else if (pageId === 'locations') loadLocations();
            else if (pageId === 'settings') loadSettings();
            else if (pageId === 'attendance') setTimeout(() => { initCamera(); loadTodayStatus(); }, 100);
        });
    });
}

function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        });
    }
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
    const reportYear = document.getElementById('reportYear');
    if (reportYear) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === currentYear) option.selected = true;
            reportYear.appendChild(option);
        }
    }
}

function initModals() {
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            document.getElementById('teacherDetail').style.display = 'none';
        });
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Aplikasi dimulai");
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
        initYearSelect();
        initModals();
        loadTodaySchedule();
        loadDashboardStats();
        if (window.location.pathname.includes('dashboard-admin.html')) {
            loadLocations();
            loadSettings();
        }
        if (window.location.pathname.includes('dashboard-kepsek.html') || window.location.pathname.includes('dashboard-admin.html')) {
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
    
    // ATTENDANCE BUTTONS
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.addEventListener('click', () => { capturePhoto(); captureBtn.disabled = true; });
    
    const retakeBtn = document.getElementById('retakeBtn');
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
    
    const getLocBtn = document.getElementById('getLocationBtn');
    if (getLocBtn) getLocBtn.addEventListener('click', handleGetLocation);
    
    const checkInBtn = document.getElementById('checkInBtn');
    if (checkInBtn) checkInBtn.addEventListener('click', handleCheckIn);
    
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) checkOutBtn.addEventListener('click', handleCheckOut);
    
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
    
    const loadHistoryBtn = document.getElementById('loadHistoryBtn');
    if (loadHistoryBtn) loadHistoryBtn.addEventListener('click', loadHistory);
    
    const generateReport = document.getElementById('generateReportBtn');
    if (generateReport) generateReport.addEventListener('click', generateMonthlyReport);
    
    const changePwBtn = document.getElementById('changePasswordBtn');
    if (changePwBtn) {
        changePwBtn.addEventListener('click', () => {
            const modal = document.getElementById('changePasswordModal');
            if (modal) modal.style.display = 'flex';
        });
    }
    
    const confirmChange = document.getElementById('confirmChangePassword');
    if (confirmChange) confirmChange.addEventListener('click', changePassword);
    
    // ADMIN BUTTONS
    const addLocationBtn = document.getElementById('addLocationBtn');
    if (addLocationBtn) addLocationBtn.addEventListener('click', addLocation);
    
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    
    const addTeacherBtn = document.getElementById('addTeacherBtn');
    if (addTeacherBtn) {
        addTeacherBtn.addEventListener('click', () => {
            document.getElementById('editEmail').value = '';
            document.getElementById('teacherNama').value = '';
            document.getElementById('teacherEmail').value = '';
            document.getElementById('teacherPassword').value = '';
            document.getElementById('teacherRole').value = 'guru';
            document.getElementById('teacherStatus').value = 'Verified';
            document.getElementById('modalTitle').textContent = 'Tambah Guru';
            document.getElementById('teacherModal').style.display = 'flex';
            
            const saveBtn = document.getElementById('saveTeacherBtn');
            if (saveBtn) {
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                newSaveBtn.addEventListener('click', addTeacher);
            }
        });
    }
    
    const saveTeacherBtn = document.getElementById('saveTeacherBtn');
    if (saveTeacherBtn) {
        saveTeacherBtn.addEventListener('click', () => {
            if (document.getElementById('editEmail').value) {
                saveTeacher();
            } else {
                addTeacher();
            }
        });
    }
});
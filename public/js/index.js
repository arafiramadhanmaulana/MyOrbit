// Logic Login untuk Desktop
const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

form?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = document.getElementById('code').value.trim();
    errorMsg.textContent = '';

    try {
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: code })
    });

    const data = await res.json();
    if (!res.ok) {
        errorMsg.textContent = data.msg || 'Kode salah';
        return;
    }

    sessionStorage.setItem('referralData', JSON.stringify(data));
    window.location.href = 'dashboard.html';
    } catch (err) {
    errorMsg.textContent = 'Gagal koneksi ke server.';
    }
});

// Logic Login untuk Mobile
const mobileForm = document.getElementById('mobileLoginForm');
const mobileError = document.getElementById('mobileError');

mobileForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = document.getElementById('mobileCode').value.trim();
    mobileError.textContent = '';

    try {
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: code })
    });

    const data = await res.json();
    if (!res.ok) {
        mobileError.textContent = data.msg || 'Kode salah';
        return;
    }

    sessionStorage.setItem('referralData', JSON.stringify(data));
    window.location.href = 'dashboard.html';
    } catch (err) {
    mobileError.textContent = 'Gagal koneksi ke server.';
    }
});

// Toggle Password (Desktop)
const togglePassword = document.getElementById('togglePassword');
const codeInput = document.getElementById('code');
const eyeIcon = document.getElementById('eyeIcon');
let isVisible = false;

togglePassword?.addEventListener('click', () => {
    isVisible = !isVisible;
    codeInput.type = isVisible ? 'text' : 'password';

    eyeIcon.innerHTML = isVisible
    ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.955 
        9.955 0 012.442-4.362M9.88 9.88a3 3 0 104.243 4.243M6.1 
        6.1l11.8 11.8" />`
    : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 
        8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 
        7-4.477 0-8.268-2.943-9.542-7z" />`;
});
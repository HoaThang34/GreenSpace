(function () {
  // Helper rút gọn cho query selection
  const $ = s => document.querySelector(s);

  // Các node form và điều khiển
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');
  const showLoginBtn = $('#showLogin');
  const showRegisterBtn = $('#showRegister');
  const authMessage = $('#authMessage');
  const adminShortcut = $('#adminShortcut');

  // Chuyển đổi: hiện Đăng nhập, ẩn Đăng ký
  showLoginBtn.onclick = () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    showLoginBtn.classList.add('active');
    showRegisterBtn.classList.remove('active');
    authMessage.textContent = '';
  };

  // Chuyển đổi: hiện Đăng ký, ẩn Đăng nhập
  showRegisterBtn.onclick = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    showLoginBtn.classList.remove('active');
    showRegisterBtn.classList.add('active');
    authMessage.textContent = '';
  };

  // --- Luồng Đăng nhập ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMessage.textContent = 'Đang kiểm tra...';
    const username = $('#loginUser').value;
    const password = $('#loginPass').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = '/chat';
      } else {
        authMessage.textContent = 'Tên đăng nhập hoặc mật khẩu không hợp lệ.';
      }
    } catch (error) {
      authMessage.textContent = 'Không thể kết nối đến máy chủ.';
    }
  });

  // --- Luồng Đăng ký ---
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMessage.textContent = 'Đang tạo tài khoản...';
    const displayName = $('#regDisplayName').value;
    const username = $('#regUser').value;
    const password = $('#regPass').value;
    const confirmPassword = $('#regPassConfirm').value;

    if (!displayName || !username || !password) {
      authMessage.textContent = 'Vui lòng điền đầy đủ các trường.';
      return;
    }

    if (password !== confirmPassword) {
      authMessage.textContent = 'Mật khẩu không khớp.';
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password }),
      });

      const data = await res.json();
      if (res.ok) {
        authMessage.textContent = 'Tạo tài khoản thành công! Vui lòng đăng nhập.';
        showLoginBtn.click();
      } else {
        authMessage.textContent = data.error || 'Đăng ký thất bại.';
      }
    } catch (error) {
      authMessage.textContent = 'Không thể kết nối đến máy chủ.';
    }
  });

  // --- Lối tắt Admin ẩn ---
  let adminClickCount = 0;
  let adminClickTimer = null;
  adminShortcut.addEventListener('click', () => {
    adminClickCount++;

    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => {
      adminClickCount = 0;
    }, 1500);

    if (adminClickCount >= 5) {
      window.location.href = '/admin';
    }
  });
})();
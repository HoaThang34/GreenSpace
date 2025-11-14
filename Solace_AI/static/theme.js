(function () {
  // Chuyển đổi và lưu trữ theme. Thẻ <html> sẽ có class 'light' cho chế độ sáng.
  const themeToggle = document.getElementById('themeToggle');

  const applyTheme = (theme) => {
    document.documentElement.classList.toggle('light', theme === 'light');
    if (themeToggle) {
      // Cập nhật văn bản của nút
      themeToggle.textContent = theme === 'light' ? 'Chế độ sáng' : 'Chế độ tối';
    }
    localStorage.setItem('aseed_theme', theme);
  };

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
      applyTheme(next);
    });
  }

  // Khởi tạo với lựa chọn đã lưu (mặc định: tối)
  applyTheme(localStorage.getItem('aseed_theme') || 'dark');
})();
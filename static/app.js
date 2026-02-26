(function () {
  function setAppHeight() {
    const vh = window.innerHeight;
    document.body.style.setProperty('height', `${vh}px`, 'important');
  }
  window.addEventListener('load', setAppHeight);
  window.addEventListener('resize', setAppHeight);

  const $ = (s) => document.querySelector(s);

  const emergencyBtn = $("#emergencyBtn");
  const emergencyModal = $("#emergencyModal");
  const emergencyCloseBtn = $("#emergencyCloseBtn");
  const chat = $("#chat");
  const inp = $("#inp");
  const sendBtn = $("#send");
  const intro = $("#intro");
  const startBtn = $("#start");
  const newChatBtn = $("#newChatBtn");
  const historyBtn = $("#historyBtn");
  const histModal = $("#histModal");
  const histList = $("#histList");
  const histSearch = $("#histSearch");
  const histClose = $("#histClose");
  const statsBtn = $("#statsBtn");
  const statsModal = $("#statsModal");
  const statsClose = $("#statsClose");
  const emotionChartCanvas = $("#emotionChart");
  const userChip = $("#userChip");
  const dropdownMenu = $("#dropdownMenu");
  const logoutBtn = $("#logoutBtn");
  const changePasswordBtn = $("#changePasswordBtn");
  const changePasswordModal = $("#changePasswordModal");
  const changePasswordForm = $("#changePasswordForm");
  const changePassClose = $("#changePassClose");
  const changePassMessage = $("#changePassMessage");
  const micBtn = $("#micBtn");

  // =========================
  // Cấu Hình & Dịch Thuật
  // =========================
  const MOOD_CHART_COLORS = {
    joy: "rgba(34, 197, 94, 0.8)", sadness: "rgba(96, 165, 250, 0.8)",
    anger: "rgba(239, 68, 68, 0.8)", fear: "rgba(20, 184, 166, 0.8)",
    disgust: "rgba(132, 204, 22, 0.8)", surprise: "rgba(168, 85, 247, 0.8)",
    neutral: "rgba(148, 163, 184, 0.8)",
  };

  // Đối tượng dịch thuật cảm xúc
  const EMOTION_TRANSLATIONS = {
    joy: "Vui vẻ", sadness: "Buồn bã", anger: "Tức giận",
    fear: "Sợ hãi", disgust: "Chán ghét", surprise: "Ngạc nhiên",
    neutral: "Trung lập",
  };

  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // trang thai
  let logs = [];
  let typing = null;
  let sessionEmotions = [];
  let currentMood = 'neutral';
  let SID = localStorage.getItem("aseed_sid") || String(Date.now());
  localStorage.setItem("aseed_sid", SID);
  let emotionChartInstance = null;
  const moodOrb = $("#moodOrb");

  // =========================
  // Điều Khiển Cảm Xúc & Theme
  // =========================
  function setMood(mood) {
    const newMood = mood || 'neutral';
    if (newMood === currentMood) return;
    const body = document.body;
    if (currentMood) {
      body.classList.remove(`mood-${currentMood}`);
    }
    body.classList.add(`mood-${newMood}`);
    currentMood = newMood;
    if (moodOrb) {
      moodOrb.style.backgroundColor = `var(--mood)`;
    }
  }
  // ===================================
  // (MỚI) Logic Nhập Liệu Bằng Giọng Nói
  // ===================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;

  // Chỉ khởi tạo nếu trình duyệt hỗ trợ
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; // Thiết lập ngôn ngữ Tiếng Việt
    recognition.continuous = false; // Chỉ ghi âm một câu rồi dừng
    recognition.interimResults = false; // Chỉ trả về kết quả cuối cùng

    let isListening = false;

    micBtn.onclick = () => {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    };

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micBtn.title = "Đang lắng nghe... Nhấn để dừng.";
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      micBtn.title = "Nhập bằng giọng nói";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Thêm nội dung vào cuối, có dấu cách nếu cần
      inp.value += (inp.value.length > 0 ? ' ' : '') + transcript;
      // Kích hoạt sự kiện input để textarea tự động co giãn
      inp.dispatchEvent(new Event('input'));
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        alert('Bạn đã chặn quyền truy cập vào micro. Vui lòng cho phép trong cài đặt trình duyệt.');
      } else if (event.error === 'no-speech') {
        // Không nói gì, không cần thông báo
      } else {
        alert(`Lỗi nhận dạng giọng nói: ${event.error}`);
      }
    };

  } else {
    // Nếu trình duyệt không hỗ trợ, ẩn nút micro đi
    if (micBtn) micBtn.style.display = 'none';
    console.log("Trình duyệt này không hỗ trợ Web Speech API.");
  }

  // =========================
  // Chức Năng Chat Cốt Lõi
  // =========================
  function autoscroll() {
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
  }

  function push(role, text, emotion = null) {
    const group = document.createElement("div");
    group.className = `group ${role} fx-reveal`;

    if (role === 'assistant') {
      const avatar = document.createElement("div");
      avatar.className = "ai-avatar";
      avatar.textContent = "🌱";
      group.appendChild(avatar);
    }

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    const msg = document.createElement("div");
    msg.className = `msg ${role === "user" ? "me" : "ai"}`;
    msg.innerHTML = window.DOMPurify ? DOMPurify.sanitize(marked.parse(text)) : text;
    messageContent.appendChild(msg);

    if (emotion && role === 'assistant') {
      const emotionTag = document.createElement("div");
      emotionTag.className = "emotion-tag";
      // (ĐÃ CẬP NHẬT) Sử dụng bản dịch
      emotionTag.textContent = EMOTION_TRANSLATIONS[emotion] || emotion;
      messageContent.appendChild(emotionTag);
    }

    group.appendChild(messageContent);
    chat.appendChild(group);

    setTimeout(() => group.classList.add('is-visible'), 10);
    autoscroll();
    return messageContent;
  }

  function typeMessage(text, emotion) {
    hideTyping();
    const messageContent = push('assistant', '', null);
    const msgElement = messageContent.querySelector('.msg.ai');

    let i = 0;
    const typingSpeed = 5;

    const type = () => {
      if (i < text.length) {
        msgElement.innerHTML = DOMPurify.sanitize(marked.parse(text.substring(0, i + 1) + "▌"));
        i++;
        autoscroll();
        setTimeout(type, typingSpeed);
      } else {
        msgElement.innerHTML = DOMPurify.sanitize(marked.parse(text));
        const emotionTag = document.createElement("div");
        emotionTag.className = "emotion-tag fx-reveal is-visible";
        emotionTag.textContent = EMOTION_TRANSLATIONS[emotion] || emotion;
        messageContent.appendChild(emotionTag);

        logs.push({ role: 'assistant', text, emotion });
        autoSaveDebounced();
        autoscroll();
      }
    };
    type();
  }

  function showTyping() {
    if (typing) return;
    typing = document.createElement("div");
    typing.className = "group assistant";
    typing.innerHTML = `<div class="ai-avatar">🌱</div><div class="msg ai dots"><i></i><i></i><i></i></div>`;
    chat.appendChild(typing);
    autoscroll();
  }
  function hideTyping() {
    if (typing) {
      typing.remove();
      typing = null;
    }
  }
  async function send() {
    const m = inp.value.trim();
    if (!m) return;
    logs.push({ role: 'user', text: m, emotion: null });
    push("user", m, null);
    inp.value = "";
    inp.style.height = 'auto';
    showTyping();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m, history: logs.slice(-13) }),
      });
      if (!res.ok) throw new Error(`Lỗi HTTP! trạng thái: ${res.status}`);
      const data = await res.json();
      if (data.error) {
        hideTyping();
        typeMessage(`Lỗi: ${data.error}`, 'sadness');
        return;
      }
      const emotion = data.emotion || "neutral";
      sessionEmotions.push(emotion);
      setMood(emotion);
      typeMessage(data.reply || "...", emotion);
    } catch (e) {
      hideTyping();
      typeMessage("Mình đang gặp sự cố kết nối. Vui lòng thử lại trong giây lát.", 'sadness');
    }
  }

  // =========================
  // Thống Kê Cảm Xúc (Chart.js)
  // =========================
  function renderEmotionChart() {
    const counts = sessionEmotions.reduce((acc, emo) => { acc[emo] = (acc[emo] || 0) + 1; return acc; }, {});
    const labels = Object.keys(counts);
    // (ĐÃ CẬP NHẬT) Dịch các nhãn cho biểu đồ
    const translatedLabels = labels.map(label => EMOTION_TRANSLATIONS[label] || label);
    const data = Object.values(counts);
    const backgroundColors = labels.map(label => MOOD_CHART_COLORS[label] || '#cccccc');

    const isLightTheme = document.documentElement.classList.contains('light');
    const textColor = isLightTheme ? '#334155' : '#e2e8f0';

    if (emotionChartInstance) emotionChartInstance.destroy();

    emotionChartInstance = new Chart(emotionChartCanvas, {
      type: 'doughnut',
      data: {
        // Sử dụng nhãn đã dịch
        labels: translatedLabels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: isLightTheme ? '#ffffff' : '#1e293b',
          borderWidth: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 14, family: 'Inter' }, padding: 20 }
          }
        },
        layout: { padding: 20 }
      }
    });
  }

  // Sự kiện giao diện, Phiên & Lịch sử, Tải lần đầu, Logic menu di động, Logic đổi mật khẩu...
  sendBtn.onclick = send;
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = (inp.scrollHeight) + 'px'; });
  newChatBtn.onclick = () => { if (confirm("Bạn có chắc muốn bắt đầu cuộc trò chuyện mới không? Cuộc trò chuyện hiện tại sẽ được lưu lại.")) { logs = []; sessionEmotions = []; chat.innerHTML = ""; SID = String(Date.now()); localStorage.setItem("aseed_sid", SID); setMood('neutral'); typeMessage(window.GREETING, 'neutral'); } };
  userChip.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
  window.addEventListener('click', (e) => { if (!userChip.contains(e.target) && !dropdownMenu.contains(e.target)) { dropdownMenu.classList.remove('show'); } });
  let saveTimer = null;
  function autoSaveDebounced() { clearTimeout(saveTimer); saveTimer = setTimeout(autoSave, 1000); }
  async function autoSave() { await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: SID, chat: logs }), }); }
  historyBtn.onclick = async () => { const res = await fetch("/api/sessions"); const arr = await res.json(); renderHist(arr); histModal.classList.add("show"); };
  histClose.onclick = () => histModal.classList.remove("show");
  function renderHist(arr) { histList.innerHTML = ""; const q = (histSearch.value || "").toLowerCase(); arr.filter(x => (x.title || "").toLowerCase().includes(q)).forEach(it => { const row = document.createElement("div"); row.className = "histitem"; row.innerHTML = `<div><div class="title">${it.title}</div><div class="meta">${new Date(it.updated * 1000).toLocaleString('vi-VN')}</div></div>`; row.onclick = async () => { const r = await fetch("/api/load?sid=" + it.sid); const data = await r.json(); if (data.chat) { logs = data.chat; sessionEmotions = data.chat.filter(m => m.role === 'assistant' && m.emotion).map(m => m.emotion); chat.innerHTML = ""; logs.forEach(m => push(m.role, m.text, m.emotion)); SID = data.sid; localStorage.setItem("aseed_sid", SID); const lastMood = sessionEmotions.length > 0 ? sessionEmotions[sessionEmotions.length - 1] : 'neutral'; setMood(lastMood); histModal.classList.remove("show"); } }; histList.appendChild(row); }); }
  histSearch.oninput = () => historyBtn.onclick();
  statsBtn.onclick = () => { renderEmotionChart(); statsModal.classList.add("show"); };
  statsClose.onclick = () => statsModal.classList.remove("show");
  startBtn.onclick = () => { intro.classList.remove("show"); typeMessage(window.GREETING, 'neutral'); };
  logoutBtn.onclick = async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; };
  window.IS_GUEST = false;
  fetch('/api/session-check').then(r => r.json()).then(data => {
    if (!data.logged_in) {
      window.location.href = '/login';
    } else if (data.is_guest) {
      window.IS_GUEST = true;
      // Ẩn các tính năng không dành cho khách
      if (historyBtn) historyBtn.style.display = 'none';
      if (statsBtn) statsBtn.style.display = 'none'; // Thống kê phiên có thể giữ lại, nhưng thường khách không cần

      const myProfileBtn = $("#myProfileBtn");
      const friendsMenuLink = $("#friendsMenuLink");
      const messagesMenuLink = $("#messagesMenuLink");
      const changePasswordBtn = $("#changePasswordBtn");
      const tourCommunity = $("#tour-community");

      if (myProfileBtn) myProfileBtn.style.display = 'none';
      if (friendsMenuLink) friendsMenuLink.style.display = 'none';
      if (messagesMenuLink) messagesMenuLink.style.display = 'none';
      if (changePasswordBtn) changePasswordBtn.style.display = 'none';
      if (tourCommunity) tourCommunity.style.display = 'none';

      // Đổi chữ Logout thành Thoát
      if (logoutBtn) {
        const logoutText = logoutBtn.querySelector('span') || logoutBtn;
        logoutBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Thoát chế độ ẩn danh
          `;
      }
    }
  });

  // ============================================
  // === Thông báo tin nhắn mới ===
  // ============================================
  const unreadBadge = $("#unreadBadge");
  async function updateUnreadCount() {
    if (window.IS_GUEST) return;
    try {
      const res = await fetch('/api/messages/unread-count');
      const data = await res.json();
      if (data.unread_count > 0) {
        unreadBadge.style.display = 'inline-flex';
        unreadBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
      } else {
        unreadBadge.style.display = 'none';
      }
    } catch (error) {
      // Ignore errors
    }
  }

  // Cập nhật số lượng tin nhắn chưa đọc mỗi 5 giây
  if (unreadBadge) {
    updateUnreadCount();
    setInterval(updateUnreadCount, 5000);
  }

  // Cập nhật badge trong menu dropdown
  const unreadBadgeMenu = $("#unreadBadgeMenu");
  if (unreadBadgeMenu) {
    async function updateUnreadCountMenu() {
      if (window.IS_GUEST) return;
      try {
        const res = await fetch('/api/messages/unread-count');
        const data = await res.json();
        if (data.unread_count > 0) {
          unreadBadgeMenu.style.display = 'inline-flex';
          unreadBadgeMenu.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
        } else {
          unreadBadgeMenu.style.display = 'none';
        }
      } catch (error) {
        // Ignore errors
      }
    }
    updateUnreadCountMenu();
    setInterval(updateUnreadCountMenu, 5000);
  }
  const mobileMenuBtn = $("#mobileMenuBtn"); const controlsContainer = $("#controlsContainer");
  if (mobileMenuBtn && controlsContainer) { mobileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); controlsContainer.classList.toggle('menu-open'); }); userChip.addEventListener('click', (e) => { if (window.innerWidth <= 768) { e.stopPropagation(); userChip.classList.toggle('active'); } }); }
  window.addEventListener('click', (e) => { if (controlsContainer && controlsContainer.classList.contains('menu-open')) { if (!controlsContainer.contains(e.target) && !mobileMenuBtn.contains(e.target)) { controlsContainer.classList.remove('menu-open'); userChip.classList.remove('active'); } } });
  if (changePasswordBtn) { changePasswordBtn.onclick = () => { changePasswordForm.reset(); changePassMessage.textContent = ''; changePasswordModal.classList.add('show'); dropdownMenu.classList.remove('show'); }; changePassClose.onclick = () => changePasswordModal.classList.remove('show'); changePasswordForm.addEventListener('submit', async (e) => { e.preventDefault(); changePassMessage.textContent = 'Đang xử lý...'; const old_password = $("#oldPass").value; const new_password = $("#newPass").value; const confirm_password = $("#newPassConfirm").value; if (new_password !== confirm_password) { changePassMessage.textContent = 'Mật khẩu mới không khớp.'; return; } try { const res = await fetch('/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_password, new_password, confirm_password }), }); const data = await res.json(); if (res.ok) { changePassMessage.textContent = data.message; changePasswordForm.reset(); setTimeout(() => { changePasswordModal.classList.remove('show'); }, 2000); } else { changePassMessage.textContent = data.error || 'Đã có lỗi xảy ra.'; } } catch (error) { changePassMessage.textContent = 'Không thể kết nối đến máy chủ.'; } }); }
  // ===================================
  // Logic Hỗ Trợ Khẩn Cấp
  // ===================================
  if (emergencyBtn && emergencyModal && emergencyCloseBtn) {
    // Mở modal khi nhấn nút
    emergencyBtn.onclick = () => {
      emergencyModal.classList.add('show');
    };

    // Đóng modal khi nhấn nút "Đóng"
    emergencyCloseBtn.onclick = () => {
      emergencyModal.classList.remove('show');
    };

    // Đóng modal khi nhấn ra ngoài vùng panel
    emergencyModal.addEventListener('click', (e) => {
      if (e.target === emergencyModal) {
        emergencyModal.classList.remove('show');
      }
    });
  }
  setMood('neutral');
})();
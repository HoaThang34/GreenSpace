// File: static/global_chat.js
(function () {
  const $ = s => document.querySelector(s);
  const messagesContainer = $('#messagesContainer');
  const messageForm = $('#messageForm');
  const messageInput = $('#messageInput');
  const sendBtn = $('#sendMessageBtn');

  let currentUserId = null;
  
  async function loadMessages() {
    if (!currentUserId) {
      try {
        const sessionRes = await fetch('/api/session-check');
        const sessionData = await sessionRes.json();
        if (sessionData.logged_in) {
          currentUserId = sessionData.user_id;
        } else {
          window.location.href = '/login'; return;
        }
      } catch (e) { return; }
    }
    
    try {
      // THAY ĐỔI: Gọi API của global chat
      const res = await fetch(`/api/messages/global`);
      const messages = await res.json();
      
      messagesContainer.innerHTML = '';
      
      messages.forEach(msg => {
        const isSent = msg.sender_id === currentUserId;
        const time = new Date(msg.timestamp * 1000);
        const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

        // THAY ĐỔI: Hiển thị tên và avatar của người gửi
        if (isSent) {
          messageDiv.innerHTML = `
            <div class="message-content">
              ${msg.content}
              <div class="message-time">${timeStr}</div>
            </div>
          `;
        } else {
          messageDiv.innerHTML = `
            <div class="sender-avatar" style="background:${msg.avatar_color};">${msg.sender_name[0].toUpperCase()}</div>
            <div class="message-content">
              <div class="sender-name">${msg.sender_name}</div>
              ${msg.content}
              <div class="message-time">${timeStr}</div>
            </div>
          `;
        }
        messagesContainer.appendChild(messageDiv);
      });
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) { console.error('Lỗi tải tin nhắn global:', error); }
  }

  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    
    sendBtn.disabled = true;
    sendBtn.textContent = 'Đang gửi...';
    
    try {
      // THAY ĐỔI: Gửi tin nhắn đến receiver_id của global chat
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: GLOBAL_CHAT_ID, // Gửi tới ID 0
          content: content,
        })
      });
      
      const data = await res.json();
      if (data.ok) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
        loadMessages();
      } else { alert(data.error || 'Lỗi khi gửi tin nhắn'); }
    } catch (error) { alert('Lỗi kết nối'); } 
    finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Gửi';
    }
  });

  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  });

  setInterval(loadMessages, 2000); // Tự động làm mới
  loadMessages(); // Tải lần đầu
})();
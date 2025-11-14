/**
 * ============================================
 * === CHAT PAGE - Chat với một user ===
 * ============================================
 */

(function () {
  const $ = s => document.querySelector(s);
  const messagesContainer = $('#messagesContainer');
  const messageForm = $('#messageForm');
  const messageInput = $('#messageInput');
  const sendBtn = $('#sendMessageBtn');

  // ============================================
  // === Load Messages ===
  // ============================================
  let currentUserId = null;
  
  async function loadMessages() {
    try {
      // Lấy user_id nếu chưa có
      if (!currentUserId) {
        const sessionRes = await fetch('/api/session-check');
        const sessionData = await sessionRes.json();
        if (sessionData.user_id) {
          currentUserId = sessionData.user_id;
        }
      }
      
      const res = await fetch(`/api/messages/${OTHER_USER_ID}`);
      const messages = await res.json();
      
      messagesContainer.innerHTML = '';
      
      messages.forEach(msg => {
        // So sánh sender_id với user_id hiện tại
        const isSent = msg.sender_id === currentUserId;
        const time = new Date(msg.timestamp * 1000);
        const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
          <div class="message-content">
            ${msg.content}
            <div class="message-time">${timeStr}</div>
          </div>
        `;
        messagesContainer.appendChild(messageDiv);
      });
      
      // Cuộn xuống cuối
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
    } catch (error) {
      console.error('Lỗi tải tin nhắn:', error);
    }
  }

  // ============================================
  // === Send Message ===
  // ============================================
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = messageInput.value.trim();
    if (!content) return;
    
    // Disable button
    sendBtn.disabled = true;
    sendBtn.textContent = 'Đang gửi...';
    
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: OTHER_USER_ID,
          content: content,
          message_type: 'text'
        })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
        loadMessages(); // Reload messages
      } else {
        alert(data.error || 'Lỗi khi gửi tin nhắn');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Gửi';
    }
  });

  // ============================================
  // === Auto Resize Textarea ===
  // ============================================
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  });

  // ============================================
  // === Auto Refresh Messages ===
  // ============================================
  // Tự động làm mới tin nhắn mỗi 2 giây
  setInterval(loadMessages, 2000);

  // ============================================
  // === Khởi tạo ===
  // ============================================
  // Lấy user_id từ session và load messages
  fetch('/api/session-check')
    .then(r => r.json())
    .then(data => {
      if (data.logged_in && data.user_id) {
        currentUserId = data.user_id;
        loadMessages();
      } else {
        window.location.href = '/login';
      }
    });
})();


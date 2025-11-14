/**
 * ============================================
 * === MESSAGES PAGE - Danh sách cuộc trò chuyện ===
 * ============================================
 */

(function () {
  const $ = s => document.querySelector(s);

  // ============================================
  // === Load Conversations ===
  // ============================================
  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      const conversations = await res.json();
      
      const conversationsList = $('#conversationsList');
      
      // TẠO HTML TĨNH CHO GLOBAL CHAT
      let globalChatHTML = `
        <a href="/messages/global" class="conversation-item">
          <div class="conversation-avatar" style="background: var(--mood-joy);">🌐</div>
          <div class="conversation-info">
            <div class="conversation-name">Nhóm Chat Chung</div>
            <div class="conversation-preview">Nơi mọi người cùng trò chuyện...</div>
          </div>
        </a>
      `;

      if (conversations.length === 0) {
        conversationsList.innerHTML = globalChatHTML + `
          <div class="empty-state" style="padding-top: 20px;">
            <i class="fas fa-comments"></i>
            <p>Chưa có cuộc trò chuyện riêng nào</p>
          </div>
        `;
        return;
      }
      
      let privateChatsHTML = conversations.map(conv => {
        // ... (giữ nguyên logic render tin nhắn riêng)
        const time = new Date(conv.last_message_time * 1000);
        const timeStr = time.toLocaleDateString('vi-VN') === new Date().toLocaleDateString('vi-VN')
          ? time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : time.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
        
        return `
          <a href="/messages/${conv.other_user_id}" class="conversation-item">
            <div class="conversation-avatar" style="background: ${conv.avatar_color};">
              ${conv.display_name[0].toUpperCase()}
            </div>
            <div class="conversation-info">
              <div class="conversation-name">${conv.display_name}</div>
              <div class="conversation-preview">${conv.last_message || 'Chưa có tin nhắn'}</div>
            </div>
            <div class="conversation-meta">
              <div class="conversation-time">${timeStr}</div>
              ${conv.unread_count > 0 ? `<div class="unread-badge">${conv.unread_count}</div>` : ''}
            </div>
          </a>
        `;
      }).join('');
      
      // GHÉP GLOBAL CHAT VÀO ĐẦU DANH SÁCH
      conversationsList.innerHTML = globalChatHTML + privateChatsHTML;
      
    } catch (error) {
      console.error('Lỗi tải cuộc trò chuyện:', error);
      $('#conversationsList').innerHTML = '<div class="empty-state">Lỗi tải danh sách cuộc trò chuyện.</div>';
    }
  }


  // ============================================
  // === Auto Refresh ===
  // ============================================
  // Tự động làm mới danh sách mỗi 5 giây
  setInterval(loadConversations, 5000);

  // ============================================
  // === Khởi tạo ===
  // ============================================
  loadConversations();
})();


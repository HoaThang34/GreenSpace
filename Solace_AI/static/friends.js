/**
 * ============================================
 * === FRIENDS PAGE - Quản lý bạn bè ===
 * ============================================
 */

(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ============================================
  // === Tab Navigation ===
  // ============================================
  const tabs = $$('.tab');
  const tabContents = $$('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Cập nhật active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Hiển thị tab content tương ứng
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === targetTab + 'Tab') {
          content.classList.add('active');
        }
      });
      
      // Tải dữ liệu cho tab
      if (targetTab === 'friends') loadFriends();
      else if (targetTab === 'requests') loadRequests();
      else if (targetTab === 'suggestions') loadSuggestions();
    });
  });

  // ============================================
  // === Load Friends ===
  // ============================================
  async function loadFriends() {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      
      const friendsList = $('#friendsList');
      
      if (data.friends.length === 0) {
        friendsList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-friends"></i>
            <p>Bạn chưa có bạn bè nào. Hãy gửi lời mời kết bạn!</p>
          </div>
        `;
        return;
      }
      
      friendsList.innerHTML = data.friends.map(friend => `
        <div class="friend-card">
          <div class="friend-avatar" style="background: ${friend.avatar_color};">
            ${friend.display_name[0].toUpperCase()}
          </div>
          <div class="friend-info">
            <div class="friend-name">${friend.display_name}</div>
            <div class="friend-meta">@${friend.username}</div>
          </div>
          <div class="friend-actions">
            <a href="/messages/${friend.friend_id}" class="btn btn-small">💬 Nhắn tin</a>
            <a href="/profile/${friend.username}" class="btn btn-small">👁️ Xem hồ sơ</a>
            <button class="btn btn-small" onclick="removeFriend(${friend.friend_id})" style="background: var(--mood-anger);">
              ❌ Hủy kết bạn
            </button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Lỗi tải danh sách bạn bè:', error);
      $('#friendsList').innerHTML = '<div class="empty-state">Lỗi tải danh sách bạn bè.</div>';
    }
  }

  // ============================================
  // === Load Requests ===
  // ============================================
  async function loadRequests() {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      
      // Cập nhật số lượng lời mời
      $('#requestCount').textContent = data.received_requests.length;
      
      // Lời mời đã nhận
      const receivedList = $('#receivedRequestsList');
      if (data.received_requests.length === 0) {
        receivedList.innerHTML = '<div class="empty-state"><p>Không có lời mời nào</p></div>';
      } else {
        receivedList.innerHTML = data.received_requests.map(req => `
          <div class="request-card">
            <div class="friend-avatar" style="background: ${req.avatar_color};">
              ${req.display_name[0].toUpperCase()}
            </div>
            <div class="friend-info">
              <div class="friend-name">${req.display_name}</div>
              <div class="friend-meta">@${req.username}</div>
            </div>
            <div class="friend-actions">
              <button class="btn btn-small" onclick="acceptRequest(${req.id})" style="background: var(--mood-joy);">
                ✓ Chấp nhận
              </button>
              <button class="btn btn-small" onclick="rejectRequest(${req.id})" style="background: var(--mood-anger);">
                ✗ Từ chối
              </button>
            </div>
          </div>
        `).join('');
      }
      
      // Lời mời đã gửi
      const sentList = $('#sentRequestsList');
      if (data.sent_requests.length === 0) {
        sentList.innerHTML = '<div class="empty-state"><p>Chưa gửi lời mời nào</p></div>';
      } else {
        sentList.innerHTML = data.sent_requests.map(req => `
          <div class="request-card">
            <div class="friend-avatar" style="background: ${req.avatar_color};">
              ${req.display_name[0].toUpperCase()}
            </div>
            <div class="friend-info">
              <div class="friend-name">${req.display_name}</div>
              <div class="friend-meta">@${req.username} • Đang chờ phản hồi</div>
            </div>
            <div class="friend-actions">
              <button class="btn btn-small" onclick="cancelRequest(${req.friend_id})" style="background: var(--mood-anger);">
                ✗ Hủy lời mời
              </button>
            </div>
          </div>
        `).join('');
      }
      
    } catch (error) {
      console.error('Lỗi tải lời mời:', error);
    }
  }

  // ============================================
  // === Load Suggestions ===
  // ============================================
  async function loadSuggestions() {
    try {
      const res = await fetch('/api/friends/suggestions');
      const suggestions = await res.json();
      
      const suggestionsList = $('#suggestionsList');
      
      if (suggestions.length === 0) {
        suggestionsList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-plus"></i>
            <p>Không có gợi ý nào lúc này</p>
          </div>
        `;
        return;
      }
      
      suggestionsList.innerHTML = suggestions.map(user => `
        <div class="friend-card">
          <div class="friend-avatar" style="background: ${user.avatar_color};">
            ${user.display_name[0].toUpperCase()}
          </div>
          <div class="friend-info">
            <div class="friend-name">${user.display_name}</div>
            <div class="friend-meta">
              @${user.username}
              ${user.school ? ` • ${user.school}` : ''}
              ${user.grade ? ` • ${user.grade}` : ''}
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn btn-small" onclick="sendFriendRequest(${user.id})" style="background: var(--mood-joy);">
              ➕ Kết bạn
            </button>
            <a href="/profile/${user.username}" class="btn btn-small">👁️ Xem hồ sơ</a>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Lỗi tải gợi ý:', error);
    }
  }

  // ============================================
  // === Friend Actions ===
  // ============================================
  window.sendFriendRequest = async function(friendId) {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: friendId })
      });
      const data = await res.json();
      
      if (data.ok) {
        alert(data.message);
        loadSuggestions();
      } else {
        alert(data.error || 'Lỗi khi gửi lời mời');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  window.acceptRequest = async function(requestId) {
    try {
      const res = await fetch(`/api/friends/accept/${requestId}`, { method: 'POST' });
      const data = await res.json();
      
      if (data.ok) {
        alert(data.message);
        loadRequests();
        loadFriends();
      } else {
        alert(data.error || 'Lỗi khi chấp nhận');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  window.rejectRequest = async function(requestId) {
    if (!confirm('Bạn có chắc muốn từ chối lời mời này?')) return;
    
    try {
      const res = await fetch(`/api/friends/reject/${requestId}`, { method: 'POST' });
      const data = await res.json();
      
      if (data.ok) {
        alert(data.message);
        loadRequests();
      } else {
        alert(data.error || 'Lỗi khi từ chối');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  window.removeFriend = async function(friendId) {
    if (!confirm('Bạn có chắc muốn hủy kết bạn?')) return;
    
    try {
      const res = await fetch(`/api/friends/${friendId}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.ok) {
        alert(data.message);
        loadFriends();
      } else {
        alert(data.error || 'Lỗi khi hủy kết bạn');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  window.cancelRequest = async function(friendId) {
    if (!confirm('Bạn có chắc muốn hủy lời mời này?')) return;
    
    try {
      const res = await fetch(`/api/friends/${friendId}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.ok) {
        alert('Đã hủy lời mời');
        loadRequests();
      } else {
        alert(data.error || 'Lỗi khi hủy lời mời');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  // ============================================
  // === Khởi tạo ===
  // ============================================
  loadFriends();
})();


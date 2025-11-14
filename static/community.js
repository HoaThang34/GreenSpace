/**
 * ============================================
 * === COMMUNITY PAGE - Cộng đồng ===
 * ============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const $ = s => document.querySelector(s);
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContent');
    const postsContainer = document.getElementById('postsContainer');
    const searchUsersInput = $('#searchUsers');
    const showAllUsersBtn = $('#showAllUsersBtn');
    const allUsersModal = $('#allUsersModal');
    const closeAllUsersModal = $('#closeAllUsersModal');
    const allUsersList = $('#allUsersList');
    const userChip = $('#userChip');
    const dropdownMenu = $('#dropdownMenu');
    const logoutBtn = $('#logoutBtn');
    const unreadBadge = $('#unreadBadge');
    
    // ============================================
    // === User Menu ===
    // ============================================
    if (userChip && dropdownMenu) {
        userChip.addEventListener('click', () => {
            dropdownMenu.classList.toggle('show');
        });
        
        window.addEventListener('click', (e) => {
            if (!userChip.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        });
    }
    
    // ============================================
    // === Thông báo tin nhắn mới ===
    // ============================================
    async function updateUnreadCount() {
        try {
            const res = await fetch('/api/messages/unread-count');
            const data = await res.json();
            if (data.unread_count > 0 && unreadBadge) {
                unreadBadge.style.display = 'inline-flex';
                unreadBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
            } else if (unreadBadge) {
                unreadBadge.style.display = 'none';
            }
        } catch (error) {
            // Ignore
        }
    }
    
    if (unreadBadge) {
        updateUnreadCount();
        setInterval(updateUnreadCount, 5000);
    }
    
    // ============================================
    // === Tìm kiếm User ===
    // ============================================
    const searchResults = $('#searchResults');
    let searchTimeout = null;
    
    searchUsersInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchUsersInput.value.trim().toLowerCase();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch('/api/friends/suggestions');
                const users = await res.json();
                
                const filtered = users.filter(user => 
                    user.display_name.toLowerCase().includes(query) ||
                    user.username.toLowerCase().includes(query) ||
                    (user.school && user.school.toLowerCase().includes(query)) ||
                    (user.grade && user.grade.toLowerCase().includes(query))
                );
                
                if (filtered.length > 0) {
                    searchResults.innerHTML = filtered.slice(0, 5).map(user => `
                        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; cursor: pointer; transition: background 0.2s;" 
                             onmouseover="this.style.background='var(--border)'" 
                             onmouseout="this.style.background='transparent'"
                             onclick="window.location.href='/profile/${user.username}'">
                            <div class="author-avatar" style="background-color: ${user.avatar_color}; width: 35px; height: 35px; font-size: 1rem;">
                                ${user.display_name[0].toUpperCase()}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--fg); font-size: 0.9rem;">${user.display_name}</div>
                                <div style="font-size: 0.8rem; color: var(--muted);">@${user.username}</div>
                            </div>
                        </div>
                    `).join('');
                    searchResults.style.display = 'block';
                } else {
                    searchResults.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">Không tìm thấy</div>';
                    searchResults.style.display = 'block';
                }
            } catch (error) {
                console.error('Lỗi tìm kiếm:', error);
            }
        }, 300);
    });
    
    // Đóng kết quả tìm kiếm khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!searchUsersInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    // ============================================
    // === Hiển thị tất cả User ===
    // ============================================
    showAllUsersBtn.addEventListener('click', async () => {
        allUsersModal.classList.add('show');
        await loadAllUsers();
    });
    
    closeAllUsersModal.addEventListener('click', () => {
        allUsersModal.classList.remove('show');
    });
    
    allUsersModal.addEventListener('click', (e) => {
        if (e.target === allUsersModal) {
            allUsersModal.classList.remove('show');
        }
    });
    
    async function loadAllUsers() {
        try {
            const res = await fetch('/api/friends/suggestions');
            const users = await res.json();
            renderUsersList(users);
        } catch (error) {
            console.error('Lỗi tải danh sách user:', error);
            allUsersList.innerHTML = '<p style="text-align:center; color: var(--muted);">Lỗi tải danh sách người dùng.</p>';
        }
    }
    
    function renderUsersList(users) {
        if (users.length === 0) {
            allUsersList.innerHTML = `
                <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
                    <i class="fas fa-user-friends" style="font-size: 3rem; opacity: 0.3; margin-bottom: 15px; display: block;"></i>
                    <p>Không tìm thấy người dùng nào.</p>
                </div>
            `;
            return;
        }
        
        allUsersList.innerHTML = users.map(user => `
            <div style="display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid var(--border); transition: background 0.2s;" 
                 onmouseover="this.style.background='var(--border)'" 
                 onmouseout="this.style.background='transparent'">
                <div class="author-avatar" style="background-color: ${user.avatar_color};">
                    ${user.display_name[0].toUpperCase()}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--fg); margin-bottom: 4px;">${user.display_name}</div>
                    <div style="font-size: 0.85rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        @${user.username}
                        ${user.school ? ` • ${user.school}` : ''}
                        ${user.grade ? ` • ${user.grade}` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <a href="/profile/${user.username}" class="btn btn-small" style="padding: 6px 12px; font-size: 0.85rem;">👁️ Xem</a>
                    <button class="btn btn-small" onclick="sendFriendRequestFromCommunity(${user.id})" style="background: var(--mood-joy); color: white; padding: 6px 12px; font-size: 0.85rem;">
                        ➕ Kết bạn
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // ============================================
    // === Friend Request từ Community ===
    // ============================================
    window.sendFriendRequestFromCommunity = async function(userId) {
        try {
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friend_id: userId })
            });
            const data = await res.json();
            
            if (data.ok) {
                alert(data.message);
                loadAllUsers(); // Reload danh sách
            } else {
                alert(data.error || 'Lỗi khi gửi lời mời');
            }
        } catch (error) {
            alert('Lỗi kết nối');
        }
    };

    function renderPosts(posts) {
        postsContainer.innerHTML = ''; 
        if (posts.length === 0) {
            postsContainer.innerHTML = '<p style="text-align:center; color: var(--muted);">Chưa có bài viết nào!</p>';
        } else {
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'post-card';
                postElement.dataset.postId = post.id;
                
                const postDate = new Date(post.timestamp * 1000).toLocaleString('vi-VN', {
                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                });
                const supportActive = post.user_reaction === 'support' ? 'active' : '';
                const relateActive = post.user_reaction === 'relate' ? 'active' : '';

                postElement.innerHTML = `
                    <div class="post-body">
                        <div class="post-header">
                            <a href="/profile/${post.author_username}" style="text-decoration:none; flex-shrink: 0;">
                                <div class="author-avatar" style="background-color:${post.avatar_color}; color: #333; font-weight: 700;">${post.author_name.charAt(0).toUpperCase()}</div>
                            </a>
                            <div class="author-info">
                                <a href="/profile/${post.author_username}" class="post-author" style="text-decoration:none;">${post.author_name}</a>
                                <div class="post-meta">@${post.author_username} • ${postDate}</div>
                            </div>
                        </div>
                        <a href="/post/${post.id}" style="text-decoration: none; color: inherit;">
                            <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
                        </a>
                    </div>
                    <div class="post-footer">
                        <div class="reaction-bar">
                            <button class="reaction-btn ${supportActive}" data-reaction="support">
                                <i class="fas fa-seedling"></i> Ủng hộ <span class="count">${post.support_count}</span>
                            </button>
                            <button class="reaction-btn ${relateActive}" data-reaction="relate">
                                <i class="far fa-heart"></i> Đồng cảm <span class="count">${post.relate_count}</span>
                            </button>
                        </div>
                        <a href="/post/${post.id}" class="comment-link">
                            <i class="far fa-comment"></i> Bình luận (${post.comment_count})
                        </a>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
        }
    }

    async function fetchPosts() {
        try {
            const res = await fetch('/api/posts');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const posts = await res.json();
            renderPosts(posts);
        } catch (error) {
            console.error("Lỗi tải bài viết:", error);
            postsContainer.innerHTML = '<p style="text-align:center; color: var(--muted);">Không thể tải bài viết. Vui lòng thử lại.</p>';
        }
    }

    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContentInput.value.trim();
        if (!content) return;
        try {
            const res = await fetch('/api/create-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            if (res.ok) {
                postContentInput.value = '';
                fetchPosts();
            } else { 
                const data = await res.json();
                alert(data.error || 'Đăng bài thất bại.');
            }
        } catch (error) { alert('Lỗi kết nối khi đăng bài.'); }
    });

    postsContainer.addEventListener('click', async (e) => {
        const reactionBtn = e.target.closest('.reaction-btn');
        if (!reactionBtn) return;
        const postId = reactionBtn.closest('.post-card').dataset.postId;
        const reactionType = reactionBtn.dataset.reaction;
        try {
            const res = await fetch(`/api/posts/${postId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reaction_type: reactionType }),
            });
            if(res.ok) {
                fetchPosts(); 
            } else {
                alert('Tương tác thất bại.');
            }
        } catch (error) {
            console.error("Lỗi tương tác:", error);
        }
    });

    fetchPosts();
});
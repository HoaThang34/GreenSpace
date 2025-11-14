/**
 * ============================================
 * === ADMIN PANEL - QUẢN TRỊ HỆ THỐNG ===
 * ============================================
 * File này xử lý toàn bộ logic cho trang quản trị:
 * - Dashboard với thống kê và biểu đồ
 * - Quản lý người dùng
 * - Quản lý nội dung (bài đăng, bình luận)
 * - Phân tích dữ liệu
 */

(function () {
    // ============================================
    // === Helper Functions ===
    // ============================================
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    
    // ============================================
    // === Trạng thái ứng dụng ===
    // ============================================
    let userGrowthChartInstance = null;  // Instance biểu đồ tăng trưởng user
    let reactionChartInstance = null;     // Instance biểu đồ phân bổ tương tác
    let topUsersChartInstance = null;     // Instance biểu đồ top users
    let allUsers = [];                    // Cache danh sách users để tìm kiếm
    let allContent = [];                  // Cache danh sách content để tìm kiếm

    // ============================================
    // === Xử lý chuyển Tab ===
    // ============================================
    const tabs = $$('.tab-button');
    const tabContents = $$('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Xóa active từ tất cả tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Hiển thị tab content tương ứng
            const target = tab.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = content.id === target ? 'block' : 'none';
            });
            
            // Tải dữ liệu tương ứng khi chuyển tab
            if (target === 'dashboard') loadDashboard();
            if (target === 'users') loadUsers();
            if (target === 'content') loadContent();
            if (target === 'Analytics') loadAnalytics();
        });
    });

    // ============================================
    // === Đăng xuất ===
    // ============================================
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.href = '/admin';
        });
    }

    // ============================================
    // === Tab 1: Bảng Điều Khiển (Dashboard) ===
    // ============================================
    /**
     * Tải và hiển thị dữ liệu tổng quan:
     * - Thống kê số lượng users, posts, comments
     * - Hoạt động gần đây
     * - Biểu đồ tăng trưởng người dùng
     */
    async function loadDashboard() {
        try {
            const res = await fetch('/api/admin/dashboard-summary');
            if (!res.ok) throw new Error('Failed to fetch summary');
            const summary = await res.json();
            
            // Cập nhật các thẻ thống kê
            $('#statTotalUsers').textContent = summary.stats.total_users;
            $('#statTotalPosts').textContent = summary.stats.total_posts;
            $('#statTotalComments').textContent = summary.stats.total_comments;
            $('#statNewUsers').textContent = summary.stats.new_users_weekly;

            // Render Hoạt động gần đây
            const activityList = $('#recentActivityList');
            activityList.innerHTML = '';
            summary.recent_activity.forEach(act => {
                const li = document.createElement('li');
                const icon = act.type === 'user' ? 'fa-user-plus' : 'fa-pen-square';
                const text = act.type === 'user' ? `Người dùng mới: <strong>${act.title}</strong>` : `Bài đăng mới: "${act.title.substring(0, 30)}..."`;
                li.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
                activityList.appendChild(li);
            });

            // Render biểu đồ tăng trưởng người dùng
            const ctx = $('#userGrowthChart').getContext('2d');
            if (userGrowthChartInstance) {
                userGrowthChartInstance.destroy();
            }
            userGrowthChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: summary.user_growth.labels,
                    datasets: [{
                        label: 'Người dùng mới mỗi ngày',
                        data: summary.user_growth.data,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { maintainAspectRatio: false }
            });

        } catch (error) {
            console.error("Lỗi tải dashboard:", error);
        }
    }
    
    // ============================================
    // === Tab 2: Quản lý Người dùng ===
    // ============================================
    const userTableBody = $('#userTableBody');
    const userSearchInput = $('#userSearchInput');
    const userDetailModal = $('#userDetailModal');

    /**
     * Tải danh sách tất cả người dùng từ API.
     */
    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            allUsers = await res.json();
            renderUsers(allUsers);
        } catch (error) {
            userTableBody.innerHTML = '<tr><td colspan="7">Lỗi tải danh sách người dùng.</td></tr>';
        }
    }

    /**
     * Render danh sách người dùng vào bảng.
     * @param {Array} users - Mảng các user objects
     */
    function renderUsers(users) {
        userTableBody.innerHTML = '';
        
        if (users.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="7">Không tìm thấy người dùng.</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const createdDate = new Date(user.created_ts * 1000).toLocaleDateString('vi-VN');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.display_name}</td>
                <td>${createdDate}</td>
                <td>${user.post_count}</td>
                <td>${user.comment_count}</td>
                <td>
                    <button class="btn action-btn" data-action="view" data-user-id="${user.id}">
                        <i class="fas fa-eye"></i> Xem
                    </button>
                    <button class="btn action-btn" data-action="reset_pass" 
                            data-user-id="${user.id}" data-username="${user.username}">
                        <i class="fas fa-key"></i> Đặt lại MK
                    </button>
                    <button class="btn action-btn" style="background:var(--mood-anger)" 
                            data-action="delete" data-user-id="${user.id}" data-username="${user.username}">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    }
    
    // Tìm kiếm người dùng
    userSearchInput.addEventListener('input', () => {
        const query = userSearchInput.value.toLowerCase();
        const filteredUsers = allUsers.filter(user => 
            user.username.toLowerCase().includes(query) || 
            user.display_name.toLowerCase().includes(query)
        );
        renderUsers(filteredUsers);
    });
    
    // Xử lý sự kiện click trên bảng người dùng
    userTableBody.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;
        const action = target.dataset.action;
        const userId = target.dataset.userId;
        const username = target.dataset.username;

        if (action === 'view') viewUser(userId);
        if (action === 'delete') deleteUser(userId, username);
        if (action === 'reset_pass') resetPassword(userId, username);
    });

    /**
     * Xem chi tiết một người dùng (bài đăng, bình luận).
     * @param {number} userId - ID của user
     */
    async function viewUser(userId) {
        try {
            const res = await fetch(`/api/admin/users/${userId}`);
            const details = await res.json();
            
            // Tạo HTML cho danh sách bài đăng và bình luận
            let postsHTML = details.posts
                .map(p => `<div class="activity-item">${p.content.substring(0, 100)}...</div>`)
                .join('');
            let commentsHTML = details.comments
                .map(c => `<div class="activity-item">${c.content.substring(0, 100)}...</div>`)
                .join('');

            userDetailModal.innerHTML = `
                <div class="panel user-detail-panel">
                    <div class="user-detail-header">
                        <h2>Chi tiết: ${details.profile.display_name}</h2>
                        <button class="btn" id="closeUserDetailModal">Đóng</button>
                    </div>
                    <p><strong>Tên đăng nhập:</strong> ${details.profile.username}</p>
                    <p><strong>Ngày tham gia:</strong> ${new Date(details.profile.created_ts * 1000).toLocaleString('vi-VN')}</p>
                    <hr>
                    <h3>Bài đăng (${details.posts.length})</h3>
                    <div class="activity-list">${postsHTML || 'Chưa có bài đăng nào.'}</div>
                    <h3 style="margin-top:20px;">Bình luận (${details.comments.length})</h3>
                    <div class="activity-list">${commentsHTML || 'Chưa có bình luận nào.'}</div>
                </div>
            `;
            
            userDetailModal.classList.add('show');
            $('#closeUserDetailModal').addEventListener('click', () => {
                userDetailModal.classList.remove('show');
            });
        } catch (error) {
            alert('Không thể tải chi tiết người dùng.');
        }
    }

    /**
     * Xóa một người dùng và toàn bộ nội dung của họ.
     * @param {number} userId - ID của user
     * @param {string} username - Username để hiển thị trong confirm
     */
    async function deleteUser(userId, username) {
        if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng "${username}" (ID: ${userId}) không? `
                    + `Toàn bộ bài đăng và bình luận của họ cũng sẽ bị xóa.`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Đã xóa người dùng thành công.');
                loadUsers(); // Tải lại danh sách
            } else {
                alert('Xóa thất bại.');
            }
        } catch (error) {
            alert('Lỗi kết nối.');
        }
    }
    
    /**
     * Đặt lại mật khẩu cho một người dùng.
     * Tạo mật khẩu tạm thời ngẫu nhiên.
     * @param {number} userId - ID của user
     * @param {string} username - Username để hiển thị
     */
    async function resetPassword(userId, username) {
        if (!confirm(`Bạn có chắc muốn ĐẶT LẠI MẬT KHẨU cho người dùng "${username}" không?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
            const data = await res.json();
            
            if (data.ok) {
                prompt(`Mật khẩu mới cho người dùng "${username}" là (hãy sao chép và gửi cho họ):`, 
                       data.new_password);
            } else {
                alert('Đặt lại mật khẩu thất bại.');
            }
        } catch (error) {
            alert('Lỗi kết nối.');
        }
    }
    // ============================================
    // === Tab 3: Quản lý Nội dung ===
    // ============================================
    const contentTableBody = $('#contentTableBody');
    const contentSearchInput = $('#contentSearchInput');

    /**
     * Tải danh sách tất cả nội dung (bài đăng, bình luận) từ API.
     */
    async function loadContent() {
        try {
            const res = await fetch('/api/admin/content');
            allContent = await res.json();
            renderContent(allContent);
        } catch (error) {
            contentTableBody.innerHTML = '<tr><td colspan="5">Lỗi tải nội dung.</td></tr>';
        }
    }
    
    /**
     * Render danh sách nội dung vào bảng.
     * @param {Array} contents - Mảng các content objects
     */
    function renderContent(contents) {
        contentTableBody.innerHTML = '';
        if (contents.length === 0) {
            contentTableBody.innerHTML = '<tr><td colspan="5">Không có nội dung.</td></tr>';
            return;
        }
        contents.forEach(item => {
            const date = new Date(item.timestamp * 1000).toLocaleString('vi-VN');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="chip">${item.type}</span></td>
                <td>${item.content.substring(0, 80)}...</td>
                <td>${item.author}</td>
                <td>${date}</td>
                <td>
                    <button class="btn action-btn" style="background:var(--mood-anger)" data-type="${item.type}" data-id="${item.id}"><i class="fas fa-trash"></i> Xóa</button>
                </td>
            `;
            contentTableBody.appendChild(row);
        });
    }
    
    contentSearchInput.addEventListener('input', () => {
        const query = contentSearchInput.value.toLowerCase();
        const filteredContent = allContent.filter(item => 
            item.content.toLowerCase().includes(query) ||
            item.author.toLowerCase().includes(query)
        );
        renderContent(filteredContent);
    });

    contentTableBody.addEventListener('click', async e => {
        const target = e.target.closest('button');
        if (!target) return;

        const type = target.dataset.type;
        const id = target.dataset.id;
        
        if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn ${type} này không?`)) return;

        const endpoint = type === 'Bài đăng' ? `/api/admin/content/post/${id}` : `/api/admin/content/comment/${id}`;
        
        try {
            const res = await fetch(endpoint, { method: 'DELETE' });
            if (res.ok) {
                alert('Đã xóa nội dung.');
                loadContent(); // Tải lại bảng
            } else { alert('Xóa thất bại.'); }
        } catch (error) { alert('Lỗi kết nối.'); }
    });
    // ============================================
    // === Tab 4: Phân tích dữ liệu ===
    // ============================================
    /**
     * Tải và hiển thị dữ liệu phân tích:
     * - Phân bổ tương tác (support vs relate)
     * - Top 5 người dùng hoạt động nhiều nhất
     */
    async function loadAnalytics() {
        try {
            const res = await fetch('/api/admin/analytics');
            const analytics = await res.json();

            // Biểu đồ phân bổ tương tác (Doughnut)
            if (reactionChartInstance) {
                reactionChartInstance.destroy();
            }
            reactionChartInstance = new Chart($('#reactionChart'), {
                type: 'doughnut',
                data: {
                    labels: analytics.reaction_distribution.labels.map(
                        l => l === 'support' ? 'Ủng hộ' : 'Đồng cảm'
                    ),
                    datasets: [{
                        data: analytics.reaction_distribution.data,
                        backgroundColor: ['#22c55e', '#a855f7'],
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });

            // Biểu đồ top người dùng (Bar)
            if (topUsersChartInstance) {
                topUsersChartInstance.destroy();
            }
            topUsersChartInstance = new Chart($('#topUsersChart'), {
                type: 'bar',
                data: {
                    labels: analytics.top_active_users.labels,
                    datasets: [{
                        label: 'Tổng hoạt động (bài đăng + bình luận)',
                        data: analytics.top_active_users.data,
                        backgroundColor: '#3b82f6'
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    indexAxis: 'y'
                }
            });
        } catch (error) {
            console.error("Lỗi tải dữ liệu phân tích:", error);
        }
    }

    // ============================================
    // === Khởi tạo ===
    // ============================================
    // Tải dữ liệu ban đầu cho tất cả các tab
    loadDashboard();
    loadUsers();
    loadContent();
    loadAnalytics();
})();
document.addEventListener('DOMContentLoaded', () => {
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    
    // ============================================
    // === Kiểm tra trạng thái kết bạn ===
    // ============================================
    const friendActions = document.getElementById('friendActions');
    if (friendActions) {
        // Lấy user_id từ URL hoặc từ data attribute
        const profileUsername = document.querySelector('.username').textContent.replace('@', '');
        
        // Lấy user_id từ API
        fetch(`/api/profile/${profileUsername}`)
            .then(r => r.json())
            .catch(() => null)
            .then(profileData => {
                if (!profileData) return;
                
                // Tạm thời, cần lấy user_id từ một API khác hoặc từ template
                // Giả sử có API trả về user_id từ username
                fetch(`/api/friends/status/${profileData.id || 0}`)
                    .then(r => r.json())
                    .then(statusData => {
                        const friendRequestBtn = document.getElementById('friendRequestBtn');
                        const friendPendingBtn = document.getElementById('friendPendingBtn');
                        const friendRemoveBtn = document.getElementById('friendRemoveBtn');
                        const messageBtn = document.getElementById('messageBtn');
                        
                        if (statusData.status === 'none') {
                            friendRequestBtn.style.display = 'block';
                            friendRequestBtn.onclick = () => sendFriendRequest(profileData.id);
                        } else if (statusData.status === 'pending') {
                            if (statusData.is_sender) {
                                friendPendingBtn.style.display = 'block';
                                friendPendingBtn.textContent = '⏳ Đã gửi lời mời';
                            } else {
                                friendPendingBtn.style.display = 'block';
                                friendPendingBtn.textContent = '⏳ Đang chờ phản hồi';
                            }
                        } else if (statusData.status === 'accepted') {
                            friendRemoveBtn.style.display = 'block';
                            messageBtn.style.display = 'block';
                            friendRemoveBtn.onclick = () => removeFriend(profileData.id);
                        }
                    })
                    .catch(() => {
                        // Nếu không lấy được status, ẩn tất cả nút
                    });
            });
    }
    
    // ============================================
    // === Friend Actions ===
    // ============================================
    function sendFriendRequest(friendId) {
        fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friend_id: friendId })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                alert(data.message);
                window.location.reload();
            } else {
                alert(data.error || 'Lỗi khi gửi lời mời');
            }
        })
        .catch(() => alert('Lỗi kết nối'));
    }
    
    function removeFriend(friendId) {
        if (!confirm('Bạn có chắc muốn hủy kết bạn?')) return;
        
        fetch(`/api/friends/${friendId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                alert(data.message);
                window.location.reload();
            } else {
                alert(data.error || 'Lỗi khi hủy kết bạn');
            }
        })
        .catch(() => alert('Lỗi kết nối'));
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', async () => {
            const username = document.querySelector('.username').textContent.replace('@', '');
            
            try {
                const res = await fetch(`/api/profile/${username}`);
                if (!res.ok) throw new Error('Failed to fetch profile data');
                const data = await res.json();
                
                // Sử dụng innerHTML với thiết kế mới, chuyên nghiệp hơn
                editProfileModal.innerHTML = `
                    <div class="panel" style="width: min(700px, 90vw);">
                        <div class="histbar">
                            <h2>Chỉnh sửa hồ sơ</h2>
                            <button id="closeEditModal" class="btn">Đóng</button>
                        </div>
                        <form id="editProfileForm" style="margin-top: 20px;">
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label for="editDisplayName">Tên hiển thị</label>
                                <input type="text" id="editDisplayName" class="input" value="${data.display_name || ''}" required style="width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem; border: 2px solid var(--border); background: var(--input-bg); color: var(--fg);">
                            </div>
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label for="editBio">Mô tả ngắn (Bio)</label>
                                <textarea id="editBio" class="input" rows="3" style="width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem; border: 2px solid var(--border); background: var(--input-bg); color: var(--fg); resize: vertical;">${data.bio || ''}</textarea>
                                <small class="muted" style="font-size: 0.8rem;">Giới thiệu ngắn về bản thân bạn.</small>
                            </div>
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label for="editHobbies">Sở thích</label>
                                <input type="text" id="editHobbies" class="input" value="${data.hobbies || ''}" style="width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem; border: 2px solid var(--border); background: var(--input-bg); color: var(--fg);">
                                <small class="muted" style="font-size: 0.8rem;">Ngăn cách bởi dấu phẩy, ví dụ: Đọc sách, Nghe nhạc</small>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                <div class="form-group">
                                    <label for="editGrade">Lớp</label>
                                    <input type="text" id="editGrade" class="input" value="${data.grade || ''}" style="width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem; border: 2px solid var(--border); background: var(--input-bg); color: var(--fg);">
                                </div>
                                <div class="form-group">
                                    <label for="editSchool">Trường</label>
                                    <input type="text" id="editSchool" class="input" value="${data.school || ''}" style="width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem; border: 2px solid var(--border); background: var(--input-bg); color: var(--fg);">
                                </div>
                            </div>
                            <div class="actions" style="justify-content: flex-end;">
                                <button type="submit" class="btn primary">Lưu thay đổi</button>
                            </div>
                        </form>
                        <p id="editProfileMessage" class="muted" style="text-align: center; margin-top: 15px; min-height: 1em;"></p>
                    </div>
                `;
                editProfileModal.classList.add('show');
                
                document.getElementById('closeEditModal').onclick = () => editProfileModal.classList.remove('show');
                
                document.getElementById('editProfileForm').onsubmit = async (e) => {
                    e.preventDefault();
                    const messageEl = document.getElementById('editProfileMessage');
                    messageEl.textContent = 'Đang lưu...';

                    try {
                        const updateRes = await fetch('/api/profile/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                display_name: document.getElementById('editDisplayName').value,
                                bio: document.getElementById('editBio').value,
                                hobbies: document.getElementById('editHobbies').value,
                                grade: document.getElementById('editGrade').value,
                                school: document.getElementById('editSchool').value,
                            })
                        });

                        const result = await updateRes.json();
                        if (updateRes.ok) {
                            messageEl.textContent = result.message;
                            setTimeout(() => window.location.reload(), 1500); // Tải lại trang sau 1.5s
                        } else {
                            messageEl.textContent = result.error || 'Cập nhật thất bại.';
                        }
                    } catch (error) {
                        messageEl.textContent = 'Lỗi kết nối.';
                    }
                };
            } catch (error) {
                console.error(error);
                alert('Không thể tải dữ liệu hồ sơ để chỉnh sửa.');
            }
        });
    }
});
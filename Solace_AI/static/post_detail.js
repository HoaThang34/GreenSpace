document.addEventListener('DOMContentLoaded', () => {
    const postDetailContainer = document.getElementById('postDetailContainer');
    const commentList = document.getElementById('commentList');
    const createCommentForm = document.getElementById('createCommentForm');
    const commentContentInput = document.getElementById('commentContent');

    async function fetchAndRenderPostDetail() {
        try {
            const res = await fetch(`/api/posts/${POST_ID}`);
            // <<< THÊM KIỂM TRA NÀY >>>
            if (!res.ok) {
                document.querySelector('main').innerHTML = '<h2 style="text-align:center; color: var(--muted); margin-top: 50px;">Bài viết không tồn tại hoặc đã bị xóa.</h2>';
                return;
            }
            const post = await res.json();
            
            const postDate = new Date(post.timestamp * 1000).toLocaleString('vi-VN');
            
            let deleteButtonHTML = '';
            if (post.user_id === post.current_user_id) {
                deleteButtonHTML = `<button id="deletePostBtn" class="delete-btn"><i class="fas fa-trash"></i> Xóa bài</button>`;
            }

            postDetailContainer.innerHTML = `
                <div class="post-card">
                    <div class="post-body">
                        <div class="post-header">
                            <div class="author-avatar">${post.author_name.charAt(0)}</div>
                            <div class="author-info">
                                <div class="post-author">${post.author_name}</div>
                                <div class="post-meta">${postDate}</div>
                            </div>
                            ${deleteButtonHTML}
                        </div>
                        <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `;
            
            const deleteBtn = document.getElementById('deletePostBtn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', handleDeletePost);
            }

            // Render bình luận với giao diện mới
            commentList.innerHTML = '';
            if (post.comments.length > 0) {
                post.comments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment-card';
                    const commentDate = new Date(comment.timestamp * 1000).toLocaleString('vi-VN');
                    
                    commentEl.innerHTML = `
                        <a href="/profile/${comment.author_username}" style="text-decoration:none;">
                            <div class="author-avatar" style="background-color:${comment.avatar_color};">${comment.author_name.charAt(0)}</div>
                        </a>
                        <div>
                            <div>
                                <span class="comment-author">${comment.author_name}</span>
                                <span class="comment-meta">${commentDate}</span>
                            </div>
                            <div class="comment-content">${comment.content.replace(/\n/g, '<br>')}</div>
                        </div>
                    `;
                    commentList.appendChild(commentEl);
                });
            } else {
                commentList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px 0;">Chưa có bình luận nào.</p>';
            }

        } catch (error) { console.error("Lỗi tải bài viết:", error); }
    }

    async function handleDeletePost() {
        if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.')) {
            return;
        }
        try {
            const res = await fetch(`/api/posts/${POST_ID}`, { method: 'DELETE' });
            if (res.ok) {
                window.location.href = '/community';
            } else {
                const data = await res.json();
                alert(data.error || 'Xóa bài viết thất bại.');
            }
        } catch (error) {
            alert('Lỗi kết nối khi xóa bài.');
        }
    }

    createCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = commentContentInput.value.trim();
        if (!content) return;

        try {
            const res = await fetch(`/api/posts/${POST_ID}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            if (res.ok) {
                commentContentInput.value = '';
                // Tải lại để hiển thị bình luận mới và cuộn xuống dưới cùng
                await fetchAndRenderPostDetail();
                const wrapper = document.getElementById('commentListWrapper');
                wrapper.scrollTop = wrapper.scrollHeight;
            } else {
                alert('Gửi bình luận thất bại.');
            }
        } catch (error) {
            alert('Lỗi kết nối.');
        }
    });

    fetchAndRenderPostDetail();
});
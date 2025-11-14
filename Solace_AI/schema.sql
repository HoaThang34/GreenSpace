-- File: schema.sql

-- Xóa các bảng cũ nếu tồn tại để đảm bảo khởi tạo sạch
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS reaction;
DROP TABLE IF EXISTS friendship;
DROP TABLE IF EXISTS message;

-- Bảng người dùng
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_ts INTEGER NOT NULL,
    avatar_color TEXT,
    bio TEXT,
    hobbies TEXT,
    grade TEXT,
    school TEXT
);

-- Bảng bài đăng
CREATE TABLE post (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
);

-- Bảng bình luận
CREATE TABLE comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES post (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
);

-- Bảng tương tác (support, relate)
CREATE TABLE reaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    reaction_type TEXT NOT NULL, -- 'support' or 'relate'
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES post (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
);

-- Bảng quan hệ bạn bè
CREATE TABLE friendship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'accepted', 'blocked'
    created_ts INTEGER NOT NULL,
    updated_ts INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES user (id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
);

-- Bảng tin nhắn
CREATE TABLE message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    timestamp INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
    FOREIGN KEY (sender_id) REFERENCES user (id) ON DELETE CASCADE -- << Chỉ giữ lại dòng này
);
from __future__ import annotations

import os
import sys
import json
import time
import uuid
import re
import sqlite3
import click
import random
import string
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

import psutil
import requests
from flask import (
    Flask, request, jsonify, session, g, redirect, make_response, render_template, cli
)
from werkzeug.security import generate_password_hash, check_password_hash
from waitress import serve


# --- Cấu hình GPU (Tùy chọn) ---
try:
    import pynvml
    pynvml.nvmlInit()
    NVML_AVAILABLE = True
except Exception:
    NVML_AVAILABLE = False

# ============================================
# === Cấu hình & Đường dẫn ===
# ============================================
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
DATABASE_PATH: Path = DATA_DIR / "aseed.db"
STATIC_DIR: Path = BASE_DIR / "static"
TRAIN_DIR: Path = BASE_DIR / "training"
SESS_DIR: Path = DATA_DIR / "sessions"
USERS_FILE: Path = DATA_DIR / "users.json"
POSTS_FILE: Path = DATA_DIR / "posts.json"

# Tạo các thư mục cần thiết nếu chưa tồn tại
for d in (DATA_DIR, SESS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ============================================
# === Cấu hình ứng dụng ===
# ============================================
# Cấu hình Ollama (AI backend)
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-3-flash-preview:latest")

# Cấu hình Admin
ADMIN_USER: str = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

# Secret key cho session
SECRET_KEY: str = os.getenv("SECRET_KEY", "a-seed-secret-key-final-stable")

app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder='templates')
app.secret_key = SECRET_KEY
app.config.update(SESSION_COOKIE_SAMESITE='Lax', SESSION_COOKIE_SECURE=False)

# ============================================
# === Quản lý Cơ Sở Dữ Liệu ===
# ============================================
def get_db():
    """
    Lấy kết nối database từ Flask context.
    Tự động tạo kết nối mới nếu chưa có.
    """
    if 'db' not in g:
        g.db = sqlite3.connect(
            DATABASE_PATH,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON") # <<< THÊM DÒNG NÀY
    return g.db



@app.teardown_appcontext
def close_db(e=None):
    """Đóng kết nối database khi request kết thúc."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """
    Khởi tạo database từ file schema.sql.
    Tạo các bảng cần thiết nếu chưa tồn tại.
    """
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql') as f:
            db.executescript(f.read().decode('utf8'))

def migrate_json_to_db():
    """
    Di chuyển dữ liệu từ file JSON cũ sang database SQLite.
    Hỗ trợ migration từ phiên bản cũ của ứng dụng.
    """
    db = sqlite3.connect(DATABASE_PATH)
    cursor = db.cursor()
    
    # Di chuyển dữ liệu người dùng
    if USERS_FILE.exists():
        print("Đang di chuyển dữ liệu người dùng từ JSON...")
        with USERS_FILE.open("r", encoding="utf-8") as f:
            users = json.load(f)
            for username, data in users.items():
                cursor.execute(
                    "INSERT OR IGNORE INTO user (username, display_name, password_hash, created_ts) VALUES (?, ?, ?, ?)",
                    (username, data['display_name'], data['hash'], data['created_at'])
                )
    
    # Di chuyển dữ liệu bài đăng
    if POSTS_FILE.exists():
        print("Đang di chuyển dữ liệu bài đăng từ JSON...")
        with POSTS_FILE.open("r", encoding="utf-8") as f:
            posts = json.load(f)
            for post in posts:
                cursor.execute(
                    "SELECT id FROM user WHERE username = ?",
                    (post['author_id'],)
                )
                user_row = cursor.fetchone()
                if user_row:
                    cursor.execute(
                        "INSERT OR IGNORE INTO post (id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
                        (post['post_id'], user_row[0], post['content'], post['timestamp'])
                    )
    
    db.commit()
    db.close()
    print("Di chuyển dữ liệu hoàn tất.")

@app.cli.command('init-db')
def init_db_command(): init_db(); click.echo('Đã khởi tạo CSDL.')
@app.cli.command('migrate-data')
def migrate_data_command(): init_db(); migrate_json_to_db()

# ============================================
# === Các Hàm Tiện Ích Chung ===
# ============================================
def generate_avatar_color():
    """Tạo một mã màu pastel ngẫu nhiên cho avatar."""
    return f"hsl({random.randint(0, 360)}, 70%, 80%)"


def now_ts():
    """Lấy timestamp hiện tại (Unix timestamp)."""
    return int(time.time())


def safe_json(s: str) -> Dict[str, Any]:
    """
    Trích xuất JSON từ chuỗi text (dùng khi AI trả về text có chứa JSON).
    Trả về dict rỗng nếu không tìm thấy hoặc parse lỗi.
    """
    match = re.search(r"\{.*\}", s, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def ensure_sid(sid: Optional[str]) -> str:
    """Đảm bảo có session ID, tạo mới nếu chưa có."""
    return sid or str(uuid.uuid4())


def get_user_session_dir() -> Optional[Path]:
    """
    Lấy thư mục lưu session của user hiện tại.
    Tự động tạo thư mục nếu chưa tồn tại.
    """
    if 'username' not in session:
        return None
    safe_user_id = re.sub(r'[^\w-]', '', session['username'])
    user_dir = SESS_DIR / safe_user_id
    user_dir.mkdir(exist_ok=True)
    return user_dir


def session_path(sid: str) -> Optional[Path]:
    """Tạo đường dẫn file session từ session ID."""
    user_dir = get_user_session_dir()
    if not user_dir:
        return None
    safe_sid = re.sub(r'[^\w-]', '', sid)
    return user_dir / f"{safe_sid}.json"


def write_json(path: Optional[Path], obj: Any):
    """
    Ghi object vào file JSON một cách an toàn (dùng file tạm).
    Tránh mất dữ liệu khi ghi file bị gián đoạn.
    """
    if not path:
        return
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    tmp_path.replace(path)


def read_json(path: Optional[Path]) -> Any:
    """Đọc file JSON và trả về object Python."""
    if not path or not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

# ==================================
# === API Xác thực & Route Chung ===
# ==================================
@app.route("/")
def root():
    return render_template('welcome.html')

@app.route("/guest-experience")
def guest_experience():
    session.clear()
    session['username'] = 'khach'
    session['display_name'] = 'Khách Trải Nghiệm'
    session['is_guest'] = True
    return redirect('/chat')

@app.route("/chat")
def chat_page():
    """Truyền thêm `username` vào template để link hồ sơ hoạt động."""
    if 'user_id' not in session and not session.get('is_guest'): return redirect('/login')
    
    return render_template(
        'index.html',
        display_name=session.get('display_name', ''),
        username=session.get('username', '') # Dòng này đảm bảo link hồ sơ hoạt động
    )

@app.route("/login")
def login_page(): return render_template('login.html')

@app.route("/terms")
def terms_page(): return render_template('terms.html')

@app.route("/privacy")
def privacy_page(): return render_template('privacy.html')

@app.route("/docs")
def docs_page(): return render_template('docs.html')

@app.post("/api/register")
def api_register():
    """
    API đăng ký tài khoản mới.
    Tạo user mới với username, display_name và password.
    """
    data = request.get_json()
    username = data.get('username', '').strip()
    display_name = data.get('displayName', '').strip()
    password = data.get('password', '').strip()
    
    # Kiểm tra dữ liệu đầu vào
    if not all([username, display_name, password]):
        return jsonify({
            "ok": False,
            "error": "Vui lòng điền đầy đủ các trường."
        }), 400
    
    db = get_db()
    try:
        db.execute(
            "INSERT INTO user (username, display_name, password_hash, created_ts, avatar_color) VALUES (?, ?, ?, ?, ?)",
            (
                username,
                display_name,
                generate_password_hash(password),
                now_ts(),
                generate_avatar_color()
            )
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({
            "ok": False,
            "error": "Tên đăng nhập đã tồn tại."
        }), 409
    
    return jsonify({
        "ok": True,
        "message": "Tạo tài khoản thành công."
    })

@app.post("/api/login")
def api_login():
    """
    API đăng nhập.
    Xác thực username và password, tạo session nếu thành công.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    db = get_db()
    user = db.execute(
        "SELECT * FROM user WHERE username = ?",
        (username,)
    ).fetchone()
    
    if user and check_password_hash(user['password_hash'], password):
        session.clear()
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['display_name'] = user['display_name']
        return jsonify({
            "ok": True,
            "displayName": user['display_name']
        })
    
    return jsonify({
        "ok": False,
        "error": "Tên đăng nhập hoặc mật khẩu không hợp lệ."
    }), 401
    
@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/session-check")
def api_session_check():
    if 'user_id' in session or session.get('is_guest'):
        return jsonify({
            "logged_in": True,
            "user_id": session.get('user_id'),
            "is_guest": session.get('is_guest', False)
        })
    return jsonify({"logged_in": False})

@app.post("/api/change-password")
def api_change_password():
    """
    API đổi mật khẩu.
    Yêu cầu mật khẩu cũ để xác thực trước khi đổi.
    """
    if 'user_id' not in session:
        return jsonify({
            "ok": False,
            "error": "Bạn chưa đăng nhập."
        }), 401
    
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    db = get_db()
    user = db.execute(
        "SELECT * FROM user WHERE id = ?",
        (session['user_id'],)
    ).fetchone()
    
    # Xác thực mật khẩu cũ
    if not user or not check_password_hash(user['password_hash'], old_password):
        return jsonify({
            "ok": False,
            "error": "Mật khẩu cũ không chính xác."
        }), 403
    
    # Cập nhật mật khẩu mới
    db.execute(
        "UPDATE user SET password_hash = ? WHERE id = ?",
        (generate_password_hash(new_password), session['user_id'])
    )
    db.commit()
    
    return jsonify({
        "ok": True,
        "message": "Đổi mật khẩu thành công!"
    })

# ===========================================
# === API Lịch Sử Trò Chuyện (Session Files)
# ===========================================
@app.post("/api/save")
def api_save():
    """
    API lưu lịch sử trò chuyện.
    Tự động tạo tiêu đề từ tin nhắn đầu tiên của user.
    """
    if 'user_id' not in session and not session.get('is_guest'):
        return jsonify({"error": "unauthorized"}), 401
    
    data = request.get_json()
    sid = ensure_sid(data.get("sid"))
    
    if session.get('is_guest'):
        return jsonify({
            "ok": True,
            "sid": sid,
            "title": "Chat Trải Nghiệm"
        })
        
    chat = data.get("chat") or []
    path = session_path(sid)
    
    if path:
        # Tạo tiêu đề từ tin nhắn đầu tiên của user
        first_user_message = next(
            (item['text'] for item in chat if item['role'] == 'user'),
            "Trò chuyện mới"
        )
        title = first_user_message[:60]
        
        # Lưu vào file JSON
        write_json(path, {
            "sid": sid,
            "title": title,
            "chat": chat,
            "updated": now_ts()
        })
        
        return jsonify({
            "ok": True,
            "sid": sid,
            "title": title
        })
    
    return jsonify({"ok": False}), 500

@app.get("/api/sessions")
def api_sessions():
    if 'user_id' not in session and not session.get('is_guest'): return jsonify([]), 401
    if session.get('is_guest'): return jsonify([])
    user_dir = get_user_session_dir()
    if not user_dir: return jsonify([])
    res = []
    for p in user_dir.glob("*.json"):
        try:
            obj = read_json(p) or {}
            res.append({"sid": obj.get("sid", p.stem), "title": obj.get("title", p.stem), "updated": obj.get("updated", int(p.stat().st_mtime))})
        except Exception: pass
    res.sort(key=lambda x: x["updated"], reverse=True)
    return jsonify(res)

@app.get("/api/load")
def api_load():
    if 'user_id' not in session and not session.get('is_guest'): return jsonify({"error": "unauthorized"}), 401
    if session.get('is_guest'): return jsonify({"error": "invalid_sid"}), 400
    sid = request.args.get("sid")
    if not sid: return jsonify({"error": "invalid_sid"}), 400
    path = session_path(sid)
    obj = read_json(path)
    if not obj: return jsonify({"error": "not-found"}), 404
    return jsonify(obj)

# === API Mạng Xã Hội ===
@app.route("/community")
def community_page():
    if 'user_id' not in session: return redirect('/login')
    # THÊM 'username' vào đây
    return render_template(
        'community.html', 
        display_name=session.get('display_name'),
        username=session.get('username', '') # <<< THÊM DÒNG NÀY
    )

@app.route("/friends")
def friends_page():
    """Trang quản lý bạn bè và lời mời kết bạn."""
    if 'user_id' not in session: return redirect('/login')
    return render_template('friends.html', display_name=session.get('display_name'))

@app.route("/messages")
def messages_page():
    """Trang danh sách cuộc trò chuyện."""
    if 'user_id' not in session: return redirect('/login')
    return render_template('messages.html', display_name=session.get('display_name'))

@app.route("/messages/<int:user_id>")
def chat_with_user_page(user_id):
    """Trang chat với một user cụ thể."""
    if 'user_id' not in session: return redirect('/login')
    db = get_db()
    other_user = db.execute("SELECT id, username, display_name, avatar_color FROM user WHERE id = ?", (user_id,)).fetchone()
    if not other_user: return "Người dùng không tồn tại.", 404
    return render_template('chat.html', other_user=dict(other_user), display_name=session.get('display_name'))

@app.route("/messages/global")
def global_chat_page():
    """Trang chat chung toàn server."""
    if 'user_id' not in session: return redirect('/login')
    return render_template('global_chat.html', display_name=session.get('display_name'))

@app.route("/post/<string:post_id>")
def post_detail_page(post_id):
    if 'user_id' not in session: return redirect('/login')
    return render_template('post_detail.html', post_id=post_id, display_name=session.get('display_name'))

@app.get("/api/posts")
def api_get_posts():
    """Đảm bảo truy vấn trả về đúng các trường count."""
    if 'user_id' not in session: return jsonify([]), 401
    db = get_db()
    
    # === MÃ ĐÃ TỐI ƯU HÓA ===
    posts_rows = db.execute(
        """
        SELECT
            p.id, p.content, p.timestamp, p.user_id,
            u.display_name as author_name,
            u.username as author_username,
            u.avatar_color,
            COUNT(DISTINCT c.id) as comment_count,
            SUM(CASE WHEN r.reaction_type = 'support' THEN 1 ELSE 0 END) as support_count,
            SUM(CASE WHEN r.reaction_type = 'relate' THEN 1 ELSE 0 END) as relate_count,
            MAX(CASE WHEN r_user.user_id = ? THEN r_user.reaction_type ELSE NULL END) as user_reaction
        FROM post p
        JOIN user u ON p.user_id = u.id
        LEFT JOIN comment c ON c.post_id = p.id
        LEFT JOIN reaction r ON r.post_id = p.id
        LEFT JOIN reaction r_user ON r_user.post_id = p.id AND r_user.user_id = ?
        GROUP BY p.id
        ORDER BY p.timestamp DESC
        """,
        (session['user_id'], session['user_id'])
    ).fetchall()
    
    return jsonify([dict(row) for row in posts_rows])



@app.post("/api/create-post")
def api_create_post():
    """
    API tạo bài đăng mới trong cộng đồng.
    """
    if 'user_id' not in session:
        return jsonify({
            "ok": False,
            "error": "unauthorized"
        }), 401
    
    content = request.get_json().get('content', '').strip()
    
    if not content:
        return jsonify({
            "ok": False,
            "error": "Nội dung không được để trống."
        }), 400
    
    db = get_db()
    db.execute(
        "INSERT INTO post (id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), session['user_id'], content, now_ts())
    )
    db.commit()
    
    return jsonify({
        "ok": True,
        "message": "Đăng bài thành công!"
    })

@app.get("/api/posts/<string:post_id>")
def api_get_post_detail(post_id):
    if 'user_id' not in session: return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    post_row = db.execute("SELECT p.id, p.content, p.timestamp, p.user_id, u.display_name as author_name FROM post p JOIN user u ON p.user_id = u.id WHERE p.id = ?", (post_id,)).fetchone()
    if not post_row: return jsonify({"error": "Bài viết không tồn tại."}), 404
    post = dict(post_row)
    comments_rows = db.execute("SELECT c.id, c.content, c.timestamp, c.user_id, u.display_name as author_name FROM comment c JOIN user u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.timestamp ASC", (post_id,)).fetchall()
    post['comments'] = [dict(row) for row in comments_rows]
    post['current_user_id'] = session.get('user_id')
    return jsonify(post)

@app.post("/api/posts/<string:post_id>/comments")
def api_create_comment(post_id):
    if 'user_id' not in session: return jsonify({"error": "unauthorized"}), 401
    content = request.get_json().get('content', '').strip()
    if not content: return jsonify({"ok": False, "error": "Nội dung bình luận không được để trống."}), 400
    db = get_db()
    db.execute("INSERT INTO comment (post_id, user_id, content, timestamp) VALUES (?, ?, ?, ?)", (post_id, session['user_id'], content, now_ts()))
    db.commit()
    return jsonify({"ok": True, "message": "Bình luận thành công!"})

@app.delete("/api/posts/<string:post_id>")
def api_delete_post(post_id):
    if 'user_id' not in session: return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    post = db.execute("SELECT user_id FROM post WHERE id = ?", (post_id,)).fetchone()
    if not post: return jsonify({"ok": False, "error": "Bài viết không tồn tại."}), 404
    if post['user_id'] != session['user_id']: return jsonify({"ok": False, "error": "Bạn không có quyền xóa bài viết này."}), 403
    db.execute("DELETE FROM post WHERE id = ?", (post_id,))
    db.commit()
    return jsonify({"ok": True, "message": "Đã xóa bài viết."})

@app.post("/api/posts/<string:post_id>/react")
def api_react_post(post_id):
    """
    API tương tác với bài đăng (support/relate).
    Nếu đã tương tác cùng loại thì bỏ tương tác (toggle).
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    reaction_type = request.get_json().get('reaction_type')
    
    if reaction_type not in ['support', 'relate']:
        return jsonify({
            "ok": False,
            "error": "Loại tương tác không hợp lệ."
        }), 400
    
    db = get_db()
    
    # Kiểm tra xem user đã tương tác chưa
    existing = db.execute(
        "SELECT reaction_type FROM reaction WHERE post_id = ? AND user_id = ?",
        (post_id, session['user_id'])
    ).fetchone()
    
    # Nếu đã tương tác cùng loại thì bỏ tương tác
    if existing and existing['reaction_type'] == reaction_type:
        db.execute(
            "DELETE FROM reaction WHERE post_id = ? AND user_id = ?",
            (post_id, session['user_id'])
        )
    else:
        # Thêm hoặc cập nhật tương tác
        db.execute(
            """INSERT INTO reaction (post_id, user_id, reaction_type, timestamp)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(post_id, user_id)
               DO UPDATE SET reaction_type = excluded.reaction_type, timestamp = excluded.timestamp""",
            (post_id, session['user_id'], reaction_type, now_ts())
        )
    
    db.commit()
    return jsonify({"ok": True})

# ===========================================
# === API Chat & Ollama ===
# ===========================================
def get_system_prompt():
    prompt_file = TRAIN_DIR / "a_seed_prompt.txt"
    if prompt_file.exists(): return prompt_file.read_text('utf-8')
    return "Bạn là một trợ lý đồng cảm và hữu ích tên là GreenSpace."

def ollama_chat(messages: List[Dict[str, str]]):
    """
    Gửi request đến Ollama API để chat với AI.
    
    Args:
        messages: Danh sách các tin nhắn (system, user, assistant)
    
    Returns:
        Nội dung phản hồi từ AI
    """
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": False,
        "options": {
            "num_ctx": 4096,      # Context window
            "temperature": 0.7,   # Độ sáng tạo (0-1)
            "top_p": 0.9          # Nucleus sampling
        }
    }
    
    r = requests.post(
        f"{OLLAMA_HOST}/api/chat",
        json=payload,
        timeout=120
    )
    r.raise_for_status()
    return r.json().get("message", {}).get("content", "")
    
@app.post("/api/chat")
def api_chat():
    """
    API chat với AI Solace.
    Xử lý tin nhắn từ user, gọi Ollama, và trả về phản hồi với emotion.
    """
    if 'user_id' not in session and not session.get('is_guest'):
        return jsonify({"error": "unauthorized"}), 401
    
    data = request.get_json()
    user_msg = (data.get("message") or "").strip()
    
    if not user_msg:
        return jsonify({"error": "empty-message"}), 400
    
    # Xây dựng danh sách tin nhắn cho AI
    # Bao gồm: system prompt + lịch sử + tin nhắn hiện tại
    history = data.get("history") or []
    msgs = [
        {"role": "system", "content": get_system_prompt()}
    ] + [
        {"role": turn['role'], "content": turn['text']}
        for turn in history
        if turn.get('role') in ['user', 'assistant']
    ] + [
        {"role": "user", "content": user_msg}
    ]
    
    try:
        # Gọi Ollama API
        text = ollama_chat(msgs)
        
        # Trích xuất JSON từ phản hồi (format: {"emotion": "...", "reply": "..."})
        obj = safe_json(text)
        
        # Lấy reply và emotion, có fallback
        reply = (
            obj.get("reply") or
            text.strip() or
            "Mình không chắc phải trả lời sao. Bạn có thể diễn đạt lại không?"
        ).strip()
        
        emo = (obj.get("emotion") or "neutral").lower().strip()
        
        return jsonify({
            "emotion": emo,
            "reply": reply
        })
    
    except Exception as e:
        print(f"Lỗi khi gọi Ollama: {e}", file=sys.stderr)
        return jsonify({
            "error": "backend-failed",
            "hint": str(e)
        }), 500

# ===========================================
# === (CẬP NHẬT TOÀN DIỆN) Khu Vực Admin ===
# ===========================================
@app.route("/admin")
def admin_page():
    if session.get("admin"): return redirect("/admin/dashboard")
    return render_template("admin_login.html")

@app.route("/admin/dashboard")
def admin_dashboard():
    if not session.get("admin"): return redirect("/admin")
    return render_template("admin.html")

@app.post("/api/admin/login")
def admin_login():
    data = request.get_json()
    if data.get("username") == os.getenv("ADMIN_USER", "admin") and data.get("password") == os.getenv("ADMIN_PASSWORD", "admin123"):
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Invalid credentials"}), 401

@app.post("/api/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return jsonify({"ok": True})

# === (HOÀN THIỆN) API CHO BẢNG ĐIỀU KHIỂN CHÍNH ===
@app.get("/api/admin/dashboard-summary")
def admin_get_dashboard_summary():
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    
    stats = {
        "total_users": db.execute("SELECT COUNT(id) FROM user").fetchone()[0],
        "total_posts": db.execute("SELECT COUNT(id) FROM post").fetchone()[0],
        "total_comments": db.execute("SELECT COUNT(id) FROM comment").fetchone()[0],
    }
    
    seven_days_ago = int(time.time()) - 7 * 86400
    stats["new_users_weekly"] = db.execute("SELECT COUNT(id) FROM user WHERE created_ts >= ?", (seven_days_ago,)).fetchone()[0]
    
    recent_activity = db.execute(
        """
        SELECT 'user' as type, display_name as title, created_ts as timestamp FROM user
        UNION ALL
        SELECT 'post' as type, content as title, timestamp FROM post
        ORDER BY timestamp DESC LIMIT 7
        """
    ).fetchall()
    
    user_growth_data = db.execute(
        "SELECT strftime('%Y-%m-%d', created_ts, 'unixepoch') as date, COUNT(id) as count "
        "FROM user WHERE created_ts >= ? GROUP BY date ORDER BY date ASC", (seven_days_ago,)
    ).fetchall()

    return jsonify({
        "stats": stats,
        "recent_activity": [dict(row) for row in recent_activity],
        "user_growth": {
            "labels": [row['date'] for row in user_growth_data],
            "data": [row['count'] for row in user_growth_data]
        }
    })

@app.get("/api/admin/users")
def admin_get_users():
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    users_rows = db.execute(
        """
        SELECT u.id, u.username, u.display_name, u.created_ts,
               (SELECT COUNT(p.id) FROM post p WHERE p.user_id = u.id) as post_count,
               (SELECT COUNT(c.id) FROM comment c WHERE c.user_id = u.id) as comment_count
        FROM user u ORDER BY u.id DESC
        """
    ).fetchall()
    return jsonify([dict(row) for row in users_rows])

@app.get("/api/admin/users/<int:user_id>")
def admin_get_user_detail(user_id):
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    
    user = db.execute("SELECT id, username, display_name, created_ts FROM user WHERE id = ?", (user_id,)).fetchone()
    if not user: return jsonify({"error": "not found"}), 404
        
    posts = db.execute("SELECT id, content, timestamp FROM post WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
    comments = db.execute("SELECT id, content, timestamp FROM comment WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
    
    return jsonify({
        "profile": dict(user),
        "posts": [dict(p) for p in posts],
        "comments": [dict(c) for c in comments]
    })

# Chỉ giữ lại MỘT hàm admin_delete_user
@app.delete("/api/admin/users/<int:user_id>")
def admin_delete_user(user_id):
    """Xóa một người dùng và toàn bộ nội dung của họ."""
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    db.execute("DELETE FROM user WHERE id = ?", (user_id,))
    db.commit()
    return jsonify({"ok": True, "message": f"Đã xóa người dùng ID {user_id}."})

@app.post("/api/admin/users/<int:user_id>/reset-password")
def admin_reset_password(user_id):
    """
    API admin: Đặt lại mật khẩu cho user.
    Tạo mật khẩu tạm thời ngẫu nhiên 8 ký tự.
    """
    if not session.get("admin"):
        return jsonify({"error": "unauthorized"}), 401
    
    # Tạo mật khẩu tạm thời ngẫu nhiên
    temp_password = ''.join(
        random.choices(string.ascii_lowercase + string.digits, k=8)
    )
    
    db = get_db()
    db.execute(
        "UPDATE user SET password_hash = ? WHERE id = ?",
        (generate_password_hash(temp_password), user_id)
    )
    db.commit()
    
    return jsonify({
        "ok": True,
        "message": "Đặt lại mật khẩu thành công!",
        "new_password": temp_password
    })

@app.get("/api/admin/content")
def admin_get_content():
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    
    posts = db.execute(
        "SELECT 'Bài đăng' as type, p.id, p.content, p.timestamp, u.display_name as author FROM post p JOIN user u ON p.user_id = u.id"
    ).fetchall()
    
    comments = db.execute(
        "SELECT 'Bình luận' as type, c.id, c.content, c.timestamp, u.display_name as author FROM comment c JOIN user u ON c.user_id = u.id"
    ).fetchall()
    
    all_content = [dict(p) for p in posts] + [dict(c) for c in comments]
    all_content.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return jsonify(all_content)

@app.delete("/api/admin/content/post/<string:post_id>")
def admin_delete_content_post(post_id):
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    db.execute("DELETE FROM post WHERE id = ?", (post_id,))
    db.commit()
    return jsonify({"ok": True, "message": "Đã xóa bài đăng."})

@app.delete("/api/admin/content/comment/<int:comment_id>")
def admin_delete_content_comment(comment_id):
    if not session.get("admin"): return jsonify({"error": "unauthorized"}), 401
    db = get_db()
    db.execute("DELETE FROM comment WHERE id = ?", (comment_id,))
    db.commit()
    return jsonify({"ok": True, "message": "Đã xóa bình luận."})

@app.get("/api/admin/analytics")
def admin_get_analytics():
    """
    API admin: Lấy dữ liệu phân tích.
    Bao gồm: phân bổ tương tác, top users hoạt động.
    """
    if not session.get("admin"):
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    
    # Phân bổ tương tác (support vs relate)
    reaction_counts = db.execute(
        "SELECT reaction_type, COUNT(id) as count FROM reaction GROUP BY reaction_type"
    ).fetchall()
    
    # Top 5 người dùng hoạt động nhiều nhất (bài đăng + bình luận)
    top_users = db.execute(
        """
        SELECT u.display_name, (
            (SELECT COUNT(p.id) FROM post p WHERE p.user_id = u.id) + 
            (SELECT COUNT(c.id) FROM comment c WHERE c.user_id = u.id)
        ) as activity_count
        FROM user u
        ORDER BY activity_count DESC
        LIMIT 5
        """
    ).fetchall()
    
    return jsonify({
        "reaction_distribution": {
            "labels": [row['reaction_type'] for row in reaction_counts],
            "data": [row['count'] for row in reaction_counts]
        },
        "top_active_users": {
            "labels": [row['display_name'] for row in top_users],
            "data": [row['activity_count'] for row in top_users]
        }
    })

@app.route("/profile/<string:username>")
def profile_page(username):
    """Trang hiển thị hồ sơ của một người dùng."""
    if 'user_id' not in session: return redirect('/login')
    
    db = get_db()
    user = db.execute("SELECT * FROM user WHERE username = ?", (username,)).fetchone()
    if not user: return "Người dùng không tồn tại.", 404
        
    posts_rows = db.execute("SELECT * FROM post WHERE user_id = ? ORDER BY timestamp DESC", (user['id'],)).fetchall()
    
    posts_data = []
    for post in posts_rows:
        post_dict = dict(post)
        post_dict['formatted_timestamp'] = datetime.fromtimestamp(post['timestamp']).strftime('%H:%M, %d/%m/%Y')
        posts_data.append(post_dict)

    is_own_profile = (session.get('username') == username)
    
    return render_template(
        'profile.html', 
        profile_user=dict(user), 
        posts=posts_data,
        is_own_profile=is_own_profile,
        display_name=session.get('display_name')
    )


@app.get("/api/profile/<string:username>")
def api_get_profile(username):
    """
    API lấy dữ liệu hồ sơ (chủ yếu để chỉnh sửa).
    Nếu không phải profile của mình, trả về thông tin công khai kèm user_id.
    """
    if 'user_id' not in session: return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user = db.execute("SELECT id, display_name, bio, hobbies, grade, school FROM user WHERE username = ?", (username,)).fetchone()
    
    if not user: return jsonify({"error": "not found"}), 404
    
    # Nếu là profile của chính mình, kiểm tra quyền chỉnh sửa
    if session.get('username') != username:
        # Trả về thông tin công khai (không cần kiểm tra forbidden)
        return jsonify({
            "id": user['id'],
            "display_name": user['display_name'],
            "bio": user['bio'],
            "hobbies": user['hobbies'],
            "grade": user['grade'],
            "school": user['school']
        })
    
    # Profile của chính mình - trả về đầy đủ để chỉnh sửa
    return jsonify(dict(user))

@app.post("/api/profile/update")
def api_update_profile():
    """
    API cập nhật thông tin hồ sơ.
    Cho phép cập nhật: display_name, bio, hobbies, grade, school.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    data = request.get_json()
    
    db = get_db()
    db.execute(
        """
        UPDATE user SET
            display_name = ?,
            bio = ?,
            hobbies = ?,
            grade = ?,
            school = ?
        WHERE id = ?
        """,
        (
            data.get('display_name'),
            data.get('bio'),
            data.get('hobbies'),
            data.get('grade'),
            data.get('school'),
            session['user_id']
        )
    )
    db.commit()
    
    # Cập nhật lại session với tên hiển thị mới
    session['display_name'] = data.get('display_name')
    
    return jsonify({
        "ok": True,
        "message": "Cập nhật hồ sơ thành công!"
    })

# ============================================
# === API Kết Bạn ===
# ============================================
@app.get("/api/friends")
def api_get_friends():
    """
    API lấy danh sách bạn bè và lời mời kết bạn.
    Trả về: danh sách bạn bè, lời mời đã gửi, lời mời đã nhận.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Lấy danh sách bạn bè (đã chấp nhận)
    friends = db.execute(
        """
        SELECT 
            CASE 
                WHEN f.user_id = ? THEN f.friend_id
                ELSE f.user_id
            END as friend_id,
            u.username, u.display_name, u.avatar_color,
            f.updated_ts
        FROM friendship f
        JOIN user u ON (CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END) = u.id
        WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
        ORDER BY f.updated_ts DESC
        """,
        (user_id, user_id, user_id, user_id)
    ).fetchall()
    
    # Lấy lời mời đã gửi (pending)
    sent_requests = db.execute(
        """
        SELECT f.id, f.friend_id, u.username, u.display_name, u.avatar_color, f.created_ts
        FROM friendship f
        JOIN user u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'pending'
        ORDER BY f.created_ts DESC
        """,
        (user_id,)
    ).fetchall()
    
    # Lấy lời mời đã nhận (pending)
    received_requests = db.execute(
        """
        SELECT f.id, f.user_id, u.username, u.display_name, u.avatar_color, f.created_ts
        FROM friendship f
        JOIN user u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'pending'
        ORDER BY f.created_ts DESC
        """,
        (user_id,)
    ).fetchall()
    
    return jsonify({
        "friends": [dict(row) for row in friends],
        "sent_requests": [dict(row) for row in sent_requests],
        "received_requests": [dict(row) for row in received_requests]
    })


@app.get("/api/friends/status/<int:friend_id>")
def api_get_friendship_status(friend_id):
    """
    API kiểm tra trạng thái kết bạn với một user.
    Trả về: 'none', 'pending', 'accepted', 'blocked'
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Kiểm tra xem đã có quan hệ kết bạn chưa
    friendship = db.execute(
        """
        SELECT status, user_id, friend_id
        FROM friendship
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        """,
        (user_id, friend_id, friend_id, user_id)
    ).fetchone()
    
    if not friendship:
        return jsonify({"status": "none"})
    
    # Xác định ai là người gửi
    is_sender = friendship['user_id'] == user_id
    return jsonify({
        "status": friendship['status'],
        "is_sender": is_sender
    })


@app.post("/api/friends/request")
def api_send_friend_request():
    """
    API gửi lời mời kết bạn.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    data = request.get_json()
    friend_id = data.get('friend_id')
    
    if not friend_id:
        return jsonify({"ok": False, "error": "Thiếu friend_id"}), 400
    
    user_id = session['user_id']
    
    if user_id == friend_id:
        return jsonify({"ok": False, "error": "Không thể kết bạn với chính mình"}), 400
    
    db = get_db()
    
    # Kiểm tra xem đã có quan hệ chưa
    existing = db.execute(
        """
        SELECT id, status FROM friendship
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        """,
        (user_id, friend_id, friend_id, user_id)
    ).fetchone()
    
    if existing:
        if existing['status'] == 'accepted':
            return jsonify({"ok": False, "error": "Đã là bạn bè rồi"}), 400
        elif existing['status'] == 'pending':
            return jsonify({"ok": False, "error": "Đã gửi lời mời kết bạn"}), 400
        elif existing['status'] == 'blocked':
            return jsonify({"ok": False, "error": "Người dùng này đã bị chặn"}), 400
    
    # Tạo lời mời mới
    try:
        db.execute(
            "INSERT INTO friendship (user_id, friend_id, status, created_ts, updated_ts) VALUES (?, ?, 'pending', ?, ?)",
            (user_id, friend_id, now_ts(), now_ts())
        )
        db.commit()
        return jsonify({"ok": True, "message": "Đã gửi lời mời kết bạn"})
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "error": "Lỗi khi gửi lời mời"}), 500


@app.post("/api/friends/accept/<int:request_id>")
def api_accept_friend_request(request_id):
    """
    API chấp nhận lời mời kết bạn.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Kiểm tra lời mời có tồn tại và thuộc về user hiện tại không
    request = db.execute(
        "SELECT * FROM friendship WHERE id = ? AND friend_id = ? AND status = 'pending'",
        (request_id, user_id)
    ).fetchone()
    
    if not request:
        return jsonify({"ok": False, "error": "Lời mời không tồn tại"}), 404
    
    # Cập nhật trạng thái thành accepted
    db.execute(
        "UPDATE friendship SET status = 'accepted', updated_ts = ? WHERE id = ?",
        (now_ts(), request_id)
    )
    db.commit()
    
    return jsonify({"ok": True, "message": "Đã chấp nhận lời mời kết bạn"})


@app.post("/api/friends/reject/<int:request_id>")
def api_reject_friend_request(request_id):
    """
    API từ chối lời mời kết bạn (xóa bản ghi).
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Kiểm tra lời mời có tồn tại và thuộc về user hiện tại không
    request = db.execute(
        "SELECT * FROM friendship WHERE id = ? AND friend_id = ? AND status = 'pending'",
        (request_id, user_id)
    ).fetchone()
    
    if not request:
        return jsonify({"ok": False, "error": "Lời mời không tồn tại"}), 404
    
    # Xóa lời mời
    db.execute("DELETE FROM friendship WHERE id = ?", (request_id,))
    db.commit()
    
    return jsonify({"ok": True, "message": "Đã từ chối lời mời kết bạn"})


@app.delete("/api/friends/<int:friend_id>")
def api_remove_friend(friend_id):
    """
    API hủy kết bạn hoặc hủy lời mời đã gửi.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Xóa quan hệ kết bạn
    db.execute(
        "DELETE FROM friendship WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
        (user_id, friend_id, friend_id, user_id)
    )
    db.commit()
    
    return jsonify({"ok": True, "message": "Đã hủy kết bạn"})


@app.get("/api/friends/suggestions")
def api_get_friend_suggestions():
    """
    API gợi ý kết bạn.
    Ưu tiên: cùng trường/lớp > tất cả user khác.
    Nếu không có gợi ý cùng trường/lớp, trả về tất cả user chưa kết bạn.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Lấy thông tin user hiện tại
    current_user = db.execute("SELECT school, grade FROM user WHERE id = ?", (user_id,)).fetchone()
    
    # Lấy danh sách user đã kết bạn hoặc đã gửi/nhận lời mời
    excluded_ids = db.execute(
        """
        SELECT friend_id as id FROM friendship WHERE user_id = ?
        UNION
        SELECT user_id as id FROM friendship WHERE friend_id = ?
        """,
        (user_id, user_id)
    ).fetchall()
    excluded_ids = [row['id'] for row in excluded_ids] + [user_id]
    
    # Thử gợi ý dựa trên cùng trường/lớp trước
    if current_user['school'] or current_user['grade']:
        school = current_user['school'] or ''
        grade = current_user['grade'] or ''
        
        suggestions = db.execute(
            """
            SELECT u.id, u.username, u.display_name, u.avatar_color, u.school, u.grade,
                   (SELECT COUNT(*) FROM post p WHERE p.user_id = u.id) as post_count,
                   CASE 
                       WHEN u.school = ? AND u.grade = ? THEN 3
                       WHEN u.school = ? OR u.grade = ? THEN 2
                       ELSE 1
                   END as priority
            FROM user u
            WHERE u.id NOT IN ({})
            AND (u.school = ? OR u.grade = ?)
            ORDER BY priority DESC, post_count DESC
            LIMIT 20
            """.format(','.join(['?'] * len(excluded_ids))),
            excluded_ids + [school, grade, school, grade, school, grade]
        ).fetchall()
        
        # Nếu có gợi ý cùng trường/lớp, trả về
        if suggestions:
            return jsonify([dict(row) for row in suggestions])
    
    # Nếu không có gợi ý cùng trường/lớp, trả về tất cả user chưa kết bạn
    all_users = db.execute(
        """
        SELECT u.id, u.username, u.display_name, u.avatar_color, u.school, u.grade,
               (SELECT COUNT(*) FROM post p WHERE p.user_id = u.id) as post_count
        FROM user u
        WHERE u.id NOT IN ({})
        ORDER BY post_count DESC, u.created_ts DESC
        LIMIT 50
        """.format(','.join(['?'] * len(excluded_ids))),
        excluded_ids
    ).fetchall()
    
    return jsonify([dict(row) for row in all_users])


# ============================================
# === API Tin Nhắn ===
# ============================================
@app.get("/api/conversations")
def api_get_conversations():
    if 'user_id' not in session: return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # === MÃ ĐÃ TỐI ƯU HÓA ===
    conversations = db.execute(
        """
        WITH LastMessages AS (
            SELECT
                *,
                ROW_NUMBER() OVER(PARTITION BY
                    CASE
                        WHEN sender_id = ? THEN receiver_id
                        ELSE sender_id
                    END
                ORDER BY timestamp DESC) as rn
            FROM message
            WHERE sender_id = ? OR receiver_id = ?
        )
        SELECT
            u.id as other_user_id,
            u.username,
            u.display_name,
            u.avatar_color,
            lm.content as last_message,
            lm.timestamp as last_message_time,
            (SELECT COUNT(*) FROM message
             WHERE receiver_id = ? AND sender_id = u.id AND is_read = 0) as unread_count
        FROM LastMessages lm
        JOIN user u ON u.id = (CASE WHEN lm.sender_id = ? THEN lm.receiver_id ELSE lm.sender_id END)
        WHERE lm.rn = 1
        ORDER BY lm.timestamp DESC
        """,
        (user_id, user_id, user_id, user_id, user_id)
    ).fetchall()
    
    return jsonify([dict(row) for row in conversations])


@app.get("/api/messages/<int:other_user_id>")
def api_get_messages(other_user_id):
    """
    API lấy tin nhắn với một user cụ thể.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    # Lấy tin nhắn
    messages = db.execute(
        """
        SELECT m.id, m.sender_id, m.receiver_id, m.content, m.message_type, 
               m.timestamp, m.is_read,
               u_sender.username as sender_username,
               u_sender.display_name as sender_name,
               u_receiver.username as receiver_username,
               u_receiver.display_name as receiver_name
        FROM message m
        JOIN user u_sender ON m.sender_id = u_sender.id
        JOIN user u_receiver ON m.receiver_id = u_receiver.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) 
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.timestamp ASC
        LIMIT 100
        """,
        (user_id, other_user_id, other_user_id, user_id)
    ).fetchall()
    
    # Đánh dấu tin nhắn đã đọc
    db.execute(
        "UPDATE message SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0",
        (user_id, other_user_id)
    )
    db.commit()
    
    return jsonify([dict(row) for row in messages])

@app.get("/api/messages/global")
def api_get_global_messages():
    """API lấy tin nhắn chat chung (receiver_id = 0)."""
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    
    messages = db.execute(
        """
        SELECT m.id, m.sender_id, m.content, m.timestamp,
               u_sender.username as sender_username,
               u_sender.display_name as sender_name,
               u_sender.avatar_color
        FROM message m
        JOIN user u_sender ON m.sender_id = u_sender.id
        WHERE m.receiver_id = 0 -- Lấy tin nhắn của nhóm chat chung
        ORDER BY m.timestamp ASC
        LIMIT 200 -- Giới hạn 200 tin nhắn gần nhất
        """,
    ).fetchall()
    
    return jsonify([dict(row) for row in messages])

@app.post("/api/messages")
def api_send_message():
    """
    API gửi tin nhắn.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    data = request.get_json()
    receiver_id = data.get('receiver_id')
    content = data.get('content', '').strip()
    message_type = data.get('message_type', 'text')
    
    if receiver_id is None:
        return jsonify({"ok": False, "error": "Thiếu receiver_id"}), 400
    
    if not content:
        return jsonify({"ok": False, "error": "Nội dung tin nhắn không được để trống"}), 400
    
    user_id = session['user_id']
    
    if user_id == receiver_id and receiver_id != 0:
        return jsonify({"ok": False, "error": "Không thể gửi tin nhắn cho chính mình"}), 400
    
    # Kiểm tra xem đã là bạn bè chưa (tùy chọn - có thể bỏ qua nếu muốn cho phép nhắn tin tự do)
    db = get_db()
    # is_friend = db.execute(
    #     """
    #     SELECT id FROM friendship
    #     WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
    #     AND status = 'accepted'
    #     """,
    #     (user_id, receiver_id, receiver_id, user_id)
    # ).fetchone()
    
    # Nếu muốn chỉ cho phép nhắn tin với bạn bè, uncomment dòng sau:
    # if not is_friend:
    #     return jsonify({"ok": False, "error": "Chỉ có thể nhắn tin với bạn bè"}), 403
    
    # Gửi tin nhắn
    try:
        db.execute(
            "INSERT INTO message (sender_id, receiver_id, content, message_type, timestamp, is_read) VALUES (?, ?, ?, ?, ?, 0)",
            (user_id, receiver_id, content, message_type, now_ts())
        )
        db.commit()
        return jsonify({"ok": True, "message": "Đã gửi tin nhắn"})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Lỗi khi gửi tin nhắn: {str(e)}"}), 500


@app.get("/api/messages/unread-count")
def api_get_unread_count():
    """
    API lấy số lượng tin nhắn chưa đọc.
    """
    if 'user_id' not in session:
        return jsonify({"error": "unauthorized"}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    count = db.execute(
        "SELECT COUNT(*) as count FROM message WHERE receiver_id = ? AND is_read = 0",
        (user_id,)
    ).fetchone()['count']
    
    return jsonify({"unread_count": count})


# ============================================
# === Khởi động ứng dụng ===
# ============================================
if __name__ == "__main__":
    # Khởi tạo database nếu chưa tồn tại
    with app.app_context():
        if not DATABASE_PATH.exists():
            print("Không tìm thấy CSDL. Đang khởi tạo...")
            init_db()
            print("CSDL đã được khởi tạo.")
            
            # Di chuyển dữ liệu từ JSON cũ nếu có
            if USERS_FILE.exists() or POSTS_FILE.exists():
                print("Phát hiện dữ liệu JSON cũ. Đang di chuyển...")
                migrate_json_to_db()
                print("LƯU Ý: Dữ liệu JSON cũ đã được di chuyển. "
                      "Bạn có thể xóa các file users.json và posts.json.")
    
    # Cấu hình server
    host = "0.0.0.0"
    port = 80
    
    print(f"🌱 Máy chủ GreenSpace đang khởi động trên cổng {port}...")
    
    def print_network_info():
        """In thông tin địa chỉ IP để truy cập từ mạng nội bộ."""
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            print(
                f"   - Trên các thiết bị khác trong mạng, truy cập qua: http://{local_ip}",
                flush=True
            )
        except Exception:
            pass
    
    print(f"   - Trên máy tính này, bạn có thể dùng: http://127.0.0.1", flush=True)
    print_network_info()
    print(
        f"   - LƯU Ý: Chạy trên cổng {port} có thể yêu cầu quyền quản trị viên.",
        flush=True
    )
    
    # Khởi động server với Waitress (production-ready WSGI server)
    serve(app, host=host, port=port)
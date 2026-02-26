import sqlite3
import time
import uuid
import random
from faker import Faker
from werkzeug.security import generate_password_hash
from pathlib import Path

# Cấu hình
DATABASE_PATH = Path("data/aseed.db")
fake = Faker('vi_VN')

def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def seed_data():
    if not DATABASE_PATH.exists():
        print(f"Lỗi: Không tìm thấy database tại {DATABASE_PATH}")
        return

    db = get_db()
    cursor = db.cursor()

    print("--- Đang bắt đầu quá trình seeding dữ liệu ảo ---")

    # 1. Tạo người dùng ảo
    users = []
    grade_options = ["Lớp 10", "Lớp 11", "Lớp 12", "Sinh viên năm 1", "Sinh viên năm 2"]
    school_options = ["THPT Chuyên Hà Nội - Amsterdam", "THPT Chu Văn An", "Đại học Bách Khoa", "Đại học Ngoại Thương", "THPT Lê Hồng Phong"]

    for _ in range(20):
        username = fake.user_name() + str(random.randint(10, 99))
        display_name = fake.name()
        password_hash = generate_password_hash("password123")
        created_ts = int(time.time()) - random.randint(0, 30 * 86400) # Trong 30 ngày qua
        avatar_color = f"hsl({random.randint(0, 360)}, 70%, 80%)"
        bio = fake.text(max_nb_chars=100)
        hobbies = ", ".join(fake.words(nb=3, ext_word_list=None, unique=True))
        grade = random.choice(grade_options)
        school = random.choice(school_options)

        try:
            cursor.execute(
                "INSERT INTO user (username, display_name, password_hash, created_ts, avatar_color, bio, hobbies, grade, school) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (username, display_name, password_hash, created_ts, avatar_color, bio, hobbies, grade, school)
            )
            user_id = cursor.lastrowid
            users.append(user_id)
            print(f"Đã tạo user: {username}")
        except sqlite3.IntegrityError:
            continue

    # 2. Tạo bài đăng
    post_ids = []
    contents = [
        "Hôm nay mình cảm thấy rất vui vì đã hoàn thành xong bài tập khó!",
        "Có ai muốn cùng học nhóm môn Toán không nhỉ?",
        "GreenSpace thực sự là một trợ lý tuyệt vời, giúp mình giảm bớt căng thẳng.",
        "Mọi người thường làm gì khi cảm thấy bị áp lực trong học tập?",
        "Vừa đọc được một cuốn sách rất hay về tâm lý học, muốn chia sẻ với cả nhà.",
        "Thời tiết hôm nay thật đẹp, rất thích hợp để ra ngoài đi dạo.",
        "Kỳ thi sắp tới rồi, chúc mọi người ôn tập thật tốt nhé!",
        "Mục tiêu tuần này của mình là dậy sớm lúc 6h sáng mỗi ngày. Cố lên!",
        "Có ai ở đây thích nghe nhạc không lời khi học bài không?",
        "Vừa hoàn thành một dự án nhỏ về lập trình Python, cảm giác thật tự hào."
    ]

    for user_id in users:
        num_posts = random.randint(1, 3)
        for _ in range(num_posts):
            post_id = str(uuid.uuid4())
            content = random.choice(contents) + " " + fake.sentence()
            timestamp = int(time.time()) - random.randint(0, 7 * 86400) # Trong 7 ngày qua
            
            cursor.execute(
                "INSERT INTO post (id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
                (post_id, user_id, content, timestamp)
            )
            post_ids.append(post_id)
    
    print(f"Đã tạo {len(post_ids)} bài đăng.")

    # 3. Tạo bình luận
    comment_samples = [
        "Hay quá bạn ơi!",
        "Mình cũng vậy, đồng cảm với bạn.",
        "Cố gắng lên nhé, bạn sẽ làm được thôi.",
        "Cảm ơn bạn đã chia sẻ nhé!",
        "Ý tưởng này tuyệt thật đấy.",
        "Cho mình tham gia với được không?",
        "Đúng là như vậy, áp lực học tập đôi khi mệt mỏi thật.",
        "Bạn giỏi quá!",
        "Mình cũng thích cuốn sách đó lắm.",
        "Chúc bạn một ngày tốt lành!"
    ]

    for post_id in post_ids:
        num_comments = random.randint(0, 4)
        commenters = random.sample(users, min(num_comments, len(users)))
        for commenter_id in commenters:
            content = random.choice(comment_samples)
            timestamp = int(time.time()) - random.randint(0, 86400)
            cursor.execute(
                "INSERT INTO comment (post_id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
                (post_id, commenter_id, content, timestamp)
            )

    # 4. Tạo tương tác (Reactions)
    for post_id in post_ids:
        num_reactions = random.randint(1, 10)
        reactors = random.sample(users, min(num_reactions, len(users)))
        for reactor_id in reactors:
            rtype = random.choice(['support', 'relate'])
            cursor.execute(
                "INSERT OR IGNORE INTO reaction (post_id, user_id, reaction_type, timestamp) VALUES (?, ?, ?, ?)",
                (post_id, reactor_id, rtype, int(time.time()))
            )

    db.commit()
    db.close()
    print("--- Hoàn tất seeding dữ liệu! ---")

if __name__ == "__main__":
    seed_data()

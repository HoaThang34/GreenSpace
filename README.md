# 🌱 GreenSpace — Giá trị cốt lõi từ sự thấu cảm.

> "Nơi mầm xanh tâm hồn được ươm mầm bởi sự thấu hiểu."

**GreenSpace** là một hệ sinh thái chăm sóc sức khỏe tinh thần toàn diện, kết hợp sức mạnh của **Trí tuệ Nhân tạo (AI)** và **Sức mạnh Cộng đồng**. Được xây dựng trên triết lý "Thấu cảm là chìa khóa", GreenSpace cung cấp một không gian an toàn, riêng tư và không phán xét để bạn được là chính mình.

---

## ✨ CÁC TÍNH NĂNG ĐỘC BẢN

### 🤖 GreenSpace Bot: Người Bạn Tri Kỷ 24/7
Không chỉ là một chatbot thông thường, GreenSpace Bot được tối ưu hóa để trở thành một người lắng nghe sâu sắc:
- **Phản hồi Đa cảm xúc:** Giao diện thay đổi linh hoạt theo tông giọng và cảm xúc của bạn (Glassmorphism Dynamic).
- **Hội thoại Sâu sắc:** Sử dụng các mô hình ngôn ngữ lớn (LLM) để đưa ra những phản hồi mang tính chữa lành, không máy móc.
- **Bảo mật Tuyệt đối:** Mọi cuộc trò chuyện được mã hóa và lưu trữ cục bộ, đảm bảo sự riêng tư hoàn mỹ.

### 🍃 Khu Vườn Chung: Cộng Đồng Chữa Lành
Một mạng xã hội thu nhỏ nơi sự tử tế được đặt lên hàng đầu:
- **Chia sẻ Ẩn danh:** Tự do bộc bạch tâm tư mà không lo ngại về danh tính.
- **Tương tác Ý nghĩa:** Thay thế nút "Like" bằng các nút **"Ủng hộ"** (Support) và **"Đồng cảm"** (Relate).
- **Không gian Sạch:** Hệ thống kiểm duyệt nội dung tự động và thủ công giúp loại bỏ tiêu cực.

### 📊 Quản Trị Hệ Thống (Admin Dashboard)
Công cụ mạnh mẽ dành cho người quản trị để điều phối và hỗ trợ cộng đồng:
- Thống kê tăng trưởng người dùng theo thời gian thực.
- Quản lý bài đăng, bình luận và người dùng tập trung.
- Giám sát hiệu năng hệ thống (CPU/GPU/RAM).

---

## 🛠 CÔNG NGHỆ SỬ DỤNG

GreenSpace được xây dựng với các công nghệ hiện đại, ưu tiên hiệu năng và tính ổn định:

- **Backend:** Python + Flask (Trái tim của hệ thống).
- **Frontend:** Vanilla JS + CSS (Thiết kế phong cách Glassmorphism hiện đại).
- **Cơ sở dữ liệu:** SQLite (Gọn nhẹ, an toàn).
- **AI Engine:** Ollama (Chạy các mô hình ngôn ngữ lớn mạnh mẽ ngay trên máy local).
- **WSGI Server:** Waitress (Production-ready).

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT NHANH (QUICK START)

### 1. Yêu cầu hệ thống
- **Python:** 3.10 trở lên.
- **Ollama:** Đã cài đặt và đang chạy ([ollama.com](https://ollama.com)).

### 2. Cài đặt các thư viện cần thiết
Mở terminal tại thư mục dự án và chạy:
```bash
pip install -r requirements.txt
```

### 3. Thiết lập Mô hình AI
Tải mô hình AI bạn muốn sử dụng (mặc định trong code là `gemini-3-flash-preview:latest` hoặc bạn có thể cấu hình lại):
```bash
ollama pull gemini-3-flash-preview:latest
```
*(Ghi chú: Bạn có thể đổi mô hình trong file `main.py` tại biến `MODEL_NAME`).*

### 4. Khởi tạo Cơ sở dữ liệu
```bash
set FLASK_APP=main
flask init-db
```

### 5. Khởi động GreenSpace
```bash
python main.py
```
Sau đó, truy cập: **[http://127.0.0.1](http://127.0.0.1)**

---

## 🛡 AN TOÀN & BẢO MẬT
GreenSpace luôn cung cấp các nguồn lực hỗ trợ khẩn cấp:
- Nút **"Hỗ trợ khẩn cấp"** tích hợp sẵn hotline tâm lý Việt Nam (19001567, 0243.6273.888).
- Cam kết không chia sẻ dữ liệu người dùng cho bên thứ ba.

---
*GreenSpace - Vì mọi tâm hồn đều xứng đáng được lắng nghe.*

```
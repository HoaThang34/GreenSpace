#!/bin/bash

# Thiết lập màu sắc để làm nổi bật hướng dẫn
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # Không màu

clear
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   SCRIPT KHOI DONG UNG DUNG OLLAMA (LINUX/MAC)   ${NC}"
echo -e "${GREEN}=============================================${NC}"

# Bước 1: Đăng nhập vào Ollama
echo -e "\n${YELLOW}Buoc 1: Dang nhap vao Ollama...${NC}"
ollama signin

echo -e "\n${YELLOW}------------------------------------------------------------------${NC}"
echo -e "${YELLOW}!!! HUONG DAN QUAN TRONG !!!${NC}"
echo -e "${YELLOW}1. Mot lien ket dang nhap da hien ra o tren.${NC}"
echo -e "${YELLOW}2. Sao chep (copy) toan bo lien ket do.${NC}"
echo -e "${YELLOW}3. Dan (paste) vao trinh duyet web va hoan tat viec dang nhap.${NC}"
echo -e "${YELLOW}4. Quay tro lai day sau khi da dang nhap thanh cong tren trinh duyet.${NC}"
echo -e "${YELLOW}------------------------------------------------------------------${NC}"

# Đợi người dùng nhấn Enter để tiếp tục
read -p ">> Nhan [ENTER] de tiep tuc sau khi da dang nhap thanh cong... "

echo -e "\n${GREEN}Xac nhan dang nhap! Tiep tuc cac buoc tiep theo...${NC}"

# Bước 2: Cài đặt các thư viện Python
echo -e "\n${YELLOW}Buoc 2: Cai dat cac thu vien Python tu requirements.txt...${NC}"
if pip install -r requirements.txt; then
    echo -e "${GREEN}>> Cai dat thu vien hoan tat!${NC}"
else
    echo -e "${RED}>> Loi: Khong the cai dat cac thu vien tu requirements.txt. Vui long kiem tra file va thu lai.${NC}"
    exit 1
fi

# Bước 3: Tải model Ollama
echo -e "\n${YELLOW}Buoc 3: Tai mo hinh 'gpt-oss:120b-cloud' tu Ollama...${NC}"
echo "Luu y: Buoc nay co the mat rat nhieu thoi gian va dung luong tuy vao toc do mang cua ban."
if ollama pull gpt-oss:120b-cloud; then
    echo -e "${GREEN}>> Tai mo hinh hoan tat!${NC}"
else
    echo -e "${RED}>> Loi: Khong the tai mo hinh. Vui long kiem tra ket noi mang va ten mo hinh.${NC}"
    exit 1
fi

# Bước 4: Khởi chạy server chính
echo -e "\n${YELLOW}Buoc 4: Khoi chay may chu chinh (main_server.py)...${NC}"
python main.py

echo -e "\n${GREEN}Script da hoan tat.${NC}"
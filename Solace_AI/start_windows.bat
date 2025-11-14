@echo off
cls
TITLE Khoi Dong Ung Dung Ollama

ECHO =============================================
ECHO    SCRIPT KHOI DONG UNG DUNG OLLAMA (WINDOWS)
ECHO =============================================

ECHO.
ECHO --- Buoc 1: Dang nhap vao Ollama...
ollama signin

ECHO.
ECHO ------------------------------------------------------------------
ECHO !!! HUONG DAN QUAN TRONG !!!
ECHO 1. Mot lien ket dang nhap da hien ra o tren.
ECHO 2. Sao chep (copy) toan bo lien ket do.
ECHO 3. Dan (paste) vao trinh duyet web va hoan tat viec dang nhap.
ECHO 4. Quay tro lai day sau khi da dang nhap thanh cong tren trinh duyet.
ECHO ------------------------------------------------------------------
ECHO.
pause

ECHO.
ECHO --- Buoc 2: Cai dat cac thu vien Python tu requirements.txt...
pip install -r requirements.txt

REM Kiem tra xem buoc truoc co thanh cong khong
IF NOT %ERRORLEVEL% == 0 (
    ECHO >> LOI: Khong the cai dat cac thu vien. Vui long kiem tra file requirements.txt.
    pause
    EXIT /B 1
)
ECHO >> Cai dat thu vien hoan tat!

ECHO.
ECHO --- Buoc 3: Tai mo hinh 'gpt-oss:120b-cloud' tu Ollama...
ECHO Luu y: Buoc nay co the mat rat nhieu thoi gian va dung luong.
ollama pull gpt-oss:120b-cloud

REM Kiem tra xem buoc truoc co thanh cong khong
IF NOT %ERRORLEVEL% == 0 (
    ECHO >> LOI: Khong the tai mo hinh. Vui long kiem tra ket noi mang va ten mo hinh.
    pause
    EXIT /B 1
)
ECHO >> Tai mo hinh hoan tat!

ECHO.
ECHO --- Buoc 4: Khoi chay may chu chinh (main.py)...
python main.py

ECHO.
ECHO Script da hoan tat.
pause
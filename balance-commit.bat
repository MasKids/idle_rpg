@echo off
chcp 65001 > nul
cd /d %~dp0
echo === 밸런싱 변환 시작 ===
call npm run balance
if errorlevel 1 goto error
echo.
echo === 커밋 ===
git add balance/balance.xlsx src/data/balance.json
git commit -m "balance: 수치 조정"
if errorlevel 1 goto nochange
git push
echo.
echo 완료
pause
exit /b 0

:nochange
echo.
echo 변경사항 없음
pause
exit /b 0

:error
echo.
echo 변환 실패. 엑셀 파일이 열려있는지 확인하세요.
pause
exit /b 1

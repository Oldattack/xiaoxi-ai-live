@echo off
chcp 65001 >nul
cd /d "%~dp0"
wscript //nologo "%~dp0启动.vbs"

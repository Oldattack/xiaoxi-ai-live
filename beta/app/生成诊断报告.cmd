@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 生成诊断报告
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0生成诊断报告.ps1" %*

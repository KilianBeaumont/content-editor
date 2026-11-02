@echo off
chcp 65001 >nul
title Editeur video
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable : installe Node.js 24 depuis https://nodejs.org puis relance.
  pause
  exit /b 1
)
node scripts\lancer.ts
if errorlevel 1 pause

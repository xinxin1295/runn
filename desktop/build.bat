@echo off
chcp 65001 >nul
setlocal

echo.
echo ================================
echo   润 Runn 一键构建脚本
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没检测到 Node.js
  echo 请先从 https://nodejs.org/zh-cn 下载 LTS 版本安装
  echo 装完打开新窗口重新跑本脚本
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo Node 版本: %NODE_VER%
echo.

cd /d "%~dp0"

if not exist "node_modules" (
  echo [1/3] 首次运行，安装依赖（第一次会下载 Electron 约 80MB，耐心等）...
  call npm install
  if errorlevel 1 (
    echo [错误] npm install 失败
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已存在，跳过安装
)
echo.

echo [2/3] 生成图标...
call node tools\gen-icons.js
if errorlevel 1 (
  echo [错误] 图标生成失败
  pause
  exit /b 1
)
echo.

echo [3/3] 打包 Windows 安装包 .exe...
call npm run dist
if errorlevel 1 (
  echo [错误] 打包失败
  pause
  exit /b 1
)
echo.

echo ================================
echo   完成 · 安装包在 release\ 目录
echo ================================
echo.

if exist "release" (
  explorer release
)

pause

# 润 Runn · 桌面 .exe 版本

对齐一线大厂桌面应用（微信桌面、飞书桌面、Slack、VS Code）的体验：**系统托盘常驻 + 定时右下角迷你卡片 + 开机静默自启 + 关闭到托盘不真退出 + 单实例 + 会议中静默**。

技术栈：Electron 30 + 原生 JS（无框架依赖）。安装包约 80MB。

## 一 三种玩法（按你的时间选）

> **国内用户网络提示**：`npm install` 时 Electron 二进制从 GitHub 下载可能超时。先跑这两行切国内镜像：
> ```
> npm config set registry https://registry.npmmirror.com
> npm config set ELECTRON_MIRROR https://npmmirror.com/mirrors/electron/
> ```
> 之后再 `npm install`，5 分钟以内一般能下完。

### 玩法A · 想立刻看效果（3 分钟）

需要电脑已装 Node.js（22+）。命令行进入 `desktop/` 目录：

```
npm install
npm start
```

第一次会自动生成图标 + 装 Electron，之后主窗口弹出、托盘图标出现。到间隔时间右下角会自动弹迷你卡片。

### 玩法B · 生成 .exe 安装包给别人用（5 分钟）

同样进 `desktop/` 目录：

```
npm install
npm run dist
```

跑完后在 `release/` 目录里有一个 `润Runn_Setup_1.0.0.exe`，双击即可安装到 Windows。装完开始菜单和桌面都有「润 Runn」快捷方式，首次运行会自动加入开机自启。

### 玩法C · 一键跑（一行不用敲）

双击 `desktop/build.bat`（Windows 记事本可查看内容确认无害），它会自动做完玩法B的所有步骤。

## 二 安装 Node.js

如果 `npm install` 提示找不到 `npm`，先去装 Node.js：

- 打开 [nodejs.org](https://nodejs.org/zh-cn)
- 下 LTS 版本（不用管版本号，跟着推荐的走）
- 一路下一步装完
- 打开新的命令行窗口，输入 `node -v` 有版本号就是好了

## 三 装完之后

安装 `润Runn_Setup_1.0.0.exe` 后：

1. **托盘图标常驻**：右下角任务栏（或点小箭头展开区）会有一个青色水滴，鼠标悬停显示今日饮水量
2. **主界面**：左键单击托盘图标展开主窗口，再点一次收起
3. **右键托盘**：完整菜单
   - 打开主界面
   - 现在提醒我（立即在右下角弹迷你卡片）
   - 工作状态（会议中 / 深度专注 / 空隙时刻）
   - 提醒间隔（30 / 45 / 60 / 90 分钟）
   - 暂停一小时
   - 开机自启（勾/取消）
   - 退出
4. **定时提醒**：默认每 45 分钟在右下角弹出迷你卡片，含一句观察语和三档打卡按钮。10 秒不点自动收起，也可以点「稍后 10 分钟」延后
5. **关闭 X 按钮**：主窗口右上角 × 是「收到托盘」，不是真退出。真要退出走托盘右键
6. **会议中**：切到「会议中」状态，任何提醒静默，边缘光晕熄灭。开会前顺手切一下

## 四 开机自启

首次安装完自动加入开机自启，静默启动（不弹主窗口，只在托盘就位）。

想手动切换：右键托盘 → 开机自启（勾选/取消勾选）。

系统层面：`app.setLoginItemSettings({openAtLogin: true, openAsHidden: true, args: ['--hidden']})` — 用的是 Electron 官方 API，Windows 会把它写进注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，跟微信、Slack、Everything 是同一个位置。

## 五 数据存哪

`%APPDATA%\润 Runn\runn-state.json` — 只有你本机能看到，不上传任何服务器。

内容大概长这样：
```json
{
  "today": "2026-7-1",
  "ml": 640,
  "cups": 3,
  "target": 2500,
  "streak": 6,
  "history": [...],
  "status": "focus",
  "interval": 45
}
```

想清空重来：直接删这个文件。

## 六 目录结构

```
desktop/
├── package.json            Electron 应用清单 + electron-builder 打包配置
├── main.js                 主进程：托盘、定时、窗口、自启、IPC handler
├── preload.js              预加载脚本：安全暴露 window.runn API 给渲染层
├── renderer/
│   ├── main.html           主窗口界面（1280x860 无边框）
│   └── mini.html           右下角迷你卡片（340x200 无边框透明）
├── tools/
│   └── gen-icons.js        纯 Node 手工生成 PNG 图标（无外部依赖）
├── assets/                 图标（gen-icons 运行后产生）
│   ├── icon.png / icon-*.png
│   └── tray.png
├── build.bat               Windows 一键构建脚本
├── release/                打包产物（构建后产生，含 .exe）
└── README-桌面版.md         本文件
```

## 七 一线大厂对齐清单

- [x] 单实例锁（重复启动激活现有实例，不开两个）
- [x] 系统托盘（图标常驻，右键完整菜单）
- [x] 无边框主窗口（自定义标题栏，可拖动）
- [x] 关闭到托盘（首次弹通知提示）
- [x] 静默开机自启（`openAsHidden: true`，不打扰你晨间工作）
- [x] 桌面通知（原生 Windows 通知 + 我们自定义的迷你卡片）
- [x] 数据持久化（应用数据目录，跟随用户配置文件）
- [x] 状态持久化（重启后状态、间隔、统计都在）
- [x] 快捷菜单（右键托盘直接切状态/间隔）
- [x] 暂停机制（会议中静默/暂停一小时）
- [x] 安装包（NSIS，创建开始菜单和桌面快捷方式，可选安装目录）

## 八 已知限制

- **图标是纯 Node 生成的简化水滴**：若想换成设计精修版，把 `assets/icon.png`（256x256+）和 `assets/tray.png`（32x32）替换掉重新打包即可
- **打包出的 .exe 无签名**：Windows Defender 首次运行可能拦截，点「更多信息 → 仍要运行」放行即可（师兄课上讲过，属于个人开发的正常现象）
- **仅 Windows x64**：Mac / Linux 需要各自打包（`npm run dist -- --mac` / `--linux`），但托盘和自启行为略有差异
- **不接日历**：v2 计划接飞书 / Outlook 日历自动识别会议时段，v1 暂手动切换

## 九 下一步

- v2：加托盘徽标（当日饮水进度画在图标上）
- v3：接飞书 / Outlook 日历 API 自动切「会议中」
- v4：接体检报告 OCR 个性化饮水目标
- v5：多用户 · 团队痛风互助（慎重评估）

---

RUNN · v1.0 · MADE FOR THE DESK-BOUND

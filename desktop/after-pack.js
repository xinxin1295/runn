// electron-builder afterPack 钩子:给 macOS 应用做 ad-hoc 自签名。
// 没有 Apple 付费开发者证书时,electron-builder 默认跳过签名,
// 导致苹果芯片上「已损坏无法打开」。这里在打包后、生成 dmg 前,
// 用 codesign 做 ad-hoc 签名(sign -),让 app 能被 Gatekeeper 放行运行。
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[after-pack] ad-hoc 签名: ${appPath}`);
  try {
    execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: "inherit" });
    console.log("[after-pack] 签名完成,校验:");
    execSync(`codesign -dv --verbose=2 "${appPath}"`, { stdio: "inherit" });
  } catch (e) {
    console.error("[after-pack] 签名失败:", e.message);
    throw e;
  }
};

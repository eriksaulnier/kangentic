const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

module.exports = async function afterPack(context) {
  const exeName = context.packager.appInfo.productFilename;
  const platform = context.electronPlatformName;
  let electronBinaryPath;
  if (platform === 'darwin') {
    electronBinaryPath = path.join(context.appOutDir, `${exeName}.app`, 'Contents', 'MacOS', exeName);
  } else if (platform === 'win32') {
    electronBinaryPath = path.join(context.appOutDir, `${exeName}.exe`);
  } else {
    // Linux: binary has no extension
    electronBinaryPath = path.join(context.appOutDir, exeName);
  }

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};

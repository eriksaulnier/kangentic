const { execFileSync } = require('child_process');

let moduleInstalled = false;

function ensureTrustedSigningModule() {
  if (moduleInstalled) return;
  execFileSync('pwsh.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Install-Module -Name TrustedSigning -Force -Scope CurrentUser -ErrorAction SilentlyContinue',
  ], { stdio: 'inherit', timeout: 120000 });
  moduleInstalled = true;
}

exports.default = async function sign(configuration) {
  if (!process.env.AZURE_TENANT_ID) return;

  ensureTrustedSigningModule();

  // Use Invoke-TrustedSigning PowerShell module directly.
  // This avoids the signtool/dlib dependency and properly handles
  // file paths with spaces (which azureSignOptions does not).
  const command = [
    'Invoke-TrustedSigning',
    '-FileDigest', 'SHA256',
    '-Endpoint', `'${process.env.AZURE_SIGNING_ENDPOINT}'`,
    '-CertificateProfileName', `'${process.env.AZURE_CERT_PROFILE}'`,
    '-CodeSigningAccountName', `'${process.env.AZURE_SIGNING_ACCOUNT}'`,
    '-Files', `'${configuration.path}'`,
  ].join(' ');

  execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    stdio: 'inherit',
    timeout: 120000,
  });
};

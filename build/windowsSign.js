const { execFileSync } = require('child_process');

exports.default = async function sign(configuration) {
  if (!process.env.AZURE_CODE_SIGNING_DLIB) return;

  execFileSync('signtool', [
    'sign',
    '/v', '/debug',
    '/dlib', process.env.AZURE_CODE_SIGNING_DLIB,
    '/dmdf', process.env.AZURE_METADATA_JSON,
    '/td', 'sha256',
    '/fd', 'sha256',
    configuration.path,
  ]);
};

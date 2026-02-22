const { spawn } = require('child_process');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const electronPath = path.join(projectDir, 'node_modules', 'electron', 'dist', 'electron.exe');

// Start Vite dev server
const vite = spawn('npx', ['vite', '--port', '5173'], {
  cwd: projectDir,
  stdio: 'pipe',
  shell: true,
});

vite.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(`[vite] ${text}`);

  // When Vite is ready, build main + preload and launch Electron
  // Strip ANSI escape codes before checking
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  if (clean.includes('Local:')) {
    console.log('[dev] Vite ready, building main process...');
    buildAndLaunch();
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(`[vite:err] ${data}`);
});

function buildAndLaunch() {
  // Use Forge's Vite plugin to build main and preload via electron-forge start
  // Since Forge start has issues, we'll build manually with esbuild and launch Electron
  const esbuild = require('esbuild');

  const commonOptions = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron', 'better-sqlite3', 'node-pty', 'simple-git'],
    define: {
      'MAIN_WINDOW_VITE_DEV_SERVER_URL': JSON.stringify('http://localhost:5173'),
      'MAIN_WINDOW_VITE_NAME': JSON.stringify('main_window'),
    },
    sourcemap: true,
  };

  Promise.all([
    esbuild.build({
      ...commonOptions,
      entryPoints: [path.join(projectDir, 'src/main/index.ts')],
      outfile: path.join(projectDir, '.vite/build/index.js'),
    }),
    esbuild.build({
      ...commonOptions,
      entryPoints: [path.join(projectDir, 'src/preload/preload.ts')],
      outfile: path.join(projectDir, '.vite/build/preload.js'),
    }),
  ]).then(() => {
    console.log('[dev] Build complete, launching Electron...');

    const electron = spawn(electronPath, [projectDir], {
      cwd: projectDir,
      stdio: 'inherit',
    });

    electron.on('close', (code) => {
      console.log(`[dev] Electron exited with code ${code}`);
      vite.kill();
      process.exit(code || 0);
    });
  }).catch((err) => {
    console.error('[dev] Build failed:', err);
    vite.kill();
    process.exit(1);
  });
}

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});

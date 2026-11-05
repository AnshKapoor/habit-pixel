// Builds the Expo web app into desktop/app/web and copies the app icon next to main.js.
// Keeps desktop/app/package.json's version in step with app.json.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appDir = path.join(__dirname, 'app');

execSync('npx expo export --platform web --output-dir desktop/app/web --clear', { cwd: root, stdio: 'inherit' });
fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(appDir, 'icon.png'));

// electron-builder never packages folders named node_modules, but the web export keeps
// fonts (e.g. Ionicons) under web/assets/node_modules. Rename it and update references.
const webDir = path.join(appDir, 'web');
const from = path.join(webDir, 'assets', 'node_modules');
if (fs.existsSync(from)) {
  fs.renameSync(from, path.join(webDir, 'assets', 'vendor'));
  const rewrite = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) rewrite(p);
      else if (/\.(js|html|css|json)$/.test(entry.name)) {
        const text = fs.readFileSync(p, 'utf8');
        const next = text.split('/assets/node_modules/').join('/assets/vendor/');
        if (next !== text) fs.writeFileSync(p, next);
      }
    }
  };
  rewrite(webDir);
}

const version = require(path.join(root, 'app.json')).expo.version;
const pkgPath = path.join(appDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

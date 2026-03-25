// Run vite build with increased stack/heap limits
const { execSync } = require('child_process');
const path = require('path');

const projectDir = path.resolve(__dirname);
console.log('Project dir:', projectDir);

try {
    const output = execSync(
        'node --max-old-space-size=4096 --stack-size=65536 node_modules/vite/bin/vite.js build',
        {
            cwd: projectDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
            timeout: 300000
        }
    );
    console.log('STDOUT:', output);
    console.log('BUILD SUCCESS');
} catch (err) {
    console.log('STDOUT:', err.stdout);
    console.log('STDERR:', err.stderr);
    console.log('EXIT CODE:', err.status);
    process.exit(1);
}

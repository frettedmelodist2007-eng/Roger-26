const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const mainScript = path.join(__dirname, '../desktop/main.js');

const child = spawn(electron, [mainScript], {
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined // Ensure this is unset!
    }
});

child.on('close', (code) => {
    process.exit(code);
});

const fs = require('fs').promises;
const path = require('path');

const AUTH_PATH = path.join(process.cwd(), 'auth');
const MAX_FILES = 3;
const CLEANUP_INTERVAL = 15 * 60 * 1000;


async function cleanAuth() {
    try {
        await fs.mkdir(AUTH_PATH, { recursive: true });
        const files = await fs.readdir(AUTH_PATH);
        const filesToDelete = files.filter(file => file !== 'creds.json');
        if (filesToDelete.length <= MAX_FILES) return;
        for (const file of filesToDelete) {
            const filePath = path.join(AUTH_PATH, file);
            await fs.unlink(filePath).catch(() => {});
        }
        console.log(`[AUTH] Cleaned ${filesToDelete.length} files`);
    } catch (error) {
        console.error('[AUTH] Cleanup error:', error);
    }
}

function start() {
    cleanAuth();
    setInterval(cleanAuth, CLEANUP_INTERVAL);
}

module.exports = { start };
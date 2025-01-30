const simpleGit = require('simple-git');
const path = require('path');
const git = simpleGit();
const REPO_URL = 'https://github.com/master-josh/Axiom-Md.git';
const BRANCH = 'main';
const axios = require('axios');
const fs = require('fs');
const { writeFile } = require('fs/promises');
const startTime = Date.now();

function getUptime() {
    return Date.now() - startTime;
}

function formatTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;

    let timeString = '';
    if (days) timeString += `${days}d `;
    if (hours) timeString += `${hours}h `;
    if (minutes) timeString += `${minutes}m `;
    if (seconds) timeString += `${seconds}s`;

    return timeString.trim() || '0s';
}


async function ensureRepo() {
    try {
        const gitDir = path.join(process.cwd(), '.git');
        if (!fs.existsSync(gitDir)) {
            await git.init();
            await git.addRemote('origin', REPO_URL);
            await git.fetch('origin');
            await git.reset(['--hard', `origin/${BRANCH}`]);
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function checkUpdates() {
    await git.fetch('origin', BRANCH);
    const status = await git.status();
    return {
        hasUpdate: status.behind > 0,
        commits: await git.log(['HEAD..origin/' + BRANCH])
    };
}

async function MakeSession(session_id, authFile) {
    return new Promise((resolve, reject) => {
        try {
            if (!session_id) return reject(new Error('Session ID is required'));
            if (!authFile) return reject(new Error('Auth file path is required'));

            const authDir = path.dirname(authFile);
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            const timeout = setTimeout(() => {
                reject(new Error('Session retrieval timed out'));
            }, 30000);

            axios.get(`https://session-wine.vercel.app/retrieve/${session_id}`, {
                headers: {
                    'x-api-key': '8dEZvgJU6Ew2LRoa1zniL0iAUVEtDRGY'
                }
            })
            .then(async (response) => {
                clearTimeout(timeout);
                if (!response.data.base64Data) {
                    return reject(new Error('Invalid session data'));
                }
                const decodedData = Buffer.from(response.data.base64Data, 'base64');
                await writeFile(authFile, decodedData);
                resolve(true);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error.response?.data?.error || error.message);
            });

        } catch (error) {
            reject(error);
        }
    });
}

async function updateConfigEnv(key, value) {
    const configPath = path.join(process.cwd(), 'config.env');
    let content = '';

    try {
        if (fs.existsSync(configPath)) {
            content = fs.readFileSync(configPath, 'utf8');
        }const lines = content.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`${key}=`)) {
                lines[i] = `${key}=${value}`;
                found = true;
                break;
            }
        }if (!found) {
            lines.push(`${key}=${value}`);
        }fs.writeFileSync(configPath, lines.join('\n'));
        return true;
    } catch (error) {
        console.error("Config Update Error:", error);
        return false;
    }
}


const getVideoId = (videoUrl) => {
    if (videoUrl.includes('watch?v=')) {
        const id = videoUrl.split('watch?v=')[1] || '';
        return id ? id.split('&')[0] : null;
    }
    if (videoUrl.includes('youtu.be/')) {
        const id = videoUrl.split('youtu.be/')[1] || '';
        return id ? id.split('&')[0] : null;
    }
    if (videoUrl.includes('shorts/')) {
        const id = videoUrl.split('shorts/')[1] || '';
        return id ? id.split('&')[0] : null;
    }
    return null;
};


const fetchVideoData = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to fetch data');
    }
};


const getVideoInfo = async (url) => {
    const videoId = getVideoId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    const videoData = await fetchVideoData(`https://api.y2matego.com/yt/${videoId}`);
    if (videoData.error || !videoData.data || !videoData.data.formats) {
        throw new Error('Failed to fetch video details');
    }

    const videoFormats = videoData.data.formats
        .filter((f) => f.type === 'videos')
        .map((f) => ({
            id: f.id,
            quality: f.format,
            filesize: f.filesize,
        }));

    const audioFormats = videoData.data.formats
        .filter((f) => f.type === 'audios')
        .map((f) => ({
            id: f.id,
            quality: f.format,
            filesize: f.filesize,
        }));

    return {
        id: videoId,
        title: videoData.data.name,
        duration: videoData.data.duration,
        thumbnail: videoData.data.thumbnail,
        formats: {
            video: videoFormats,
            audio: audioFormats,
        },
    };
};


const getDownloadLink = async (videoId, formatId, type = 'video') => {
    if (!['video', 'audio'].includes(type)) {
        throw new Error('Invalid type parameter. Must be "video" or "audio"');
    }

    const endpoint =
        type === 'video'
            ? `https://api.y2matego.com/yt/${videoId}/videos/${formatId}`
            : `https://api.y2matego.com/yt/${videoId}/audios/${formatId}`;

    const downloadData = await fetchVideoData(endpoint);

    if (downloadData.error) {
        throw new Error('Failed to get download URL');
    }

    if (downloadData.status === 200) {
        return downloadData.data;
    }

    while (true) {
        const statusResult = await fetchVideoData(
            `https://api.y2matego.com/yt/${videoId}/status/${downloadData.data}`
        );

        if (statusResult.error) {
            throw new Error('Failed to check status');
        }

        if (statusResult.status === 200) {
            return statusResult.data;
        }

        if (statusResult.status !== 102) {
            throw new Error('Processing failed');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
};



module.exports = {
    getVideoInfo,
    getDownloadLink,
    getUptime,
    formatTime,
    ensureRepo,
    checkUpdates,
    MakeSession,
    updateConfigEnv,
};
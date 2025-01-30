const { command } = require("../lib");
const axios = require("axios");
const fs = require("fs");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { getBuffer } = require("../lib/functions");
const { ensureRepo, checkUpdates } = require("../lib/utils");
const exec = require('child_process').exec;
const apiUrl ="https://api.elevenlabs.io/v1/text-to-speech/ErXwobaYiN019PkySvjV/stream";
const apiKey = "527cdd000ff0fca268a9d8eaf5d218a8";
const simpleGit = require('simple-git');
const git = simpleGit();
const BRANCH = 'main';

command({
    pattern: "vv",
    fromMe: true,
    desc: "View once media revealer",
    type: "utility",
  },
  async (message, match, m) => {
    if (!m.quoted?.message?.viewOnceMessageV2)
      return message.reply("Reply to a view once message");
    const buffer = await downloadMediaMessage(m.quoted,"buffer",{},{reuploadRequest: message.client.updateMediaMessage,});
    const msg = m.quoted.message.viewOnceMessageV2.message;
    if (msg.imageMessage) {
      return await message.client.sendMessage(
        message.jid,
        { image: buffer },
        { quoted: m }
      );
    } else if (msg.videoMessage) {
      return await message.client.sendMessage(
        message.jid,
        { video: buffer },
        { quoted: m }
      );
    }
  }
);

command({
    pattern: "block",
    fromMe: true,
    desc: "Block a user",
    type: "user"
}, async (message, match, m) => {
    try {
        const user = message.mention[0] || message.reply_message?.jid || match;
        if (!user) return await message.reply("*Tag a user or reply to their message*");
        await message.client.updateBlockStatus(user, "block");
        return await message.reply("*User blocked successfully ✓*");
    } catch (error) {
        return await message.reply("*Failed to block user*");
    }
});

command({
    pattern: "unblock",
    fromMe: true,
    desc: "Unblock a user",
    type: "user"
}, async (message, match, m) => {
    try {
        const user = message.mention[0] || message.reply_message?.jid || match;
        if (!user) return await message.reply("*Tag a user or reply to their message*");
        await message.client.updateBlockStatus(user, "unblock");
        return await message.reply("*User unblocked successfully ✓*");
    } catch (error) {
        return await message.reply("*Failed to unblock user*");
    }
});

command({
    pattern: "setname",
    fromMe: true,
    desc: "Change bot display name",
    type: "user"
}, async (message, match, m) => {
    try {
        if (!match) return await message.reply("*Enter new name*\nExample: .setname Bot Name");
        await message.client.updateProfileName(match.trim());
        return await message.reply("*Display name updated successfully ✓*");
    } catch (error) {
        return await message.reply("*Failed to update display name*");
    }
});

command({
    pattern: "setpp",
    fromMe: true,
    desc: "Set bot's profile picture",
    type: "user"
}, async (message, match, m) => {
    try {
        if (!message.reply_message || !message.reply_message.image) {
            return await message.reply("*Reply to an image to set as profile picture*");
        }
        const media = await m.quoted.download();
        await message.client.updateProfilePicture(message.client.user.id, media);
        return await message.reply("*Profile picture updated successfully*");
    } catch (error) {
        console.error(error);
        return await message.reply("*Failed to update profile picture*");
    }
});

command({
    pattern: "jid",
    fromMe: true,
    desc: "Get JID of chat/user",
    type: "utility"
}, async (message, match, m) => {
    try {
        let response = "";
        if (message.reply_message) {
            response += `${message.reply_message.jid}\n`;
        }response += `${message.jid}\n`;
        if (message.isGroup) {
            response += `${message.jid}\n`;
            if (message.reply_message) {
                response += `${message.reply_message.participant}\n`;
            }
        }return await message.reply(response.trim());
    } catch (error) {
        console.error(error);
        return await message.reply("*Failed to get JID*");
    }
});

command({
    pattern: "save", 
    fromMe: true,
    desc: "Save/forward message to sudo DM",
    type: "utility"
}, async (message, match, m) => {
    try {
        if (!m.quoted) {
            return await message.reply("*Reply to a message to save it*");
        }
        let mediaBuffer;
        let mimetype;
        
        if (m.quoted.mtype === 'imageMessage' || 
            m.quoted.mtype === 'videoMessage' ||
            m.quoted.mtype === 'audioMessage' ||
            m.quoted.mtype === 'stickerMessage' ||
            m.quoted.mtype === 'documentMessage') {
            mediaBuffer = await m.quoted.download();
            mimetype = m.quoted.mimetype;
        }
        const text = m.quoted.text || m.quoted.caption || "";
        const sudo = message.client.user.id.split(':')[0];
        if (mediaBuffer) {
            let msgType = m.quoted.mtype.replace('Message','');
            await message.client.sendMessage(sudo + "@s.whatsapp.net", {
                [msgType.toLowerCase()]: mediaBuffer,
                caption: text,
                mimetype: mimetype
            });
        } else {
            await message.client.sendMessage(sudo + "@s.whatsapp.net", {
                text: text
            });
        }
    } catch (error) {
        console.error(error);
        return await message.reply("*Failed to save message*");
    }
});

command({
    pattern: "tts",
    fromMe: true,
    desc: "text to speech",
    type: "utility"
},
  async (message, match, m) => {
    if (match.length > 80 || !match)
      return message.send(
        message.jid,
        "i need something short/i need a query",
        { quoted: m }
      );
    const requestBody = {
      model_id: "eleven_multilingual_v2",
      text: match,
    };
    const { data } = await axios.post(apiUrl, requestBody, {
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      responseType: "arraybuffer",
    });
    await fs.writeFileSync("temp.mp3", data);
    let bb = await fs.readFileSync("temp.mp3");
    await message.client.sendMessage(
      message.jid,
      {
        audio: bb,
        mimetype: "audio/mp4",
        waveform: [20, 60, 70, 54, 69, 80, 39],
        ptt: true,
      },
      { quoted: m }
    );
    await fs.unlinkSync("temp.mp3");
  }
);

command({
    pattern: "forward ?(.*)",
    fromMe: true,
    desc: "Forward messages to specified JID(s)",
    type: "user"
}, async (message, match, m) => {
    if (!match) return message.reply("*Usage:*\n.forward jid1,jid2,jid3\n\nExample: .forward 1234@s.whatsapp.net");
    if (!message.reply_message) return message.reply("*Reply to a message to forward it!*");
    try {
        const jids = (match ? match[0]?.toLowerCase() : null)?.split(',').map(jid => {
            if (!jid.includes('@')) {
            return jid.trim() + '@s.whatsapp.net';
            }return jid.trim();
        }) || [];

        let successCount = 0;
        let failCount = 0;

        for (let jid of jids) {
            try {
                await message.client.relayMessage(jid, 
                    message.reply_message.message, 
                    { messageId: message.reply_message.key.id }
                );
                successCount++;
            } catch (err) {
                console.error(`Forward Error for ${jid}:`, err);
                failCount++;
            }
        }return message.reply(`*Forwarding Complete*\n✓ Success: ${successCount}\n× Failed: ${failCount}`);
    } catch (error) {
        console.error("Forward Error:", error);
        return message.reply("*Failed to forward message!*");
    }
});

command({
    pattern: "del",
    fromMe: true,
    desc: "Delete bot's message",
    type: "user"
}, async (message, match) => {
    try {
        if (!message.reply_message) {
            return await message.reply("*Reply to a message to delete it!*");
        }
    
        if (message.isGroup && message.reply_message.key.participant !== message.client.user.id) {
            if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
        }

        await message.client.sendMessage(message.jid, {
            delete: message.reply_message.key
        });
    } catch (error) {
        console.error("Delete Error:", error);
        return message.reply("*Failed to delete message!*");
    }
});

command({
    pattern: "cppdp",
    fromMe: true,
    desc: "Copy someone's profile picture",
    type: "user"
}, async (message, match) => {
    try {
        if (!message.reply_message) {
            return await message.reply("*Reply to someone to copy their profile picture!*");
        }
        const targetJid = message.reply_message.jid;
        let pfp;
        try {
            pfp = await message.client.profilePictureUrl(targetJid, 'image');
        } catch (err) {
            return message.reply("*User has no profile picture!*");
        }
        const buffer = await getBuffer(pfp);
        await message.client.updateProfilePicture(message.client.user.id, buffer);
        return message.reply("*Successfully copied profile picture!*");

    } catch (error) {
        console.error("Copy PP Error:", error);
        return message.reply("*Failed to copy profile picture!*");
    }
});

command({
    pattern: "update",
    fromMe: true,
    desc: "Check for bot updates",
    type: "user"
}, async (message) => {
    try {
        await message.reply("*Checking for updates...*");
        
        if (!await ensureRepo()) {
            return message.reply("*Repository setup failed!*");
        }

        const update = await checkUpdates();
        if (!update.hasUpdate) {
            return message.reply("*Bot is up to date!*");
        }

        let updateText = "*Updates available!*\n\n*Changes:*\n";
        update.commits.all.forEach(c => {
            updateText += `\n• ${c.message}\n  _${c.date.split('T')[0]}_\n`;
        });
        updateText += "\n*Use .updatebot to update*";
        
        await message.reply(updateText);

    } catch (error) {
        console.error("Update Check Error:", error);
        return message.reply("*Failed to check updates!*");
    }
});

command({
    pattern: "updatebot",
    fromMe: true,
    desc: "Update bot to latest version",
    type: "user"
}, async (message) => {
    try {
        await message.reply("*Updating bot...*");

        await git.reset(['--hard', 'HEAD']);
        const result = await git.pull('origin', BRANCH);

        if (result.files.includes('package.json')) {
            await message.reply("*Installing new dependencies...*");
            await new Promise((resolve, reject) => {
                exec('npm install', (error, stdout) => {
                    if (error) reject(error);
                    else resolve(stdout);
                });
            });
        }
        await message.reply("*Update successful! Restarting...*");
        process.exit(0);

    } catch (error) {
        console.error("Update Error:", error);
        return message.reply("*Update failed:* " + error.message);
    }
});

command({
    pattern: "restart",
    fromMe: true,
    desc: "Restart bot",
    type: "user"
}, async (message) => {
    try {
        await message.reply("*Restarting bot...*");
        process.exit(0);
    } catch (error) {
        console.error("Restart Error:", error);
        return message.reply("*Failed to restart bot!*");
    }
});

command({
    pattern: "edit ?(.*)",
    fromMe: true,
    desc: "Send and edit message",
    type: "user"
}, async (message, match, m) => {
    try {
        const input = match ? match[0] : null;
        if (!input) return message.reply("*Provide text to edit*\nExample: .edit text1|text2");
        
        const [text1, text2] = input.split("|");
        if (!text1 || !text2) return message.reply("*Provide both texts separated by |*");

        const msg = await message.client.sendMessage(message.jid, { text: text1 });
        
        setTimeout(async () => {
            await message.client.sendMessage(message.jid, { 
                text: text2,
                edit: msg.key 
            });
        }, 3000);

    } catch (error) {
        console.error(error);
        return message.reply("*Failed to edit message*");
    }
});
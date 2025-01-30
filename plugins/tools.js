const { command } = require("../lib");
const { writeExifImg } = require("../lib/sticker");
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Jimp = require('jimp');
const { getAutoStatus, setAutoStatus } = require("../lib/database/AutoStatus");
const { getAntiDelete, setAntiDelete, getDestination, setDestination } = require("../lib/database/antidelete");
const { 
    addDMReply, 
    deleteDMReply, 
    getDMReplies, 
    toggleDMReply, 
    getDMStatus 
} = require("../lib/database/autoreply");
const config = require("../config");
const { TinyURL, extractUrlFromMessage, IsGd } = require("../lib/functions");
const path = require('path');
const { updateConfigEnv } = require("../lib/utils");


command({
    pattern: "sudo ?(.*)",
    fromMe: true,
    desc: "Add a SUDO user",
    type: "user"
}, async (message, match, m) => {
    try {
        if (!match[0]) {
            return await message.reply("*Provide a number to add as SUDO*\nExample: .sudo 1234567890");
        }

        const newSudo = match[0].replace(/[^0-9]/g, '');
        if (!newSudo) return message.reply("*Invalid number format!*");

        let currentSudo = process.env.SUDO || '';
        let sudoList = currentSudo.split(',').filter(x => x);

        if (sudoList.includes(newSudo)) {
            return await message.reply("*This number is already a SUDO user!*");
        }

        sudoList.push(newSudo);
        const newSudoString = sudoList.join(',');

        if (await updateConfigEnv('SUDO', newSudoString)) {
            process.env.SUDO = newSudoString;
            return await message.reply(`*Successfully added @${newSudo} as SUDO user!*\nRestart bot to apply changes.`, {
                mentions: [`${newSudo}@s.whatsapp.net`]
            });
        } else {
            return await message.reply("*Failed to update config!*");
        }

    } catch (error) {
        console.error("AddSudo Error:", error);
        return await message.reply("*Failed to add SUDO user!*");
    }
});

command({
    pattern: "rmsudo ?(.*)",
    fromMe: true,
    desc: "Remove a SUDO user",
    type: "user"
}, async (message, match, m) => {
    try {
        if (!match[0]) {
            return await message.reply("*Provide a number to remove from SUDO*\nExample: .rmsudo 1234567890");
        }
        const targetSudo = match[0].replace(/[^0-9]/g, '');
        if (!targetSudo) return message.reply("*Invalid number format!*");
        let currentSudo = process.env.SUDO || '';
        let sudoList = currentSudo.split(',').filter(x => x);
        if (!sudoList.includes(targetSudo)) {
            return await message.reply("*This number is not a SUDO user!*");
        }
        sudoList = sudoList.filter(x => x !== targetSudo);
        const newSudoString = sudoList.join(',');
        if (await updateConfigEnv('SUDO', newSudoString)) {
            process.env.SUDO = newSudoString;
            return await message.reply(`*Successfully removed @${targetSudo} from SUDO users!*\nRestart bot to apply changes.`, {
                mentions: [`${targetSudo}@s.whatsapp.net`]
            });
        } else {
            return await message.reply("*Failed to update config!*");
        }

    } catch (error) {
        console.error("DelSudo Error:", error);
        return await message.reply("*Failed to remove SUDO user!*");
    }
});

command({
    pattern: "attp",
    fromMe: true,
    desc: "Convert text to sticker",
    type: "sticker"
}, async (message, match, m) => {
    try {
        if (!match[0]) {
            return await message.reply("*Please provide text*\nExample: .attp Hello");
        }

        const text = match[0].trim();
        const image = await new Jimp(512, 512, 0x0);
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const textWidth = Jimp.measureText(font, text);
        const textHeight = Jimp.measureTextHeight(font, text);
        const x = (512 - textWidth) / 2;
        const y = (512 - textHeight) / 2;
        image.print(font, x, y, text);
        const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
        const sticker = await writeExifImg(buffer, {
            packname: "Axiom",
            author: "Bot"
        });
        return await message.client.sendMessage(message.jid, {
            sticker: { url: sticker }
        }, { quoted: m });
    } catch (error) {
        console.error(error);
        return await message.reply("Error creating text sticker");
    }
});

command({
    pattern: "tovid",
    fromMe: true,
    desc: "Convert animated sticker to video",
    type: "converter"
}, async (message, _match, m) => {
    try {
        if (!m.quoted) return await message.reply("*Reply to an animated sticker*");
        if (m.quoted.mtype !== 'stickerMessage') return await message.reply("*This is not a sticker*");

        const stickerBuffer = await m.quoted.download();
        
        if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');
        
        const timestamp = new Date().getTime();
        const tempFile = `./temp/sticker_${timestamp}.webp`;
        const outputMp4 = `./temp/video_${timestamp}.mp4`;

        await fs.promises.writeFile(tempFile, stickerBuffer);

        // Direct WebP to MP4 conversion
        await new Promise((resolve, reject) => {
            ffmpeg(tempFile)
                .inputFormat('webp')
                .outputOptions([
                    '-pix_fmt', 'yuv420p',
                    '-vf', 'scale=512:-1:flags=lanczos',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-movflags', '+faststart',
                    '-loop', '0'
                ])
                .toFormat('mp4')
                .on('end', resolve)
                .on('error', reject)
                .save(outputMp4);
        });

        await message.client.sendMessage(message.jid, {
            video: fs.readFileSync(outputMp4),
            caption: "Converted by Axiom-MD"
        }, { quoted: m });

        // Cleanup
        [tempFile, outputMp4].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

    } catch (error) {
        console.error('Sticker Conversion Error:', error);
        return await message.reply("*Failed to convert sticker to video!*\nMake sure it's an animated sticker.");
    }
});
// command({
//     pattern: "take",
//     fromMe: true,
//     desc: "Change sticker packname/author",
//     type: "sticker"
// }, async (message, match, m) => {
//     try {
//         if (!m.quoted) {
//             return await message.reply("*Please reply to a sticker*");
//         }if (m.quoted.mtype !== 'stickerMessage') {
//             return await message.reply("*This is not a sticker*");
//         }let [packname, author] = match.split(",");
//         if (!packname) packname = "Axiom";
//         if (!author) author = "Bot";
//         const buffer = await m.quoted.download();
//         const sticker = await writeExifImg(buffer, {
//             packname: packname.trim(),
//             author: author.trim()
//         });return await message.client.sendMessage(message.jid, {
//             sticker: { url: sticker }
//         }, { quoted: m });
//     } catch (error) {
//         console.error(error);
//         return await message.reply("Error modifying sticker");
//     }
// });


command({
    pattern: "autostatus ?(.*)",
    fromMe: true,
    desc: "Check, enable, or disable auto status view",
    type: "whatsapp"
}, async (message, match) => {
    // console.log("Match groups:", match); 

    const option = match ? match[0]?.toLowerCase() : null;

    if (option === "on") {
        await setAutoStatus(true);
        return await message.reply('*Auto Status View Enabled ✓*');
    } else if (option === "off") {
        await setAutoStatus(false);
        return await message.reply('*Auto Status View Disabled ✓*');
    } else {
        const status = await getAutoStatus();
        return await message.reply(
            `*Auto Status View: ${status ? 'ON' : 'OFF'}*\n` +
            'Use: .autostatus on or .autostatus off'
        );
    }
});

command({
    pattern: "antidelete ?(.*)",
    fromMe: true,
    desc: "Toggle anti-delete message and set destination (chat/sudo)",
    type: "whatsapp"
}, async (message, match, m) => {
    try {
        const option = match ? match[0]?.toLowerCase() : null;

        if (option === "on") {
            await setAntiDelete(true);
            return await message.reply('*Anti-Delete Enabled ✓*');
        } 
        
        else if (option === "off") {
            await setAntiDelete(false);
            return await message.reply('*Anti-Delete Disabled ✓*');
        }
        
        else if (option === "chat") {
            await setDestination(message.jid);
            return await message.reply("*Anti-Delete destination set to current chat ✓*");
        }

        else if (option === "sudo") {
            const sudo = config.SUDO.split(",")[0];
            const sudoJid = sudo + "@s.whatsapp.net";
            await setDestination(sudoJid);
            return await message.reply("*Anti-Delete destination set to sudo chat ✓*");
        }
        
        else {
            const status = await getAntiDelete();
            const dest = await getDestination();
            const sudo = config.SUDO.split(",")[0] + "@s.whatsapp.net";
            
            let destType = "Not Set";
            if (dest) {
                destType = dest === sudo ? "Sudo Chat" : "Current Chat";
            }

            return await message.reply(
                `*Anti Delete: ${status ? 'ON' : 'OFF'}*\n` +
                `*Destination: ${destType}*\n` +
                'Use: .antidelete on/off\n' +
                'Use: .antidelete chat (set current chat)\n' +
                'Use: .antidelete sudo (set sudo chat)'
            );
        }

    } catch (error) {
        console.log(error);
        return await message.reply("*Failed to change anti-delete setting*");
    }
});

command({
    pattern: "dmreply ?(.*)",
    fromMe: true,
    desc: "Configure DM auto replies",
    type: "misc"
}, async (message, match) => {
    if (message.isGroup) return message.reply("This command is for DMs only!");
    
    const usage = `*DM Auto Reply Usage*
• .dmreply on - Enable auto replies
• .dmreply off - Disable auto replies
• .dmreply add <pattern>,<response>
• .dmreply del <pattern>
• .dmreply list

Example: .dmreply add hi,Hello there!`;

    const input = match ? match[0] : null;
    if (!input) return message.reply(usage);

    const [cmd, ...args] = input.split(' ');
    
    try {
        switch(cmd.toLowerCase()) {
            case 'add': {
                const fullText = args.join(' ');
                const splitIndex = fullText.indexOf(',');
                
                if (splitIndex === -1) return message.reply(usage);
                
                const pattern = fullText.slice(0, splitIndex).trim();
                const response = fullText.slice(splitIndex + 1).trim();
                
                if (!pattern || !response) {
                    return message.reply('*Both pattern and response are required!*');
                }
                
                await addDMReply(pattern, response);
                return message.reply('*Auto reply added successfully!*');
            }
            case 'on': {
                await toggleDMReply(true);
                return message.reply('*DM Auto replies enabled!*');
            }
            
            case 'off': {
                await toggleDMReply(false);
                return message.reply('*DM Auto replies disabled!*');
            }
            
            case 'del': {
                const pattern = args.join(' ');
                if (!pattern) return message.reply(usage);
                
                await deleteDMReply(pattern.trim());
                return message.reply('*Auto reply deleted!*');
            }
            
            case 'list': {
                const replies = await getDMReplies();
                if (!replies.length) return message.reply('*No auto replies found!*');
                
                let list = '*DM Auto Replies:*\n\n';
                replies.forEach((reply, i) => {
                    list += `${i + 1}. Pattern: ${reply.pattern}\n   Reply: ${reply.response}\n\n`;
                });
                return message.reply(list);
            }
            
            default:
                return message.reply(usage);
        }
    } catch (error) {
        console.error('DMReply Error:', error);
        return message.reply('*Failed to add reply. Please check format!*');
    }
});

command({
    pattern: "tiny ?(.*)",
    fromMe: true, 
    desc: "Convert link to TinyURL",
    type: "utility"
}, async (message, match) => {
    const input = match ? match[0] : null;
    try {
        if (!input) return message.reply("*Need a link!*");
        
        const url = extractUrlFromMessage(match);
        if (!url) return message.reply("*Invalid URL!*");
        
        const shortened = await TinyURL(url);
        return message.reply(`*Shortened URL:* ${shortened.link}`);
        
    } catch (error) {
        console.error("TinyURL Error:", error);
        return message.reply("*Failed to shorten URL!*");
    }
});

command({
    pattern: "wame ?(.*)",
    fromMe: true,
    desc: "Convert number to wa.me link", 
    type: "utility"
}, async (message, match) => {
    try {
        const input = match ? match[0] : null;
        let number;
        
        if (message.reply_message?.jid) {
            number = message.reply_message.jid;
        } else if (message.mention?.[0]) {
            number = message.mention[0];
        } else if (input) {
            number = input.replace(/[^0-9]/g, '');
        } else {
            return message.reply("*Need a number!*");
        }

        number = number.split('@')[0];
        
        if (number.length < 10 || number.length > 15) {
            return message.reply("*Invalid number format!*");
        }
        
        const link = `https://wa.me/${number}`;
        return message.reply(`*WhatsApp Link:* ${link}`);

    } catch (error) {
        console.error("Wame Error:", error);
        return message.reply("*Failed to generate wa.me link!*");
    }
});

command({
    pattern: "isgd ?(.*)",
    fromMe: true,
    desc: "Convert link to Is.gd",
    type: "utility"
}, async (message, match) => {
    const input = match ? match[0] : null;
    try {
        if (!input) return message.reply("*Need a link!*");
        
        const url = extractUrlFromMessage(match);
        if (!url) return message.reply("*Invalid URL!*");
        
        const shortened = await IsGd(url);
        return message.reply(`*Shortened URL:* ${shortened.link}`);
        
    } catch (error) {
        console.error("Is.gd Error:", error);
        return message.reply("*Failed to shorten URL!*");
    }
});


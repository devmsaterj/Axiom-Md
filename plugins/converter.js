const { command } = require("../lib");
const config = require("../config");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { writeExifImg } = require("../lib/sticker");
const fs = require('fs');
const { writeFile } = require('fs/promises');

command({
    pattern: "vsticker ?(.*)",
    fromMe: true,
    desc: "Convert video/gif to animated sticker",
    type: "converter"
}, async (message, match) => {
    try {
        if (!message.reply_message) {
            return await message.reply("*Reply to a video/gif!*");
        }await message.reply("*Converting to sticker...*");
        let [packname, author] = (match[0] || "").split(",");
        packname = packname?.trim() || config.STICKER_PACKNAME || "Axiom-MD";
        author = author?.trim() || config.STICKER_AUTHOR || "Master-josh";
        const buffer = await downloadMediaMessage(
            message.reply_message,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: message.client.updateMediaMessage
            }
        );
        await message.client.VAS(message.jid, buffer, {
            packname,
            author,
            quoted: message
        });

    } catch (error) {
        console.error("VSticker Error:", error);
        return message.reply("*Failed to convert to sticker!*\n" + error.message);
    }
});

command({
    pattern: "sticker",
    fromMe: true,
    desc: "Convert image to sticker",
    type: "converter"
}, async (message, match, m) => {
    try {
        if (!m.quoted || !m.quoted.mtype === 'imageMessage') {
            return await message.reply("*Reply to an image*");
        }
        const buffer = await m.quoted.download();
        const sticker = await writeExifImg(buffer, {
            packname: "Axiom",
            author: "Bot"
        });return await message.client.sendMessage(message.jid, {
            sticker: { url: sticker }
        }, { quoted: m });
    } catch (error) {
        console.error(error);
        return await message.reply("Error creating sticker");
    }
});

command({
    pattern: "tovoice",
    fromMe: true,
    desc: "Convert audio to voice note",
    type: "converter"
}, async (message, match) => {
    try {
        if (!message.reply_message || (!message.reply_message.audio && !message.reply_message.video)) {
            return await message.reply("*Reply to an audio/video!*");
        }

        const buffer = await downloadMediaMessage(
            message.reply_message,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: message.client.updateMediaMessage
            }
        );

        await message.client.sendMessage(message.jid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            ptt: true
        });

    } catch (error) {
        console.error("Voice Convert Error:", error);
        return message.reply("*Failed to convert to voice note!*");
    }
});


command({
    pattern: "take ?(.*)",
    fromMe: true,
    desc: "Change sticker pack info",
    type: "converter"
}, async (message, match) => {
    try {
        if (!message.reply_message || !message.reply_message.sticker) {
            return await message.reply("*Reply to a sticker!*");
        }

        let [packname, author] = (match[0] || "").split(",");
        packname = packname?.trim() || "Created By";
        author = author?.trim() || "Axiom-MD";

        const buffer = await downloadMediaMessage(
            message.reply_message,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: message.client.updateMediaMessage
            }
        );
        const sticker = await writeExifImg(buffer, {
            packname: packname,
            author: author
        });
        await message.client.sendMessage(message.jid, {
            sticker: { url: sticker }
        }, { quoted: message });
    } catch (error) {
        console.error("Take Error:", error);
        return message.reply("*Failed to change pack info!*");
    }
});

command({
    pattern: "toimage",
    fromMe: true,
    desc: "Convert sticker to image",
    type: "converter"
}, async (message, match, m) => {
    try {
        if (!m.quoted || !m.quoted.mtype === 'stickerMessage') {
            return await message.reply("*Reply to a sticker*");
        }const buffer = await m.quoted.download();
        return await message.client.sendMessage(message.jid, {
            image: buffer
        });
    } catch (error) {
        console.error(error);
        return await message.reply("Error converting sticker");
    }
});


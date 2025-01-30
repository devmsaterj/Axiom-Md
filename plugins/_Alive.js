const { command, commands } = require("../lib");
const { getMessage, setMessage } = require("../lib/database/alive");
const { getUptime, formatTime } = require("../lib/utils");
const config = require("../config");
const totalCmds = commands.filter(cmd => !cmd.dontAddCommandList).length

command({
    pattern: "alive ?(.*)",
    fromMe: true,
    desc: "Show/Set bot alive message\n@pp - Bot PP\n@img <url> - Custom image",
    type: "info"
}, async (message, match) => {
    try {
        if (match && String(match).trim()) {
            await setMessage(String(match));
            return await message.reply(`*Alive message updated!*\n\nNew message:\n${match}`);
        }

        let aliveText = await getMessage();
        aliveText = aliveText
            .replace('@user', message.pushName || "user")
            .replace('@uptime', formatTime(getUptime()))
            .replace('@version', config.VERSION || "1.0.0")
            .replace('@cmds', (totalCmds || commands.length).toString());

        const imgMatch = aliveText.match(/@img\s+(https?:\/\/\S+)/i);
        if (imgMatch) {
            const imageUrl = imgMatch[1];
            return await message.client.sendMessage(message.jid, {
                image: { url: imageUrl },
                caption: aliveText.replace(/@img\s+https?:\/\/\S+/i, '')
            }).catch(async () => {
                return await message.reply(aliveText.replace(/@img\s+https?:\/\/\S+/i, ''));
            });
        }
        if (aliveText.includes('@pp')) {
            try {
                const ppUrl = await message.client.profilePictureUrl(message.client.user.id);
                return await message.client.sendMessage(message.jid, {
                    image: { url: ppUrl },
                    caption: aliveText.replace('@pp', '')
                });
            } catch {
                aliveText = aliveText.replace('@pp', '');
            }
        }

        return await message.reply(aliveText);
    } catch (error) {
        console.error("Alive Error:", error);
        return await message.reply("Error processing alive command!");
    }
});
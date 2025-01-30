const { command, commands } = require('../lib');
const os = require('os');
const Config = require('../config');
const { getUptime, formatTime } = require('../lib/utils');
const config = require('../config');

command({
    pattern: "menu",
    fromMe: true,
    desc: "Show all commands",
    type: "info"
}, async (message, match, m) => {
    try {
        const categories = {};
        commands.filter(cmd => !cmd.dontAddCommandList).forEach(cmd => {
            const type = cmd.type || "misc";
            if (!categories[type]) categories[type] = [];
            let cmdName;
            if (typeof cmd.pattern === 'string') {
                cmdName = cmd.pattern.replace(/\|.*/, '').trim();
            } else if (cmd.pattern instanceof RegExp) {
                cmdName = cmd.pattern.source
                    .replace(/^\^/, '') 
                    .replace(/\$.*/, '') 
                    .replace(/\\d/g, '') 
                    .replace(/[^a-zA-Z]/g, '');
            }
            
            if (cmdName) {
                categories[type].push({
                    name: cmdName,
                    desc: cmd.desc || 'No description available'
                });
            }
        });

        const totalMem = (os.totalmem() / (1024*1024*1024)).toFixed(2);
        const freeMem = (os.freemem() / (1024*1024*1024)).toFixed(2);
        const usedMem = (totalMem - freeMem).toFixed(2);
        const uptime = getUptime();

        let menu = `╭─────────────┈⊷
│ 「 *${config.BOT_NAME}* 」
╰┬────────────┈⊷
┌┤
││◦➛ Owner: ${Config.OWNER_NAME}
││◦➛ User: ${message.pushName || 'User'}
││◦➛ Commands: ${commands.filter(cmd => !cmd.dontAddCommandList).length}
││◦➛ Uptime: ${formatTime(uptime)}
││◦➛ Memory: ${usedMem}/${totalMem}GB
│╰────────────┈⊷
╰─────────────┈⊷\n\n`;

        for (const [type, cmds] of Object.entries(categories)) {
            if (cmds.length > 0) {
                menu += `╭─────────────┈⊷
│ 「 *${type.toUpperCase()}* 」
╰┬────────────┈⊷
┌┤\n`;
                cmds.forEach(cmd => {
                    menu += `││◦➛ ${Config.HANDLERS}${cmd.name}\n`;
                });
                menu += `│╰────────────┈⊷
╰─────────────┈⊷\n\n`;
            }
        }

        menu += `Use ${Config.HANDLERS}list <command> for details`;
        return await message.reply(menu.trim());
    } catch (error) {
        console.error("Menu Error:", error);
        return await message.reply("Error generating menu");
    }
});

command({
    pattern: "list ?(.*)",
    fromMe: true,
    desc: "Show detailed command list or search commands",
    type: "info"
}, async (message, match, m) => {
    try {
        const searchQuery = (match[0] || '').toString().toLowerCase();

        if (searchQuery) {
            const cmd = commands.find(cmd => {
                if (!cmd || !cmd.pattern) return false;
                
                const cmdName = typeof cmd.pattern === 'string' ? 
                    cmd.pattern.split('|')[0].trim() : 
                    (cmd.pattern instanceof RegExp ? 
                        cmd.pattern.toString().split(/\W+/)[1] : '');
                        
                return cmdName.toLowerCase() === searchQuery;
            });

            if (!cmd) {
                return await message.reply(`No command found: ${searchQuery}`);
            }

            const cmdName = typeof cmd.pattern === 'string' ? 
                cmd.pattern.split('|')[0].trim() : 
                (cmd.pattern instanceof RegExp ? 
                    cmd.pattern.toString().split(/\W+/)[1] : 'Unknown');

            let info = `╭─────────────┈⊷
│ 「 *COMMAND INFO* 」
╰┬────────────┈⊷
┌┤
││◦➛ Command: ${cmdName}
││◦➛ Description: ${cmd.desc || 'No description'}
││◦➛ Category: ${cmd.type || 'misc'}
││◦➛ Owner Only: ${cmd.fromMe ? 'Yes' : 'No'}
│╰────────────┈⊷
╰─────────────┈⊷`;

            return await message.reply(info);
        }

        let list = `╭─────────────┈⊷
│ 「 *COMMAND LIST* 」
╰┬────────────┈⊷
┌┤
││ Use .list <command> for details
│╰────────────┈⊷
╰─────────────┈⊷\n\n`;

        commands.forEach(cmd => {
            if (!cmd.dontAddCommandList && cmd.pattern) {
                const cmdName = typeof cmd.pattern === 'string' ? 
                    cmd.pattern.split('|')[0].trim() : 
                    (cmd.pattern instanceof RegExp ? 
                        cmd.pattern.toString().split(/\W+/)[1] : 'Unknown');
                    
                list += `╭────────────┈⊷
│ ${cmdName}
│ ${cmd.desc || 'No description'}
╰────────────┈⊷\n\n`;
            }
        });

        return await message.reply(list.trim());

    } catch (error) {
        console.error('Menu Error:', error);
        return await message.reply("Error occurred while fetching commands");
    }
});
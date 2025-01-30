const { command } = require("../lib");
const { delMessage, getMessage, toggleStatus, setMessage } = require("../lib/database/greetings");
const { enableAntilink, disableAntilink, getSettings } = require("../lib/database/antilink");
const { enableAntiBadWord, disableAntiBadWord, getAntiBadWord, addBadWord, removeBadWord } = require("../lib/database/antibadword");
const config = require("../config");
const schedule = require('node-schedule');
const moment = require('moment-timezone');

const muteJobs = new Map();

command({
    pattern: "tag ?(.*)",
    fromMe: true,
    desc: "Tag users with replied message",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.reply_message) return message.reply("Reply to a message to tag!");
    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);
        const participants = groupMetadata.participants.map(u => u.id);
        const replyMessage = message.reply_message;
        await message.client.sendMessage(message.jid, {
            text: replyMessage.text || "",
            mentions: participants
        });

    } catch (error) {
        console.error("Tag Error:", error);
        return message.reply("Failed to tag members!");
    }
});

command({
    pattern: "setdp",
    fromMe: true,
    desc: "Change group profile picture",
    type: "group"
}, async (message, match,m) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    try {
        if (!message.reply_message || !message.reply_message.image) {
            return message.reply("Please reply to an image to set as group DP!");
        }const media = await m.quoted.download();
        await message.client.updateProfilePicture(message.jid, media);
        return message.reply("✓ Group profile picture updated successfully!");
    } catch (error) {
        console.error("SetDP Error:", error);
        return message.reply("Failed to update group profile picture!");
    }
});

command({
    pattern: "setdesc ?(.*)",
    fromMe: true,
    desc: "Change group description",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    try {
        let newDesc = match[0];
        if (!newDesc && message.reply_message) {
            newDesc = message.reply_message.text;
        } if (!newDesc) {
            return message.reply("Please provide a description or reply to a message!");
        }await message.client.groupUpdateDescription(message.jid, newDesc);
        return message.reply("✓ Group description updated successfully!");
    } catch (error) {
        console.error("SetDesc Error:", error);
        return message.reply("Failed to update group description!");
    }
});

command({
    pattern: "groupinfo",
    fromMe: true,
    desc: "Get group information",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    const groupMetadata = await message.client.groupMetadata(message.jid);
    const text = `
*Group Name:* ${groupMetadata.subject}
*Members:* ${groupMetadata.participants.length}
*Group Owner:* @${groupMetadata.owner.split('@')[0]}
*Description:* ${groupMetadata.desc || "No description"}`;
    return await message.reply(text);
});

command({
    pattern: "add ?(.*)",
    fromMe: true,
    desc: "Add member to group",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");

    let numbers = [];
    if (message.reply_message) {
        numbers = [message.reply_message.jid];
    } else if (match && typeof match === 'string') {
        numbers = match.replace(/[^0-9,]/g, '').split(',').map(num => `${num.trim()}@s.whatsapp.net`);
    } if (!numbers.length) return message.reply("Provide numbers or reply to a message!");

    const statusMessages = {
        '403': "Couldn't add. Invite sent!",
        '408': "They left recently. Try later.",
        '401': "They blocked the bot.",
        '200': "Added successfully!",
        '409': "Already in group!"
    };

    try {
        const results = await message.client.groupParticipantsUpdate(message.jid, numbers, "add");
        let response = ''; 
        results.forEach((result, i) => {
            const number = numbers[i].split('@')[0];
            const status = result.status || '200';
            response += `${statusMessages[status]}\n`;
        });return await message.reply(response.trim());
    } catch (error) {
        return message.reply("Failed to add! Check numbers and permissions.");
    }
});

command({
    pattern: "kick",
    fromMe: true,
    desc: "Remove member from group",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    let user;
    if (message.reply_message?.jid) {
        user = message.reply_message.jid;
    } else if (match && match[0]) {
        user = match[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
    } else {
        return message.reply("Please reply to a message or provide a number to kick!");
    }try {
        await message.client.groupParticipantsUpdate(message.jid, [user], "remove");
        return await message.reply("✓ User removed successfully!");
    } catch (error) {
        return message.reply("Failed to remove user. Make sure I have admin privileges and the user is in the group!");
    }
});

command({
    pattern: "invite",
    fromMe: true,
    desc: "Get group invite link",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    const code = await message.client.groupInviteCode(message.jid);
    return await message.reply(`https://chat.whatsapp.com/${code}`);
});

command({
    pattern: "promote",
    fromMe: true,
    desc: "Promote member to admin",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    let user = message.reply_message.jid || match + "@s.whatsapp.net";
    await message.client.groupParticipantsUpdate(message.jid, [user], "promote");
    return await message.reply("Promoted successfully!");
});

command({
    pattern: "demote",
    fromMe: true,
    desc: "Demote admin to member",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    let user = message.reply_message.jid || match + "@s.whatsapp.net";
    await message.client.groupParticipantsUpdate(message.jid, [user], "demote");
    return await message.reply("Demoted successfully!");
});

command({
    pattern: "mute",
    fromMe: true,
    desc: "Mute group",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    await message.client.groupSettingUpdate(message.jid, 'announcement');
    return await message.reply("Group muted successfully!");
});

command({
    pattern: "unmute",
    fromMe: true,
    desc: "Unmute group",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    await message.client.groupSettingUpdate(message.jid, 'not_announcement');
    return await message.reply("Group unmuted successfully!");
});

command({
    pattern: "gname ?(.*)",
    fromMe: true,
    desc: "Change group name",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");
    const newName = match[0] || match;
    if (!newName) return message.reply("Please provide a group name!");
    await message.client.groupUpdateSubject(message.jid, newName);
    return await message.reply("Group name updated successfully!");
});

command({
    pattern: "members",
    fromMe: true,
    desc: "Get group members list",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    const groupMetadata = await message.client.groupMetadata(message.jid);
    let msg = "Group Members:\n";
    groupMetadata.participants.forEach((user, i) => {
        msg += `${i+1}. @${user.id.split('@')[0]}\n`;
    });
    return await message.reply(msg);
});

command({
    pattern: "tagall ?(.*)",
    fromMe: true,
    desc: "Tag all group members",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!"); 
    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);
        const participants = groupMetadata.participants;
        const msg = match[0] ? match[0] : "Hey everyone!";
        let mentionMessage = `${msg}\n\n`;
        participants.forEach(participant => {
            mentionMessage += `\n @${participant.id.split("@")[0]} `;
        });
        await message.client.sendMessage(message.jid, {
            text: mentionMessage,
            mentions: participants.map(p => p.id)
        });

    } catch (error) {
        return message.reply("Failed to tag members!");
    }
});

command({
    pattern: "welcome ?(.*)",
    fromMe: true,
    desc: "Set/get/delete welcome message",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");
    
    try {
        const usage = `*Welcome Message Usage*
• .welcome text - Set welcome message
• .welcome on/off - Enable/disable
• .welcome delete - Delete  message
• .welcome - View current message

*Variables*
• @user - Mentions joined user
• @gname - Group name
• @count - Member count`;

        const input = match ? match[0]?.toLowerCase() : null;
        
        if (!input) {
            const msg = await getMessage(message.jid, "welcome");
            return message.reply(msg ? `*Current Welcome Message:*\n${msg.message}` : usage);
        }
        if (input === 'delete') {
            await delMessage(message.jid, "welcome");
            return message.reply("Welcome message deleted!");
        }  
        if (input === 'on' || input === 'off') {
            const status = await toggleStatus(message.jid, "welcome");
            return message.reply(`Welcome message ${status.status ? 'enabled' : 'disabled'}!`);
        }
        await setMessage(message.jid, "welcome", input);
        return message.reply("Welcome message set!");

    } catch (error) {
        console.error("Welcome Error:", error);
        return message.reply("Failed to process welcome command!");
    }
});

command({
    pattern: "goodbye ?(.*)",
    fromMe: true,
    desc: "Set/get/delete goodbye message",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");
    
    try {
        const usage = `*Goodbye Message Usage*
• .goodbye text - Set goodbye message
• .goodbye on/off - Enable/disable
• .goodbye delete - Delete message
• .goodbye - View current message

*Variables*
• @user - Mentions left user
• @gname - Group name
• @count - Member count`;

        const input = match ? match[0]?.toLowerCase() : null;
        
        if (!input) {
            const msg = await getMessage(message.jid, "goodbye");
            return message.reply(msg ? `*Current Goodbye Message:*\n${msg.message}` : usage);
        }
        if (input === 'delete') {
            await delMessage(message.jid, "goodbye");
            return message.reply("Goodbye message deleted!");
        }  
        if (input === 'on' || input === 'off') {
            const status = await toggleStatus(message.jid, "goodbye");
            return message.reply(`Goodbye message ${status.status ? 'enabled' : 'disabled'}!`);
        }
        await setMessage(message.jid, "goodbye", input);
        return message.reply("Goodbye message set!");

    } catch (error) {
        console.error("Goodbye Error:", error);
        return message.reply("Failed to process goodbye command!");
    }
});

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
const warnings = new Map();
const MAX_WARNINGS = 3;

command({
    pattern: "antilink ?(.*)",
    fromMe: true,
    desc: "Configure antilink settings",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");

    const usage = `*Antilink Usage*
• .antilink on [action]
• .antilink off
• .antilink status
• .antilink reset

Actions: delete, warn, kick
Default: delete`;

    const input = match ? match[0]?.toLowerCase() : null;
    if (!input) return message.reply(usage);

    const [cmd, action] = input.split(' ');
    
    switch(cmd) {
        case 'on':
            if (!['delete', 'warn', 'kick'].includes(action)) {
                await enableAntilink(message.jid, 'delete');
            } else {
                await enableAntilink(message.jid, action);
            }
            return message.reply(`Antilink enabled with ${action || 'delete'} action`);

        case 'off':
            await disableAntilink(message.jid);
            warnings.delete(message.jid);
            return message.reply("Antilink disabled");

        case 'reset':
            warnings.delete(message.jid);
            return message.reply("Warning counts reset!");

        case 'status': {
            const settings = await getSettings(message.jid);
            const groupWarns = warnings.get(message.jid) || new Map();
            let warnList = '';
            groupWarns.forEach((count, user) => {
                warnList += `@${user.split('@')[0]}: ${count}/${MAX_WARNINGS}\n`;
            });
            return message.reply(`*Antilink Status*
• Status: ${settings?.status ? 'Enabled ✅' : 'Disabled ❌'}
• Action: ${settings?.action || 'Not set'}
• Warnings:\n${warnList || 'No warnings'}`);
        }

        default:
            return message.reply(usage);
    }
});


command({
    on: 'text',
    fromMe: false,
    dontAddCommandList: true,
}, async (message) => {
    if (!message.isGroup) return;
    const settings = await getSettings(message.jid);
    if (!settings?.status) return;

    const groupMetadata = await message.client.groupMetadata(message.jid);
    const isAdmin = groupMetadata.participants.some(p => 
        p.id === message.key.participant && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (isAdmin) return;

    const matches = message.text.match(urlRegex);
    if (!matches) return;
    const userId = message.key.participant || message.key.remoteJid;
    if (!userId) return;

    const userWarnings = warnings.get(userId) || 0;

    try {
        switch(settings.action) {
            case 'delete':
                await message.client.sendMessage(message.jid, { delete: message.key });
                break;

            case 'warn':
                await message.client.sendMessage(message.jid, { delete: message.key });
                warnings.set(userId, userWarnings + 1);

                await message.client.sendMessage(message.jid, {
                    text: ` @${userId.split('@')[0] || 'user'} Warning ${userWarnings + 1}/3`,
                    mentions: [userId]
                });

                if (userWarnings + 1 >= 3) {
                    await message.client.groupParticipantsUpdate(message.jid, [userId], "remove");
                    await message.client.sendMessage(message.jid, {
                        text: ` @${userId.split('@')[0] || 'user'} kicked for exceeding warnings`,
                        mentions: [userId]
                    });
                    warnings.delete(userId);
                }
                break;

            case 'kick':
                await message.client.groupParticipantsUpdate(message.jid, [userId], "remove");
                await message.client.sendMessage(message.jid, {
                    text: ` @${userId.split('@')[0] || 'user'} kicked for sending links`,
                    mentions: [userId]
                });
                break;
        }
    } catch (error) {
        console.error("Antilink action error:", error);
    }
});

command({
    pattern: "antibadword ?(.*)",
    fromMe: true,
    desc: "Configure anti-bad word settings",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");

    const usage = `*Anti-Bad Word Usage*
• .antibadword on [action]
• .antibadword off
• .antibadword add <word>
• .antibadword remove <word>
• .antibadword list
• .antibadword reset

Actions: delete, warn, kick
Default: delete`;

    const input = match ? match[0]?.toLowerCase() : null;
    if (!input) return message.reply(usage);

    const [cmd, ...args] = input.split(' ');

    try {
        switch(cmd) {
            case 'on':
                if (!['delete', 'warn', 'kick'].includes(args[0])) {
                    await enableAntiBadWord(message.jid);
                } else {
                    await enableAntiBadWord(message.jid, args[0]);
                }
                return message.reply(`Anti-Bad Word enabled with ${args[0] || 'delete'} action`);

            case 'off':
                await disableAntiBadWord(message.jid);
                return message.reply("Anti-Bad Word disabled");

            case 'add':
                if (!args[0]) return message.reply("Provide a word to add!");
                await addBadWord(message.jid, args[0]);
                return message.reply("Word added to bad words list!");

            case 'remove':
                if (!args[0]) return message.reply("Provide a word to remove!");
                await removeBadWord(message.jid, args[0]);
                return message.reply("Word removed from bad words list!");

            case 'list': {
                const data = await getAntiBadWord(message.jid);
                if (!data?.words?.length) return message.reply("No bad words in list!");
                return message.reply(`*Bad Words List:*\n${data.words.join(', ')}`);
            }

            case 'reset':
                warnings.clear();
                return message.reply("Warning counts reset!");

            default:
                return message.reply(usage);
        }
    } catch (error) {
        return message.reply("Failed to process command!");
    }
});

command({
    on: 'text',
    fromMe: false,
    dontAddCommandList: true
}, async (message) => {
    if (!message.isGroup) return;
    
    const settings = await getAntiBadWord(message.jid);
    if (!settings?.status) return;

    const groupMetadata = await message.client.groupMetadata(message.jid);
    const isAdmin = groupMetadata.participants.some(p => 
        p.id === message.key.participant && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (isAdmin) return;

    const text = message.text.toLowerCase();
    const containsBadWord = settings.words.some(word => text.includes(word));
    if (!containsBadWord) return;

    const userId = message.key.participant || message.key.remoteJid;
    if (!userId) return;

    const userWarnings = warnings.get(userId) || 0;

    try {
        switch(settings.action) {
            case 'delete':
                await message.client.sendMessage(message.jid, { delete: message.key });
                break;

            case 'warn':
                await message.client.sendMessage(message.jid, { delete: message.key });
                warnings.set(userId, userWarnings + 1);

                await message.client.sendMessage(message.jid, {
                    text: ` @${userId.split('@')[0]} Warning ${userWarnings + 1}/3 for bad word usage`,
                    mentions: [userId]
                });

                if (userWarnings + 1 >= 3) {
                    await message.client.groupParticipantsUpdate(message.jid, [userId], "remove");
                    await message.client.sendMessage(message.jid, {
                        text: `@${userId.split('@')[0]} kicked for exceeding warnings`,
                        mentions: [userId]
                    });
                    warnings.delete(userId);
                }
                break;

            case 'kick':
                await message.client.groupParticipantsUpdate(message.jid, [userId], "remove");
                await message.client.sendMessage(message.jid, {
                    text: `@${userId.split('@')[0]} kicked for using bad words`,
                    mentions: [userId]
                });
                break;
        }
    } catch (error) {
        console.error("Anti-Bad Word action error:", error);
    }
});

const { AntiSpamDB, getspam, updateSettings } = require("../lib/database/antispam");
const spamMap = new Map();

command({
    pattern: "antispam ?(.*)",
    fromMe: true,
    desc: "Configure anti-spam settings",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");

    const usage = `*Antispam Usage*
• .antispam on
• .antispam off
• .antispam limit <number>
• .antispam time <seconds>
• .antispam action <warn/mute/kick>
• .antispam status`;

    const input = match ? match[0]?.toLowerCase() : null;
    if (!input) return message.reply(usage);

    const [cmd, value] = input.split(' ');

    try {
        switch(cmd) {
            case 'on':
                await updateSettings(message.jid, { status: true });
                return message.reply("Antispam enabled!");

            case 'off':
                await updateSettings(message.jid, { status: false });
                spamMap.delete(message.jid);
                return message.reply("Antispam disabled!");

            case 'limit':
                if (!value || isNaN(value)) return message.reply("Provide a valid number!");
                await updateSettings(message.jid, { limit: parseInt(value) });
                return message.reply(`Spam limit set to ${value} messages`);

            case 'time':
                if (!value || isNaN(value)) return message.reply("Provide time in seconds!");
                await updateSettings(message.jid, { time: parseInt(value) });
                return message.reply(`Time window set to ${value} seconds`);

            case 'action':
                if (!['warn', 'mute', 'kick'].includes(value)) {
                    return message.reply("Invalid action! Use: warn/mute/kick");
                }
                await updateSettings(message.jid, { action: value });
                return message.reply(`Action set to ${value}`);

            case 'status': {
                const settings = await getspam(message.jid);
                return message.reply(`*Antispam Status*
• Status: ${settings?.status ? 'Enabled ✅' : 'Disabled ❌'}
• Action: ${settings?.action}
• Limit: ${settings?.limit} messages
• Time: ${settings?.time} seconds`);
            }

            default:
                return message.reply(usage);
        }
    } catch (error) {
        return message.reply("Failed to update settings!");
    }
});

command({
    on: 'text',
    fromMe: false,
    dontAddCommandList: true
}, async (message) => {
    if (!message.isGroup) return;

    const settings = await getspam(message.jid);
    if (!settings?.status) return;

    const userId = message.key.participant || message.key.remoteJid;
    if (!userId) return;

    if (!spamMap.has(message.jid)) {
        spamMap.set(message.jid, new Map());
    }

    const groupSpam = spamMap.get(message.jid);
    const now = Date.now();
    const userData = groupSpam.get(userId) || { count: 0, firstMsg: now };

    if (now - userData.firstMsg > settings.time * 1000) {
        userData.count = 1;
        userData.firstMsg = now;
    } else {
        userData.count++;
    }

    groupSpam.set(userId, userData);

    if (userData.count > settings.limit) {
        try {
            switch(settings.action) {
                case 'warn':
                    await message.client.sendMessage(message.jid, {
                        text: `@${userId.split('@')[0]} Stop spamming!`,
                        mentions: [userId]
                    });
                    break;

                case 'mute':
                    await message.client.groupParticipantsUpdate(message.jid, [userId], "mute");
                    await message.client.sendMessage(message.jid, {
                        text: `@${userId.split('@')[0]} muted for spamming`,
                        mentions: [userId]
                    });
                    break;

                case 'kick':
                    await message.client.groupParticipantsUpdate(message.jid, [userId], "remove");
                    await message.client.sendMessage(message.jid, {
                        text: `@${userId.split('@')[0]} removed for spamming`,
                        mentions: [userId]
                    });
                    break;
            }
            groupSpam.delete(userId);
        } catch (error) {
            console.error("Antispam action error:", error);
        }
    }
});

command({
    pattern: "automute ?(.*)",
    fromMe: true,
    desc: "Schedule group mute/unmute",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("Admin only!");

    const usage = `*Auto Mute Usage*
• .automute on 22:00,06:00
• .automute off
• .automute status
• .automute list

Time format: HH:mm (24hr)`;

    const input = match ? match[0]?.toLowerCase() : null;
    if (!input) return message.reply(usage);

    const [command, time] = input.split(' ');

    try {
        switch(command.toLowerCase()) {
            case 'on':
                if (!time || !time.includes(',')) {
                    return message.reply("Provide mute and unmute times!\nExample: 22:00,06:00");
                }

                const [muteTime, unmuteTime] = time.split(',');
                const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                
                if (!timeRegex.test(muteTime) || !timeRegex.test(unmuteTime)) {
                    return message.reply("Invalid time format! Use HH:mm");
                }

                if (muteJobs.has(message.jid)) {
                    const [oldMute, oldUnmute] = muteJobs.get(message.jid);
                    oldMute.cancel();
                    oldUnmute.cancel();
                }

                const muteCron = schedule.scheduleJob(`0 ${muteTime.split(':')[1]} ${muteTime.split(':')[0]} * * *`, async () => {
                    await message.client.groupSettingUpdate(message.jid, 'announcement');
                    await message.client.sendMessage(message.jid, { 
                        text: 'Group has been muted automatically.' 
                    });
                });

                const unmuteCron = schedule.scheduleJob(`0 ${unmuteTime.split(':')[1]} ${unmuteTime.split(':')[0]} * * *`, async () => {
                    await message.client.groupSettingUpdate(message.jid, 'not_announcement');
                    await message.client.sendMessage(message.jid, { 
                        text: 'Group has been unmuted automatically.' 
                    });
                });

                muteJobs.set(message.jid, [muteCron, unmuteCron]);
                return message.reply(`Auto mute scheduled:\nMute: ${muteTime}\nUnmute: ${unmuteTime}`);

            case 'off':
                if (!muteJobs.has(message.jid)) {
                    return message.reply("No auto mute schedule found!");
                }
                const [mute, unmute] = muteJobs.get(message.jid);
                mute.cancel();
                unmute.cancel();
                muteJobs.delete(message.jid);
                return message.reply("Auto mute schedule cancelled!");

            case 'status':
                if (!muteJobs.has(message.jid)) {
                    return message.reply("No active auto mute schedule!");
                }
                const jobs = muteJobs.get(message.jid);
                const nextMute = jobs[0].nextInvocation();
                const nextUnmute = jobs[1].nextInvocation();
                return message.reply(`*Auto Mute Status*\nNext mute: ${moment(nextMute).format('HH:mm')}\nNext unmute: ${moment(nextUnmute).format('HH:mm')}`);

            default:
                return message.reply(usage);
        }
    } catch (error) {
        console.error("Auto Mute Error:", error);
        return message.reply("Failed to process auto mute command!");
    }
});

command({
    pattern: "creategc ?(.*)",
    desc: "Create a new WhatsApp group",
    category: "group",
}, async (message, match, {}) => {
    const input = match[0];
    try {
        if (!input) {
            return message.reply("Usage: creategc groupname|number1,number2,number3");
        }
        const [groupName, participants] = input.split("|");
        if (!groupName || !participants) {
            return message.reply("Please provide both group name and participants!");
        }const participantList = participants.split(",").map(num => {
            return num.trim().replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        });
        const group = await message.client.groupCreate(groupName, participantList);
        const inviteCode = await message.client.groupInviteCode(group.id);
        await message.reply(`Group created successfully!\n\n*Group Name:* ${groupName}\n*Group ID:* ${group.id}\n*Invite Link:* https://chat.whatsapp.com/${inviteCode}`);

    } catch (error) {
        console.error("Group Creation Error:", error);
        return message.reply("Failed to create group! Make sure all numbers are valid WhatsApp numbers.");
    }
});

command({
    pattern: "kickcountry ?(.*)",
    fromMe: true,
    desc: "Kick all members with specific country code",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.isAdmin(message.jid)) return message.reply("This command requires admin privileges!");

    try {
        if (!match[0]) {
            return message.reply("*Usage:* kickcountry <country_code>");
        }
        const countryCode = match[0].replace(/[^0-9]/g, "");
        if (!countryCode) return message.reply("Please provide a valid country code!");

        const groupMetadata = await message.client.groupMetadata(message.jid);
        const participants = groupMetadata.participants;

        const toKick = participants
            .filter(p => p.id.startsWith(countryCode))
            .filter(p => p.id !== message.client.user.id)
            .map(p => p.id);

        if (!toKick.length) {
            return message.reply(`No members found with country code +${countryCode}`);
        }

        await message.client.groupParticipantsUpdate(message.jid, toKick, "remove");
        return message.reply(`Successfully kicked ${toKick.length} members with country code +${countryCode}`);

    } catch (error) {
        console.error("Kick Country Error:", error);
        return message.reply("Failed to kick members!");
    }
});

command({
    pattern: "grouplist",
    fromMe: true,
    desc: "List all groups bot is in",
    type: "group"
}, async (message, match) => {
    try {
        // Fetch all groups
        const groups = await message.client.groupFetchAllParticipating();
        
        // Format group info
        let response = "*My Groups List*\n\n";
        let index = 1;
        
        Object.values(groups).forEach(group => {
            response += `*${index++}) ${group.subject}*\n`;
            response += `• ID: ${group.id}\n`;
            response += `• Members: ${group.size}\n`;
            response += `• Owner: @${group.owner.split('@')[0]}\n`;
            if (group.desc) response += `• Desc: ${group.desc}\n`;
            response += `• Created: ${new Date(group.creation * 1000).toLocaleDateString()}\n\n`;
        });

        return await message.reply(response);

    } catch (error) {
        console.error("Group List Error:", error);
        return message.reply("Failed to fetch groups list!");
    }
});
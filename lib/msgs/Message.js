const {
    decodeJid
} = require("../functions");
const ut = require("util");
const Base = require("./Base");
const {
    writeExifWebp
} = require("../sticker");
let config = require("../../config");
const ReplyMessage = require("./ReplyMessage");
const {
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys')
class Message extends Base {
    constructor(client, data) {
        super(client);
        if (data) {
            this.data = data;
            this._patch(data);
        }
    }
    _patch(data) {
        this.user = decodeJid(this.client.user.id);
        this.key = data.key;
        this.isGroup = data.isGroup;
        this.IsAdmin = data.IsAdmin;
        this.prefix = data.prefix;
        this.id = data.key.id === undefined ? undefined : data.key.id;
        this.jid = data.key.remoteJid;
        this.message = {
            key: data.key,
            message: data.message
        };
        this.pushName = data.pushName;
        this.participant = data.sender || '';
        this.sudo = config.SUDO.split(",").includes(this.participant ? this.participant.split("@")[0] : '');
        this.fromMe = data.key.fromMe;
        
        this.timestamp = typeof data.messageTimestamp === "object"
            ? new Date(data.messageTimestamp.low * 1000 + (2 * 60 * 60 * 1000)).toString().replace("GMT+0000 (Coordinated Universal Time)", "")
            : new Date(data.messageTimestamp * 1000 + (2 * 60 * 60 * 1000)).toString().replace("GMT+0000 (Coordinated Universal Time)", "");
    
        const msg = data.message;
        this.type = Object.keys(msg)[0];
        this.content = msg[this.type];
        
        this.text = data.body || (msg?.conversation || 
                    msg?.extendedTextMessage?.text || 
                    msg?.imageMessage?.caption ||
                    msg?.videoMessage?.caption || 
                    msg?.documentMessage?.caption || '');
        
        this.mediaType = null;
        this.mediaUrl = null;
        if (msg?.imageMessage) {
            this.mediaType = 'image';
            this.mediaUrl = msg.imageMessage.url;
        } else if (msg?.videoMessage) {
            this.mediaType = 'video';
            this.mediaUrl = msg.videoMessage.url;
        } else if (msg?.audioMessage) {
            this.mediaType = 'audio';
            this.mediaUrl = msg.audioMessage.url;
        } else if (msg?.stickerMessage) {
            this.mediaType = 'sticker';
            this.mediaUrl = msg.stickerMessage.url;
        } else if (msg?.documentMessage) {
            this.mediaType = 'document';
            this.mediaUrl = msg.documentMessage.url;
        }
    
        this.mention = false;
        const contextInfo = msg?.[this.type]?.contextInfo;
        if (contextInfo?.mentionedJid) {
            this.mention = contextInfo.mentionedJid;
        }
    
        if (data.quoted) {
            this.reply_message = new ReplyMessage(
                this.client,
                msg?.[this.type]?.contextInfo,
                data
            );
            this.reply_message.type = data.quoted.type || "extendedTextMessage";
            this.reply_message.mtype = data.quoted.mtype;
            this.reply_message.mimetype = data.quoted.text?.mimetype || "text/plain";
            this.reply_message.key = data.quoted.key;
            this.reply_message.message = data.quoted.message;
        } else {
            this.reply_message = false;
        }
    
        this.reaction = msg?.reactionMessage || null;
    
        return super._patch(data);
    }
    async log() {
        console.log(this.data);
    }
    async sendFile(content, options = {}) {
        let {
            data
        } = await this.client.getFile(content);
        let type = await fileType.fromBuffer(data);
        return this.client.sendMessage(
            this.jid,
            {
                [type.mime.split("/")[0]]: data, ...options
            },
            {
                ...options
            }
        );
    }
    async edit(text, jid = this.jid) {
        if (!this.key) return false;
        return await this.client.sendMessage(jid, {
            text: text,
            edit: this.key
        });
    }
    async reply(text, opt = {}) {
        return this.client.sendMessage(
            this.jid,
            {
                text: require("util").format(text),
                ...opt,
            },
            {
             quoted: this.data
            }
        );
    }
    async send(jid, text, opt = {}) {
        return this.client.sendMessage(
            jid,
            {
                text: require("util").format(text),
                ...opt,
            },
            {
                ...opt
            }
        );
    }
    async sendMessage(
        content,
        opt = {
            packname: "Axiom-md", author: "master-j"
        },
        type = "text"
    ) {
        switch (type.toLowerCase()) {
            case "text":
                {
                    return this.client.sendMessage(
                        this.jid,
                        {
                            text: content,
                            ...opt,
                        },
                        {
                            ...opt
                        }
                    );
                }
                break;
            case "image":
                {
                    if (Buffer.isBuffer(content)) {
                        return this.client.sendMessage(
                            this.jid,
                            {
                                image: content, ...opt
                            },
                            {
                                ...opt
                            }
                        );
                    } else if (isUrl(content)) {
                        return this.client.sendMessage(
                            this.jid,
                            {
                                image: {
                                    url: content
                                }, ...opt
                            },
                            {
                                ...opt
                            }
                        );
                    }
                }
                break;
            case "video": {
                if (Buffer.isBuffer(content)) {
                    return this.client.sendMessage(
                        this.jid,
                        {
                            video: content, ...opt
                        },
                        {
                            ...opt
                        }
                    );
                } else if (isUrl(content)) {
                    return this.client.sendMessage(
                        this.jid,
                        {
                            video: {
                                url: content
                            }, ...opt
                        },
                        {
                            ...opt
                        }
                    );
                }
            }
                case "audio":
                    {
                        if (Buffer.isBuffer(content)) {
                            return this.client.sendMessage(
                                this.jid,
                                {
                                    audio: content, ...opt
                                },
                                {
                                    ...opt
                                }
                            );
                        } else if (isUrl(content)) {
                            return this.client.sendMessage(
                                this.jid,
                                {
                                    audio: {
                                        url: content
                                    }, ...opt
                                },
                                {
                                    ...opt
                                }
                            );
                        }
                    }
                    break;
                case "sticker":
                    {
                        let {
                            data,
                            mime
                        } = await this.client.getFile(content);
                        if (mime == "image/webp") {
                            let buff = await writeExifWebp(data, opt);
                            await this.client.sendMessage(
                                this.jid,
                                {
                                    sticker: {
                                        url: buff
                                    }, ...opt
                                },
                                opt
                            );
                        } else {
                            mime = await mime.split("/")[0];

                            if (mime === "video") {
                                await this.client.sendImageAsSticker(this.jid, content, opt);
                            } else if (mime === "image") {
                                await this.client.sendImageAsSticker(this.jid, content, opt);
                            }
                        }
                    }
                    break;
        }
    }

    async edit(text, jid = this.jid) {
        if (!this.key) return false;
        return await this.client.sendMessage(jid, { 
            text: text, 
            edit: this.key 
        });
    }

    async forward(jid, message, options = {}) {
        try{
        let m = generateWAMessageFromContent(jid, message, {
            ...options,
            userJid: this.client.user.id,
    });
        
    await this.client.relayMessage(jid, m.message, {
        messageId: m.key.id,
        ...options,
    }, { ...options });
        } catch(e){
            return this.client.sendMessage(jid , {text: `cannot add options for now`})
        }
    
}
async sendFromUrl(url, options = {}) {
    let buff = await getBuffer(url);
    let mime = await fileType.fromBuffer(buff);
    let type = mime.mime.split("/")[0];
    if (type === "audio") {
        options.mimetype = "audio/mpeg";
    }
    if (type === "application") type = "document";
    return this.client.sendMessage(
        this.jid,
        {
            [type]: buff, ...options
        },
        {
            ...options
        }
    );
}

async react(emoji) {
    try {
        await this.client.sendMessage(this.jid, {
            react: {
                text: emoji,
                key: this.data.key
            }
        });
    } catch (error) {
        console.error('Error reacting to message:', error);
        return 'Failed to react to the message. Please try again later.';
    }
}   

async PresenceUpdate(status) {
    await sock.sendPresenceUpdate(status, this.jid);
}
async delete(key) {
    await this.client.sendMessage(this.jid, {
        delete: key
    });
}
async updateName(name) {
    await this.client.updateProfileName(name);
}
async getPP(jid) {
    return await this.client.profilePictureUrl(jid, "image");
}
async setPP(jid, pp) {
    if (Buffer.isBuffer(pp)) {
        await this.client.updateProfilePicture(jid, pp);
    } else {
        await this.client.updateProfilePicture(jid, {
            url: pp
    });
}
}
/**
*
* @param {string} jid
* @returns
*/
async block(jid) {
await this.client.updateBlockStatus(jid, "block");
}
/**
*
* @param {string} jid
* @returns
*/
async unblock(jid) {
await this.client.updateBlockStatus(jid, "unblock");
}
/**
*
* @param {array} jid
* @returns
*/
async add(jid) {
return await this.client.groupParticipantsUpdate(this.jid, jid, "add");
}
/**
*
* @param {array} jid
* @returns
*/
async kick(jid) {
return await this.client.groupParticipantsUpdate(this.jid, jid, "remove");
}

/**
*
* @param {array} jid
* @returns
*/
async promote(jid) {
return await this.client.groupParticipantsUpdate(this.jid, jid, "promote");
}
/**
*
* @param {array} jid
* @returns
*/
async demote(jid) {
return await this.client.groupParticipantsUpdate(this.jid, jid, "demote");
}
    async isAdmin(id) {
        let groupMetadata = await this.client.groupMetadata(this.jid);
        let participants = groupMetadata.participants;
        let admins = participants.filter(p => p.admin !== null).map(p => p.id);
        return admins.includes(id || this.participant);
    }
}
module.exports = Message;
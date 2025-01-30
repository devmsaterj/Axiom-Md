const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  makeInMemoryStore,
  delay,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  generateWAMessageFromContent,
  downloadMediaMessage, 
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const NodeCache = require("node-cache");
const pino = require("pino");
const { Image, Message, Sticker, Video, All } = require("./lib/msgs");
const { serialize, Greetings, parsedJid } = require("./lib");
const events = require("./lib/events");
const express = require("express");
const app = express();
const port = config.PORT;
const logger = pino({ level: "silent" });
const { getAutoStatus } = require("./lib/database/AutoStatus");
const { getAntiDelete, getDestination } = require("./lib/database/antidelete");
const { numToJid } = require("./lib/functions");
const { getDMStatus, getDMReplies } = require("./lib/database/autoreply");
const { MakeSession, cleanAuthFolder } = require("./lib/utils");
const { exec } = require("child_process");

const sudo = numToJid(config.SUDO.split(",")[0]) || client.user.id;

fs.readdirSync(__dirname + "/data").forEach((db) => {
  if (path.extname(db).toLowerCase() == ".js") {
    require(__dirname + "/data" + db);
  }
});

const AXMD = async () => {
    if (config.SESSION_ID) {
      (async () => {
        try {
          const credFile = "./auth/creds.json";
          if (fs.existsSync(credFile)) {
            return;
          }
          await MakeSession(config.SESSION_ID, credFile);
          console.log("Auth file created successfully!");
          exec('pm2 restart', (error, stdout, stderr) => {
            if (error) {
              console.error('PM2 restart failed:', error);
              process.exit(1);
            }process.exit(0);
          });} catch (error) {
          console.error("Session creation failed:", error.message);
        }
      })();
    }

  fs.readdirSync("./plugins").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") {
      console.log(`Installing ${plugin}`);
      require("./plugins/" + plugin);
    }
  });
};

const messageStore = new Map();

function cleanupOldMessages() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, msg] of messageStore.entries()) {
    if (msg.messageTimestamp * 1000 < oneHourAgo) {
      messageStore.delete(id);
    }
  }
}

setInterval(cleanupOldMessages, 30 * 60 * 1000);

async function Connect() {
  console.log(`syncing with database`);
  await config.DATABASE.sync();
  const msgRetryCounterCache = new NodeCache();
  const authCleaner = require('./lib/auth');
  const { state, saveCreds } = await useMultiFileAuthState(`./auth`);
  const { version} = await fetchLatestBaileysVersion();

  let conn = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome"),
    downloadHistory: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    msgRetryCounterCache,
    version,
    generateHighQualityLinkPreview: true,
  });

  authCleaner.start();
  
  conn.ev.on("call", async (calls) => {
    if (config.CALL_REJECT === true) {
      const c = calls[0];
      let { status, from, id } = c;
      if (status == "offer") {
        await conn.rejectCall(id, from);
        // return conn.sendMessage(from, {
        //   text: "_NO CALLS ALLOWED_",
        // });
      }
    } else if (config.CALL_REJECT === false) {
      return;
    }
  });

  conn.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection === "open") {
      console.log("Connecting to WhatsApp...");
      console.log("connected");
      await delay(5000);
      await conn.sendMessage(sudo, { 
        text: `*Axiom-MD Connected Successfully*\n\n` +
          `• Time: ${new Date().toLocaleString()}\n` +
          `• Version: ${require('./package.json').version}\n` +
          `• Prefix: ${config.HANDLERS}\n` +
          `• Sudo: ${config.SUDO}\n` +
          `• Auto-Status: ${await getAutoStatus()}\n` +
          `• Anti-Delete: ${await getAntiDelete()}\n` +
          `• Auto-Reply: ${await getDMStatus()}\n` +
          `• User: ${conn.user.name || 'Unknown'}\n` +
          `• Platform: ${process.platform}\n` +
          `• Node Version: ${process.version}`
      });
    }

    if (connection === "close") {
      if (
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
      ) {
        await delay(300);
        Connect();
        console.log("reconnecting...");
        console.log(s);
      } else {
        console.log("connection closed");
        await delay(3000);
        process.exit(0);
      }
    }
  });

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;
    let msg = await serialize(JSON.parse(JSON.stringify(m.messages[0])), conn);
    if (!msg) return;

    if (msg.key && msg.key.remoteJid === "status@broadcast") {
      try {
        if (await getAutoStatus()) {
          await conn.readMessages([
            {
              remoteJid: msg.key.remoteJid,
              id: msg.key.id,
              participant: msg.key.participant,
            },
          ]);
        }
        return;
      } catch (error) {
        console.error("Error viewing status:", error);
      }
    }

    if (!msg.key.remoteJid.endsWith('@g.us') && !msg.key.fromMe) {
      try {
        const status = await getDMStatus();
        if (status) {
          const replies = await getDMReplies();
          if (replies.length) {
            const text = msg.body?.toLowerCase();
            if (text) {
              const matchingReply = replies.find(reply => 
                text.includes(reply.pattern.toLowerCase())
              );
              if (matchingReply) {
                await conn.sendMessage(msg.key.remoteJid, {
                  text: matchingReply.response
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("DM Auto-reply Error:", error);
      }
    }


    if (await getAntiDelete()) {
      try {
        const messageType = msg.type || Object.keys(msg.message)[0];
  
        if (messageType !== "protocolMessage") {
          try {
            let mediaBuffer = null;
            let mediaType = null;

            if (msg.message?.imageMessage || 
                msg.message?.videoMessage || 
                msg.message?.audioMessage || 
                msg.message?.stickerMessage || 
                msg.message?.documentMessage) {
              
              try {
                mediaBuffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  { 
                    logger,
                    reuploadRequest: conn.updateMediaMessage
                  }
                );
                
                if (msg.message.imageMessage) mediaType = 'image';
                else if (msg.message.videoMessage) mediaType = 'video';
                else if (msg.message.audioMessage) mediaType = 'audio';
                else if (msg.message.stickerMessage) mediaType = 'sticker';
                else if (msg.message.documentMessage) mediaType = 'document';
                
              } catch (error) {
                console.error('Error downloading media:', error);
              }
            }
            
            messageStore.set(msg.key.id, {
              message: msg.message,
              mediaBuffer,
              mediaType,
              from: msg.key.remoteJid,
              participant: msg.key.participant
            });
            
          } catch (error) {
            console.error("Error storing message:", error);
          }
        }
  
        if (messageType === "protocolMessage" && msg.message.protocolMessage.type === "REVOKE") {
          const deletedMessageId = msg.message.protocolMessage.key.id;
          const deletedMessage = messageStore.get(deletedMessageId);
  
          if (deletedMessage) {
            try {
              const dest = (await getDestination()) || msg.key.remoteJid;
              const participant = msg.key.participant || msg.key.remoteJid;
              
              if (!participant) {
                console.error("No participant found");
                return;
              }

              let groupName = "";
              if (msg.key.remoteJid.endsWith('@g.us')) {
                const groupMetadata = await conn.groupMetadata(msg.key.remoteJid);
                groupName = groupMetadata.subject;
              }
  
              let messageData = {
                contextInfo: {
                  forwardingScore: 1,
                  isForwarded: true,
                  mentionedJid: [participant]
                }
              };
  
              const caption = `*ANTI-DELETE* \n\n` +
                            `*From:* @${participant.split('@')[0]}\n` +
                            `*Type:* ${deletedMessage.mediaType || 'text'}\n` +
                            (groupName ? `*Group:* ${groupName}\n` : '') +
                            `*Chat:* ${deletedMessage.from}`;
  
              if (deletedMessage.mediaBuffer) {
                messageData[deletedMessage.mediaType] = deletedMessage.mediaBuffer;
                messageData.caption = caption;
                
                if (deletedMessage.message[`${deletedMessage.mediaType}Message`]?.caption) {
                  messageData.caption += `\n\n*Original Caption:* ${deletedMessage.message[`${deletedMessage.mediaType}Message`].caption}`;
                }
              } else {
                const textContent = deletedMessage.message.conversation || 
                                  deletedMessage.message.extendedTextMessage?.text || 
                                  "Message content unavailable";
                
                messageData.text = `${caption}\n\n*Message:* ${textContent}`;
              }
  
              await conn.sendMessage(dest, messageData);
  
            } catch (error) {
              console.error("Error sending anti-delete message:", error);
            }
          }
        }
      } catch (error) {
        console.error("Anti-delete error:", error);
      }
    
    }

    let sender = msg?.sender ? parsedJid(msg.sender)[0] : null;
    let su = sender ? sender.split("@")[0] : null;

    let text_msg = msg.body;
    if (text_msg && config.LOGS) {
      console.log(
        '----------------------------------------\n' +
        `At : ${
          msg.from.endsWith("@g.us")
            ? (await conn.groupMetadata(msg.from)).subject
            : msg.from
        }\nFrom : ${msg.sender}\nSender:${su}\nMessage:${text_msg}\nSudo:${msg.sudo.includes(
          su
        )}`
      );
    }

    events.commands.map(async (command) => {
      if (command.fromMe && !msg.sudo.includes(su)) return;
      let prefix = config.HANDLERS.trim();
      let comman = text_msg;

      try {
        if (typeof comman === "string" && !comman?.startsWith(prefix))
          comman = false;
      } catch (e) {
        comman = false;
      }

      msg.prefix = prefix;
      if (config.ALWAYS_ONLINE === true) {
        conn.sendPresenceUpdate("available", msg.key.remoteJid);
      } else {
        conn.sendPresenceUpdate("unavailable", msg.key.remoteJid);
      }
      
      if (config.AUTOTYPE == true) {
        await conn.sendPresenceUpdate("composing", msg.key.remoteJid);
        await delay(3000);
        await conn.sendPresenceUpdate("paused", msg.key.remoteJid);
      }

      if (
        config.READ_MSG == true &&
        msg.key.remoteJid !== "status@broadcast"
      ) {
        await conn.readMessages([msg.key]);
      }

      let whats;
      switch (true) {
        case command.pattern && command.pattern.test(comman): {
          try {
            const matches = command.pattern.exec(comman);
            const match = matches ? matches.slice(1) : null;
            whats = new Message(conn, msg);
            await command.function(whats, match, msg, conn);
          } catch (error) {
            console.error("Command Error:", error);
            if (config.ERROR_MSG) {
              const errorReport = `*─━❲ ERROR REPORT ❳━─*\n\n` +
                `*Command:* ${comman}\n` +
                `*Error:* ${error.message}\n` +
                `*Chat:* ${msg.from}\n` +
                `*Sender:* ${msg.sender}\n` +
                `*Time:* ${new Date().toLocaleString()}`;

              await conn.sendMessage(sudo, {
                text: errorReport,
                contextInfo: {
                  mentionedJid: [msg.sender]
                }
              }, { quoted: msg });
            }
          }
          break;
        }

        case text_msg && command.on === "text":
          whats = new Message(conn, msg);
          command.function(whats, text_msg, msg, conn, m);
          break;

        case command.on === "image" || command.on === "photo":
          if (msg.type === "imageMessage") {
            whats = new Message(conn, msg);
            command.function(whats, text_msg, msg, conn, m);
          }
          break;

        case command.on === "sticker":
          if (msg.type === "stickerMessage") {
            whats = new Message(conn, msg);
            command.function(whats, msg, conn, m);
          }
          break;

        case command.on === "video":
          if (msg.type === "videoMessage") {
            whats = new Message(conn, msg);
            command.function(whats, msg, conn, m);
          }
          break;

        default:
          break;
      }
    });
  });
  conn.ev.on('group-participants.update', async (data) => {
    try {
        await Greetings(data, conn);
    } catch (error) {
        console.error('Greetings Error:', error);
    }
});
}

app.get("/", (req, res) => res.type("html").send(`<p2>Hello world this is Axiom</p2>`));
app.listen(port, () =>
  console.log(`Server listening on port http://localhost:${port}`)
);
Connect();
AXMD();

const { command, commands, runtime } = require("../lib");
const { getUptime, formatTime } = require("../lib/utils");

command({
  pattern: "uptime",
  fromMe: true,
  desc: "Show bot uptime",
  type: "info"
}, async (message, match) => {
  try {
      const uptime = getUptime();
      const formattedUptime = formatTime(uptime);
      return await message.reply(formattedUptime);
  } catch (error) {
      console.error("Uptime Error:", error);
      return message.reply("*Failed to get uptime!*");
  }
});

command({
  pattern: "ping",
  fromMe: false,
  desc: "Check bot latency",
  type: "info",
}, 
async(message, m, match) => {
  const start = new Date().getTime()
  const msg = await message.client.sendMessage(message.jid, { text: 'Testing ping...' })
  const end = new Date().getTime()
  await message.client.sendMessage(message.jid, {
      text: `Response time: ${end - start}ms`,
      edit: msg.key
  })
})

command({
  pattern: "status",
  fromMe: true,
  desc: "Show bot status",
  type: "info"
},
async(message, m, match) => {
  const totalCmds = commands.filter(cmd => !cmd.dontAddCommandList).length
  const uptime = runtime()

  return message.reply(
`-Total Commands: ${totalCmds}
 -Uptime: ${uptime}`
  )
})
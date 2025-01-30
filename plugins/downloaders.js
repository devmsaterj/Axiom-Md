const { command, getBuffer, pinterest } = require("../lib");
const axios = require("axios");
const { getDownloadLink, getVideoInfo } = require("../lib/utils");


command({
  pattern: "tikvideo ?(.*)",
  fromMe: true,
  desc: "Download TikTok video",
  type: "downloader",
}, async (message, match) => {
  const link = match[0]; 
  if (!link) return message.reply("*Please provide a TikTok video link!*");
  if (!link.match(/tiktok\.com/)) {
    return message.reply("*Invalid TikTok URL! Please provide a valid TikTok link.*");
  }
  try {
    const url = `https://popular-anastassia-dolnard285-511c3281.koyeb.app/Tiktok?url=${encodeURIComponent(link)}`;
    const response = await axios.get(url);
    
    if (!response.data?.result?.data) {
      throw new Error("Invalid API response");
    }
    
    const videoData = response.data.result.data;
    const videoUrl = videoData.play;
    
    await message.reply(`*⬇Downloading:* ${videoData.title}`);
    
    await message.client.sendMessage(message.jid, {
      video: { url: videoUrl },
      caption: videoData.title,
      contextInfo: {
        externalAdReply: {
          title: videoData.title,
          body: `Creator: ${response.data.creator || 'Unknown'}`,
          thumbnailUrl: videoData.cover,
          sourceUrl: link,
          mediaType: 1,
          showAdAttribution: true,
          renderLargerThumbnail: true
        }
      }
    });
  } catch (error) {
    console.error('TikTok Download Error:', error);
    return message.reply("*Failed to download video!*\nPlease check the link and try again.");
  }
});

command({
  pattern: 'tikaudio ?(.*)', 
  fromMe: true,
  desc: 'Download TikTok audio using the link provided.',
  type: 'download'
}, async (message, match) => {
  const link = match[0];

  if (!link) {
    return await message.reply('Please provide a TikTok video link.');
  }

  try {
    const url = `https://popular-anastassia-dolnard285-511c3281.koyeb.app/Tiktok?url=${encodeURIComponent(link)}`;
    const response = await axios.get(url);
  
    const videoData = response.data.result.data;
    const audioUrl = videoData.music;

    await message.reply(`Downloading audio of \n\n ${videoData.title}`);
    await lient.sendMessage(message.jid, {
      url: audioUrl,
      mimetype: 'audio/mpeg',
      contextInfo: {
        externalAdReply: {
          title: videoData.title,
          body: `Creator: ${response.data.creator}`,
          renderLargerThumbnail: true,
          thumbnailUrl: videoData.cover,
          mediaType: 1,
          mediaUrl: videoData.cover,
        }
      }
    });
  } catch (error) {
    await message.reply(error.message);
  }
});

command({
  pattern: 'igdl ?(.*)',
  fromMe: true,
  desc: 'Download Instagram videos/photos',
  type: 'downloader'
}, async (message, match) => {
  const link = match[0];
  
  if (!link) {
      return await message.reply('Please provide an Instagram link.');
  }

  try {
      await message.react('⏳');
      const url = `https://popular-anastassia-dolnard285-511c3281.koyeb.app/instagram?url=${encodeURIComponent(link)}`;
      const response = await axios.get(url);
      
      if (!response.data.result) {
          throw new Error('Failed to fetch media');
      }

      const mediaData = response.data.result;
      await message.reply(`_*Downloading*_`);
      
      if (mediaData.videoUrl) {
          await message.client.sendMessage(message.jid,{
              video: { url: mediaData.videoUrl},
              caption: mediaData.title || 'Powered by Axiom-Md',
              mimetype: 'video/mp4',
              contextInfo: {
                  externalAdReply: {
                      title: 'Instagram Video',
                      body: `Creator: Master-j`,
                      renderLargerThumbnail: true,
                      thumbnailUrl: mediaData.thumbnail,
                      mediaType: 1,
                      mediaUrl: mediaData.thumbnail,
                  },
              }
          });
      } 
      await message.react('✅');
      setTimeout(() => message.react(''), 3000);

  } catch (error) {
      console.error('Instagram Download Error:', error);
      await message.react('❌');
      await message.reply('Error downloading media: ' + error.message);
  }
});

command({
    pattern: "pinterest ?(.*)",
    fromMe: false,
    desc: "Download pinterest images",
    type: "downloader",
  },
  async (message, match, m) => {
    const query = match[0]
    if (!query) return message.reply("_i need a query_");
    try {
      let res = await pinterest(query);
      for (const data of res) {
        let image = await getBuffer(data.url);
        await message.client.sendMessage(
          message.jid,
          { image: image, caption: `*Pinterest images*` },
          { quoted: m }
        );
      }
    } catch (e) {
      message.reply(`error: ${e}`);
    }
  }
);

command({
  pattern: "song ?(.*)",
  fromMe: false,
  desc: "Download songs",
  type: "downloader",
}, async (message, match) => {
  if (!match[0]) return message.reply("*Give me a song name!*\nExample: .song heat waves");
  
  try {
      const processingMsg = await message.reply('*Searching...*');
      const searchUrl = `https://ideal-robot-production.up.railway.app/search?q=${encodeURIComponent(match[0])}`;
      const searchResponse = await axios.get(searchUrl);
      
      if (!searchResponse.data?.results?.videos?.length) {
          return message.reply('No results found');
      }
      const video = searchResponse.data.results.videos[0];
      await message.send(message.jid,`*Downloading:* ${video.title}`);

      const downloadUrl = `https://ideal-robot-production.up.railway.app/ytaudio?url=${encodeURIComponent(video.url)}`;
      const audioResponse = await axios.get(downloadUrl);
      
      if (!audioResponse.data?.result?.downloadUrl) {
          return message.reply('Failed to get download URL');
      }

      const audioBuffer = await getBuffer(audioResponse.data.result.downloadUrl);
      
      const caption = `*Title:* ${video.title}\n` +
                     `*Channel:* ${video.author}\n` +
                     `*Duration:* ${video.duration}\n`

      await message.client.sendMessage(message.jid, {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`,
          caption: caption,
          contextInfo: {
              externalAdReply: {
                  title: video.title,
                  body: video.author,
                  thumbnailUrl: video.thumbnail,
                  sourceUrl: video.url,
                  mediaType: 1,
                  showAdAttribution: true,
                  renderLargerThumbnail: true
              }
          }
      });

  } catch (error) {
      console.error('Song Download Error:', error);
      return message.reply('Error downloading song. Please try again.');
  }
});

command({
  pattern: "ytdl ?(.*)",
  fromMe: true,
  desc: "Download YouTube videos with quality selection", 
  type: "downloader"
}, async (message, match) => {
  const input = match ? match[0] : null;
  if (!input) return await message.reply("*Need YouTube URL!*\nUsage: .ytdl URL [quality]");
  
  const [url, requestedQuality] = input.split(' ');
  
  try {
      await message.react('⏳');
      const video = await getVideoInfo(url);
      if (!video) throw new Error("Invalid YouTube URL!");

      const availableQualities = [...new Set(video.formats.video.map(f => f.quality))];
      
      if (!requestedQuality || !availableQualities.includes(requestedQuality)) {
          const qualityList = availableQualities
              .map(q => `• ${q}`)
              .join('\n');
          
          return await message.reply(
              `*Available Qualities for:*\n${video.title}\n\n${qualityList}\n\nUsage: .ytdl ${url} [quality]`
          );
      }
      
      const selectedFormat = video.formats.video.find(f => f.quality === requestedQuality);
      if (!selectedFormat) throw new Error(`Quality ${requestedQuality} not available`);

      const dlInfo = await getDownloadLink(video.id, selectedFormat.id);
      if (!dlInfo?.url) throw new Error("Failed to get download URL");

      const fileSizeMB = (selectedFormat.filesize / (1024 * 1024)).toFixed(2);
      await message.reply(`*⬇️ Downloading:* ${video.title}\n*📊 Size:* ${fileSizeMB}MB\n*🎥 Quality:* ${selectedFormat.quality}`);

      await message.client.sendMessage(message.jid, {
          video: { url: dlInfo.url },
          caption: video.title,
          contextInfo: {
              externalAdReply: {
                  title: video.title,
                  thumbnailUrl: video.thumbnail,
                  sourceUrl: url,
                  mediaType: 1,
                  showAdAttribution: true,
                  renderLargerThumbnail: true
              }
          }
      });
      
      await message.react('✅');
      setTimeout(() => message.react(''), 3000);

  } catch (error) {
      console.error('YTDL Error:', error);
      await message.react('❌');
      return message.reply(`*Download Failed!*\n${error.message}`);
  }
});
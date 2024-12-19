const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ytdl = require('ytdl-core');
const getFBInfo = require("@xaviabot/fb-downloader");
const mime = require('mime-types');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = 9562;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Convert MP4 to MP3 using ffmpeg
async function convertToMP3(mp4Path) {
  return new Promise((resolve, reject) => {
    const mp3Path = mp4Path.replace(/\.mp4$/, '.mp3');
    ffmpeg(mp4Path)
      .toFormat('mp3')
      .on('end', () => resolve(mp3Path))
      .on('error', reject)
      .save(mp3Path);
  });
}

// TikTok Downloader with MP3 Support
async function downloadTikTok(url, format) {
  try {
    const response = await axios.post('https://www.tikwm.com/api/', { url });
    const data = response.data.data;

    const videoUrl = data.play;
    const filePath = path.join(__dirname, `TikTok-${Date.now()}.mp4`);
    const videoStream = await axios.get(videoUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    videoStream.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        if (format === 'mp3') {
          try {
            const mp3Path = await convertToMP3(filePath);
            fs.unlinkSync(filePath); // Remove the MP4 file after conversion
            resolve(mp3Path);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(filePath); // Return MP4 file directly
        }
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading TikTok content:', error);
    throw new Error('Failed to download TikTok content');
  }
}

// YouTube Downloader with MP3 Support
async function downloadYouTube(url, format) {
  try {
    const videoInfo = await ytdl.getInfo(url);
    const fileName = `${videoInfo.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '')}`;
    const filePath = path.join(__dirname, `${fileName}.mp4`);

    const stream = ytdl(url, { quality: format === 'mp4' ? 'highestvideo' : 'highestaudio' });
    const writer = fs.createWriteStream(filePath);
    stream.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        if (format === 'mp3') {
          try {
            const mp3Path = await convertToMP3(filePath);
            fs.unlinkSync(filePath); // Remove the MP4 file after conversion
            resolve(mp3Path);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(filePath); // Return MP4 file directly
        }
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading YouTube content:', error);
    throw new Error('Failed to download YouTube content');
  }
}

// Facebook Downloader with MP3 Support
async function downloadFacebook(url, format) {
  try {
    const result = await getFBInfo(url);
    const videoUrl = result.sd;
    const filePath = path.join(__dirname, `Facebook-${Date.now()}.mp4`);
    const videoData = await axios.get(videoUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    videoData.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        if (format === 'mp3') {
          try {
            const mp3Path = await convertToMP3(filePath);
            fs.unlinkSync(filePath); // Remove the MP4 file after conversion
            resolve(mp3Path);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(filePath); // Return MP4 file directly
        }
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading Facebook content:', error);
    throw new Error('Failed to download Facebook content');
  }
}

// Google Drive Downloader
async function downloadGoogleDrive(url) {
  try {
    const drive = google.drive({ version: 'v3', auth: 'AIzaSyCYUPzrExoT9f9TsNj7Jqks1ZDJqqthuiI' });
    const fileId = url.match(/(?:drive.google.com\/.*?\/d\/)([\w-]{33})/)[1];
    const filePath = path.join(__dirname, 'GoogleDriveFile');

    const writer = fs.createWriteStream(filePath);
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    res.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading Google Drive content:', error);
    throw new Error('Failed to download Google Drive content');
  }
}

// Route Handlers
app.post('/download/tiktok', async (req, res) => {
  const { url, format } = req.body;
  try {
    const filePath = await downloadTikTok(url, format);
    res.download(filePath, () => fs.unlinkSync(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/download/youtube', async (req, res) => {
  const { url, format } = req.body;
  try {
    const filePath = await downloadYouTube(url, format);
    res.download(filePath, () => fs.unlinkSync(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/download/facebook', async (req, res) => {
  const { url, format } = req.body;
  try {
    const filePath = await downloadFacebook(url, format);
    res.download(filePath, () => fs.unlinkSync(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/download/google-drive', async (req, res) => {
  const { url } = req.body;
  try {
    const filePath = await downloadGoogleDrive(url);
    res.download(filePath, () => fs.unlinkSync(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`DownFlick is running on port ${port}`);
});

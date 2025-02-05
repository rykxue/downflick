const express = require("express")
const fs = require("fs")
const path = require("path")
const ytdl = require("ytdl-core")
const getFBInfo = require("@xaviabot/fb-downloader")
const { v4: uuidv4 } = require('uuid')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
const axios = require('axios'); // Import axios

const app = express()
const port = 9562

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

function generateUniqueId() {
  return uuidv4()
}

function formatDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`
}

// Helper: Convert MP4 to MP3 using ffmpeg
async function convertToMP3(mp4Path) {
  const fileName = path.basename(mp4Path, '.mp4')
  const mp3Path = path.join(path.dirname(mp4Path), `${fileName}.mp3`)
  return new Promise((resolve, reject) => {
    ffmpeg(mp4Path)
      .output(mp3Path)
      .format('mp3')
      .on('end', () => resolve(mp3Path))
      .on('error', reject)
      .run()
  })
}

// TikTok Downloader with MP3 Support
async function downloadTikTok(url, format) {
  try {
    const response = await axios.post("https://www.tikwm.com/api/", { url })
    const data = response.data.data

    const videoUrl = data.play
    const uniqueId = generateUniqueId()
    const date = formatDate()
    const fileName = `tikvid-${date}-${uniqueId}`
    const filePath = path.join(__dirname, `${fileName}.mp4`)
    const videoStream = await axios.get(videoUrl, { responseType: "stream" })
    const writer = fs.createWriteStream(filePath)
    videoStream.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        if (format === "mp3") {
          try {
            const mp3Path = await convertToMP3(filePath)
            fs.unlinkSync(filePath) // Remove the MP4 file after conversion
            resolve({ path: mp3Path, fileName: fileName })
          } catch (error) {
            reject(error)
          }
        } else {
          resolve({ path: filePath, fileName: fileName })
        }
      })
      writer.on("error", reject)
    })
  } catch (error) {
    console.error("Error downloading TikTok content:", error)
    throw new Error("Failed to download TikTok content")
  }
}

// YouTube Downloader with MP3 Support
async function downloadYouTube(url, format) {
  try {
    const videoId = ytdl.getVideoID(url)
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`
    const videoInfo = await ytdl.getInfo(normalizedUrl)
    const title = videoInfo.videoDetails.title.replace(/[<>:"/\\|?*]+/g, "")
    const date = formatDate()
    const fileName = title || `ytvid-${date}-${generateUniqueId()}`
    const filePath = path.join(__dirname, `${fileName}.mp4`)

    const stream = ytdl(normalizedUrl, { 
      quality: format === "mp4" ? "highestvideo" : "highestaudio",
      filter: format === "mp4" ? "videoandaudio" : "audioonly"
    })
    const writer = fs.createWriteStream(filePath)
    stream.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        if (format === "mp3") {
          try {
            const mp3Path = await convertToMP3(filePath)
            fs.unlinkSync(filePath) // Remove the MP4 file after conversion
            resolve({ path: mp3Path, fileName: fileName })
          } catch (error) {
            reject(error)
          }
        } else {
          resolve({ path: filePath, fileName: fileName })
        }
      })
      writer.on("error", reject)
    })
  } catch (error) {
    console.error("Error downloading YouTube content:", error)
    throw new Error("Failed to download YouTube content")
  }
}

// Facebook Downloader with MP3 Support
async function downloadFacebook(url, format) {
  try {
    const result = await getFBInfo(url)
    const videoUrl = result.sd
    const uniqueId = generateUniqueId()
    const date = formatDate()
    const fileName = `fbvid-${date}-${uniqueId}`
    const filePath = path.join(__dirname, `${fileName}.mp4`)
    const videoData = await axios.get(videoUrl, { responseType: "stream" })
    const writer = fs.createWriteStream(filePath)
    videoData.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        if (format === "mp3") {
          try {
            const mp3Path = await convertToMP3(filePath)
            fs.unlinkSync(filePath) // Remove the MP4 file after conversion
            resolve({ path: mp3Path, fileName: fileName })
          } catch (error) {
            reject(error)
          }
        } else {
          resolve({ path: filePath, fileName: fileName })
        }
      })
      writer.on("error", reject)
    })
  } catch (error) {
    console.error("Error downloading Facebook content:", error)
    throw new Error("Failed to download Facebook content")
  }
}

// Route Handlers
app.post("/download/tiktok", async (req, res) => {
  const { url, format } = req.body
  try {
    const { path: filePath, fileName } = await downloadTikTok(url, format)
    res.download(filePath, `${fileName}.${format}`, () => fs.unlinkSync(filePath))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post("/download/youtube", async (req, res) => {
  const { url, format } = req.body
  try {
    const { path: filePath, fileName } = await downloadYouTube(url, format)
    res.download(filePath, `${fileName}.${format}`, () => fs.unlinkSync(filePath))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post("/download/facebook", async (req, res) => {
  const { url, format } = req.body
  try {
    const { path: filePath, fileName } = await downloadFacebook(url, format)
    res.download(filePath, `${fileName}.${format}`, () => fs.unlinkSync(filePath))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Start server
app.listen(port, () => {
  console.log(`DownFlick is running on port ${port}`)
})

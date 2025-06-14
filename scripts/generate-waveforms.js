// scripts/generate-waveforms.js
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { Pool } from 'pg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Configure these to match your Supabase and DB credentials
const STORAGE_URL = 'https://xyzcompany.supabase.co/storage/v1/object/public'; 
const BUCKET = 'audio-posts'; 
const POSTS_TABLE = 'posts';
const SAMPLE_COUNT = 100; // number of bars in your waveform

const db = new Pool({
  user: 'postgres',
  host: 'db.yourhost.com',
  database: 'yourdb',
  password: 'yourpassword',
  port: 5432,
});

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const fileStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

async function extractWaveform(filePath) {
  // Generate SAMPLE_COUNT amplitude values via ffmpeg’s astats filter
  return new Promise((resolve, reject) => {
    const magnitudes = [];
    ffmpeg(filePath)
      .audioFilters(
        `astats=metadata=1:measure_perframe=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:\
        file=-`
      )
      .format('null')
      .on('stderr', stderrLine => {
        // ffmpeg prints per-frame RMS to stderr lines like: lavfi.astats.Overall.RMS_level=XX.XX
        const match = stderrLine.match(/RMS_level=(-?[0-9.]+)/);
        if (match) {
          magnitudes.push(parseFloat(match[1]));
        }
      })
      .on('end', () => {
        // We got an array of dB-levels; convert to linear [0,1] and resample to SAMPLE_COUNT
        const linear = magnitudes.map(dB => Math.pow(10, dB / 20));
        const result = [];
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const idx = Math.floor((i / SAMPLE_COUNT) * linear.length);
          result.push(linear[idx]);
        }
        resolve(result);
      })
      .on('error', reject)
      .saveToFile('/dev/null');
  });
}

async function main() {
  try {
    // 1. Fetch posts without waveform
    const { rows } = await db.query(
      `SELECT id, audio_url FROM ${POSTS_TABLE} WHERE waveform IS NULL`
    );

    for (const { id, audio_url } of rows) {
      console.log(`Processing post ${id}`);
      const filename = path.basename(audio_url);
      const localPath = path.resolve('/tmp', filename);

      // 2. Download the audio file
      const downloadUrl = `${STORAGE_URL}/${BUCKET}/${filename}`;
      await downloadFile(downloadUrl, localPath);

      // 3. Extract waveform data
      const waveform = await extractWaveform(localPath);

      // 4. Update DB
      await db.query(
        `UPDATE ${POSTS_TABLE} SET waveform = $1 WHERE id = $2`,
        [waveform, id]
      );
      console.log(`Updated waveform for post ${id}`);

      // Clean up
      fs.unlinkSync(localPath);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await db.end();
  }
}

main();

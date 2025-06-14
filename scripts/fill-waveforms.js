// scripts/fill-waveforms.js
import 'dotenv/config';                    // if you’re using a .env file
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@supabase/supabase-js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'audio-posts';
const SAMPLE_COUNT = 100;

// download the file locally
async function downloadToTemp(filename) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed for ${filename}`);
  const tmpPath = path.resolve('/tmp', filename);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(tmpPath);
    res.body.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
  });
  return tmpPath;
}

// extract per-frame peak levels (RMS) and downsample to SAMPLE_COUNT
function extractWaveform(filePath) {
  return new Promise((resolve, reject) => {
    const levels = [];
    ffmpeg(filePath)
      // make mono, then use `volumedetect` to get per-frame levels
      .audioFilters([
        'aformat=channel_layouts=mono',
        'astats=measure_perframe=1:reset=1',
        'ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-'
      ])
      .format('null')
      .on('stderr', line => {
        const m = line.match(/RMS_level=(-?[0-9.]+)/);
        if (m) levels.push(parseFloat(m[1]));
      })
      .on('end', () => {
        // convert dB to linear 0–1
        const linear = levels.map(dB => Math.pow(10, dB / 20));
        // downsample to fixed length
        const waveform = [];
        const step = linear.length / SAMPLE_COUNT;
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const idx = Math.floor(i * step);
          waveform.push(linear[idx] || 0);
        }
        resolve(waveform);
      })
      .on('error', reject)
      .saveToFile('/dev/null');
  });
}

async function main() {
  // find posts missing waveform
  const { data: posts, error: fetchErr } = await supabase
    .from('posts')
    .select('id, audio_url')
    .is('waveform', null);

  if (fetchErr) throw fetchErr;

  for (const { id, audio_url } of posts) {
    try {
      console.log('Processing', id);
      const filename = audio_url.split('/').pop();
      const tmp = await downloadToTemp(filename);
      const waveform = await extractWaveform(tmp);
      fs.unlinkSync(tmp);

      const { error: updateErr } = await supabase
        .from('posts')
        .update({ waveform })
        .eq('id', id);

      if (updateErr) throw updateErr;
      console.log('✔️ Updated', id);
    } catch (e) {
      console.error('✖️ Error on', id, e.message);
    }
  }

  process.exit();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

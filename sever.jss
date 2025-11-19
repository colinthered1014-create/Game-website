// server.js
const express = require('express');
const cors = require('cors');
const fse = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(morgan('combined'));

// Basic rate limiting to avoid spam
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/leaderboard', apiLimiter);

const DATA_FILE = path.join(__dirname, 'leaderboard.json');

// load or init the data file
async function loadData(){
  try{
    const exists = await fse.pathExists(DATA_FILE);
    if(!exists){
      await fse.writeJson(DATA_FILE, { clicker: [] }, { spaces: 2 });
    }
    const data = await fse.readJson(DATA_FILE);
    return data;
  }catch(err){
    console.error('loadData error', err);
    return { clicker: [] };
  }
}

async function saveData(obj){
  await fse.writeJson(DATA_FILE, obj, { spaces: 2 });
}

/* Health check */
app.get('/health', (req, res) => res.json({ ok: true, now: Date.now() }));

/* GET leaderboard for a game (return top N) */
app.get('/leaderboard/:game', async (req, res) => {
  try{
    const game = req.params.game || 'clicker';
    const data = await loadData();
    const list = data[game] || [];
    // sanitize and sort
    const sanitized = (list.map(i => ({ name: String(i.name).slice(0,32), score: Number(i.score) || 0, ts: i.ts || 0 })))
      .sort((a,b) => b.score - a.score)
      .slice(0, 50);
    res.json(sanitized);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

/* POST a score to leaderboard/:game
   body: { name: string, score: number }
*/
app.post('/leaderboard/:game', async (req, res) => {
  try{
    const game = req.params.game || 'clicker';
    const { name, score } = req.body;

    // basic validation
    if(typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_name' });
    }
    if(typeof score !== 'number' || !isFinite(score) || score < 0) {
      return res.status(400).json({ ok: false, error: 'invalid_score' });
    }

    const data = await loadData();
    data[game] = data[game] || [];

    // push entry and limit file size
    data[game].push({ name: name.slice(0,32), score: Math.floor(score), ts: Date.now() });

    // keep top 500
    data[game].sort((a,b) => b.score - a.score);
    data[game] = data[game].slice(0, 500);

    await saveData(data);
    res.json({ ok: true });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

/* simple admin endpoint (optional) - protect by secret in env if you want */
app.get('/_list/:game', async (req,res) => {
  const game = req.params.game || 'clicker';
  const data = await loadData();
  res.json(data[game] || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Clicker backend listening on port', PORT);
});

const express = require('express');
const cors = require('cors');
const fse = require('fs-extra');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'leaderboard.json');
async function loadData(){
  try{
    const exists = await fse.pathExists(DATA_FILE);
    if(!exists){
      await fse.writeJson(DATA_FILE, { clicker: [] }, { spaces:2 });
    }
    return await fse.readJson(DATA_FILE);
  }catch(e){
    console.error(e);
    return { clicker: [] };
  }
}

async function saveData(d){
  await fse.writeJson(DATA_FILE, d, { spaces:2 });
}

/* GET leaderboard for game */
app.get('/leaderboard/:game', async (req,res) => {
  const game = req.params.game || 'clicker';
  const data = await loadData();
  const lb = data[game] || [];
  // return top 50
  lb.sort((a,b)=>b.score - a.score);
  res.json(lb.slice(0,50));
});

/* POST a score */
app.post('/leaderboard/:game', async (req,res) => {
  const game = req.params.game || 'clicker';
  const { name, score } = req.body;
  if(typeof name !== 'string' || typeof score !== 'number'){
    return res.status(400).json({ ok:false, error:'invalid' });
  }
  const data = await loadData();
  data[game] = data[game] || [];
  data[game].push({ name: name.substring(0,24), score: Math.floor(score), ts: Date.now() });
  // keep top 500 to limit file size
  data[game].sort((a,b)=>b.score - a.score);
  data[game] = data[game].slice(0,500);
  await saveData(data);
  res.json({ ok:true });
});

/* simple health */
app.get('/health', (req,res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('server running on', PORT));

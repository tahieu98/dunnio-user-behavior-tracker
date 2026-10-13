require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const fs=require('fs');const path=require('path');const {pool}=require('./config/database');
async function migrate(){
 const c=await pool.getConnection();
 try {
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  for(const file of fs.readdirSync(path.join(__dirname,'../migrations')).filter(f=>f.endsWith('.sql')).sort()) {
   const [done]=await c.execute('SELECT name FROM schema_migrations WHERE name=?',[file]);if(done.length)continue;
   let sql=fs.readFileSync(path.join(__dirname,'../migrations',file),'utf8');
   sql=sql.replace(/--[^\n]*/g,'');
   // Initial schema predates the migration runner. Respect DB_NAME and never overwrite users.
   sql=sql.replace(/CREATE DATABASE IF NOT EXISTS dunnio_tracker;/g,'').replace(/USE dunnio_tracker;/g,'').replace(/INSERT INTO users[\s\S]*?;/,'').replace(/INSERT INTO pages/g,'INSERT IGNORE INTO pages');
   // Existing files contain no procedural SQL or semicolons inside string literals.
   for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await c.query(statement);
   await c.execute('INSERT INTO schema_migrations(name) VALUES (?)',[file]);
   console.log(`Applied ${file}`);
  }
 }finally{c.release();await pool.end();}
}
migrate().catch(e=>{console.error(e.message);process.exitCode=1;});

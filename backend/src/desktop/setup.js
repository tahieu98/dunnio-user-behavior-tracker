'use strict';
const mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),fs=require('fs'),path=require('path');
const {spawn,spawnSync}=require('child_process');
async function run(exe,args,env,input){
 const p=spawn(exe,args,{windowsHide:true,env:{...process.env,...env},stdio:[input?'pipe':'ignore','ignore','pipe']});
 let errors='';p.stderr.on('data',b=>{if(errors.length<1000)errors+=b.toString();});
 const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(`Setup helper exited ${code}`)));});
 if(input){const source=fs.createReadStream(input);source.on('error',e=>{p.kill();});source.pipe(p.stdin);p.stdin.on('error',()=>{});}
 await done;
}
async function importReview(root){
 const sourcePath=process.env.DESKTOP_IMPORT_ENV;
 if(!sourcePath||!fs.existsSync(sourcePath))return false;
 const source=require('dotenv').parse(fs.readFileSync(sourcePath));
 const sql=path.join(process.env.DESKTOP_RUN_ROOT,'import.sql');
 const dump=spawn(process.env.DESKTOP_MYSQLDUMP,['--no-defaults',`--host=${source.DB_HOST||'127.0.0.1'}`,`--port=${source.DB_PORT||3307}`,`--user=${source.DB_USER}`,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-comments','--default-character-set=utf8mb4',source.DB_NAME],{windowsHide:true,env:{...process.env,MYSQL_PWD:source.DB_PASSWORD||''},stdio:['ignore','pipe','pipe']});
 dump.stderr.resume();
 const done=new Promise((resolve,reject)=>{dump.on('error',reject);dump.on('close',code=>code===0?resolve():reject(new Error('Existing review database is unavailable; start it before importing')));});
 try{
  await Promise.all([require('stream/promises').pipeline(dump.stdout,fs.createWriteStream(sql,{flags:'wx'})),done]);
  await run(process.env.DESKTOP_MYSQL_CLIENT,['--no-defaults','--host=127.0.0.1',`--port=${process.env.DB_PORT}`,'--user=root','--default-character-set=utf8mb4',process.env.DB_NAME],{MYSQL_PWD:process.env.DESKTOP_MYSQL_ROOT_PASSWORD},sql);
  return true;
 }finally{await fs.promises.unlink(sql).catch(()=>{});}
}
(async()=>{
 const options={host:'127.0.0.1',port:Number(process.env.DB_PORT),user:'root',password:process.env.DESKTOP_MYSQL_ROOT_PASSWORD,connectTimeout:10000};
 let root;
 try{root=await mysql.createConnection(options);}catch(e){if(process.env.DESKTOP_INITIAL_SETUP!=='true'||e.code!=='ER_ACCESS_DENIED_ERROR')throw e;root=await mysql.createConnection({...options,password:''});await root.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[process.env.DESKTOP_MYSQL_ROOT_PASSWORD]);}
 try{
  if(!/^[a-zA-Z0-9_]+$/.test(process.env.DB_NAME))throw new Error('Invalid database name');
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query("CREATE USER IF NOT EXISTS 'dunnio_local'@'localhost' IDENTIFIED BY ?",[process.env.DB_PASSWORD]);
  await root.query(`GRANT ALL PRIVILEGES ON \`${process.env.DB_NAME}\`.* TO 'dunnio_local'@'localhost'`);
  if(process.env.DESKTOP_INITIAL_SETUP==='true')await importReview(root);
 }finally{await root.end();}
 const migration=spawnSync(process.execPath,[path.resolve(__dirname,'../migrate.js')],{env:process.env,windowsHide:true,encoding:'utf8',timeout:60000});
 if(migration.status!==0)throw new Error('Database migration failed');
 const db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 try{
  const name=process.env.DESKTOP_ADMIN_USERNAME||'admin';
  const [admins]=await db.execute('SELECT id,role,is_active FROM users WHERE username=?',[name]);
  if(!admins.length)await db.execute('INSERT INTO users(username,email,password_hash,role) VALUES (?,?,?,?)',[name,'admin@dunnio-insights.local',await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD,12),'admin']);
  else if(admins[0].role!=='admin'||!admins[0].is_active)throw new Error('Imported account is not an active Admin');
 }finally{await db.end();}
 console.log('Desktop database ready');
})().catch(e=>{console.error('Setup failed:',e.code||e.message);process.exitCode=1;});

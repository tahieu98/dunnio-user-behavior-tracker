// For the isolated, newly initialized review database only. Does not touch Laragon's existing databases.
const mysql=require('mysql2/promise'),crypto=require('crypto'),fs=require('fs/promises'),path=require('path');
(async()=>{
 const dir=path.join(process.env.USERPROFILE,'.codex/local-services/dunnio-review');
 const envFile=path.join(dir,'tracker.env');
 try{await fs.access(envFile);throw new Error('Local environment already provisioned');}catch(e){if(e.code!=='ENOENT')throw e;}
 const c=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:''});
 const rootPassword=crypto.randomBytes(24).toString('hex'),dbPassword=crypto.randomBytes(24).toString('hex'),adminPassword=crypto.randomBytes(14).toString('base64url');
 try{
  await c.query('CREATE DATABASE dunnio_review CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await c.query("CREATE USER 'dunnio_review'@'localhost' IDENTIFIED BY ?",[dbPassword]);
  await c.query("GRANT ALL PRIVILEGES ON dunnio_review.* TO 'dunnio_review'@'localhost'");
  await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[rootPassword]);
 }finally{await c.end();}
 await fs.writeFile(envFile,`PORT=3000\nHOST=127.0.0.1\nNODE_ENV=development\nDB_HOST=127.0.0.1\nDB_PORT=3307\nDB_NAME=dunnio_review\nDB_USER=dunnio_review\nDB_PASSWORD=${dbPassword}\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\nINITIAL_ADMIN_PASSWORD=${adminPassword}\nCORS_ORIGIN=http://localhost:3000\nENABLE_DEMO=true\nEVENT_RETENTION_DAYS=400\n`);
 await fs.writeFile(path.join(dir,'access.txt'),`Local review only\nURL: http://localhost:3000/analysis.html\nUsername: admin\nPassword: ${adminPassword}\nMySQL root password: ${rootPassword}\nDatabase: dunnio_review on 127.0.0.1:3307\n`);
 console.log('Isolated review environment configured outside the webroot.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});

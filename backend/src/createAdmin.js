require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const bcrypt=require('bcryptjs');const {query,pool}=require('./config/database');
(async()=>{
 const password=process.env.INITIAL_ADMIN_PASSWORD;
 if(!password||password.length<12)throw new Error('Set INITIAL_ADMIN_PASSWORD (at least 12 characters). No default password is installed.');
 const existing=await query('SELECT id FROM users WHERE username=?',[process.env.INITIAL_ADMIN_USERNAME||'admin']);
 if(existing.length)throw new Error('Admin already exists; use password change instead of overwriting.');
 await query('INSERT INTO users(username,email,password_hash,role) VALUES (?,?,?,?)',[process.env.INITIAL_ADMIN_USERNAME||'admin',process.env.INITIAL_ADMIN_EMAIL||'admin@dunnio-tracker.local',await bcrypt.hash(password,12),'admin']);
 console.log('Admin created.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

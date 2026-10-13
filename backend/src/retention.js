require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const {query,pool}=require('./config/database');
(async()=>{
 const days=Number(process.env.EVENT_RETENTION_DAYS||400);
 if(!Number.isInteger(days)||days<30||days>730)throw new Error('EVENT_RETENTION_DAYS must be 30–730');
 let count=0,batch;
 do{batch=await query('DELETE FROM behavior_events WHERE occurred_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY) LIMIT 10000',[days]);count+=batch.affectedRows;}while(batch.affectedRows===10000);
 await query('DELETE FROM clarity_exports WHERE requested_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY)');
 console.log(`Removed ${count} expired events. Reports beyond retention are no longer available.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

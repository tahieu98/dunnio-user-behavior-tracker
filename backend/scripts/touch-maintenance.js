'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const {exportDay,copyArchive}=require('../src/services/touchArchive'),{query,pool}=require('../src/config/database');
async function main(){
 const result=await exportDay();
 // Late batches can arrive within 24h: re-export the preceding date too, retaining both revisions.
 const prior=new Date(result.date+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);
 const previous=await exportDay({date:prior.toISOString().slice(0,10)});
 if(process.env.TOUCH_BACKUP_FOLDER)for(const item of [result,previous])await copyArchive({file:item.file,destination:process.env.TOUCH_BACKUP_FOLDER});
 const receipts=await query('DELETE FROM touch_batches WHERE received_at < UTC_TIMESTAMP() - INTERVAL 72 HOUR');
 console.log(JSON.stringify({exported:[result,previous],expiredReceipts:receipts.affectedRows,aggregateDeletion:false},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

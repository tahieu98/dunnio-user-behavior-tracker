require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const {capture}=require('../src/services/snapshotCapture'),{pool}=require('../src/config/database');
(async()=>{const siteId=Number(process.argv[2]||1),pagePath=process.argv[3]||'/blog/what-suit-color-to-choose.html',version=process.argv[4];for(const [device,width] of [['desktop',1440],['mobile',390]])console.log(JSON.stringify(await capture({siteId,pagePath,device,width,version})));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());

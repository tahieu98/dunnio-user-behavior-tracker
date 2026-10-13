'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const archive=require('../src/services/touchArchive');const {pool}=require('../src/config/database');
async function main(){
 const [command,...args]=process.argv.slice(2);const opts={};for(let i=0;i<args.length;i+=2){if(!['--date','--directory','--site','--file','--destination'].includes(args[i])||!args[i+1])throw new Error('Use export --date YYYY-MM-DD [--directory PATH] [--site ID], restore --file FILE, verify --file FILE, or copy --file FILE --destination PATH');opts[args[i].slice(2)]=args[i+1];}
 let result;
 if(command==='export')result=await archive.exportDay({date:opts.date,directory:opts.directory,siteId:opts.site?Number(opts.site):undefined});
 else if(command==='restore'&&opts.file)result=await archive.restoreFile({file:opts.file});
 else if(command==='verify'&&opts.file){const {manifest}=await archive.readArchive(opts.file);result={verified:true,...manifest};}
 else if(command==='copy'&&opts.file&&opts.destination)result=await archive.copyArchive({file:opts.file,destination:opts.destination});
 else throw new Error('Usage: touch-archive.js export|restore|verify|copy [options]');
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());

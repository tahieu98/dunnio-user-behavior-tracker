'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const path=require('path');
module.exports={testDir:'./test/browser',testMatch:'clarity-workspace.spec.js',fullyParallel:false,workers:1,timeout:45000,use:{channel:'chrome',headless:true,baseURL:'http://127.0.0.1:3016',screenshot:'only-on-failure',trace:'retain-on-failure'},reporter:'list',outputDir:'../test-results/clarity-workspace',webServer:{command:'node src/index.js',url:'http://127.0.0.1:3016/api/health',reuseExistingServer:false,env:{PORT:'3016',HOST:'127.0.0.1',DUNNIO_DESKTOP_MODE:'false',ENABLE_DEMO:'false',NODE_ENV:'development',DESKTOP_DATA_ROOT:path.resolve(__dirname,'../.local/clarity-qa')}}};

const {startServer}=require('./server');
startServer().catch(error=>{console.error(error.message);process.exit(1);});

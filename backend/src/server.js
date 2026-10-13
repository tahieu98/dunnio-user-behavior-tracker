require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const express=require('express'),cors=require('cors'),helmet=require('helmet'),path=require('path');
const {rateLimit}=require('express-rate-limit');
const {query,testConnection,pool}=require('./config/database');
const {errorHandler,notFoundHandler,asyncHandler}=require('./middleware/errorHandler');
const {monthBounds}=require('./services/behaviorMath');
const app=express();
app.disable('x-powered-by');
const proxyHops=Number(process.env.TRUST_PROXY_HOPS||0);
if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>2)throw new Error('TRUST_PROXY_HOPS must be 0, 1 or 2');
if(proxyHops)app.set('trust proxy',proxyHops);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'",'https://cdn.jsdelivr.net'],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],upgradeInsecureRequests:process.env.NODE_ENV==='production'?[]:null}},crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use((req,res,next)=>{res.setHeader('X-Robots-Tag','noindex, nofollow'); if(req.path.startsWith('/api'))res.setHeader('Cache-Control','no-store');next();});
app.use('/api/tracker',cors({origin:(origin,cb)=>{
 if(!origin)return cb(null,false);
 query('SELECT origin FROM tracking_sites').then(r=>cb(null,r.some(s=>require('./services/pageCatalog').sameOrigin(s.origin,origin))?origin:false)).catch(cb);
},credentials:false,methods:['POST','OPTIONS'],allowedHeaders:['Content-Type']}));
const dashboardOrigins=(process.env.CORS_ORIGIN||'http://localhost:3000').split(',').map(x=>x.trim());
app.use('/api',cors({origin:(origin,cb)=>cb(null,!origin||dashboardOrigins.includes(origin)),credentials:false}));
app.use('/api/behavior/heatmap-import',require('./middleware/auth').authenticate,require('./middleware/auth').authorize('admin','dev'),express.json({limit:'16mb'}));
app.post('/api/clarity-workspace/reports',require('./middleware/auth').authenticate,require('./middleware/auth').authorize('admin','dev'),express.json({limit:'16mb'}));
app.use(express.json({limit:'64kb'}));
app.use('/api/auth/login',rateLimit({windowMs:900000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/auth',require('./routes/auth'));
app.use('/api/pages',require('./routes/pages'));
app.use('/api/cta',require('./routes/cta'));
app.use('/api/clarity',require('./routes/clarity'));
app.use('/api/clarity-workspace',require('./routes/clarityWorkspace'));
const {router:behavior,collector}=require('./routes/behavior');
app.use('/api/tracker',collector);
app.use('/api/behavior',behavior);
const {router:touch,collector:touchCollector}=require('./routes/touch');
app.use('/api/tracker',touchCollector);
app.use('/api/touch',touch);
if(process.env.ENABLE_DEMO==='true' && process.env.NODE_ENV!=='production') {
 const demo=require('./services/demoData');
 app.get('/api/demo/catalog',(req,res)=>res.json({success:true,data:demo.catalog()}));
 app.get('/api/demo/compare',asyncHandler(async(req,res)=>{
  monthBounds(req.query.monthA);monthBounds(req.query.monthB);
  if(!['desktop','mobile'].includes(req.query.device))return res.status(400).json({success:false,message:'Invalid demo device'});
  res.json({success:true,data:demo.report(req.query)});
 }));
}
app.get('/api/health',(req,res)=>res.json({success:true,version:require('../package.json').version,timezone:'Asia/Ho_Chi_Minh'}));
app.use('/tracker',express.static(path.join(__dirname,'../../tracker'),{setHeaders:res=>res.setHeader('Cache-Control','public, max-age=3600')}));
app.get('/dashboard',(req,res)=>res.redirect('/touch.html'));
app.use((req,res,next)=>{
 if(['/touch.html','/analysis.html','/tracker-analysis.html','/desktop-login.html'].includes(req.path))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
 next();
});
app.use(express.static(path.join(__dirname,'../../frontend')));
if(process.env.DESKTOP_DATA_ROOT)app.use('/snapshots',express.static(require('./services/snapshotCapture').assetDirectory(),{fallthrough:true}));
if(process.env.DUNNIO_DESKTOP_MODE==='true')require('./desktop/control').attach(app);
app.use(notFoundHandler);app.use(errorHandler);
async function startServer(){
 if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32||/change|your-secret/i.test(process.env.JWT_SECRET))throw new Error('JWT_SECRET must be a unique random secret of at least 32 characters');
 if(!(await testConnection()))throw new Error('Database connection failed');
 const server=app.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log(`Dunnio Touch: http://localhost:${process.env.PORT||3000}/touch.html`));
 if(process.env.DUNNIO_DESKTOP_MODE!=='true')for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
 return server;
}
if(require.main===module)startServer().catch(e=>{console.error(e.message);process.exitCode=1;pool.end();});
module.exports={app,startServer};

'use strict';
const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticate}=require('../middleware/auth');
const {asyncHandler}=require('../middleware/errorHandler');
const {query}=require('../config/database');
const {validateBatch,collectorLimit}=require('../services/touchMath');
const store=require('../services/touchStore');
const {sameOrigin}=require('../services/pageCatalog');
const router=express.Router(),collector=express.Router();
collector.post('/touch',rateLimit({windowMs:60000,limit:collectorLimit(process.env.TOUCH_INGEST_LIMIT),standardHeaders:'draft-7',legacyHeaders:false}),asyncHandler(async(req,res)=>{
 validateBatch(req.body);
 const site=(await query('SELECT * FROM tracking_sites WHERE public_key=?',[req.body.siteKey]))[0];
 if(!site||!sameOrigin(req.headers.origin,site.origin))return res.status(403).json({success:false,message:'Site origin/key mismatch'});
 res.status(202).json({success:true,data:await store.ingest(site,req.body)});
}));
router.get('/catalog',authenticate,asyncHandler(async(req,res)=>res.json({success:true,data:await store.catalog()})));
router.post('/report',authenticate,asyncHandler(async(req,res)=>res.json({success:true,data:await store.report(req.body)})));
module.exports={router,collector};

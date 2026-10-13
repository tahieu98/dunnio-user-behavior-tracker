const test=require('node:test'),assert=require('node:assert/strict');
const {pagePath,typeOf,urlMetrics}=require('../src/services/pageCatalog'),{slice}=require('../src/services/clarityComparison'),{csvRows,selectorsFromCsv,pngSize}=require('../src/services/heatmapArchive');
test('desktop crash diagnostics preserve source location without secrets or error payload',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),{record}=require('../src/desktop/diagnostics');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dunnio-diagnostic-')),previous=process.env.DESKTOP_DATA_ROOT;
 try{process.env.DESKTOP_DATA_ROOT=root;const error=new Error('Bearer secret-token-value');error.code='E_TEST';error.stack='Error: Bearer secret-token-value\n    at handler (C:\\app\\entry.js:12:7)';record(error,'uncaughtException');const text=fs.readFileSync(path.join(root,'last-backend-error.json'),'utf8'),data=JSON.parse(text);assert.equal(data.code,'E_TEST');assert.deepEqual(data.frames,[{file:'entry.js',line:12,column:7}]);assert.ok(!text.includes('secret-token-value'));}
 finally{if(previous===undefined)delete process.env.DESKTOP_DATA_ROOT;else process.env.DESKTOP_DATA_ROOT=previous;fs.unlinkSync(path.join(root,'last-backend-error.json'));fs.rmdirSync(root);}
});
test('website catalog normalizes www aliases but rejects external and sensitive paths',()=>{
 const origin='https://dunniotailor.com';assert.equal(pagePath('https://www.dunniotailor.com/blog/one.html?email=private',origin),'/blog/one.html');
 for(const url of ['https://evil.test/blog/one.html','https://dunniotailor.com/user/login','https://dunniotailor.com/%3Cnolink%3E','https://dunniotailor.com/%61dmin/x'])assert.equal(pagePath(url,origin),null);
 assert.equal(typeOf('/blog/stylists-advice'),'blog-category');assert.equal(typeOf('/blog/article-without-extension'),'blog-article');assert.equal(typeOf('/men/custom-suits',['/men/custom-suits']),'service');assert.equal(typeOf('/a-suit.html'),'product');
});
test('Clarity preserves metric fields, URL variants and device rows rather than summing averages',()=>{
 const data=[{metricName:'ScrollDepth',information:[{Url:'https://dunniotailor.com/blog/a.html',Device:'PC',averageScrollDepth:20},{Url:'https://www.dunniotailor.com/blog/a.html',Device:'Mobile',averageScrollDepth:80}]}];
 const map=urlMetrics(data,'https://dunniotailor.com');assert.equal(map.size,1);assert.equal(map.get('/blog/a.html').metrics.ScrollDepth.length,2);
 const desktop=slice(data,'https://dunniotailor.com','/blog/a.html','desktop');assert.equal(desktop.length,1);assert.equal(desktop[0].value,20);assert.equal(slice(data,'https://dunniotailor.com','/blog/missing.html','desktop').length,0);
});
test('heatmap CSV keeps quoted selectors, rejects unsupported columns and malformed values',()=>{
 assert.deepEqual(csvRows('Selector,Clicks\r\n"a[href=""/men/suits""]",12\r\n'),[['Selector','Clicks'],['a[href="/men/suits"]','12']]);
 assert.deepEqual(selectorsFromCsv('Selector,Clicks\n"a, b",7'),[{key:'a, b',count:7}]);
 assert.throws(()=>selectorsFromCsv('x,y\n10,20'),/cột/);assert.throws(()=>selectorsFromCsv('Selector,Clicks\na,-3'),/Invalid/);assert.throws(()=>csvRows('a,"unclosed'),/Unclosed/);
 assert.throws(()=>pngSize(Buffer.from('<svg onload=alert(1)>')),/PNG/);
});
test('duplicate API partitions remain separate and missing values never turn into zero deltas',()=>{
 const {mergeRows}=require('../src/services/clarityComparison');const row={metric:'Traffic',field:'totalSessionCount',url:'https://dunniotailor.com/blog/a.html',device:'PC'};
 const duplicates=mergeRows([{...row,value:2},{...row,value:5}],[{...row,value:8}]);assert.deepEqual(duplicates[0].a,[2,5]);assert.equal(duplicates[0].delta,null);
 const missing=mergeRows([{...row,value:0}],[]);assert.equal(missing[0].b,null);assert.equal(missing[0].delta,null);
});

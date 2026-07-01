#!/usr/bin/env node
const fs=require('node:fs'),path=require('path');
const ROOT='.',PKG=JSON.parse(fs.readFileSync('package.json','utf8')),COUNT=process.argv[2]||'8';
const smokes=['v113-3-112','v113-3-114','v113-3-115','v113-3-116','v113-3-117','v113-3-118','v113-3-119','v113-3-120','v113-3-121','v113-3-122','v113-3-123','v113-3-124','v113-3-125','v113-3-126','v113-3-127','v113-3-128','v113-3-129','v113-3-130'];
let ok=true;
smokes.slice(0,parseInt(COUNT)).forEach(function(s){
  const key='smoke:'+s;
  if(!PKG.scripts||!PKG.scripts[key]){
    console.error('MISSING: '+key);
    ok=false;
  }else{console.log('OK: '+key)}
});
console.log(ok?'RC Freeze: all smokes registered':'RC Freeze: some smokes missing');
process.exit(ok?0:1);

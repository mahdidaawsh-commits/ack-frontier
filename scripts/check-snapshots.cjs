const fs=require('node:fs'),{check}=require('./scenario.cjs');
const sample=JSON.parse(fs.readFileSync(process.argv[2]));
for(const state of sample.states)check(sample.case,state,'a'.repeat(40));
console.log('Independent whole-history response-window oracle checked each snapshot');

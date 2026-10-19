// Generate one encrypted disposable gasless CLI account; never export its key.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
if(!process.env.GITHUB_ACTIONS||!process.env.GITHUB_ENV)throw Error('Disposable CI runner only');
const cli=path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'genlayer/dist/index.js');
const password=crypto.randomBytes(24).toString('hex');console.log('::add-mask::'+password);
const name='ack-proof';
cp.execFileSync(process.execPath,[cli,'account','create','--name',name,'--password',password],{stdio:['ignore','ignore','pipe']});
cp.execFileSync(process.execPath,[cli,'network','set','studionet'],{stdio:['ignore','ignore','pipe']});
fs.appendFileSync(process.env.GITHUB_ENV,`GENLAYER_CLI_PATH=${cli}\nACK_PASSWORD=${password}\nACK_ACCOUNT=${name}\n`);

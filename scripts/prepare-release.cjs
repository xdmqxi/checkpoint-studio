// Stage stable download filenames from the current tested installer version.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {createReadStream} = require('node:fs');
const {version} = require('../package.json');
const targets = {
 mac: [`Checkpoint-Studio-${version}-macOS-arm64.dmg`, 'Checkpoint-Studio-macOS-arm64.dmg'],
 win: [`Checkpoint-Studio-${version}-Windows-x64-Setup.exe`, 'Checkpoint-Studio-Windows-x64-Setup.exe'],
};
async function main() {
 const chosen = process.argv[2] ? [process.argv[2]] : ['mac','win'];
 if(chosen.some(k=>!targets[k]))throw Error('Usage: node scripts/prepare-release.cjs [mac|win]');
 const out=path.resolve('release-upload');await fs.mkdir(out,{recursive:true});
 for(const key of chosen){
  const [source,dest]=targets[key],sourcePath=path.resolve('release',source),destPath=path.join(out,dest);
  await fs.copyFile(sourcePath,destPath);
  const hash=crypto.createHash('sha256');for await (const chunk of createReadStream(destPath))hash.update(chunk);
  await fs.writeFile(path.join(out,`${dest}.sha256`),`${hash.digest('hex')}  ${dest}\n`);
  console.log(destPath);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

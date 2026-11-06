const {version} = require('../package.json');
const tag=process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;
if(tag!==`v${version}`)throw Error(`Tag must match package version: expected v${version}`);
console.log(`Release version verified: ${tag}`);

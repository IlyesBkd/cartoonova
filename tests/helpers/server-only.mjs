// Tests of the support chain that only runs on the Cartoonova server import
// files kept outside this repository. Elsewhere (GitHub CI) they are reported
// as skipped instead of failing at import.
import {accessSync,constants} from 'node:fs';
const SERVER_FILES=[
 '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs',
 '/home/hermes/projects/cartoonova/scripts/telegram-progressive.mjs',
];
export function serverSkip(files=SERVER_FILES){
 const missing=files.filter(file=>{try{accessSync(file,constants.R_OK);return false;}catch{return true;}});
 return missing.length?`needs server-only files: ${missing.join(', ')}`:false;
}
export const serverOnly=(run,skip)=>skip?name=>run(name,{skip},()=>{}):run;

import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data/playerPortraits.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);
const entries=Object.entries(c.exports.PLAYER_PORTRAITS);
if(entries.length!==75)throw Error('Unexpected catalog size');
for(const [id,p] of entries){if(!/^\d+$/.test(id)||!p.names.length||!p.clubId||!fs.existsSync('public'+p.src))throw Error('Invalid asset '+id);}
console.log('All 75 catalog entries have valid IDs, names, club IDs and runtime files.');

const fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(p,'utf8');
const b64=p=>fs.readFileSync(p).toString('base64');
const resources={};for(const folder of ['cmaps','standard_fonts'])for(const name of fs.readdirSync('node_modules/pdfjs-dist/'+folder)){if(/\.(bcmap|pfb|ttf)$/.test(name))resources[name]=b64('node_modules/pdfjs-dist/'+folder+'/'+name)}
const bootstrap=`const embeddedPdfResources=${JSON.stringify(resources)};
const decode64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const pdfModuleURL=URL.createObjectURL(new Blob([decode64('${b64('node_modules/pdfjs-dist/build/pdf.min.mjs')}')],{type:'text/javascript'}));
const pdfWorkerURL=URL.createObjectURL(new Blob([decode64('${b64('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')}')],{type:'text/javascript'}));
class LocalCMaps{async fetch({name}){const data=embeddedPdfResources[name+'.bcmap'];if(!data)throw Error('未找到内置字符映射：'+name);return {cMapData:decode64(data),compressionType:1}}}
class LocalFonts{async fetch({filename}){const data=embeddedPdfResources[filename];if(!data)throw Error('未找到内置字体：'+filename);return decode64(data)}}
`;
let app=read('src/app.js').replaceAll("import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs')","import(pdfModuleURL)").replaceAll("'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'","pdfWorkerURL").replaceAll('pdfjs.getDocument({data:','pdfjs.getDocument({CMapReaderFactory:LocalCMaps,StandardFontDataFactory:LocalFonts,useWorkerFetch:false,data:');
let html=read('src/index.html').replace('<link rel="stylesheet" href="style.css">','<style>'+read('src/style.css')+'</style>');
const inline=p=>'<script>'+read(p).replace(/<\/script/gi,'<\\/script')+'</script>';
html=html.replace('<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>',()=>inline('node_modules/jszip/dist/jszip.min.js')).replace('<script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>',()=>inline('node_modules/pdf-lib/dist/pdf-lib.min.js')).replace('<script type="module" src="app.js"></script>',()=>'<script>'+bootstrap+app.replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace('需联网刷新','请重新打开工具');
fs.writeFileSync('轻压-免安装完整版.html',html);console.log('已生成：轻压-免安装完整版.html');
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/index.html',html);fs.writeFileSync('docs/.nojekyll','');
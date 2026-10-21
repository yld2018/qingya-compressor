const $=s=>document.querySelector(s);let queue=[],busy=false;const fmt=n=>n<1e6?(n/1000).toFixed(1)+' KB':(n/1e6).toFixed(2)+' MB';
function render(){const list=$('#list');list.replaceChildren();if(!queue.length)list.innerHTML='<div class="empty">等待添加文件，准备让它们轻装上阵。</div>';queue.forEach((item,i)=>{const row=document.createElement('div');row.className='row';const icon=document.createElement('div');icon.className='fileicon';icon.textContent=item.ext.toUpperCase();const info=document.createElement('div');info.className='info';const name=document.createElement('div');name.className='filename';name.textContent=item.file.name;const meta=document.createElement('div');meta.className='meta';meta.textContent=fmt(item.file.size)+(item.message?' → '+item.message:' · 等待压缩');if(item.out)meta.classList.add((item.converted&&!item.chained)||item.metTarget===true||(!item.pages&&item.out.size<=item.target)?'ok':'warn');info.append(name,meta);row.append(icon,info);if(item.url){const a=document.createElement('a');a.href=item.url;a.download=item.name;a.textContent='下载';row.append(a)}if(item.pages){const links=document.createElement('div');links.className='page-downloads';item.pages.forEach((page,i)=>{const a=document.createElement('a');a.href=page.url;a.download=page.name;a.textContent='第 '+(i+1)+' 页'+(page.size!==undefined?' · '+fmt(page.size)+(item.chained?(page.size<=item.target?' ✓':' · 超目标'):''):'');links.append(a)});info.append(links)}const x=document.createElement('button');x.className='remove';x.textContent='×';x.ariaLabel='移除 '+item.file.name;x.disabled=busy;x.onclick=()=>{if(item.url)URL.revokeObjectURL(item.url);if(item.pages)item.pages.forEach(p=>URL.revokeObjectURL(p.url));queue.splice(i,1);render()};row.append(x);list.append(row)});$('#count').textContent=queue.length?'共 '+queue.length+' 个文件':'尚未添加文件';$('#start').disabled=busy||!queue.length;$('#download').disabled=busy||!queue.some(x=>x.out);$('#clear').disabled=busy;$('#files').disabled=busy;$('#convert').disabled=busy||!queue.length;$('#format').disabled=busy}
function add(files){if(busy)return;const errors=[];for(const file of files){const ext=file.name.split('.').pop().toLowerCase();if(!['jpg','jpeg','png','webp','docx','pdf'].includes(ext)){errors.push(file.name+'：不支持此格式，旧版 DOC 请先转为 DOCX');continue}if(file.size>30e6){errors.push(file.name+'：超过 30MB');continue}queue.push({file,ext})}render();$('#status').textContent=errors.length?errors.join('；'):'已准备好，可以开始压缩'}
$('#files').onchange=e=>{add(e.target.files);e.target.value=''};$('#drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#files').click()}};['dragenter','dragover'].forEach(n=>$('#drop').addEventListener(n,e=>{e.preventDefault();$('#drop').classList.add('over')}));['dragleave','drop'].forEach(n=>$('#drop').addEventListener(n,e=>{e.preventDefault();$('#drop').classList.remove('over');if(n==='drop')add(e.dataTransfer.files)}));$('#clear').onclick=()=>{queue.forEach(x=>{if(x.url)URL.revokeObjectURL(x.url);if(x.pages)x.pages.forEach(p=>URL.revokeObjectURL(p.url))});queue=[];render()};document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{$('#target').value=b.dataset.size;mark()});function mark(){document.querySelectorAll('[data-size]').forEach(b=>b.classList.toggle('selected',b.dataset.size==$('#target').value))}$('#target').oninput=mark;
const canvasBlob=(c,type,q)=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('图片编码失败')),type,q));
async function bitmap(blob){return createImageBitmap(blob)}
async function encode(image,max,q,type='image/jpeg'){const c=document.createElement('canvas'),scale=Math.min(1,max/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext('2d');if(type==='image/jpeg'){ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height)}ctx.drawImage(image,0,0,c.width,c.height);return canvasBlob(c,type,q)}
async function compressImage(file,target,mode,type='image/jpeg'){const im=await bitmap(file);try{let best=null;const min=mode==='quality'?800:mode==='small'?96:240;for(let edge=mode==='quality'?2600:2000;edge>=min;edge=Math.floor(edge*.75)){for(const q of (type==='image/png'?[1]:[.82,.63,.44,.26,.14])){const b=await encode(im,edge,q,type);if(!best||b.size<best.size)best=b;if(b.size<=target)return b}}return best}finally{im.close()}}
async function docx(file,target,mode){if(!window.JSZip)throw Error('压缩组件加载失败，请联网刷新');const data=await file.arrayBuffer();let best=file;for(const factor of [1,.55,.28,.12]){const zip=await JSZip.loadAsync(data);const entries=Object.values(zip.files).filter(x=>!x.dir&&/^word\/media\/.*\.(jpe?g|png)$/i.test(x.name));for(const entry of entries){const original=await entry.async('blob'),type=/\.png$/i.test(entry.name)?'image/png':'image/jpeg';const b=await compressImage(original,Math.max(1000,target*.65/Math.max(1,entries.length)*factor),mode,type);if(b.size<original.size)zip.file(entry.name,b)}const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:9},mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});if(out.size<best.size)best=out;if(best.size<=target)break}return best}
let pdfjs;async function pdf(file,target,mode,progress){if(!window.PDFLib)throw Error('PDF 组件加载失败，请联网刷新');if(!pdfjs){pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'}const source=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;try{if(source.numPages>100)throw Error('为避免浏览器内存不足，仅支持 100 页以内 PDF');let best=file;for(const [edge,q]of(mode==='quality'?[[1800,.75],[1400,.55],[1000,.4],[800,.3]]:mode==='small'?[[1400,.65],[1000,.45],[700,.3],[440,.2],[280,.14]]:[[1600,.7],[1200,.5],[900,.35],[600,.25],[400,.18]])){const doc=await PDFLib.PDFDocument.create();for(let i=1;i<=source.numPages;i++){progress('正在处理 PDF 第 '+i+'/'+source.numPages+' 页');const page=await source.getPage(i),base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,edge/Math.max(base.width,base.height))});const c=document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);await page.render({canvasContext:c.getContext('2d'),viewport,background:'white'}).promise;const b=await canvasBlob(c,'image/jpeg',q),image=await doc.embedJpg(await b.arrayBuffer());doc.addPage([base.width,base.height]).drawImage(image,{x:0,y:0,width:base.width,height:base.height});c.width=0;c.height=0;page.cleanup()}const out=new Blob([await doc.save()],{type:'application/pdf'});if(out.size<best.size)best=out;if(best.size<=target)break}return best}finally{await source.destroy()}}
$('#start').onclick=async()=>{const kb=Number($('#target').value);if(!Number.isFinite(kb)||kb<20||kb>10240){$('#status').textContent='请输入 20–10240 之间的目标 KB 数值';return}busy=true;render();const target=kb*1000,mode=$('#mode').value;for(let i=0;i<queue.length;i++){const item=queue[i];if(item.url)URL.revokeObjectURL(item.url);if(item.pages)item.pages.forEach(p=>URL.revokeObjectURL(p.url));delete item.out;delete item.url;delete item.pages;delete item.converted;delete item.chained;delete item.metTarget;item.target=target;item.message='正在压缩…';render();const progress=t=>$('#status').textContent=(i+1)+'/'+queue.length+' · '+t;progress('正在压缩 '+item.file.name);await new Promise(r=>setTimeout(r,20));try{let out=item.file,ext=item.ext;if(item.file.size>target){if(ext==='docx')out=await docx(item.file,target,mode);else if(ext==='pdf')out=await pdf(item.file,target,mode,progress);else{out=await compressImage(item.file,target,mode);ext='jpg';if(out.size>=item.file.size){out=item.file;ext=item.ext}}}item.out=out;item.name=item.file.name.replace(/\.[^.]+$/,'')+'-压缩.'+ext;item.url=URL.createObjectURL(out);const reduction=Math.round((1-out.size/item.file.size)*100);item.message=fmt(out.size)+(out.size<=target?' · 已达标':' · 未达目标，可尝试体积优先')+' · 减少 '+Math.max(0,reduction)+'%'}catch(e){item.message='处理失败：'+(e.message||'文件可能损坏或被加密')}render()}busy=false;render();const ok=queue.filter(x=>x.out&&x.out.size<=target).length;$('#status').textContent='处理完成：'+ok+'/'+queue.length+' 个文件达到目标；请下载后检查清晰度与内容。'};
$('#download').onclick=()=>{let count=0;for(const item of queue){const results=item.pages||(item.out&&item.url?[{url:item.url,name:item.name}]:[]);for(const result of results){const a=document.createElement('a');a.href=result.url;a.download=result.name;document.body.append(a);a.click();a.remove();count++}}$('#status').textContent='已开始下载 '+count+' 个文件。如浏览器拦截多个下载，请点击文件或各页旁的下载链接。'};
async function convertFile(item,format){
 const image=['jpg','jpeg','png','webp'].includes(item.ext);
 if(format==='pdf-jpg'||format==='pdf-png'){
  if(item.ext!=='pdf')throw Error('请选择 PDF 文件后再转换为图片');
  if(!pdfjs){pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'}
  const doc=await pdfjs.getDocument({data:new Uint8Array(await item.file.arrayBuffer())}).promise;
  try{if(doc.numPages>100)throw Error('仅支持 100 页以内 PDF');const results=[];for(let i=1;i<=doc.numPages;i++){
   $('#status').textContent='正在转换 '+item.file.name+'：第 '+i+'/'+doc.numPages+' 页';
   const page=await doc.getPage(i),base=page.getViewport({scale:1});
   const viewport=page.getViewport({scale:Math.min(2,2600/Math.max(base.width,base.height))});
   const c=document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);
   try{await page.render({canvasContext:c.getContext('2d'),viewport,background:'white'}).promise;results.push(await canvasBlob(c,format==='pdf-png'?'image/png':'image/jpeg',.92))}finally{c.width=0;c.height=0;page.cleanup()}
  }return results}finally{await doc.destroy()}
 }
 if(['jpg','png','webp','pdf'].includes(format)){
  if(!image)throw Error('此转换仅支持图片，请选择图片或改用 TXT 提取');
  const im=await bitmap(item.file);
  try{
   if(format==='pdf'){
    if(!window.PDFLib)throw Error('PDF 组件加载失败，请联网刷新');
    const doc=await PDFLib.PDFDocument.create();
    const blob=await encode(im,Math.max(im.width,im.height),.92,'image/jpeg');
    const embedded=await doc.embedJpg(await blob.arrayBuffer());
    const scale=Math.min(1,14400/Math.max(im.width,im.height));
    const width=im.width*scale,height=im.height*scale;
    doc.addPage([width,height]).drawImage(embedded,{x:0,y:0,width,height});
    return new Blob([await doc.save()],{type:'application/pdf'});
   }
   const mime={jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[format];
   const result=await encode(im,Math.max(im.width,im.height),.92,mime);
   if(result.type!==mime)throw Error('当前浏览器不支持输出此格式');
   return result;
  }finally{im.close()}
 }
 let text='';
 if(item.ext==='docx'){
  if(!window.JSZip)throw Error('Word 组件加载失败，请联网刷新');
  const zip=await JSZip.loadAsync(await item.file.arrayBuffer());
  const entry=zip.file('word/document.xml');if(!entry)throw Error('不是有效的 DOCX 文件');
  const xml=new DOMParser().parseFromString(await entry.async('string'),'application/xml');
  if(xml.querySelector('parsererror'))throw Error('Word 内容无法解析');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  text=Array.from(xml.getElementsByTagNameNS(ns,'p')).map(p=>{
   const walker=xml.createTreeWalker(p,NodeFilter.SHOW_ELEMENT);let value='',node;
   while(node=walker.nextNode()){if(node.namespaceURI!==ns)continue;if(node.localName==='t')value+=node.textContent;else if(node.localName==='tab')value+='\t';else if(['br','cr'].includes(node.localName))value+='\n'}return value;
  }).join('\n');
 }else if(item.ext==='pdf'){
  if(!pdfjs){pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'}
  const doc=await pdfjs.getDocument({data:new Uint8Array(await item.file.arrayBuffer())}).promise;
  try{if(doc.numPages>100)throw Error('仅支持 100 页以内 PDF');const pages=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();pages.push(content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''));page.cleanup()}text=pages.join('\n\n')}finally{await doc.destroy()}
 }else throw Error('TXT 提取仅支持 DOCX 和含文字的 PDF');
 if(!text.trim())throw Error('未提取到文字，扫描版 PDF 需要 OCR 识别');
 return new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'});
}
$('#chain').onchange=()=>{$('#convert').textContent=$('#chain').checked?'转换并压缩':'转换格式'};
async function compressConverted(blob,ext,target,mode,progress){
 if(blob.size<=target||ext==='txt')return blob;
 let out;
 if(ext==='pdf')out=await pdf(blob,target,mode,progress);
 else out=await compressImage(blob,target,mode,{jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[ext]);
 return out.size<blob.size?out:blob;
}
$('#convert').onclick=async()=>{
 const format=$('#format').value,chained=$('#chain').checked,kb=Number($('#target').value),mode=$('#mode').value;
 if(chained&&(!Number.isFinite(kb)||kb<20||kb>10240)){$('#status').textContent='请输入 20–10240 之间的目标 KB 数值';return}
 const target=kb*1000;busy=true;$('#chain').disabled=true;render();
 try{for(let i=0;i<queue.length;i++){
  const item=queue[i];if(item.url)URL.revokeObjectURL(item.url);if(item.pages)item.pages.forEach(p=>URL.revokeObjectURL(p.url));delete item.out;delete item.url;delete item.pages;delete item.converted;delete item.metTarget;
  item.chained=chained;item.target=target;item.message='正在转换…';render();
  const progress=t=>$('#status').textContent=(i+1)+'/'+queue.length+' · '+t;
  progress('正在转换 '+item.file.name);await new Promise(r=>setTimeout(r,20));
  try{
   let out=await convertFile(item,format);
   const suffix=chained?'-转换压缩':'-转换',base=item.file.name.replace(/\.[^.]+$/,'');
   if(Array.isArray(out)){
    const ext=format==='pdf-png'?'png':'jpg';
    if(chained)for(let j=0;j<out.length;j++){progress('正在压缩第 '+(j+1)+'/'+out.length+' 张图片');out[j]=await compressConverted(out[j],ext,target,mode,progress)}
    item.pages=out.map((blob,index)=>({url:URL.createObjectURL(blob),size:blob.size,name:base+suffix+'-第'+String(index+1).padStart(3,'0')+'页.'+ext}));
    item.out=new Blob([]);item.converted=true;item.metTarget=out.every(b=>b.size<=target);
    const passed=out.filter(b=>b.size<=target).length;
    item.message=out.length+' 页 · 总计 '+fmt(out.reduce((sum,b)=>sum+b.size,0))+(chained?' · '+passed+'/'+out.length+' 张达标':' · 转换完成');
   }else{
    if(chained){progress('正在压缩转换结果');out=await compressConverted(out,format,target,mode,progress)}
    item.out=out;item.converted=true;item.metTarget=out.size<=target;item.name=base+suffix+'.'+format;item.url=URL.createObjectURL(out);
    item.message=fmt(out.size)+' · '+format.toUpperCase()+(chained?(item.metTarget?' · 已达标':' · 未达目标'+(format==='txt'?'，完整文本已保留':'，可尝试体积优先')):' · 转换完成');
   }
  }catch(e){item.message='处理失败：'+(e.message||'无法读取文件')}
  render();
 }}finally{busy=false;$('#chain').disabled=false;render()}
 const n=queue.filter(x=>x.converted).length,passed=queue.filter(x=>x.converted&&x.metTarget).length;
 $('#status').textContent='处理完成：'+n+'/'+queue.length+' 个文件成功'+(chained?'，其中 '+passed+' 个文件的全部结果达到目标。':'。')+'可直接下载，请检查清晰度与内容。';
};
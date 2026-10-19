const form=document.getElementById('unlock-form');
const input=document.getElementById('passphrase');
const submit=document.getElementById('unlock-submit');
const message=document.getElementById('unlock-message');
const base=new URL('./',location.href);
const decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
const reveal=document.getElementById('reveal');
reveal.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';reveal.textContent=show?'隱藏':'顯示';reveal.setAttribute('aria-label',show?'隱藏暗號':'顯示暗號');reveal.setAttribute('aria-pressed',String(show));};
let encrypted=null;
async function loadCollection(){if(encrypted)return encrypted;const response=await fetch(new URL('collection.json',base),{cache:'no-store'});if(!response.ok)throw new Error('download');encrypted=await response.json();return encrypted;}
function restoreButton(){submit.disabled=false;submit.innerHTML='為我們開門 <span>↗</span>';}
async function openMuseum(collection){
 const files=collection.files,urls=[];
 let app=files['app.js'].data;
 for(const [name,file]of Object.entries(files))if(file.encoding==='base64'){
   const url=URL.createObjectURL(new Blob([decode(file.data)],{type:'image/jpeg'}));urls.push(url);app=app.split(name).join(url);
 }
 app=app.replace("'./assets/three.module.js'",JSON.stringify(new URL('assets/three.module.js',base).href));
 const parsed=new DOMParser().parseFromString(files['index.html'].data,'text/html');
 for(const script of parsed.querySelectorAll('script'))script.remove();
 for(const link of parsed.querySelectorAll('link[rel="stylesheet"]'))link.remove();
 document.title=parsed.title;
 document.querySelector('link[href="./unlock.css"]')?.remove();
 const style=document.createElement('style');style.textContent=files['style.css'].data;document.head.append(style);
 document.body.className='';document.body.innerHTML=parsed.body.innerHTML;
 const moduleUrl=URL.createObjectURL(new Blob([app],{type:'text/javascript'}));urls.push(moduleUrl);
 const three=await import(new URL('assets/three.module.js',base).href);
 // Confirm WebGL before replacing the final message with the scene.
 if(!three.WebGLRenderer)throw new Error('renderer');
 await import(moduleUrl);
 window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(submit.disabled)return;
 const passphrase=input.value.normalize('NFC').trim();if(!passphrase){message.textContent='先告訴我，我們的專屬暗號。';input.focus();return;}
 if(!globalThis.crypto?.subtle){message.textContent='請透過 HTTPS 網址開啟，或使用本機預覽伺服器。';return;}
 submit.disabled=true;submit.textContent='正在為我們點亮回憶…';message.textContent='';
 let data;try{data=await loadCollection();}catch{message.textContent='回憶暫時沒有載入成功，請確認網路後再試一次。';restoreButton();return;}
 let collection;
 try{
   const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
   const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(data.salt),iterations:data.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
   const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(data.iv)},key,decode(data.ciphertext));
   collection=JSON.parse(new TextDecoder().decode(plaintext));
 }catch{message.textContent='暗號好像不太一樣，再想想我們的那句話 ♡';input.setAttribute('aria-invalid','true');input.focus();restoreButton();return;}
 input.value='';input.removeAttribute('aria-invalid');
 try{await openMuseum(collection);}catch(error){const loading=document.getElementById('loading');if(loading){loading.hidden=false;loading.textContent='展館未能啟動，請使用新版 Safari 或 Chrome，或重新整理再試。';}else{message.textContent='展館未能啟動，請重新整理後再試。';restoreButton();}console.error('Museum could not start',error);}
});

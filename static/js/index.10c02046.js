(()=>{"use strict";var e={8994:function(e,t,r){let n,i;var a,o=r("1549"),s=r("4194"),c=r("8082");class l extends Error{constructor(e){super(e),this.name="IDBCacheError",Object.setPrototypeOf(this,new.target.prototype)}}class d extends l{constructor(e){super(e),this.name="DatabaseError"}}class u extends l{constructor(e){super(e),this.name="CryptoError"}}class h extends l{constructor(e){super(e),this.name="WorkerInitializationError"}}class m extends l{constructor(e){super(e),this.name="EncryptionError"}}class f extends l{constructor(e){super(e),this.name="DecryptionError"}}class p extends l{constructor(e){super(e),this.name="TimeoutError"}}function w(e,t){e.forEach((r,n)=>{r.reject(new h(t)),clearTimeout(r.timer),e.delete(n)})}async function y(e,t,r,n,i,a=5e3){return new Promise((o,s)=>{let c=setTimeout(()=>{let e=n.get(t);e&&(e.reject(new p("Request timed out")),n.delete(t))},a);n.set(t,{resolve:o,reject:s,timer:c});let l=[];i&&i.length>0&&l.push(...i);try{l.length>0?e.postMessage(r,l):e.postMessage(r)}catch(r){console.error("Failed to post message to worker:",r);let e=n.get(t);e&&(clearTimeout(e.timer),e.reject(new h("Failed to communicate with the worker.")),n.delete(t));return}})}async function x(e,t,r){let n=crypto.randomUUID();try{return await y(e,n,{requestId:n,type:"encrypt",payload:{value:t}},r,[],5e3)}catch(e){if(e instanceof h||e instanceof m||e instanceof l)throw e;throw new m(e instanceof Error?e.message:"Unknown encryption error")}}async function g(e,t,r,n){let i=crypto.randomUUID();try{return await y(e,i,{requestId:i,type:"decrypt",payload:{iv:t,ciphertext:r}},n,[t,r],5e3)}catch(e){if(e instanceof h||e instanceof f||e instanceof l)throw e;throw new f(e instanceof Error?e.message:"Unknown decryption error")}}let k=(e,t)=>t.some(t=>e instanceof t),b=new WeakMap,v=new WeakMap,j=new WeakMap,I={get(e,t,r){if(e instanceof IDBTransaction){if("done"===t)return b.get(e);if("store"===t)return r.objectStoreNames[1]?void 0:r.objectStore(r.objectStoreNames[0])}return S(e[t])},set:(e,t,r)=>(e[t]=r,!0),has:(e,t)=>e instanceof IDBTransaction&&("done"===t||"store"===t)||t in e};function C(e){I=e(I)}function S(e){if(e instanceof IDBRequest)return function(e){let t=new Promise((t,r)=>{let n=()=>{e.removeEventListener("success",i),e.removeEventListener("error",a)},i=()=>{t(S(e.result)),n()},a=()=>{r(e.error),n()};e.addEventListener("success",i),e.addEventListener("error",a)});return j.set(t,e),t}(e);if(v.has(e))return v.get(e);let t=function(e){if("function"==typeof e){var t;return t=e,(i||(i=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])).includes(t)?function(...e){return t.apply(E(this),e),S(this.request)}:function(...e){return S(t.apply(E(this),e))}}return(e instanceof IDBTransaction&&!function(e){if(b.has(e))return;let t=new Promise((t,r)=>{let n=()=>{e.removeEventListener("complete",i),e.removeEventListener("error",a),e.removeEventListener("abort",a)},i=()=>{t(),n()},a=()=>{r(e.error||new DOMException("AbortError","AbortError")),n()};e.addEventListener("complete",i),e.addEventListener("error",a),e.addEventListener("abort",a)});b.set(e,t)}(e),k(e,n||(n=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])))?new Proxy(e,I):e}(e);return t!==e&&(v.set(e,t),j.set(t,e)),t}let E=e=>j.get(e);function D(e,t,{blocked:r,upgrade:n,blocking:i,terminated:a}={}){let o=indexedDB.open(e,t),s=S(o);return n&&o.addEventListener("upgradeneeded",e=>{n(S(o.result),e.oldVersion,e.newVersion,S(o.transaction),e)}),r&&o.addEventListener("blocked",e=>r(e.oldVersion,e.newVersion,e)),s.then(e=>{a&&e.addEventListener("close",()=>a()),i&&e.addEventListener("versionchange",e=>i(e.oldVersion,e.newVersion,e))}).catch(()=>{}),s}let $=["get","getKey","getAll","getAllKeys","count"],B=["put","add","delete","clear"],M=new Map;function z(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&"string"==typeof t))return;if(M.get(t))return M.get(t);let r=t.replace(/FromIndex$/,""),n=t!==r,i=B.includes(r);if(!(r in(n?IDBIndex:IDBObjectStore).prototype)||!(i||$.includes(r)))return;let a=async function(e,...t){let a=this.transaction(e,i?"readwrite":"readonly"),o=a.store;return n&&(o=o.index(t.shift())),(await Promise.all([o[r](...t),i&&a.done]))[0]};return M.set(t,a),a}I=(e=>({...e,get:(t,r,n)=>z(t,r)||e.get(t,r,n),has:(t,r)=>!!z(t,r)||e.has(t,r)}))(I);let P=["continue","continuePrimaryKey","advance"],L={},T=new WeakMap,R=new WeakMap,W={get(e,t){if(!P.includes(t))return e[t];let r=L[t];return!r&&(r=L[t]=function(...e){T.set(this,R.get(this)[t](...e))}),r}};async function*O(...e){let t=this;if(!(t instanceof IDBCursor)&&(t=await t.openCursor(...e)),!t)return;let r=new Proxy(t,W);for(R.set(r,t),j.set(r,E(t));t;)yield r,t=await (T.get(r)||t.continue()),T.delete(r)}function N(e,t){return t===Symbol.asyncIterator&&k(e,[IDBIndex,IDBObjectStore,IDBCursor])||"iterate"===t&&k(e,[IDBIndex,IDBObjectStore])}function U(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}I=(e=>({...e,get:(t,r,n)=>N(t,r)?O:e.get(t,r,n),has:(t,r)=>N(t,r)||e.has(t,r)}))(I);let A=new class e{get(e){if(!this.cache.has(e))return;let t=this.cache.get(e);if(void 0!==t)return this.cache.delete(e),this.cache.set(e,t),t}set(e,t){if(this.cache.has(e))this.cache.delete(e);else if(this.cache.size>=this.maxSize){let e=this.cache.keys().next().value;void 0!==e&&this.cache.delete(e)}this.cache.set(e,t)}has(e){return this.cache.has(e)}constructor(e=1e4){U(this,"maxSize",void 0),U(this,"cache",void 0),this.maxSize=e,this.cache=new Map}}(1e3);function K(){return new Promise(e=>requestAnimationFrame(e))}async function G(e,t="normal"){if(A.has(e)){let t=A.get(e);if("string"==typeof t)return t}let r=new TextEncoder().encode(e);"low"===t&&await K();let n=function(e){var t;if(t=e,!/^[0-9a-fA-F]{128}$/.test(t))throw Error("Invalid hash: Must be a 128-character hexadecimal string");return[e.slice(0,8),e.slice(8,12),`5${e.slice(13,16)}`,(3&Number.parseInt(e.slice(16,17),16)|8).toString(16)+e.slice(17,20),e.slice(20,32)].join("-")}(function(e){let t=new Uint8Array(e),r="";for(let e of t)r+=e.toString(16).padStart(2,"0");return r}(await crypto.subtle.digest("SHA-512",r)));return A.set(e,n),n}async function F(e,t,r){let n=[],i=e.transaction(t,"readonly"),a=i.store,o=`${r}-chunk-000000-`,s=`${r}-chunk-999999\uffff`,c=IDBKeyRange.bound(o,s,!1,!1),l=await a.openKeyCursor(c);for(;l;)n.push(l.key),l=await l.continue();return await i.done,n}function V(e,t){if(!e.objectStoreNames.contains(t)){let r=e.createObjectStore(t,{keyPath:"key"});r.createIndex("byTimestamp","timestamp"),r.createIndex("byCacheBuster","cacheBuster")}}async function q(e,t,r){try{return await K(),await D(e,r,{upgrade(e){V(e,t)}})}catch(n){if(n instanceof DOMException&&"VersionError"===n.name)return console.warn(`VersionError: Deleting database ${e} and retrying...`),await function(e,{blocked:t}={}){let r=indexedDB.deleteDatabase(e);return t&&r.addEventListener("blocked",e=>t(e.oldVersion,e)),S(r).then(()=>void 0)}(e),await K(),await D(e,r,{upgrade(e){V(e,t)}});throw n}}function _(){let e=null,t=new Map,r=1e5,n=null,i=null;async function a(e){if(!i)throw Error("Fixed salt (cacheBuster) not initialized");let n=`${new TextDecoder().decode(e)}-${new TextDecoder().decode(new Uint8Array(i))}`;if(t.has(n)){let e=t.get(n);if(void 0!==e)return e}let a=await crypto.subtle.importKey("raw",e,{name:"PBKDF2"},!1,["deriveKey"]),o=await crypto.subtle.deriveKey({name:"PBKDF2",salt:i,iterations:r,hash:"SHA-512"},a,{name:"AES-GCM",length:256},!1,["encrypt","decrypt"]);return t.set(n,o),o}async function o(){if(!e)throw Error("Cache key not provided for encryption worker");try{null==n||n.postMessage({type:"ready"})}catch(t){console.error("Worker: Failed to initialize AES key:",t);let e=t instanceof Error?t.message:"Unknown initialization error";null==n||n.postMessage({type:"initError",error:e})}}async function s(t){if(!e)throw Error("Cache key not initialized");if(!i)throw Error("Fixed salt (cacheBuster) not initialized");let r=crypto.getRandomValues(new Uint8Array(12)),n=new TextEncoder,o=await a(e),s=await crypto.subtle.encrypt({name:"AES-GCM",iv:r},o,n.encode(t));return{iv:r.buffer,ciphertext:s}}async function c(t,r){if(!e)throw Error("AES key not initialized");if(!i)throw Error("Fixed salt (cacheBuster) not initialized");let n=new Uint8Array(t),o=await a(e),s=await crypto.subtle.decrypt({name:"AES-GCM",iv:n},o,r);return new TextDecoder().decode(s)}let l=[],d=1,u=0;function h(e){l.push(e),m()}async function m(){for(;u<d&&l.length>0;){let e=l.shift();e&&(u++,(async()=>{let t=performance.now();try{await e()}catch(e){console.error("Worker: Task execution error:",e)}finally{(function(e){e<40&&d<10?d++:e>80&&d>1&&d--})(performance.now()-t),u--,m()}})())}}async function f(t){var a,l,d,u,m;let{type:f,payload:p,requestId:w}=t.data;switch(f){case"initialize":{let{cacheKey:t,pbkdf2Iterations:n,cacheBuster:a}=p;e=new TextEncoder().encode(t),r=n||1e5,i=new TextEncoder().encode(a).buffer,await o()}break;case"encrypt":{;let{value:e}=p;await (a=w,l=e,void h(async()=>{try{let e=await s(l);if(!n)throw Error("MessagePort is not available");n.postMessage({requestId:a,type:"encryptResult",result:e},[e.iv,e.ciphertext])}catch(t){console.error("Worker: Encryption error:",t);let e=t instanceof Error?t.message:"Unknown encryption error";n&&n.postMessage({requestId:a,type:"error",error:e})}}))}break;case"decrypt":{;let{iv:e,ciphertext:t}=p;await (d=w,u=e,m=t,void h(async()=>{try{let e=await c(u,m);if(!n)throw Error("MessagePort is not available");n.postMessage({requestId:d,type:"decryptResult",result:e})}catch(t){console.error("Worker: Decryption error:",t);let e=t instanceof Error?t.message:"Unknown decryption error";n&&n.postMessage({requestId:d,type:"error",error:e})}}))}break;case"destroy":e&&(e.fill(0),e=null),i&&(new Uint8Array(i).fill(0),i=null),n&&(n.close(),n=null),self.close();break;default:console.warn(`Worker: Unknown message type received: ${f}. Ignoring the message.`)}}self.onmessage=function(e){let{type:t}=e.data;"init"===t&&e.ports&&e.ports.length>0&&((n=e.ports[0]).onmessage=f,n.start())}}function Y(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}let H=null===(a=crypto)||void 0===a?void 0:a.subtle;class Z{async initWorker(e,t){if(this.workerReadyPromise)return this.workerReadyPromise;this.workerReadyPromise=new Promise((r,n)=>{var i,a,o,s;let{worker:c,port:d}=function(e,t){let r=new Blob([`(${e.toString()})()`],{type:"application/javascript"}),n=URL.createObjectURL(r),i=new Worker(n),a=new MessageChannel;return i.postMessage({type:"init"},[a.port2]),i.onmessage=()=>{URL.revokeObjectURL(n)},i.onerror=e=>{console.error("Worker encountered an error:",e.message),t("Worker encountered an error and was terminated."),i.terminate()},a.port1.onmessageerror=()=>{console.warn("MessagePort encountered a message error. Worker may have been terminated."),t("Worker was terminated unexpectedly."),a.port1.close()},{worker:i,port:a.port1}}(_,e=>{n(new h(e)),w(this.pendingRequests,e)});this.worker=c,this.port=d,i=d,a=r,o=n,s=this.pendingRequests,i.onmessage=e=>{let t=e.data;if("ready"===t.type)a();else if("initError"===t.type)o(new h(t.error)),w(s,t.error);else{var r,n,i;if("encryptResult"===(r=t).type&&"string"==typeof r.requestId){let{requestId:e,result:r}=t,n=s.get(e);n&&(clearTimeout(n.timer),n.resolve(r),s.delete(e))}else{;if("decryptResult"===(n=t).type&&"string"==typeof n.requestId){let{requestId:e,result:r}=t,n=s.get(e);n&&(clearTimeout(n.timer),n.resolve(r),s.delete(e))}else{;if("error"===(i=t).type&&"string"==typeof i.requestId){let{requestId:e,error:r}=t,n=s.get(e);if(n){let t;let i=r.toLowerCase();t=i.includes("encrypt")?new m(r):i.includes("decrypt")?new f(r):i.includes("key")?new u(r):new l(r),clearTimeout(n.timer),n.reject(t),s.delete(e)}}else console.warn("WorkerUtils: Unknown message type received. Ignoring the message.",t)}}}},i.onmessageerror=e=>{console.error("Worker encountered a message error:",e),o(new h("Worker failed to initialize")),w(s,"Worker encountered an error and was terminated."),i.close()},d.postMessage({type:"initialize",payload:{cacheKey:e,cacheBuster:t,pbkdf2Iterations:this.pbkdf2Iterations}})});try{await this.workerReadyPromise}catch(e){if(console.error("Worker failed to initialize:",e),e instanceof l)throw e;throw new h("Worker failed to initialize.")}}async cleanup(){try{let e=await this.dbReadyPromise;"low"===this.priority&&await K();let t=e.transaction(this.storeName,"readwrite"),r=t.store,n=r.index("byTimestamp"),i=r.index("byCacheBuster"),a=Date.now(),o=await n.openCursor();for(;o;){let{timestamp:e}=o.value;if(e<=a){let t=a-e;this.debug&&console.debug(`Deleting expired item with timestamp ${e}. It is ${t}ms older than the expiration.`),o.delete()}else break;o=await o.continue()}let s=this.cacheBuster,c=IDBKeyRange.upperBound(s,!0),l=IDBKeyRange.lowerBound(s,!0),d=async e=>{let t=0,r=await i.openCursor(e);for(;r;)this.debug&&console.debug("Deleting item with cacheBuster:",r.value.cacheBuster),r.delete(),t++,r=await r.continue();return t},u=await Promise.all([d(c),d(l)]);if(void 0!==this.maxTotalChunks){let e=await r.count();if(e>this.maxTotalChunks){let t=e-this.maxTotalChunks;this.debug&&console.debug(`Total chunks (${e}) exceed maxTotalChunks (${this.maxTotalChunks}). Deleting entire items until excess (${t}) is removed.`);let i=[],a=[],o=await n.openCursor(null,"next");for(;o&&t>0;){let e=o.value.key.match(/^(.*)-chunk-\d{6}-.*/);if(!e){o=await o.continue();continue}let n=e[1];if(i.includes(n)){o=await o.continue();continue}let s=`${n}-chunk-000000-`,c=`${n}-chunk-999999\uffff`,l=IDBKeyRange.bound(s,c,!1,!1),d=[],u=await r.openCursor(l);for(;u;)d.push(u.value.key),u=await u.continue();a.push(...d),t-=d.length,i.push(n),o=await o.continue()}for(let e of a)r.delete(e),this.debug&&console.debug(`Deleted chunk ${e}.`);this.debug&&console.debug(`Deleted ${a.length} chunks by removing ${i.length} items to enforce maxTotalChunks.`)}else this.debug&&console.debug(`Total chunks (${e}) within maxTotalChunks (${this.maxTotalChunks}). No excess cleanup needed.`)}await t.done,this.debug&&u.reduce((e,t)=>e+(t||0),0)>0&&console.debug("Flushed old cache items with different cacheBuster.")}catch(e){if(console.error("Error during cleanup:",e),e instanceof d)throw e;throw new d("Failed to clean up the cache.")}}async ensureWorkerInitialized(){if(!this.workerReadyPromise)throw new h("Worker is not initialized.");await this.workerReadyPromise}getPort(){if(!this.port)throw new h("Worker port is not initialized.");return this.port}async getItem(e){try{let t=Date.now();if(!this.dbReadyPromise)return null;await this.ensureWorkerInitialized(),"low"===this.priority&&await K();let r=await this.dbReadyPromise,n=await G(`${this.cacheKey}:${e}`),i=Date.now(),a=await F(r,this.storeName,n);if(this.debug&&(0===a.length?console.debug(`Cache miss for key ${e}`):console.debug(`Cache hit for key ${e}`)),0===a.length)return null;let o=[],s=-1,c=!1;for(let t of a){let n=await r.get(this.storeName,t);if(!n)continue;if(n.timestamp<=i)return await this.removeItem(e),null;if(n.cacheBuster!==this.cacheBuster)continue;let a=function(e){let t=e.split("-chunk-");return t.length<2?-1:Number.parseInt(t[1].split("-")[0],10)}(t);a>s&&(s=a),n.isLastChunk&&(c=!0),o.push({index:a,data:n})}if(0===o.length)return null;if(!c)throw new l(`Integrity check failed for key ${e}: Last chunk is missing.`);if(o.length!==s+1)throw new l(`Integrity check failed for key ${e}: Expected ${s+1} chunks, but found ${o.length}.`);let d=new Set(o.map(e=>e.index));for(let t=0;t<=s;t++)if(!d.has(t))throw new l(`Integrity check failed for key ${e}: Missing chunk at index ${t}.`);o.sort((e,t)=>e.index-t.index);let u=await Promise.all(o.map(({data:{iv:e,ciphertext:t}})=>g(this.getPort(),e,t,this.pendingRequests))),h=Date.now()-t;return this.debug&&h>200&&console.debug(`getItem for key ${e} took ${h}ms`),u.join("")}catch(t){if(t instanceof l)throw console.error(`Integrity check failed for key ${e}:`,t),t;if(t instanceof f)throw console.error(`Decryption failed for key ${e}:`,t),t;if(t instanceof d)throw console.error(`Database error while getting key ${e}:`,t),t;if(t instanceof h)throw console.error(`Worker initialization error while getting key ${e}:`,t),t;if(t instanceof l)throw console.error(`IDBCache error while getting key ${e}:`,t),t;throw console.error(`Unexpected error while getting key ${e}:`,t),new l("An unexpected error occurred.")}}async setItem(e,t){try{let a=Date.now();if(!this.dbReadyPromise)return;if(await this.ensureWorkerInitialized(),void 0!==this.maxTotalChunks){let e=Math.ceil(t.length/this.chunkSize);if(e>this.maxTotalChunks)throw new l(`Cannot store item: chunks needed (${e}) exceeds maxTotalChunks (${this.maxTotalChunks})`)}"low"===this.priority&&await K();let o=await this.dbReadyPromise,s=await G(`${this.cacheKey}:${e}`),c=Date.now()+this.gcTime;"low"===this.priority&&await K();let d=await F(o,this.storeName,s),u=new Set(d),h=new Set,m=[],f=[],p=Math.ceil(t.length/this.chunkSize);for(let e=0;e<t.length;e+=this.chunkSize){var r,n,i;let a=t.slice(e,e+this.chunkSize),l=Math.floor(e/this.chunkSize);"low"===this.priority&&await K();let d=await G(`${this.cacheKey}:${this.cacheBuster}:${a}`,this.priority);let w=(r=s,n=l,i=d,`${r}-chunk-${String(n).padStart(6,"0")}-${i}`);h.add(w);let y=l===p-1;if(u.has(w)){"low"===this.priority&&await K();let e=await o.get(this.storeName,w);e&&e.timestamp!==c&&f.push({...e,timestamp:c,cacheBuster:this.cacheBuster,isLastChunk:y})}else{let e=await x(this.getPort(),a,this.pendingRequests);m.push({chunkKey:w,encryptedChunk:{...e,cacheBuster:this.cacheBuster,isLastChunk:y}})}}let w=d.filter(e=>!h.has(e)),y=o.transaction(this.storeName,"readwrite"),g=y.store,k=[];for(let e of f)k.push(g.put(e));for(let{chunkKey:e,encryptedChunk:t}of m)k.push(g.put({...t,key:e,timestamp:c}));for(let e of w)k.push(g.delete(e));await Promise.all(k),"low"===this.priority&&await K(),await y.done;let b=Date.now()-a;this.debug&&b>200&&console.debug(`setItem for key ${e} took ${b}ms`)}catch(e){if(e instanceof h)throw console.error("Worker port is not initialized:",e),e;if(e instanceof d)throw console.error("Database error in setItem:",e),e;if(e instanceof m)throw console.error("Encryption error in setItem:",e),e;if(e instanceof l)throw console.error("IDBCache error in setItem:",e),e;throw console.error("Unexpected error in setItem:",e),new l("An unexpected error occurred during setItem.")}}async removeItem(e){try{let t=await this.dbReadyPromise,r=await G(`${this.cacheKey}:${e}`),n=await F(t,this.storeName,r),i=t.transaction(this.storeName,"readwrite"),a=i.store,o=n.map(e=>a.delete(e));await Promise.all(o),await i.done}catch(e){if(console.error("Error in removeItem:",e),e instanceof d||e instanceof l)throw e;throw new d("Failed to remove item from the cache.")}}async count(){try{let e=(await this.dbReadyPromise).transaction(this.storeName,"readonly"),t=e.store,r=await t.count();return await e.done,this.debug&&console.debug(`Total entries in cache: ${r}`),r}catch(e){if(console.error("Error in count():",e),e instanceof d)throw e;throw new d("Failed to count items in the cache.")}}async clear(){try{let e=(await this.dbReadyPromise).transaction(this.storeName,"readwrite"),t=e.store;await t.clear(),await e.done,this.debug&&console.debug("All items have been cleared from the cache.")}catch(e){if(console.error("Error in clear:",e),e instanceof d||e instanceof l)throw e;throw new d("Failed to clear the cache.")}}async destroy(e){let{clearData:t=!1}=e||{};try{t&&await this.clear(),void 0!==this.cleanupIntervalId&&clearInterval(this.cleanupIntervalId),this.pendingRequests.forEach((e,t)=>{e.reject(new l("IDBCache instance is being destroyed.")),this.pendingRequests.delete(t)}),this.port&&(this.port.postMessage({type:"destroy"}),this.port.close(),this.port=null),this.worker&&(this.worker.terminate(),this.worker=null),this.workerReadyPromise=null,this.debug&&console.debug("IDBCache instance has been destroyed.")}catch(e){if(console.error("Error in destroy:",e),e instanceof l)throw e;throw new l("Failed to destroy the cache instance.")}}constructor(e){Y(this,"dbReadyPromise",void 0),Y(this,"storeName",void 0),Y(this,"worker",null),Y(this,"port",null),Y(this,"pendingRequests",void 0),Y(this,"workerReadyPromise",null),Y(this,"gcTime",void 0),Y(this,"cleanupIntervalId",void 0),Y(this,"cacheKey",void 0),Y(this,"chunkSize",void 0),Y(this,"cleanupInterval",void 0),Y(this,"pbkdf2Iterations",void 0),Y(this,"cacheBuster",void 0),Y(this,"debug",void 0),Y(this,"maxTotalChunks",void 0),Y(this,"priority","normal");let{cacheKey:t,cacheBuster:r,debug:n=!1,dbName:i="idb-cache",gcTime:a=6048e5,chunkSize:o=25e3,cleanupInterval:s=6e4,pbkdf2Iterations:c=1e5,maxTotalChunks:l,priority:h="normal"}=e;if(this.storeName="cache",this.cacheKey=t,this.cacheBuster=r,this.debug=n,this.gcTime=a,this.chunkSize=o,this.cleanupInterval=s,this.pbkdf2Iterations=c,this.maxTotalChunks=l,this.pendingRequests=new Map,this.priority=h,!window.indexedDB)throw new d("IndexedDB is not supported.");if(!H)throw new u("Web Crypto API not available in this environment");this.dbReadyPromise=q(i,this.storeName,1),this.cleanupIntervalId=window.setInterval(async()=>{try{await this.cleanup()}catch(e){console.error("Error during cleanup:",e)}},this.cleanupInterval),this.initWorker(t,r).then(()=>{setTimeout(()=>{this.cleanup().catch(e=>console.error("Initial cleanup failed:",e))},1e4)}).catch(e=>{console.error("Worker initialization failed:",e)})}}function X(e){let t=0;for(let r=0;r<e.length;r++)t=(t<<5)-t+e.charCodeAt(r)|0;return Math.abs(t).toString(36)}var J=r("795"),Q=r("7934"),ee=r("9719"),et=r("9839"),er=r("2462"),en=r("4964");function ei(){return(0,o.jsxs)("a",{href:"https://github.com/instructure/idb-cache","aria-label":"View source on GitHub",children:[(0,o.jsxs)("svg",{width:80,height:80,viewBox:"0 0 250 250",style:{fill:"#151513",color:"#fff",position:"absolute",top:0,border:0,right:0},"aria-hidden":"true",children:[(0,o.jsx)("path",{d:"M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"}),(0,o.jsx)("path",{d:"M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2",fill:"currentColor",style:{transformOrigin:"130px 106px"},className:"octo-arm"}),(0,o.jsx)("path",{d:"M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z",fill:"currentColor",className:"octo-body"})]}),(0,o.jsx)("span",{style:{position:"absolute",left:"-9999px"},children:"View source on GitHub"})]})}function ea(){return(0,o.jsx)("span",{style:{color:"#ddd"},children:"------"})}var eo=r("5712"),es=r("1625"),ec=r("6827");function el(e){let{cacheKey:t}=e;return(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(es.o,{renderLabel:(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(ee.G,{margin:"0 xx-small 0 0",children:"Cache key"})}),(0,o.jsx)(ec.u,{color:"primary-inverse",renderTip:"Sensitive identifier used for securely encrypting data.",offsetY:"5px",children:(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(eo.W,{})})})]}),interaction:"disabled",defaultValue:t})}),(0,o.jsx)(et.kC.Item,{children:(0,o.jsx)(J.z,{"aria-label":"Reset cache key",margin:"0 0 0 xxx-small","data-testid":"reset-cacheKey",onClick:()=>{localStorage.removeItem("cacheKey"),localStorage.removeItem("keyCounter"),window.location.reload()},children:"Reset"})})]})}function ed(e){let{cacheBuster:t}=e;return(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(es.o,{renderLabel:(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(ee.G,{margin:"0 xx-small 0 0",children:"Cache buster"})}),(0,o.jsx)(ec.u,{color:"primary-inverse",renderTip:"Unique value (not sensitive) used to invalidate old cache entries.",offsetY:"5px",children:(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(eo.W,{})})})]}),interaction:"disabled",defaultValue:t})}),(0,o.jsx)(et.kC.Item,{children:(0,o.jsx)(J.z,{"aria-label":"Reset cache buster",margin:"0 0 0 xxx-small","data-testid":"reset-cacheBuster",onClick:()=>{localStorage.removeItem("cacheBuster"),localStorage.removeItem("keyCounter"),window.location.reload()},children:"Reset"})})]})}function eu(e){let{children:t}=e;return(0,o.jsx)("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:"1.5rem"},children:t})}function eh(e){let{children:t}=e;return(0,o.jsx)("div",{style:{flex:"1 1 calc(50% - 1rem)",minWidth:"300px",boxSizing:"border-box"},children:t})}function em(e){let{children:t}=e;return(0,o.jsx)(ee.G,{as:"div",display:"block",margin:"small none",padding:"medium",background:"primary",shadow:"resting",children:(0,o.jsx)(et.kC,{direction:"column",children:t})})}async function ef(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"default";return new Promise((r,n)=>{let i="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{let t=16*Math.random()|0;return("x"===e?t:3&t|8).toString(16)}),a=function(e){let t=new Blob([e],{type:"application/javascript"});return new Worker(URL.createObjectURL(t))}(`(${(()=>{self.onmessage=e=>{var t;let r,{requestId:n,targetSizeInBytes:i,seed:a}=e.data;let o=(r=function(e){let t=0;for(let r=0;r<e.length;r++)t=31*t+e.charCodeAt(r)>>>0;return t}(a),function(){return(r=1664525*r+0x3c6ef35f>>>0)/0x100000000}),s=Math.ceil(i),c=Array(s);for(let e=0;e<s;e++)c[e]=String.fromCharCode(33+Math.floor(94*o()));let l=c.join("");for(;t=l,new TextEncoder().encode(t).length>i;)l=l.slice(0,-1);postMessage({requestId:n,text:l})}}).toString()})();`),o=e=>{let t=e.data;t.requestId===i&&(r(t.text),c())},s=e=>{n(e),c()},c=()=>{a.removeEventListener("message",o),a.removeEventListener("error",s),a.terminate()};a.addEventListener("message",o),a.addEventListener("error",s);a.postMessage({requestId:i,targetSizeInBytes:e,seed:t})})}var ep=r("4137"),ew=r("6665");let ey=localStorage.cacheKey;!ey&&(ey=crypto.randomUUID(),localStorage.cacheKey=ey);let ex=localStorage.cacheBuster;!ex&&(ex=crypto.randomUUID(),localStorage.cacheBuster=ex);let eg=()=>{let e=Number.parseInt(new URLSearchParams(window.location.hash.slice(1)).get("size")??"0",10);return!Number.isNaN(e)&&e>0?1024*e:32768},ek=document.getElementById("root");ek&&c.createRoot(ek).render((0,o.jsx)(s.StrictMode,{children:(0,o.jsx)(()=>{let[e,t]=(0,s.useState)(null),[r,n]=(0,s.useState)(null),[i,a]=(0,s.useState)(null),[c,l]=(0,s.useState)(null),[d,u]=(0,s.useState)(null),[h,m]=(0,s.useState)(null),[f,p]=(0,s.useState)(null),[w,y]=(0,s.useState)(null),[x,g]=(0,s.useState)(eg()),[k,b]=(0,s.useState)(25600),[v,j]=(0,s.useState)(null),[I,C]=(0,s.useState)(()=>{let e=localStorage.maxTotalChunksStored;return e?Number.parseInt(e,10):5e3}),[S,E]=(0,s.useState)(()=>{let e=localStorage.priority;return["normal","low"].includes(e)?e:"normal"}),[D,$]=(0,s.useState)(!1);(0,s.useEffect)(()=>{let e=new URLSearchParams(window.location.hash.slice(1));e.set("size",String(Math.round(x/1024))),window.location.hash=`#${e.toString()}`},[x]);let B=(0,s.useRef)(Number.parseInt(localStorage.getItem("keyCounter")||"0")||0),[M,z]=(0,s.useState)(()=>X(`seed-${B.current}`)),P=(0,s.useRef)(null);(0,s.useEffect)(()=>{let e=!1;return(async()=>{if(P.current){$(!1);try{await P.current.destroy()}catch(e){console.error("Error destroying previous cache:",e)}}try{let t=new Z({cacheKey:ey,cacheBuster:ex,debug:!0,chunkSize:k,maxTotalChunks:I,priority:S});e?await t.destroy():(P.current=t,$(!0))}catch(t){console.error("Error initializing cache:",t),!e&&$(!1)}})(),()=>{e=!0,P.current&&(P.current.destroy().catch(e=>{console.error("Error destroying cache on cleanup:",e)}),P.current=null,$(!1))}},[k,I,S]),(0,s.useEffect)(()=>{localStorage.setItem("maxTotalChunksStored",String(I))},[I]),(0,s.useEffect)(()=>{localStorage.setItem("priority",String(S))},[S]);let L=(0,s.useCallback)(async()=>{let e=P.current;if(!e){console.error("Cache is not initialized.");return}let r=X(`seed-${B.current}`);localStorage.setItem("keyCounter",String(B.current)),B.current+=1,z(r);let n=performance.now();try{let i=await Promise.all(Array.from({length:1},(e,t)=>ef(x,`${r}-${t}`))),o=performance.now();a(o-n),await new Promise(e=>requestAnimationFrame(e));let s=performance.now();for(let t=0;t<1;t++)await e.setItem(`item-${r}-${t}`,i[t]);let c=performance.now();l(c-s),t(X(i.join("")))}catch(e){console.error("Error during text generation and storage:",e)}},[x]),T=(0,s.useCallback)(async()=>{let e=P.current;if(!e){console.error("Cache is not initialized.");return}try{await new Promise(e=>requestAnimationFrame(e));let t=[],r=performance.now();for(let r=0;r<1;r++){let n=await e.getItem(`item-${M}-${r}`);t.push(n)}let i=performance.now();u(i-r),n(t.filter(e=>e).length>0?X(t.join("")):null)}catch(e){console.error("Error during text retrieval and decryption:",e)}},[M]),R=(0,s.useCallback)(async()=>{let e=P.current;if(!e){console.error("Cache is not initialized.");return}try{await new Promise(e=>requestAnimationFrame(e));let t=performance.now();await e.cleanup();let r=performance.now();p(r-t)}catch(e){console.error("Error during cache cleanup:",e)}},[]),W=(0,s.useCallback)(async()=>{let e=P.current;if(!e){console.error("Cache is not initialized.");return}try{await new Promise(e=>requestAnimationFrame(e));let t=performance.now(),r=await e.count(),n=performance.now();m(n-t),j(r)}catch(e){console.error("Error during cache count:",e)}},[]),O=(0,s.useCallback)(async()=>{let e=P.current;if(!e){console.error("Cache is not initialized.");return}try{await new Promise(e=>requestAnimationFrame(e));let t=performance.now();await e.clear(),localStorage.removeItem("keyCounter");let r=performance.now();y(r-t)}catch(e){console.error("Error during cache clear:",e)}},[]);return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(ei,{}),(0,o.jsx)("div",{className:"min-h-screen bg-gray-50 p-8",children:(0,o.jsxs)(ee.G,{as:"div",display:"block",width:"820px",margin:"0 auto",children:[(0,o.jsx)("h1",{style:{fontSize:"clamp(1.8rem, 4vw, 2.4rem)",whiteSpace:"nowrap",marginBottom:"1rem"},children:"@instructure/idb-cache"}),(0,o.jsxs)("form",{children:[(0,o.jsxs)(eu,{children:[(0,o.jsx)(eh,{children:(0,o.jsx)(el,{cacheKey:ey})}),(0,o.jsx)(eh,{children:(0,o.jsx)(ed,{cacheBuster:ex})}),(0,o.jsx)(eh,{children:(0,o.jsx)(en.Y,{"data-testid":"item-size-input",renderLabel:(0,o.jsxs)(et.kC,{alignItems:"end",direction:"row",children:[(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(ee.G,{margin:"0 xx-small 0 0",children:"Item size (KiB)"})}),(0,o.jsx)(ec.u,{color:"primary-inverse",renderTip:"When an item exceeds this size, it splits into multiple chunks.",offsetY:"5px",children:(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(eo.W,{})})})]}),onChange:e=>{g(Math.max(1024*Number.parseInt(e.target.value||"0",10),1024))},onIncrement:()=>{g(e=>Math.max(e+1024,1024))},onDecrement:()=>{g(e=>Math.max(e-1024,1024))},value:Math.round(x/1024)})}),(0,o.jsx)(eh,{children:(0,o.jsx)(en.Y,{renderLabel:"Chunks per item:",interaction:"disabled",value:Math.ceil(x/k)})}),(0,o.jsx)(eh,{children:(0,o.jsx)(en.Y,{disabled:!0,renderLabel:"Chunk size (KiB)",onChange:e=>{b(Math.max(1024*Number.parseInt(e.target.value||"0",10),1024))},onIncrement:()=>{b(e=>Math.max(e+1024,1024))},onDecrement:()=>{b(e=>Math.max(e-1024,1024))},value:Math.round(k/1024)})}),(0,o.jsx)(eh,{children:(0,o.jsx)(en.Y,{"data-testid":"max-chunks-input",renderLabel:(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(ee.G,{margin:"0 xx-small 0 0",children:"Max total chunks"})}),(0,o.jsx)(ec.u,{color:"primary-inverse",renderTip:"During cleanup, idb-cache removes the oldest surplus chunks.",offsetY:"5px",children:(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(eo.W,{})})})]}),onChange:e=>{C(Number.parseInt(e.target.value||"0",10)||1)},onIncrement:()=>{C(e=>Math.max(e+1,1))},onDecrement:()=>{C(e=>Math.max(e-1,1))},value:I})}),(0,o.jsx)(eh,{children:(0,o.jsxs)(ep.a,{name:"priority",value:S,description:(0,o.jsxs)(et.kC,{alignItems:"end",children:[(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(ee.G,{margin:"0 xx-small 0 0",children:"Priority"})}),(0,o.jsx)(ec.u,{color:"primary-inverse",renderTip:"Low priority slightly delays start of operations to reduce load on event loop.",offsetY:"5px",children:(0,o.jsx)(et.kC.Item,{as:"div",children:(0,o.jsx)(eo.W,{})})})]}),variant:"toggle",onChange:e=>{E("low"===e.target.value?"low":"normal")},children:[(0,o.jsx)(ew.N,{label:"Normal",value:"normal"}),(0,o.jsx)(ew.N,{label:"Low",value:"low"})]})})]}),(0,o.jsx)(er.X,{level:"h2",margin:"medium 0 small 0",children:"Tests"}),(0,o.jsxs)(em,{children:[(0,o.jsx)(J.z,{"data-testid":"set-item-button",color:"primary",onClick:L,disabled:!D,children:"setItem"}),(0,o.jsx)(ee.G,{padding:"medium 0 0 0",children:(0,o.jsxs)(et.kC,{children:[(0,o.jsx)(et.kC.Item,{size:"33.3%",children:(0,o.jsx)(Q.j,{renderLabel:"fixtures","data-testid":"generate-time",renderValue:null!==i?`${Math.round(i)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(Q.j,{renderLabel:"setItem","data-testid":"set-time",renderValue:null!==c?`${Math.round(c)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{size:"33.3%",children:(0,o.jsx)(Q.j,{"data-testid":"hash1",renderLabel:"hash",renderValue:e||(0,o.jsx)(ea,{})})})]})})]}),(0,o.jsxs)(em,{children:[(0,o.jsx)(J.z,{"data-testid":"get-item-button",color:"primary",onClick:T,disabled:!D,children:"getItem"}),(0,o.jsx)(ee.G,{padding:"medium 0 0 0",children:(0,o.jsxs)(et.kC,{children:[(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"}),(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(Q.j,{renderLabel:"getItem","data-testid":"get-time",renderValue:null!==d?`${Math.round(d)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{size:"33.3%",children:(0,o.jsx)(Q.j,{renderLabel:"hash","data-testid":"hash2",renderValue:r||(0,o.jsx)(ea,{})})})]})})]}),(0,o.jsxs)(em,{children:[(0,o.jsx)(J.z,{"data-testid":"count-button",color:"primary",onClick:W,disabled:!D,children:"count"}),(0,o.jsx)(ee.G,{padding:"medium 0 0 0",children:(0,o.jsxs)(et.kC,{children:[(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"}),(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(Q.j,{renderLabel:"count","data-testid":"count-time",renderValue:null!==h?`${Math.round(h)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{size:"33.3%",children:(0,o.jsx)(Q.j,{renderLabel:"chunks","data-testid":"count-value",renderValue:"number"==typeof v?v:(0,o.jsx)(ea,{})})})]})})]}),(0,o.jsxs)(em,{children:[(0,o.jsx)(J.z,{"data-testid":"cleanup-button",color:"primary",onClick:R,disabled:!D,children:"cleanup"}),(0,o.jsx)(ee.G,{padding:"medium 0 0 0",children:(0,o.jsxs)(et.kC,{children:[(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"}),(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(Q.j,{renderLabel:"cleanup","data-testid":"cleanup-time",renderValue:null!==f?`${Math.round(f)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"})]})})]}),(0,o.jsxs)(em,{children:[(0,o.jsx)(J.z,{"data-testid":"clear-button",color:"primary",onClick:O,disabled:!D,children:"clear"}),(0,o.jsx)(ee.G,{padding:"medium 0 0 0",children:(0,o.jsxs)(et.kC,{children:[(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"}),(0,o.jsx)(et.kC.Item,{shouldGrow:!0,children:(0,o.jsx)(Q.j,{renderLabel:"clear","data-testid":"clear-time",renderValue:null!==w?`${Math.round(w)} ms`:(0,o.jsx)(ea,{})})}),(0,o.jsx)(et.kC.Item,{size:"33.3%",children:"\xa0"})]})})]})]})]})})]})},{})}))}},t={};function r(n){var i=t[n];if(void 0!==i)return i.exports;var a=t[n]={exports:{}};return e[n](a,a.exports,r),a.exports}r.m=e,r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,{a:t}),t},(()=>{var e,t=Object.getPrototypeOf?function(e){return Object.getPrototypeOf(e)}:function(e){return e.__proto__};r.t=function(n,i){if(1&i&&(n=this(n)),8&i||"object"==typeof n&&n&&(4&i&&n.__esModule||16&i&&"function"==typeof n.then))return n;var a=Object.create(null);r.r(a);var o={};e=e||[null,t({}),t([]),t(t)];for(var s=2&i&&n;"object"==typeof s&&!~e.indexOf(s);s=t(s))Object.getOwnPropertyNames(s).forEach(function(e){o[e]=function(){return n[e]}});return o.default=function(){return n},r.d(a,o),a}})(),r.d=function(e,t){for(var n in t)r.o(t,n)&&!r.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},(()=>{var e=[];r.O=function(t,n,i,a){if(n){a=a||0;for(var o=e.length;o>0&&e[o-1][2]>a;o--)e[o]=e[o-1];e[o]=[n,i,a];return}for(var s=1/0,o=0;o<e.length;o++){for(var n=e[o][0],i=e[o][1],a=e[o][2],c=!0,l=0;l<n.length;l++)(!1&a||s>=a)&&Object.keys(r.O).every(function(e){return r.O[e](n[l])})?n.splice(l--,1):(c=!1,a<s&&(s=a));if(c){e.splice(o--,1);var d=i();void 0!==d&&(t=d)}}return t}})(),r.rv=function(){return"1.1.1"},(()=>{var e={980:0};r.O.j=function(t){return 0===e[t]};var t=function(t,n){var i=n[0],a=n[1],o=n[2],s,c,l=0;if(i.some(function(t){return 0!==e[t]})){for(s in a)r.o(a,s)&&(r.m[s]=a[s]);if(o)var d=o(r)}for(t&&t(n);l<i.length;l++)c=i[l],r.o(e,c)&&e[c]&&e[c][0](),e[c]=0;return r.O(d)},n=self.webpackChunkidb_cache_app=self.webpackChunkidb_cache_app||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))})(),r.ruid="bundler=rspack@1.1.1";var n=r.O(void 0,["361","330"],function(){return r("8994")});n=r.O(n)})();
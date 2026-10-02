import {createServer} from 'node:http';
// Same-origin JSON endpoint. No CORS, cookie-based app authentication, redirects, or credential/body logs.
export function createApiHandler({service,snapshots,origin}) {
 const allowed=new URL(origin).origin;
 return async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
  const snapshotMatch=/^\/api\/snapshots(?:\/([0-9a-f-]{36}))?$/.exec(req.url?.split('?')[0]);
  if(snapshotMatch&&snapshots){
   const id=snapshotMatch[1];
   if(req.method==='GET'&&id){try{const snapshot=await snapshots.read(id);return reply(snapshot?200:404,snapshot?{snapshot}:{error:'Unavailable.'})}catch{return reply(503,{error:'Unavailable.'})}}
   if(!['POST','PUT','DELETE'].includes(req.method)||(req.method==='POST'&&id)||(req.method!=='POST'&&!id))return reply(405,{error:'Invalid method.'});
   if(req.headers.origin!==allowed)return reply(403,{error:'Origin denied.'});
   const auth=req.headers.authorization;
   if(typeof auth!=='string'||!/^Bearer [^\s]{1,8192}$/.test(auth))return reply(401,{code:'auth',error:'Sign in required.'});
   try{
    if(req.method==='DELETE'){await snapshots.revoke({token:auth.slice(7),id});return reply(200,{revoked:true})}
    if(req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding'])return reply(415,{error:'JSON required.'});
    const body=await readJson(req);if(!body||Object.keys(body).some(k=>k!=='theme'))return reply(400,{error:'Theme only.'});
    return reply(200,await snapshots.publish({token:auth.slice(7),theme:body.theme,id}));
   }catch(error){return reply(error.status||403,{error:'Snapshot unavailable.'})}
  }
  if(req.url?.split('?')[0]!=='/api/style')return reply(404,{error:'Not found.'});
  if(req.method!=='POST')return reply(405,{error:'POST required.'});
  if(req.headers.origin!==allowed)return reply(403,{error:'Origin denied.'});
  if(req.headers['content-type']?.split(';')[0]!=='application/json')return reply(415,{error:'JSON required.'});
  if(req.headers['content-encoding'])return reply(415,{error:'Encoding unsupported.'});
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||!/^Bearer [^\s]{1,8192}$/.test(authorization))return reply(401,{code:'auth',error:'Sign in required.'});
  try{
   const body=await readJson(req);
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['prompt','byok'].includes(k)))return reply(400,{error:'Invalid request.'});
   const result=await service({...body,token:authorization.slice(7)});
   const {status,...output}=result;reply(status,output);
  }catch(error){if(!res.headersSent)reply(error.status||400,{error:'Invalid request.'})}
 };
}
export function createApiServer(options){
 const server=createServer(createApiHandler(options));
 server.requestTimeout=90000;server.headersTimeout=10000;server.maxHeadersCount=30;
 return server;
}

async function readJson(req){
 if(Number(req.headers['content-length'])>4096)throw Object.assign(Error(),{status:413});
 if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>4096)throw Object.assign(Error(),{status:413});return JSON.parse(raw)}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)throw Object.assign(Error(),{status:413});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}


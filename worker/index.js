const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...cors}})}
async function wsResponse(request,env){
  if(request.headers.get('Upgrade')!=='websocket')return json({status:'error',message:'WebSocket upgrade required'},426);
  if(!env.TWELVE_DATA_API_KEY)return json({status:'error',message:'TWELVE_DATA_API_KEY is not configured'},500);
  const pair=new WebSocketPair();
  const [client,server]=Object.values(pair);
  server.accept({allowHalfOpen:true});
  let upstream=null,closed=false,heartbeat=null,opened=false;
  const pending=[];
  const close=()=>{if(closed)return;closed=true;if(heartbeat)clearInterval(heartbeat);try{upstream?.close()}catch{}try{server.close()}catch{}};
  try{
    const r=await fetch('https://ws.twelvedata.com/v1/quotes/price?apikey='+encodeURIComponent(env.TWELVE_DATA_API_KEY),{headers:{Upgrade:'websocket'}});
    upstream=r.webSocket;
    if(!upstream){try{server.send(JSON.stringify({event:'proxy-status',status:'error',message:'Twelve Data WebSocket handshake failed'}))}catch{}close();return new Response(null,{status:101,webSocket:client});}
    upstream.accept({allowHalfOpen:true});
    upstream.addEventListener('open',()=>{
      opened=true;
      try{server.send(JSON.stringify({event:'proxy-status',status:'connected'}))}catch{}
      while(pending.length){try{upstream.send(pending.shift())}catch{break}}
      heartbeat=setInterval(()=>{try{upstream.send(JSON.stringify({action:'heartbeat'}))}catch{}},10000);
    });
    upstream.addEventListener('message',e=>{try{server.send(e.data)}catch{close()}});
    upstream.addEventListener('error',()=>{try{server.send(JSON.stringify({event:'proxy-status',status:'error',message:'Upstream WebSocket error'}))}catch{}close()});
    upstream.addEventListener('close',()=>close());
  }catch(e){try{server.send(JSON.stringify({event:'proxy-status',status:'error',message:String(e?.message||e)}))}catch{}close()}
  server.addEventListener('message',e=>{try{const msg=typeof e.data==='string'?e.data:new TextDecoder().decode(e.data);JSON.parse(msg);if(opened)upstream.send(msg);else pending.push(msg)}catch{try{server.send(JSON.stringify({event:'proxy-status',status:'error',message:'Invalid client message'}))}catch{}}});
  server.addEventListener('close',close);server.addEventListener('error',close);
  return new Response(null,{status:101,webSocket:client});
}
export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{headers:cors});const u=new URL(request.url);if(u.pathname==='/health')return json({ok:true,provider:'Twelve Data'});if(u.pathname==='/time_series'){if(!env.TWELVE_DATA_API_KEY)return json({status:'error',message:'TWELVE_DATA_API_KEY is not configured'},500);const symbol=u.searchParams.get('symbol');const interval=u.searchParams.get('interval')||'1min';const outputsize=u.searchParams.get('outputsize')||'300';if(!symbol)return json({status:'error',message:'symbol is required'},400);const api=new URL('https://api.twelvedata.com/time_series');api.searchParams.set('symbol',symbol);api.searchParams.set('interval',interval);api.searchParams.set('outputsize',outputsize);api.searchParams.set('apikey',env.TWELVE_DATA_API_KEY);const r=await fetch(api);return new Response(await r.text(),{status:r.status,headers:{'content-type':'application/json; charset=utf-8',...cors}})}if(u.pathname==='/ws')return wsResponse(request,env);return json({ok:true,service:'charting-data-proxy',endpoints:['/health','/time_series','/ws']})}};
export default async function handler(req,res){
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key) return res.status(500).json({error:'TWELVE_DATA_API_KEY is not configured'});
  const u=new URL('https://api.twelvedata.com/time_series');
  const q=req.query||{};
  const symbol=String(q.symbol||'BTC/USD');
  const interval=String(q.interval||'1min');
  u.searchParams.set('symbol',symbol);
  u.searchParams.set('interval',interval);
  u.searchParams.set('outputsize',String(Math.min(Number(q.outputsize||300),5000)));
  u.searchParams.set('apikey',key);
  try{
    const r=await fetch(u);
    const text=await r.text();
    res.status(r.status).setHeader('content-type','application/json').send(text);
  }catch(e){res.status(502).json({error:'Twelve Data request failed'});}
}

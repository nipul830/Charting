export default {
  async fetch(request, env) {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Twelve Data WebSocket proxy is online', {status: 200});
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const upstream = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(env.TWELVE_DATA_API_KEY)}`);
    upstream.addEventListener('open', () => server.send(JSON.stringify({type:'proxy-status',status:'connected'})));
    upstream.addEventListener('message', e => server.send(e.data));
    upstream.addEventListener('error', () => server.send(JSON.stringify({type:'proxy-status',status:'error'})));
    upstream.addEventListener('close', () => { try { server.close(); } catch {} });
    server.addEventListener('message', e => { try { upstream.send(e.data); } catch {} });
    server.addEventListener('close', () => { try { upstream.close(); } catch {} });
    return new Response(null, {status:101, webSocket:client});
  }
};

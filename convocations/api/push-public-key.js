module.exports = async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  const key=process.env.VAPID_PUBLIC_KEY;
  if(!key)return res.status(503).json({error:'Notifications non configurées'});
  return res.status(200).json({publicKey:key});
};
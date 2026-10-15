const webpush=require('web-push');
const base='https://yaobxgegsckwroqhvczd.supabase.co';
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Méthode interdite'});
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Connexion requise'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return res.status(503).json({error:'Configuration serveur manquante'});
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{
 const headers={apikey:service,Authorization:'Bearer '+service};
 const who=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:'Bearer '+token}});
 if(!who.ok)return res.status(401).json({error:'Session expirée'});
 const user=await who.json();
 const member=await fetch(base+'/rest/v1/club_members?select=role,active&user_id=eq.'+encodeURIComponent(user.id),{headers});
 if(!member.ok)throw Error('Vérification membre indisponible');
 const roles=await member.json();
 if(!roles.some(m=>m.active&&m.role==='admin'))return res.status(403).json({error:'Réservé aux administrateurs'});
 const r=await fetch(base+'/rest/v1/push_subscriptions?select=subscription&user_id=eq.'+encodeURIComponent(user.id),{headers});
 if(!r.ok)throw Error('Abonnements indisponibles');
 const subs=await r.json();
 if(!subs.length)return res.status(404).json({error:'Aucun appareil inscrit pour ton compte'});
 webpush.setVapidDetails('mailto:notifications@us-anizy-pinon.fr',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let sent=0,failed=0;
 for(const s of subs){
 try{await webpush.sendNotification(s.subscription,JSON.stringify({title:'USAP · Notification test',body:'Test réussi ! Les notifications USAP arrivent sur ton téléphone. 🔔'}));sent++}
 catch(e){failed++;console.error('Test push',e.statusCode||e.message)}
 }
 return res.status(sent?200:502).json({sent,failed,error:sent?undefined:'Aucune notification reçue par le service push'});
 }catch(e){console.error('Test notification',e.message);return res.status(500).json({error:'Erreur serveur lors du test'})}
};
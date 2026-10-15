const BASE='https://yaobxgegsckwroqhvczd.supabase.co';
const TABLES=['club_members','players','educators','matches','match_players','calendar_events'];
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Méthode interdite'});
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Connexion requise'});
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)return res.status(503).json({error:'Configuration indisponible'});
 const adminHeaders={apikey:secret,Authorization:'Bearer '+secret};
 try{
  const check=await fetch(BASE+'/auth/v1/user',{headers:{apikey:secret,Authorization:'Bearer '+token}});
  if(!check.ok)return res.status(401).json({error:'Session invalide'});
  const user=await check.json();let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'))}catch{return res.status(401).json({error:'Jeton invalide'})}if(claims.aal!=='aal2')return res.status(403).json({error:'Double authentification administrateur requise'});
  const member=await fetch(BASE+'/rest/v1/club_members?select=role,active&user_id=eq.'+encodeURIComponent(user.id),{headers:adminHeaders});
  if(!member.ok)throw Error('Membership check failed');
  const records=await member.json();
  if(!records.some(m=>m.active===true&&m.role==='admin'))return res.status(403).json({error:'Administrateur requis'});
  const data={};
  for(const table of TABLES){
   const rows=[];
   for(let offset=0;offset<100000;offset+=500){
    const result=await fetch(BASE+'/rest/v1/'+table+'?select=*&limit=500&offset='+offset,{headers:adminHeaders});
    if(!result.ok)throw Error('Backup table unavailable: '+table);
    const chunk=await result.json();
    rows.push(...chunk);
    if(chunk.length<500)break;
    if(offset>=99500)throw Error('Backup exceeds safe export limit');
   }
   data[table]=rows;
  }
  const payload=JSON.stringify({format:'USAP_BACKUP_V1',created_at:new Date().toISOString(),tables:data},null,2);
  if(Buffer.byteLength(payload,'utf8')>6*1024*1024)return res.status(413).json({error:'Sauvegarde trop volumineuse pour ce mode'});
  const date=new Date().toISOString().slice(0,10);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="USAP-sauvegarde-'+date+'.json"');
  return res.status(200).send(payload);
 }catch(e){console.error('Backup error',e.message);return res.status(500).json({error:'La sauvegarde a échoué ; aucun fichier incomplet ne doit être utilisé'})}
};
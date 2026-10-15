const webpush=require('web-push');
const {createHash}=require('node:crypto');
const API='https://yaobxgegsckwroqhvczd.supabase.co/rest/v1/';
async function list(table,filters){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const result=await fetch(API+table+'?'+filters,{headers:{apikey:key,Authorization:'Bearer '+key}});
 if(!result.ok)throw new Error('Supabase '+table+': '+result.status);
 return result.json();
}
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).end();
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).end();
 const now=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 if(now.weekday!=='Thu'||now.hour!=='19')return res.json({skipped:'outside Thursday 19:00-19:59 Europe/Paris window'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return res.status(503).json({error:'Environment configuration incomplete'});
 try{
 const date=now.year+'-'+now.month+'-'+now.day;
 const day=n=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const window='in.('+day(2)+','+day(3)+')';
 const [events,matches,subs,members]=await Promise.all([
  list('calendar_events','select=category,event_date&event_date='+window),
  list('matches','select=category,match_date&match_date='+window),
  list('push_subscriptions','select=user_id,subscription,categories'),
  list('club_members','select=user_id,active')
 ]);
 const completed=new Set(matches.map(m=>m.category+'|'+m.match_date));
 const pending=events.filter(e=>!completed.has(e.category+'|'+e.event_date));
 const active=new Set(members.filter(m=>m.active).map(m=>m.user_id));
 webpush.setVapidDetails('mailto:notifications@us-anizy-pinon.fr',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let sent=0,failed=0,alreadySent=0;
 for(const subscription of subs){
  if(!active.has(subscription.user_id))continue;
  const categories=[...new Set(pending.filter(e=>Array.isArray(subscription.categories)&&subscription.categories.includes(e.category)).map(e=>e.category))];
  if(!categories.length)continue;
  const subscriptionHash=createHash('sha256').update(subscription.subscription.endpoint||'').digest('hex');
  if(!subscription.subscription.endpoint){failed++;continue}
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'};
  const claim=await fetch(API+'weekly_push_deliveries',{method:'POST',headers,body:JSON.stringify({run_date:date,subscription_hash:subscriptionHash})});
  if(claim.status===409){alreadySent++;continue}
  if(!claim.ok)throw new Error('Unable to claim weekly push reminder: '+claim.status);
  try{
   await webpush.sendNotification(subscription.subscription,JSON.stringify({title:'USAP · Convocation à préparer',body:'Rencontre ce week-end : '+categories.join(', ')+'. Pense à préparer ta convocation.'}));
   sent++;
  }catch(e){console.error('USAP push delivery',e.statusCode||e.message);failed++;
   const rollback=await fetch(API+'weekly_push_deliveries?run_date=eq.'+date+'&subscription_hash=eq.'+subscriptionHash,{method:'DELETE',headers});
   if(!rollback.ok)console.error('USAP push claim cleanup',rollback.status);
  }
 }
 return res.json({pending:pending.length,sent,failed,alreadySent});
 }catch(e){console.error('USAP weekly push',e.message);return res.status(500).json({error:'Could not process reminders'})}
};

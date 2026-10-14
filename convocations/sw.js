/* USAP Convocations: push-only service worker; no app caching. */
self.addEventListener('push', event => {
  if (!event.data) return;
  let info;
  try { info=event.data.json(); } catch { info={body:event.data.text()}; }
  const title=String(info.title||'USAP Convocations');
  const options={body:String(info.body||'Pense à préparer ta convocation.'),tag:'usap-rappel-convocation',data:{url:'/'},icon:'/icon-192.png',badge:'/icon-192.png'};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const w=windows.find(c=>c.url.startsWith(self.location.origin));
    if(w) return w.focus();
    return clients.openWindow('/');
  }));
});
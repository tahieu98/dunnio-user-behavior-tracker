'use strict';
(async()=>{
 const ticket=location.hash.slice(1);history.replaceState(null,'','desktop-login.html');
 try{
  const r=await fetch('/api/desktop/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),credentials:'omit'});
  const data=await r.json();if(!r.ok||!data.success)throw new Error('Phiên mở đã hết hạn. Chọn Mở Dashboard Admin trên cửa sổ Dunnio Insights.');
  for(const s of [localStorage,sessionStorage]){s.removeItem('auth_token');s.removeItem('user_data');}
  sessionStorage.setItem('auth_token',data.data.token);sessionStorage.setItem('user_data',JSON.stringify(data.data.user));location.replace('touch.html');
 }catch(e){document.getElementById('desktopStatus').textContent=e.message;}
})();

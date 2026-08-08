/** SJTC Dashboard v3.0.0 — modular source */
async function restoreSavedAccess(){
  const pin = accessPin();
  if(!pin) { setAccess("staff"); return; }
  try{
    const res = await api("validateAccess", {pin});
    setAccess(res.valid ? (res.role || "staff") : "staff");
    if(!res.valid) localStorage.removeItem(ADMIN_PIN_KEY);
  }catch(err){
    setAccess("staff");
  }
}
function bindGlobal(){
  document.querySelectorAll(".navBtn").forEach(t=>t.onclick=async()=>{ state.page=t.dataset.page; render(); if(state.page==="production-logs"&&!state.productionLogsLoaded){ try{ await ensureProductionLogs(); }catch(err){ console.error(err); alert(err.message||err); } } if(state.page==="history"&&!state.historyLoaded){ try{ await ensureHistoryIndex(); }catch(err){ console.error(err); alert(err.message||err); } } });
  $("btnSidebarToggle").onclick=()=>{ state.sidebarCollapsed=!state.sidebarCollapsed; localStorage.setItem("sjtc_sidebar_collapsed", state.sidebarCollapsed?"Y":"N"); syncShell(); };
  $("btnAdmin").onclick=()=>openModal("adminModal");
  $("btnAdminLogin").onclick=(e)=>runAction(e,"Unlocking access...", async()=>{ const pin=$("adminPinInput").value.trim(); const res=await api("validateAccess",{pin}); if(!res.valid) return alert("Invalid PIN"); localStorage.setItem(ADMIN_PIN_KEY,pin); closeModal("adminModal"); setAccess(res.role || "staff"); await load({silent:true}); });
  $("btnAdminOff").onclick=()=>{ localStorage.removeItem(ADMIN_PIN_KEY); closeModal("adminModal"); setAccess("staff"); };
  $("btnRefresh").onclick=(e)=>runAction(e,"Refreshing data...", async()=>load());
  $("btnSaveProject").onclick=(e)=>runAction(e,"Saving project...", saveProject);
  $("btnSaveProjectItems").onclick=(e)=>runAction(e,"Saving items...", saveProjectItems);
  $("btnConfirmMove").onclick=(e)=>runAction(e,"Saving movement log...", confirmMove);
  if($("btnSaveProductionLogEdit")) $("btnSaveProductionLogEdit").onclick=(e)=>runAction(e,"Saving production log correction...", saveProductionLogEdit);
  $("btnSubmitLogisticsRequest").onclick=(e)=>runAction(e,"Submitting logistics request...", submitLogisticsRequest);
  $("btnConfirmScheduleRequest").onclick=(e)=>runAction(e,"Saving logistics schedule...", confirmSchedule);
  document.querySelectorAll(".modalBg").forEach(bg=>bg.addEventListener("click",e=>{ if(e.target===bg && !actionBusy) bg.style.display="none"; }));
}
bindGlobal(); restoreSavedAccess().then(()=>load()).then(startAutoRefresh);

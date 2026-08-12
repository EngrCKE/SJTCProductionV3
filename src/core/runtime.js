/** SJTC Dashboard v3.0.0 — modular source */
function normalizeLogisticsRecords(){
  state.logisticsRequests = (state.logisticsRequests || [])
    .filter(r => String(r.Active || "Y").toUpperCase() !== "N")
    .map(r => ({...r, Payload: normalizePayload(r.Payload || r.PayloadJSON || {})}));
  state.logisticsRequests.forEach(r => { if(r.Payload) r.Payload.SONumber = cleanSO(r.Payload.SONumber); });
}
function normalizePayload(raw){
  if(!raw) return {};
  if(typeof raw === "object") return raw;
  try { return JSON.parse(raw || "{}"); } catch(_) { return {}; }
}
async function loadExternalLogisticsRequests(silent){
  // v1.2: logistics is native to the Production Dashboard database.
  // Requests are loaded by productionBootstrapV3 from Logistics_V3.
  normalizeLogisticsRecords();
}
function setLoading(on, text="Working..."){
  const el = $("loadingOverlay");
  if(!el) return;
  el.querySelector(".loadingText").textContent = text;
  el.style.display = on ? "flex" : "none";
}
function setActionBusy(on, text="Processing..."){
  actionBusy = !!on;
  document.body.classList.toggle("actionBusy", !!on);
  setLoading(!!on, text);
  document.querySelectorAll("button").forEach(btn=>{
    if(on){
      btn.dataset.wasDisabled = btn.disabled ? "Y" : "N";
      btn.disabled = true;
    } else if(btn.dataset.wasDisabled !== "Y") {
      btn.disabled = false;
      delete btn.dataset.wasDisabled;
    }
  });
}
async function runAction(button, text, fn){
  if(actionBusy) return;
  const btn = button && button.target ? button.target : button;
  const oldText = btn && btn.textContent;
  try{
    setActionBusy(true, text || "Processing...");
    if(btn && oldText) btn.textContent = "Please wait...";
    await fn();
  } finally {
    if(btn && oldText) btn.textContent = oldText;
    setActionBusy(false);
  }
}
const FIELD_TIPS = {
  adminPinInput:"Enter the admin PIN to unlock editing, scheduling, and process movement controls.",
  lrType:"Choose whether the request is for delivery, client call, or service/purchasing.",
  lrRequestedBy:"Enter the name of the staff member submitting this logistics request.",
  lrDate:"Select the requested schedule date. Logistics admin can still revise this later.",
  lrTime:"Select the requested dispatch or call time.",
  lrSO:"Enter the SO number only. Do not type SO-.",
  lrClient:"Enter the client name connected to this request.",
  lrContact:"Enter the client or site contact number.",
  lrAddress:"Enter the exact delivery or installation address.",
  lrDestination:"Enter the destination for the service or client call.",
  lrArea:"Choose NCR if coding rules may apply. Choose Non-NCR for outside NCR trips.",
  lrItems:"List only the items included in this delivery request, especially for partial delivery.",
  lrNotes:"Add special instructions such as delivery restrictions, contact person, or priority notes.",
  lrPurpose:"Choose the main purpose of the service request.",
  lrVehicleReq:"Choose the preferred vehicle type if the request requires a specific capacity.",
  schedDate:"Final scheduled date for this logistics request.",
  schedTime:"Final scheduled dispatch/start time.",
  schedDriver:"Select the assigned driver.",
  schedVehicle:"Select the assigned vehicle.",
  schedRemarks:"Add schedule remarks, instructions, or correction notes.",
  noteSignature:"Enter your name or short signature for accountability.",
  noteText:"Write the production update, issue, or instruction. The date/time is saved automatically."
};
function applyFieldTips(root=document){
  Object.entries(FIELD_TIPS).forEach(([id,tip])=>{
    const el = root.getElementById ? root.getElementById(id) : document.getElementById(id);
    if(!el) return;
    el.title = tip;
    el.dataset.tip = tip;
    const wrap = el.closest("div");
    const label = wrap ? wrap.querySelector("label") : null;
    if(label){ label.classList.add("tipLabel"); label.dataset.tip = tip; label.title = tip; }
  });
}

const BOOTSTRAP_SNAPSHOT_KEY = "sjtc_bootstrap_snapshot_v309";
const BOOTSTRAP_SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function applyBootstrapData(data, options = {}){
  PROCESS_COLUMNS = normalizeProcessColumns(data.processColumns || data.settings?.PROCESS_COLUMNS || DEFAULT_PROCESS_COLUMNS);
  Object.assign(state, {
    projects:data.projects||[], items:data.items||[], announcements:data.announcements||[],
    logisticsRequests:data.logisticsRequests||[], logisticsItems:data.logisticsItems||[],
    teams:data.teams||[], teamMembers:data.teamMembers||[], personnel:data.personnel||[], drivers:data.drivers||[], vehicles:data.vehicles||[], vehiclePassengers:data.vehiclePassengers||[], settings:data.settings||{},
    notes:Array.isArray(data.notes) ? data.notes : state.notes,
    logs:Array.isArray(data.logs) ? data.logs : state.logs,
    syncMeta:data.meta||{}
  });
  state.projects.forEach(p=>p.SONumber=cleanSO(p.SONumber));
  state.items.forEach(i=>i.SONumber=cleanSO(i.SONumber));
  currentDataOnly();
  if(options.applyAccess !== false && data.accessRole){
    applyAccessState(data.accessRole, false);
    if(data.accessRole === "staff" && localStorage.getItem(ADMIN_PIN_KEY)) localStorage.removeItem(ADMIN_PIN_KEY);
  }
}

function saveBootstrapSnapshot(data){
  if(!PRODUCTION_API_URL) return;
  try{
    const snapshot = {
      savedAt:Date.now(),
      data:{
        settings:data.settings||{}, processColumns:data.processColumns||[],
        projects:data.projects||[], items:data.items||[], announcements:data.announcements||[],
        logisticsRequests:data.logisticsRequests||[], logisticsItems:data.logisticsItems||[],
        teams:data.teams||[], teamMembers:data.teamMembers||[], personnel:data.personnel||[],
        drivers:data.drivers||[], vehicles:data.vehicles||[], vehiclePassengers:data.vehiclePassengers||[],
        meta:data.meta||{}
      }
    };
    localStorage.setItem(BOOTSTRAP_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }catch(_){ /* Cache is optional; quota/privacy settings may disable it. */ }
}

function restoreBootstrapSnapshot(){
  try{
    const raw=localStorage.getItem(BOOTSTRAP_SNAPSHOT_KEY);
    if(!raw) return false;
    const snapshot=JSON.parse(raw);
    if(!snapshot || !snapshot.data || Date.now()-Number(snapshot.savedAt||0)>BOOTSTRAP_SNAPSHOT_MAX_AGE_MS) return false;
    applyBootstrapData(snapshot.data,{applyAccess:false});
    setSync("Cached view • syncing latest...");
    render();
    return true;
  }catch(_){ return false; }
}

async function load(options = {}){
  const silent = !!options.silent;
  setSync(silent ? "Auto-syncing..." : "Syncing...");
  if(!silent) setLoading(true, "Syncing data...");
  try{
    const data = await api("productionBootstrapV3", { pin: localStorage.getItem(ADMIN_PIN_KEY) || "" });
    applyBootstrapData(data);
    saveBootstrapSnapshot(data);
    await loadExternalLogisticsRequests(silent);
    const serverMs = Number(state.syncMeta && state.syncMeta.serverMs || 0);
    const timing = serverMs > 0 ? ` • ${(serverMs/1000).toFixed(serverMs >= 10000 ? 0 : 1)}s server` : "";
    setSync(PRODUCTION_API_URL ? `Synced ${new Date().toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}${timing}` : "Demo mode");
    render();
  }catch(err){
    console.error(err);
    const message = err && err.message ? err.message : String(err);
    setSync(message.includes("timed out") ? "Sync timed out" : "Sync failed");
    if(!silent) alert(message);
  } finally {
    if(!silent) setLoading(false);
  }
}
function setSync(text){ $("syncBadge").textContent = text; }
function isAnyModalOpen(){
  return Array.from(document.querySelectorAll(".modalBg")).some(m => m.style.display === "flex");
}
function shouldSkipAutoRefresh(){
  return document.hidden || actionBusy || isAutoRefreshing || isAnyModalOpen() || state.pendingMove || state.editingProjectId;
}
async function autoRefresh(){
  if(shouldSkipAutoRefresh()) return;
  isAutoRefreshing = true;
  try{ await load({silent:true}); }
  finally{ isAutoRefreshing = false; }
}
function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(autoRefresh, AUTO_REFRESH_MS);
}
function applyAccessState(role, rerender = true){
  role = role === "admin" ? "admin" : (role === "officer" ? "officer" : "staff");
  state.accessLevel = role;
  state.admin = role === "admin";
  state.officer = role === "admin" || role === "officer";
  const label = role === "admin" ? "Access: Admin" : (role === "officer" ? "Access: Officer" : "Access: Staff");
  $("adminBadge").textContent = label;
  $("adminBadge").className = role === "admin" ? "badge ok" : (role === "officer" ? "badge warn" : "badge");
  if(rerender) render();
}
function setAccess(role){ applyAccessState(role, true); }
function setAdmin(on){ setAccess(on ? "admin" : "staff"); }
function canAdmin(){ return state.accessLevel === "admin"; }
function canOfficer(){ return state.accessLevel === "admin" || state.accessLevel === "officer"; }
function accessPin(){ return localStorage.getItem(ADMIN_PIN_KEY) || ""; }
function requireOfficerMessage(){ return "Officer or Admin Mode is required."; }
function requireAdminMessage(){ return "Admin Mode is required."; }
function syncShell(){ document.body.classList.toggle("sidebarCollapsed", state.sidebarCollapsed); }
function dateOnlyFromAny(value){
  if(value === null || typeof value === "undefined" || value === "") return null;
  if(value instanceof Date && !isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const raw = String(value).trim();
  if(!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m){
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(raw);
  if(isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
function daysToDue(due){
  const d = dateOnlyFromAny(due);
  if(!d) return { text:"No due date", cls:"" };
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d.getTime() - today.getTime())/86400000);
  if(diff < 0) return {text:`Overdue by ${Math.abs(diff)} day${Math.abs(diff)>1?"s":""}`, cls:"bad"};
  if(diff === 0) return {text:"Due today", cls:"warn"};
  if(diff <= 7) return {text:`Due in ${diff} day${diff>1?"s":""}`, cls:"warn"};
  return {text:`Due in ${diff} days`, cls:"ok"};
}

function isDeliveredItem(item){
  return ["DELIVERED","INSTALLED","CANCELLED"].includes(String(item?.DeliveryStatus || "").trim().toUpperCase());
}
function activeProjects(){
  return state.projects.filter(p=>String(p.Active||"Y").toUpperCase()!=="N" && !["DELIVERED","CANCELLED","CLOSED","ARCHIVED"].includes(String(p.OverallStatus||"").toUpperCase()));
}
function projectItems(projectId){
  return state.items.filter(i=>String(i.ProjectID)===String(projectId) && String(i.Active||"Y").toUpperCase()!=="N").sort((a,b)=>Number(a.SortOrder||0)-Number(b.SortOrder||0));
}
function activeItems(){
  const visibleProjects = new Set(activeProjects().map(p=>String(p.ProjectID)));
  return state.items.filter(i=>visibleProjects.has(String(i.ProjectID)) && String(i.Active||"Y").toUpperCase()!=="N" && !isDeliveredItem(i));
}
function currentDataOnly(){
  const pids = new Set(activeProjects().map(p=>String(p.ProjectID)));
  state.projects = state.projects.filter(p=>pids.has(String(p.ProjectID)));
  state.items = state.items.filter(i=>pids.has(String(i.ProjectID)) && String(i.Active||"Y").toUpperCase()!=="N");
  state.notes = state.notes.filter(n=>String(n.Active||"Y").toUpperCase()!=="N" && pids.has(String(n.ProjectID)));
  state.logs = state.logs.filter(l=>state.items.some(i=>String(i.ItemID)===String(l.ItemID)));
}
function projectNotes(projectId){ return state.notes.filter(n=>String(n.ProjectID)===String(projectId) && n.Active!=="N").sort((a,b)=>new Date(b.CreatedAt)-new Date(a.CreatedAt)); }
function itemLogs(itemId){ return state.logs.filter(l=>String(l.ItemID)===String(itemId)).sort((a,b)=>new Date(b.StartedAt||b.CreatedAt||0)-new Date(a.StartedAt||a.CreatedAt||0)); }
async function ensureProjectNotes(projectId, force=false){
  const key=String(projectId||"");
  if(!key || (!force && state.loadedProjectNotes[key])) return projectNotes(key);
  const res=await api("getProjectNotes", {projectId:key});
  state.notes=state.notes.filter(n=>String(n.ProjectID)!==key).concat(res.notes||[]);
  state.loadedProjectNotes[key]=true;
  return projectNotes(key);
}
async function ensureItemLogs(itemId, force=false){
  const key=String(itemId||"");
  if(!key || (!force && state.loadedItemLogs[key])) return itemLogs(key);
  const res=await api("getItemLogs", {itemId:key});
  state.logs=state.logs.filter(l=>String(l.ItemID)!==key).concat(res.logs||[]);
  state.loadedItemLogs[key]=true;
  return itemLogs(key);
}
function teamName(teamId){ return (state.teams.find(t=>String(t.TeamID)===String(teamId))||{}).TeamName || "—"; }
function teamLead(teamId){ return (state.teams.find(t=>String(t.TeamID)===String(teamId))||{}).TeamLead || "—"; }
function projectTeamSummary(projectId){
  const names=[...new Set(projectItems(projectId).map(i=>teamName(i.AssignedTeamID)).filter(x=>x&&x!=="—"))];
  return names.length ? names.join(", ") : "Unassigned";
}
function projectPersonnelSummary(projectId){
  const names=[...new Set(projectItems(projectId).map(i=>String(i.AssignedPersonnel||"").trim()).filter(Boolean))];
  return names.length ? names.join(", ") : "Unassigned";
}
function projectSiteAddress(project){ return project?.SiteAddress || project?.Address || ""; }
function currentWeekDates(){ const base = new Date(); const day=base.getDay(); const diff=(day===0?-6:1-day)+(state.logisticsOffsetWeeks*7); base.setDate(base.getDate()+diff); base.setHours(0,0,0,0); return Array.from({length:7},(_,i)=>{const d=new Date(base); d.setDate(base.getDate()+i); return d;}); }
function detail(k,v){ return `<div class="small"><b>${escapeHtml(k)}:</b> ${escapeHtml(v||"—")}</div>`; }
function splitMultiValue(value){
  if(Array.isArray(value)) return value.map(x=>String(x||"").trim()).filter(Boolean);
  return String(value || "")
    .split(/\n|;|\|/g)
    .map(x=>x.trim())
    .filter(Boolean);
}
function bulletListHTML(items){
  const arr = (items || []).map(x=>String(x||"").trim()).filter(Boolean);
  if(!arr.length) return "—";
  return `<ul class="detailBulletList">${arr.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
}
function detailList(k, items){ return `<div class="small detailListRow"><b>${escapeHtml(k)}:</b> ${bulletListHTML(items)}</div>`; }
function cardList(list, fn){ return list.length ? list.map(fn).join("") : `<div class="hint">No records.</div>`; }

function renderCurrentPage(){
  switch(state.page){
    case "projects": return renderProjects();
    case "board": return renderBoard();
    case "production-logs": return renderProductionLogs();
    case "logistics": return renderLogistics();
    case "history": return renderHistory();
    case "settings": return renderSettings();
    case "about": return renderAbout();
    case "overview":
    default: return renderOverview();
  }
}
function render(){
  syncShell();
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const activePage=$(`page-${state.page}`);
  if(activePage) activePage.classList.add("active");
  document.querySelectorAll(".navBtn").forEach(t=>t.classList.toggle("active", t.dataset.page===state.page));
  renderCurrentPage();
  applyFieldTips();
}


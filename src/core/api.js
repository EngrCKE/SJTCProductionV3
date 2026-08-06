/** SJTC Dashboard v3.0.0 — modular source */
function apiErrorMessage(action, status, responseText){
  const text = String(responseText || "").trim();
  const isHtml = /^<!doctype\s+html|^<html[\s>]/i.test(text);
  if(isHtml){
    return `Sync service returned an HTML error page instead of JSON (${status || "no status"}). ` +
      `The Apps Script deployment may be unavailable, restricted, or taking too long. Action: ${action}.`;
  }
  if(!text) return `Sync service returned an empty response (${status || "no status"}). Action: ${action}.`;
  return `Sync service returned invalid JSON (${status || "no status"}). Action: ${action}.`;
}

async function apiRequest(action, payload){
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), API_TIMEOUT_MS);
  let res;
  try{
    res = await fetch(`${PRODUCTION_API_URL}?action=${encodeURIComponent(action)}`, {
      method:"POST",
      headers:{"Content-Type":"application/json", "Accept":"application/json"},
      body:JSON.stringify(payload || {}),
      signal:controller.signal,
      cache:"no-store"
    });
  }catch(err){
    if(err && err.name === "AbortError") throw new Error(`Sync timed out after ${Math.round(API_TIMEOUT_MS/1000)} seconds. Action: ${action}.`);
    throw new Error(`Unable to reach the sync service. ${err && err.message ? err.message : err}`);
  }finally{
    clearTimeout(timeout);
  }

  const text = await res.text();
  let j;
  try{
    j = JSON.parse(text);
  }catch(_){
    throw new Error(apiErrorMessage(action, res.status, text));
  }
  if(!res.ok) throw new Error(j.error || `Sync service error (${res.status})`);
  if(!j.ok) throw new Error(j.error || "API error");
  return j;
}

async function api(action, payload){
  if(!PRODUCTION_API_URL) return demoApi(action, payload || {});
  const attempts = API_SAFE_RETRY_ACTIONS.has(action) ? 2 : 1;
  let lastError;
  for(let attempt=1; attempt<=attempts; attempt++){
    try{
      return await apiRequest(action, payload || {});
    }catch(err){
      lastError = err;
      if(attempt < attempts) await new Promise(resolve=>setTimeout(resolve, 1200));
    }
  }
  throw lastError;
}
function demoApi(action, body){
  const ok = data => Promise.resolve({ok:true, ...data});
  if(action === "upsertAnnouncement"){
    const a = {...(body.announcement || {})};
    if(a.AnnouncementID && demo.announcements.some(x=>x.AnnouncementID===a.AnnouncementID)){
      const idx = demo.announcements.findIndex(x=>x.AnnouncementID===a.AnnouncementID);
      demo.announcements[idx] = {...demo.announcements[idx], ...a, UpdatedAt:nowISO()};
      return ok({announcement:demo.announcements[idx]});
    }
    const row = { AnnouncementID:`ANN-${String(demo.announcements.length+1).padStart(4,"0")}`, Title:a.Title||"", Message:a.Message||"", PostedBy:a.PostedBy||"", CreatedAt:a.CreatedAt||nowISO(), ExpiryDate:a.ExpiryDate||"", Active:a.Active||"Y" };
    demo.announcements.push(row); return ok({announcement:row});
  }
  if(action === "upsertSetting"){
    demo.settings[body.key] = String(body.value ?? "");
    if(body.key === "PROCESS_COLUMNS") PROCESS_COLUMNS = String(body.value || "").split("|").map(x=>x.trim()).filter(Boolean);
    return ok({settings:demo.settings});
  }
  if(action === "upsertPersonnel"){
    const p = {...(body.personnel || {})};
    if(p.PersonnelID && demo.personnel.some(x=>x.PersonnelID===p.PersonnelID)){
      const idx = demo.personnel.findIndex(x=>x.PersonnelID===p.PersonnelID);
      demo.personnel[idx] = {...demo.personnel[idx], ...p, UpdatedAt:nowISO()};
      return ok({personnel:demo.personnel[idx]});
    }
    const row = { PersonnelID:`PER-${String(demo.personnel.length+1).padStart(4,"0")}`, PersonnelName:p.PersonnelName||"", Role:p.Role||"Personnel", Department:p.Department||"", PrimaryTeamID:p.PrimaryTeamID||"", ContactNumber:p.ContactNumber||"", CanDrive:p.CanDrive||"N", CanInstall:p.CanInstall||"N", Active:p.Active||"Y", CreatedAt:nowISO(), UpdatedAt:nowISO() };
    demo.personnel.push(row); return ok({personnel:row});
  }
  if(action === "upsertVehicle"){
    const v = {...(body.vehicle || {})};
    if(v.VehicleID && demo.vehicles.some(x=>x.VehicleID===v.VehicleID)){
      const idx = demo.vehicles.findIndex(x=>x.VehicleID===v.VehicleID);
      demo.vehicles[idx] = {...demo.vehicles[idx], ...v, UpdatedAt:nowISO()}; return ok({vehicle:demo.vehicles[idx]});
    }
    const row = { VehicleID:`VEH-${String(demo.vehicles.length+1).padStart(4,"0")}`, VehicleCode:v.VehicleCode||"", VehicleLabel:v.VehicleLabel||"", PlateNo:v.PlateNo||"", PlateEnding:v.PlateEnding||"", Active:v.Active||"Y", CreatedAt:nowISO(), UpdatedAt:nowISO() };
    demo.vehicles.push(row); return ok({vehicle:row});
  }
  if(action === "upsertVehiclePassenger"){
    const vp = {...(body.vehiclePassenger || {})};
    const person = demo.personnel.find(p=>p.PersonnelID===vp.PersonnelID) || {};
    vp.PassengerName = vp.PassengerName || person.PersonnelName || "";
    if(vp.PassengerID && demo.vehiclePassengers.some(x=>x.PassengerID===vp.PassengerID)){
      const idx = demo.vehiclePassengers.findIndex(x=>x.PassengerID===vp.PassengerID);
      demo.vehiclePassengers[idx] = {...demo.vehiclePassengers[idx], ...vp, UpdatedAt:nowISO()}; return ok({vehiclePassenger:demo.vehiclePassengers[idx]});
    }
    const row = { PassengerID:`VP-${String(demo.vehiclePassengers.length+1).padStart(4,"0")}`, VehicleID:vp.VehicleID||"", PersonnelID:vp.PersonnelID||"", PassengerName:vp.PassengerName||"", Active:vp.Active||"Y", CreatedAt:nowISO(), UpdatedAt:nowISO() };
    demo.vehiclePassengers.push(row); return ok({vehiclePassenger:row});
  }
  if(action === "productionBootstrap") return ok(JSON.parse(JSON.stringify(demo)));

  if(action === "saveTeamMembers"){
    const teamId=String(body.teamId||"");
    const selected=new Set((body.personnelIds||[]).map(String));
    demo.personnel.forEach(p=>{
      if(selected.has(String(p.PersonnelID))) p.PrimaryTeamID=teamId;
      else if(String(p.PrimaryTeamID||"")===teamId) p.PrimaryTeamID="";
    });
    demo.teamMembers=demo.personnel.filter(p=>p.PrimaryTeamID).map((p,i)=>({TeamMemberID:`TM-${i+1}`,TeamID:p.PrimaryTeamID,PersonnelID:p.PersonnelID,MemberName:p.PersonnelName,Role:p.Role,Active:p.Active||"Y"}));
    return ok({teamMembers:demo.teamMembers.filter(m=>m.TeamID===teamId)});
  }
  if(action === "productionBootstrapV3"){ const data=JSON.parse(JSON.stringify(demo)); delete data.notes; delete data.logs; data.teamMembers=(data.personnel||[]).filter(p=>p.PrimaryTeamID).map((p,i)=>({TeamMemberID:`TM-${i+1}`,TeamID:p.PrimaryTeamID,PersonnelID:p.PersonnelID,MemberName:p.PersonnelName,Role:p.Role,Active:p.Active||"Y"})); data.vehiclePassengers=[]; data.meta={serverMs:1,version:APP_VERSION,lazyHistory:true,cleanSchema:true}; return ok(data); }
  if(action === "productionBootstrapV2"){
    const data=JSON.parse(JSON.stringify(demo));
    delete data.notes;
    delete data.logs;
    data.meta={serverMs:1,version:APP_VERSION,lazyHistory:true};
    return ok(data);
  }
  if(action === "getProjectHistoryIndex") return ok({projects:[]});
  if(action === "getProjectHistory") return ok({project:null,items:[],history:[],logisticsRequests:[]});
  if(action === "getProjectNotes") return ok({notes:JSON.parse(JSON.stringify(demo.notes.filter(n=>String(n.ProjectID)===String(body.projectId))))});
  if(action === "getItemLogs") return ok({logs:JSON.parse(JSON.stringify(demo.logs.filter(l=>String(l.ItemID)===String(body.itemId))))});
  if(action === "validateAccess") { const pin=String(body.pin||"").trim(); if(pin === (demo.settings.ADMIN_PIN || DEMO_PIN)) return ok({ valid:true, role:"admin" }); if(pin === (demo.settings.OFFICER_PIN || DEMO_OFFICER_PIN)) return ok({ valid:true, role:"officer" }); return ok({ valid:false, role:"staff" }); }
  if(action === "validateAdmin") return ok({ valid: body.pin === (demo.settings.ADMIN_PIN || DEMO_PIN), role: body.pin === (demo.settings.ADMIN_PIN || DEMO_PIN) ? "admin" : "staff" });
  if(action === "createProject"){
    const p = {...(body.project || {}), SONumber:cleanSO((body.project||{}).SONumber)};
    const ProjectID = `PROJ-${String(demo.projects.length+1).padStart(4,"0")}`;
    const row = { ProjectID, ...p, CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" };
    demo.projects.unshift(row);
    (body.items||[]).forEach(it => demo.items.push({ ItemID:`ITEM-${String(demo.items.length+1).padStart(4,"0")}`, ProjectID, SONumber:row.SONumber, ...it, CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" }));
    return ok({project:row});
  }
  if(action === "updateProject"){
    const i = demo.projects.findIndex(x=>x.ProjectID===body.projectId);
    if(i>=0) demo.projects[i] = {...demo.projects[i], ...(body.project||{}), SONumber:cleanSO((body.project||{}).SONumber || demo.projects[i].SONumber), UpdatedAt:nowISO()};
    return ok({project:demo.projects[i]});
  }
  if(action === "saveProjectItems"){
    const project = demo.projects.find(p=>p.ProjectID===body.projectId);
    if(!project) return ok({items:[]});
    const keep = new Set();
    (body.items||[]).forEach(raw=>{
      if(raw.ItemID && demo.items.some(x=>x.ItemID===raw.ItemID)){
        const idx = demo.items.findIndex(x=>x.ItemID===raw.ItemID);
        demo.items[idx] = {...demo.items[idx], ...raw, SONumber:project.SONumber, UpdatedAt:nowISO(), Active:raw.Active || "Y"};
        keep.add(raw.ItemID);
      } else if(String(raw.ItemDescription||"").trim()) {
        const ItemID = `ITEM-${String(demo.items.length+1).padStart(4,"0")}`;
        demo.items.push({ ItemID, ProjectID:project.ProjectID, SONumber:project.SONumber, ...raw, CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" });
        keep.add(ItemID);
      }
    });
    demo.items.forEach(x=>{ if(x.ProjectID===project.ProjectID && !keep.has(x.ItemID)) x.Active="N"; });
    return ok({items:demo.items.filter(x=>x.ProjectID===project.ProjectID && x.Active!=="N")});
  }
  if(action === "addProjectNote"){
    const n = { NoteID:`NOTE-${String(demo.notes.length+1).padStart(4,"0")}`, ...body, CreatedAt:nowISO(), Active:"Y" };
    demo.notes.push(n); return ok({note:n});
  }
  if(action === "moveProductionItem"){
    const item = demo.items.find(x=>x.ItemID===body.itemId); if(!item) throw new Error("Item not found");
    const previous = item.ItemStatus || "";
    demo.logs.filter(l=>l.ItemID===item.ItemID && !l.FinishedAt).forEach(l=>l.FinishedAt=nowISO());
    item.ItemStatus = body.toStatus; item.AssignedTeamID = body.assignedTeamId || item.AssignedTeamID; item.AssignedPersonnel = body.assignedPersonnel; item.UpdatedAt=nowISO();
    const log = { LogID:`LOG-${String(demo.logs.length+1).padStart(4,"0")}`, ItemID:item.ItemID, ProjectID:item.ProjectID, SONumber:item.SONumber, ItemDescription:item.ItemDescription, FromStatus:previous, ToStatus:body.toStatus, AssignedPersonnel:body.assignedPersonnel, StartedAt:nowISO(), FinishedAt:"", MovedBy:body.movedBy||"Admin", Remarks:body.remarks||"", CreatedAt:nowISO(), EditedAt:"", EditedBy:"", CorrectionNote:"" };
    demo.logs.push(log); return ok({item,log});
  }
  if(action === "editProductionLog"){
    const log = demo.logs.find(x=>x.LogID===body.logId);
    if(!log) throw new Error("Production log not found");
    const updates = body.updates || {};
    Object.assign(log, updates, {
      EditedAt: nowISO(),
      EditedBy: body.editedBy || "Admin",
      CorrectionNote: body.CorrectionNote || updates.CorrectionNote || "Corrected in demo mode"
    });
    return ok({log});
  }
  if(action === "submitLogisticsRequest" || action === "submitLogisticsRequestLocal"){
    const r = { RequestID:`REQ-DEMO-${demo.logisticsRequests.length+1}`, Status:"PENDING", DriverCode:"", VehicleCode:"", TripStatus:"READY", ...(body.request||{}) };
    if(r.Payload && r.Payload.SONumber) r.Payload.SONumber = cleanSO(r.Payload.SONumber);
    demo.logisticsRequests.unshift(r); return ok({request:r});
  }
  if(action === "scheduleLogisticsRequest" || action === "scheduleLogisticsRequestLocal"){
    const r = demo.logisticsRequests.find(x=>x.RequestID===body.requestId); if(r) Object.assign(r, body.updates||{}, {Status:"CONFIRMED"}); return ok({request:r});
  }
  if(action === "returnLogisticsRequestPending" || action === "returnLogisticsRequestPendingLocal"){
    const r = demo.logisticsRequests.find(x=>x.RequestID===body.requestId);
    if(!r) throw new Error("Logistics request not found");
    r.Status = "PENDING";
    r.DriverCode = "";
    r.VehicleCode = "";
    r.TripStatus = "READY";
    if(r.Payload){ r.Payload.Passengers=[]; r.Payload.PassengerIDs=[]; r.Payload.Installers=[]; }
    return ok({request:r});
  }
  if(action === "cancelLogisticsRequest" || action === "cancelLogisticsRequestLocal"){
    const r = demo.logisticsRequests.find(x=>x.RequestID===body.requestId);
    if(!r) throw new Error("Logistics request not found");
    r.Status = "CANCELLED";
    r.TripStatus = r.TripStatus || "READY";
    r.Payload = {...(r.Payload||{}), CancelNote: body.note || "Cancelled by admin"};
    return ok({request:r});
  }
  if(action === "deleteLogisticsRequest" || action === "deleteLogisticsRequestLocal"){
    const idx = demo.logisticsRequests.findIndex(x=>x.RequestID===body.requestId);
    if(idx < 0) throw new Error("Logistics request not found");
    const [request] = demo.logisticsRequests.splice(idx,1);
    return ok({request});
  }
  if(action === "markLogisticsRequestDelivered"){
    const r=demo.logisticsRequests.find(x=>x.RequestID===body.requestId); if(!r) throw new Error("Logistics request not found");
    r.Status="DELIVERED"; r.TripStatus="ARRIVED"; r.DeliveredAt=nowISO(); r.DeliveredBy=body.deliveredBy||"Officer";
    const ids=(r.Payload&&Array.isArray(r.Payload.ItemIDs))?r.Payload.ItemIDs:[];
    ids.forEach(id=>{ const item=demo.items.find(i=>i.ItemID===id); if(item){ item.DeliveryStatus="Delivered"; item.DeliveredAt=nowISO(); } });
    return ok({request:r});
  }
  return ok({});
}



/** SJTC Dashboard v3.0.0 — modular source */
function renderOverview(){
  const forDelivery = itemsForDeliveryList();
  const pastDue = activeItems().filter(i=>daysToDue(i.ItemDueDate).cls==="bad" && i.ItemStatus!=="Delivery");
  const todayKey = ymd(new Date());
  const todayLogistics = state.logisticsRequests.filter(r=>r.StartDT && ymd(new Date(r.StartDT))===todayKey);
  const ann = state.announcements.filter(a=>a.Active!=="N");
  $("page-overview").innerHTML = `
    <div class="pageTitle"><div><h1>Overview</h1><div class="hint">Daily production and logistics command center.</div></div></div>
    <button class="primary bigAction" id="overviewSubmitLogistics">+ Submit Logistics Request</button>
    <div class="grid4">
      <div class="stat"><span class="small">Active Projects</span><b>${activeProjects().length}</b></div>
      <div class="stat"><span class="small">Items for Delivery</span><b>${forDelivery.length}</b></div>
      <div class="stat"><span class="small">Past Due Items</span><b>${pastDue.length}</b></div>
      <div class="stat"><span class="small">Today’s Logistics</span><b>${todayLogistics.length}</b></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="panel"><h3>Items for Delivery</h3>${cardList(forDelivery.slice(0,8), itemCard)}</div>
      <div class="panel"><h3>Items Past Due Date</h3>${cardList(pastDue.slice(0,8), itemCard)}</div>
      <div class="panel"><h3>Today’s Logistics Schedules</h3>${cardList(todayLogistics.slice(0,8), logisticsCard)}</div>
      <div class="panel"><h3>Announcement Board</h3>${cardList(ann, a=>`<div class="card"><div class="cardTitle">${escapeHtml(a.Title)}</div><div class="small">${escapeHtml(a.Message)}</div><div class="meta"><span>${escapeHtml(a.PostedBy||"")}</span><span>${niceDT(a.CreatedAt)}</span></div></div>`)}</div>
    </div>`;
  $("overviewSubmitLogistics").onclick = () => openLogisticsRequestModal();
}
function itemCard(i){ const p = state.projects.find(x=>x.ProjectID===i.ProjectID)||{}; const due=daysToDue(i.ItemDueDate); return `<div class="card click" data-open-item="${escapeAttr(i.ItemID)}"><div class="tileSO">${escapeHtml(i.SONumber)} • ${escapeHtml(p.ClientName||"")}</div><div class="cardTitle">${escapeHtml(i.ItemDescription)}</div><div class="meta"><span>${escapeHtml(i.ItemStatus)}</span><span class="pill ${due.cls}">${due.text}</span><span>Team: ${escapeHtml(teamName(i.AssignedTeamID))}</span></div></div>`; }
function getPersonByNameOrId(value){
  const raw = String(value || "").trim();
  if(!raw) return null;
  return state.personnel.find(p =>
    String(p.PersonnelID||"") === raw ||
    String(personName(p)||"").trim().toLowerCase() === raw.toLowerCase()
  ) || null;
}
function displayPerson(value){
  const p = getPersonByNameOrId(value);
  return p ? personName(p) : String(value || "").trim();
}
function getVehicleByValue(value){
  const raw = String(value || "").trim();
  if(!raw) return null;
  return state.vehicles.find(v =>
    String(v.VehicleID||"") === raw ||
    String(v.VehicleCode||"") === raw ||
    String(v.VehicleLabel||"").trim().toLowerCase() === raw.toLowerCase()
  ) || null;
}
function displayVehicle(value){
  const v = getVehicleByValue(value);
  if(!v) return String(value || "").trim();
  const label = String(v.VehicleLabel || v.VehicleCode || "").trim();
  const plate = String(v.PlateNo || v.PlateNumber || "").trim();
  return [label, plate].filter(Boolean).join(" - ");
}
function logisticsPrimaryTitle(r){
  const p = r.Payload || {};
  const so = cleanSO(p.SONumber);
  const client = String(p.ClientName || "").trim();
  if(so && client) return `${so} - ${client}`;
  if(so) return so;
  if(client) return client;
  return displayType(r.Type) || "Logistics Request";
}
function logisticsAddressLine(r){
  const p = r.Payload || {};
  return String(p.Address || p.Destination || "").trim();
}
function logisticsCard(r){
  const address = logisticsAddressLine(r);
  const vehicle = displayVehicle(r.VehicleCode);
  const driver = displayPerson(r.DriverCode);
  return `<div class="card logisticsCard compactLogisticsTile" draggable="${canOfficer()}" data-logreq="${escapeAttr(r.RequestID)}" data-open-logreq="${escapeAttr(r.RequestID)}">
    <div class="logTitle">${escapeHtml(logisticsPrimaryTitle(r))}</div>
    <div class="logType">${escapeHtml(displayType(r.Type))}</div>
    ${address ? `<div class="logLine">📍 ${escapeHtml(address)}</div>` : ""}
    ${vehicle ? `<div class="logLine">🚚 ${escapeHtml(vehicle)}</div>` : ""}
    ${driver ? `<div class="logLine">👤 ${escapeHtml(driver)}</div>` : ""}
  </div>`;
}


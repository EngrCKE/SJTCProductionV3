/** SJTC Dashboard v3.0.0 — modular source */
function renderLogistics(){
  const dates=currentWeekDates();
  const pending=state.logisticsRequests.filter(r=>r.Status==="PENDING");
  const scheduled=state.logisticsRequests.filter(r=>r.Status!=="PENDING");
  const deliveryItems = itemsForDeliveryList();
  $("page-logistics").innerHTML = `
    <div class="pageTitle"><div><h1>Logistics</h1><div class="hint">Native logistics module. Staff can submit and view requests. Officer/Admin can schedule or reschedule by drag/drop.</div></div><button class="primary" id="btnSubmitLogisticsTop">+ Submit Logistics Request</button></div>
    <div class="split logisticsSplit"><div class="panel logisticsPendingPanel"><h3>Pending Requests</h3><div class="hint">${canOfficer() ? "Drag pending cards into a calendar day to schedule. Click any card to view details." : "Read-only: pending requests awaiting approval/scheduling. Click any card to view details."}</div><div class="pendingList" style="margin-top:10px">${pending.map(pendingLogisticsCard).join("") || `<div class="hint">No pending requests.</div>`}</div></div>
      <div class="panel logisticsCalendarPanel"><div class="line" style="justify-content:space-between"><h3>1-Week Rolling Calendar</h3><div class="line"><button id="logPrev">← Previous Week</button><button class="primary" id="logCurrent">Current Week</button><button id="logNext">Next Week →</button></div></div><div class="hint">${canOfficer() ? "Drag scheduled cards to a different day to reschedule." : "Read-only weekly logistics calendar."}</div><div class="calendarGrid">${dates.map(d=>logisticsDayBox(d,scheduled)).join("")}</div></div></div>
    <div class="panel" style="margin-top:12px"><div class="line" style="justify-content:space-between"><div><h3>Dispatch & Gate Pass</h3><div class="hint">View confirmed dispatches for the selected week and print gate passes.</div></div><div class="line"><button class="primary" id="btnOpenDispatchView">Open Dispatch View</button><button class="ok" id="btnPrintGatePasses">Generate Gate Pass</button></div></div></div>
    <div class="panel" style="margin-top:12px">
      <div class="line" style="justify-content:space-between;align-items:flex-start">
        <div><h3>Items for Delivery</h3><div class="hint">Click an item to open the same Project Details popup used in the Projects tab.</div></div>
        <span class="badge">${deliveryItems.length} item${deliveryItems.length===1?"":"s"}</span>
      </div>
      <div class="deliveryItemList" style="margin-top:10px">${deliveryItems.map(deliveryItemLogisticsCard).join("") || `<div class="hint">No items currently marked for delivery.</div>`}</div>
    </div>`;
  $("btnSubmitLogisticsTop").onclick=()=>openLogisticsRequestModal();
  $("logPrev").onclick=()=>{state.logisticsOffsetWeeks--;renderLogistics();};
  $("logCurrent").onclick=()=>{state.logisticsOffsetWeeks=0;renderLogistics();};
  $("logNext").onclick=()=>{state.logisticsOffsetWeeks++;renderLogistics();};
  bindLogisticsDnD();
  bindLogisticsDetailOpeners();
  bindDeliveryItemProjectOpeners();
  if($("btnOpenDispatchView")) $("btnOpenDispatchView").onclick=(e)=>runAction(e,"Preparing dispatch view...", async()=>openDispatchView());
  if($("btnPrintGatePasses")) $("btnPrintGatePasses").onclick=(e)=>runAction(e,"Preparing gate passes...", async()=>printGatePassesForCurrentWeek());
}
function itemsForDeliveryList(){
  // Only show items that are actually in the Kanban Delivery column.
  // Do not show QC, scheduled-only, delivered, installed, cancelled, or other in-process items here.
  return state.items
    .filter(i=>{
      const ds = String(i.DeliveryStatus || "Not Requested");
      return i.Active!=="N" && String(i.ItemStatus||"") === "Delivery" && !["Delivered","Installed","Cancelled"].includes(ds);
    })
    .sort((a,b)=>{
      const ap = state.projects.find(p=>p.ProjectID===a.ProjectID)||{};
      const bp = state.projects.find(p=>p.ProjectID===b.ProjectID)||{};
      return String(a.DeliveryStatus||"").localeCompare(String(b.DeliveryStatus||"")) || new Date(ap.DueDate||a.ItemDueDate||0) - new Date(bp.DueDate||b.ItemDueDate||0);
    });
}
function deliveryItemLogisticsCard(i){
  const p = state.projects.find(x=>x.ProjectID===i.ProjectID)||{};
  const due = daysToDue(i.ItemDueDate || p.DueDate);
  return `<div class="card click deliveryItemCard" data-open-delivery-project="${escapeAttr(i.ProjectID)}">
    <div class="tileSO">${escapeHtml(i.SONumber)} • ${escapeHtml(p.ClientName||"")}</div>
    <div class="cardTitle">${escapeHtml(i.ItemDescription)}</div>
    <div class="meta"><span>${escapeHtml(i.ItemStatus||"—")}</span><span>${escapeHtml(i.DeliveryStatus||"Not Requested")}</span><span class="pill ${due.cls}">${due.text}</span><span>Team: ${escapeHtml(teamName(i.AssignedTeamID))}</span></div>
  </div>`;
}
function bindDeliveryItemProjectOpeners(){
  document.querySelectorAll("[data-open-delivery-project]").forEach(el=>{
    el.addEventListener("click", ()=>openProjectFromLogistics(el.dataset.openDeliveryProject));
  });
}
function openProjectFromLogistics(projectId){
  state.page = "projects";
  render();
  openProjectDetails(projectId);
}
function pendingLogisticsCard(r){ return logisticsCard(r); }
function logisticsDayBox(d,list){ const key=ymd(d); const today=key===ymd(new Date()); const items=list.filter(r=>r.StartDT && ymd(new Date(r.StartDT))===key); return `<div class="dayBox ${today?"today":""}"><div class="dayHead2">${d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}${today?" • Today":""}</div><div class="dayBody2" data-logday="${key}">${items.map(logisticsCard).join("") || `<div class="small">No schedules.</div>`}</div></div>`; }
function displayType(type){ return type === "Travel" || type === "Client Call" ? "Client Call" : (type || ""); }
function bindLogisticsDnD(){
  if(!canOfficer()) return;
  document.querySelectorAll("[data-logreq]").forEach(c=>c.addEventListener("dragstart",e=>{
    e.dataTransfer.setData("text/logreq",c.dataset.logreq);
  }));
  document.querySelectorAll("[data-logday]").forEach(z=>{
    z.addEventListener("dragover",e=>{e.preventDefault();z.classList.add("dragOver")});
    z.addEventListener("dragleave",()=>z.classList.remove("dragOver"));
    z.addEventListener("drop",e=>{
      e.preventDefault(); z.classList.remove("dragOver");
      const requestId=e.dataTransfer.getData("text/logreq");
      if(requestId) openScheduleModal(requestId,z.dataset.logday);
    });
  });
}
function bindLogisticsDetailOpeners(){
  document.querySelectorAll("[data-open-logreq]").forEach(el=>{
    el.addEventListener("click", e=>{
      if(e.target && e.target.closest && e.target.closest("input,button,select,textarea")) return;
      openLogisticsDetailModal(el.dataset.openLogreq);
    });
  });
}
function driverOptions(selected=""){
  const sel = String(selected || "");
  return `<option value="">Select driver</option>` + driverPeople().map(p=>{
    const val = p.PersonnelID || personName(p);
    const selectedAttr = [p.PersonnelID, personName(p)].map(String).includes(sel) ? "selected" : "";
    return `<option value="${escapeAttr(val)}" ${selectedAttr}>${escapeHtml(personName(p))}</option>`;
  }).join("");
}
function vehicleOptions(selected=""){
  const sel = String(selected || "");
  return `<option value="">Select vehicle</option>` + state.vehicles.map(v=>{
    const val = v.VehicleID || v.VehicleCode;
    const selectedAttr = [v.VehicleID, v.VehicleCode, v.VehicleLabel].map(String).includes(sel) ? "selected" : "";
    return `<option value="${escapeAttr(val)}" ${selectedAttr}>${escapeHtml(displayVehicle(val))}</option>`;
  }).join("");
}
function personnelName(id){ const p=state.personnel.find(x=>x.PersonnelID===id); return p ? (p.PersonnelName || p.FullName || p.Name || "") : ""; }
function selectedPassengerNames(){
  return Array.from(document.querySelectorAll(".schedPassenger:checked")).map(x=>x.dataset.name || x.value).filter(Boolean);
}
function selectedPassengerIds(){
  return Array.from(document.querySelectorAll(".schedPassenger:checked")).map(x=>x.value).filter(Boolean);
}
function passengerPicker(selectedNames=[]){
  const selectedSet=new Set((selectedNames||[]).map(String));
  const groups = groupByDepartment(activePersonnelSorted());
  if(!groups.length) return `<div class="hint">No active personnel records yet.</div>`;
  return `<div class="personnelDeptPicker">${groups.map((g,idx)=>`
    <details class="deptPickGroup">
      <summary>${escapeHtml(g.dept)} <span class="badge">${g.items.length}</span></summary>
      <div class="personnelPicker compactDeptPicker">
        ${g.items.map(p=>{ const checked=selectedSet.has(personName(p)) || selectedSet.has(p.PersonnelID); return `<label class="personnelPick"><input type="checkbox" class="schedPassenger" value="${escapeAttr(p.PersonnelID)}" data-name="${escapeAttr(personName(p))}" ${checked?"checked":""}/> <span>${escapeHtml(personName(p))} <span class="small">${escapeHtml(p.Role||"")}</span></span></label>`; }).join("")}
      </div>
    </details>`).join("")}</div>`;
}
function normalizePassengers(payload){
  const raw = payload && (payload.Passengers || payload.Installers || payload.Personnel || payload.PassengerIDs || "");
  const resolve = x => {
    if(x && typeof x === "object") return x.PersonnelName || x.InstallerName || x.name || x.Name || displayPerson(x.PersonnelID || x.InstallerCode || "");
    return displayPerson(String(x || ""));
  };
  if(Array.isArray(raw)) return raw.map(resolve).filter(Boolean);
  return String(raw||"").split(",").map(x=>displayPerson(x.trim())).filter(Boolean);
}
function openScheduleModal(requestId,date){
  const r=state.logisticsRequests.find(x=>x.RequestID===requestId); if(!r)return;
  state.pendingScheduleId=requestId;
  const scheduled = r.Status !== "PENDING";
  const currentDate = date || (r.StartDT ? ymd(new Date(r.StartDT)) : ymd(new Date()));
  const currentTime = r.StartDT ? new Date(r.StartDT).toTimeString().slice(0,5) : "08:00";
  const passengers = normalizePassengers(r.Payload||{}).concat(((r.Payload||{}).PassengerIDs||[]));
  $("logisticsScheduleBody").innerHTML=`<div class="panel">${logisticsCard(r)}<div class="hint" style="margin-top:6px">${scheduled ? "You are rescheduling an existing confirmed request." : "You are scheduling a pending request."}</div></div><div class="twoCol"><div><label>Date</label><input id="schedDate" type="date" value="${currentDate}" /></div><div><label>Time</label><input id="schedTime" type="time" value="${currentTime}" /></div><div><label>Driver</label><select id="schedDriver">${driverOptions(r.DriverCode||"")}</select></div><div><label>Vehicle</label><select id="schedVehicle">${vehicleOptions(r.VehicleCode||"")}</select></div></div><div><label>Passengers / Personnel / Installers</label><div class="hint">Select from the Personnel database.</div>${passengerPicker(passengers)}</div><div><label>Remarks</label><textarea id="schedRemarks">${escapeHtml((r.Payload||{}).Notes||"")}</textarea></div>`;
  openModal("logisticsScheduleModal");
}
async function confirmSchedule(){
  const r=state.logisticsRequests.find(x=>x.RequestID===state.pendingScheduleId); if(!r)return;
  const start=new Date(`${$("schedDate").value}T${$("schedTime").value}:00`); const end=new Date(start.getTime()+4*3600000);
  const passengerNames=selectedPassengerNames();
  const passengerIds=selectedPassengerIds();
  const updates={Status:"CONFIRMED",StartDT:start.toISOString(),EndDT:end.toISOString(),DriverCode:$("schedDriver").value.trim(),VehicleCode:$("schedVehicle").value.trim(),Payload:{...(r.Payload||{}),Passengers:passengerNames,PassengerIDs:passengerIds,Installers:passengerNames,Notes:$("schedRemarks").value.trim()}};
  await api("scheduleLogisticsRequest", { pin: accessPin(), requestId:r.RequestID, updates });
  closeModal("logisticsScheduleModal"); await load();
}
async function returnLogisticsRequestToPending(requestId){
  if(!canOfficer()) return alert(requireOfficerMessage());
  if(!confirm("Return this logistics request to PENDING? Driver, vehicle, and passenger assignments will be cleared.")) return;
  try{
    await api("returnLogisticsRequestPending", { pin: accessPin(), requestId });
    closeModal("logisticsDetailModal"); await load();
  }catch(e){ alert("Failed to return request to pending: " + (e.message||e)); }
}
async function cancelLogisticsRequest(requestId){
  if(!state.admin) return alert("Admin mode is required.");
  const note = prompt("Cancellation note/reason:", "Cancelled by admin");
  if(note === null) return;
  if(!confirm("Cancel this logistics request?")) return;
  try{
    const existing = state.logisticsRequests.find(x=>x.RequestID===requestId) || {};
    const payload = {...(existing.Payload||{}), CancelNote:note};
    await api("cancelLogisticsRequest", { pin: accessPin(), requestId, note });
    closeModal("logisticsDetailModal"); await load();
  }catch(e){ alert("Failed to cancel request: " + (e.message||e)); }
}
async function deleteLogisticsRequest(requestId){
  if(!state.admin) return alert("Admin mode is required.");
  if(!confirm("Delete this logistics request permanently from this dashboard? This is stronger than cancelling.")) return;
  if(!confirm("Please confirm again. Deleted requests cannot be restored from the app.")) return;
  try{
    await api("deleteLogisticsRequest", { pin: accessPin(), requestId });
    closeModal("logisticsDetailModal"); await load();
  }catch(e){ alert("Failed to delete request: " + (e.message||e)); }
}

async function markLogisticsRequestDelivered(requestId){
  if(!canOfficer()) return alert(requireOfficerMessage());
  const r = state.logisticsRequests.find(x=>x.RequestID===requestId);
  if(!r) return alert("Logistics request not found.");
  const p = r.Payload || {};
  const items = Array.isArray(p.ItemDetails) && p.ItemDetails.length
    ? p.ItemDetails.map(x=>x.ItemDescription || x.ItemID).filter(Boolean)
    : splitMultiValue(p.Items);
  const itemText = items.length ? "\n\nItems:\n- " + items.join("\n- ") : "";
  const confirmedBy = prompt("Confirmed delivered by:", state.accessLevel === "admin" ? "Admin" : "Officer");
  if(confirmedBy === null) return;
  const name = String(confirmedBy || "").trim();
  if(!name) return alert("Please enter the name/signature of the person confirming delivery.");
  if(!confirm("Mark this logistics request as DELIVERED?" + itemText)) return;
  try{
    await api("markLogisticsRequestDelivered", { pin: accessPin(), requestId, deliveredBy:name });
    closeModal("logisticsDetailModal");
    state.historyLoaded=false;
    await load({silent:true});
    alert("Delivery confirmed. Delivered items were removed from the active Kanban. Fully delivered projects are now in Project History.");
  }catch(e){
    alert("Failed to mark as delivered: " + (e.message || e));
  }
}
function openLogisticsDetailModal(requestId){
  const r=state.logisticsRequests.find(x=>x.RequestID===requestId); if(!r) return;
  const p=r.Payload||{};
  $("logisticsDetailStatus").textContent = r.Status || "";
  $("logisticsDetailTitle").textContent = logisticsPrimaryTitle(r);
  const passengers = normalizePassengers(p);
  const itemList = splitMultiValue(p.Items);
  const scheduleHtml = `<div class="requestDetailBox"><h3>Schedule</h3>${detail("Date", r.StartDT ? new Date(r.StartDT).toLocaleDateString() : "—")}${detail("Time", r.StartDT && r.EndDT ? `${new Date(r.StartDT).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}–${new Date(r.EndDT).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}` : "—")}${detail("Driver", displayPerson(r.DriverCode) || "—")}${detail("Vehicle", displayVehicle(r.VehicleCode) || "—")}${detailList("Passengers / Installers", passengers)}${detail("Trip", r.TripStatus || "READY")}</div>`;
  const requestHtml = `<div class="requestDetailBox"><h3>Request</h3>${detail("Type", displayType(r.Type))}${detail("Status", r.Status)}${detail("Requested By", r.RequestedBy)}${detail("SO#", cleanSO(p.SONumber)||"—")}${detail("Client", p.ClientName||"—")}${detail("Contact", p.ContactNumber||"—")}${detail("Address/Destination", p.Address||p.Destination||"—")}${detail("Area", p.AreaClass||"—")}${detailList("Items", itemList)}${detail("Purpose", p.Purpose||"—")}${detail("Required Vehicle", p.RequiredVehicle||"—")}${detail("Notes", p.Notes||"—")}</div>`;
  $("logisticsDetailBody").innerHTML = `<div class="detailGrid">${requestHtml}${scheduleHtml}</div>`;
  const statusUpper = String(r.Status || "").toUpperCase();
  const canMarkDelivered = canOfficer() && !["DELIVERED","CANCELLED"].includes(statusUpper);
  $("logisticsDetailFooter").innerHTML = `<button data-close="logisticsDetailModal">Close</button>${canOfficer()?`<button class="primary" id="btnEditLogisticsFromDetail">Edit / Reschedule</button><button id="btnReturnLogisticsPending">Return to Pending</button>`:""}${canMarkDelivered?`<button class="ok" id="btnMarkLogisticsDelivered">Mark as Delivered</button>`:""}${state.admin?`<button class="danger" id="btnCancelLogisticsRequest">Cancel Request</button><button class="danger" id="btnDeleteLogisticsRequest">Delete Request</button>`:""}`;
  bindCloseButtons();
  if(canOfficer() && $("btnEditLogisticsFromDetail")) $("btnEditLogisticsFromDetail").onclick=()=>{ closeModal("logisticsDetailModal"); openScheduleModal(requestId, r.StartDT ? ymd(new Date(r.StartDT)) : ymd(new Date())); };
  if(canOfficer() && $("btnReturnLogisticsPending")) $("btnReturnLogisticsPending").onclick=()=>returnLogisticsRequestToPending(requestId);
  if(canMarkDelivered && $("btnMarkLogisticsDelivered")) $("btnMarkLogisticsDelivered").onclick=(e)=>runAction(e,"Marking delivered...",async()=>markLogisticsRequestDelivered(requestId));
  if(state.admin && $("btnCancelLogisticsRequest")) $("btnCancelLogisticsRequest").onclick=()=>cancelLogisticsRequest(requestId);
  if(state.admin && $("btnDeleteLogisticsRequest")) $("btnDeleteLogisticsRequest").onclick=()=>deleteLogisticsRequest(requestId);
  openModal("logisticsDetailModal");
}
function openLogisticsRequestModal(projectId="", selectedItemIds=[]){
  const p = projectId ? state.projects.find(x=>x.ProjectID===projectId) : null;
  const selected = p ? projectItems(p.ProjectID).filter(i=> selectedItemIds.length ? selectedItemIds.includes(i.ItemID) : String(i.ItemStatus||"")==="Delivery" && !isDeliveredItem(i)) : [];
  $("logisticsRequestBody").innerHTML = `<div class="twoCol"><div><label>Request Type</label><select id="lrType">${REQUEST_TYPES.map(t=>`<option>${t}</option>`).join("")}</select></div><div><label>Requestor Name</label><input id="lrRequestedBy" value="Production" /></div><div><label>Date</label><input id="lrDate" type="date" value="${ymd(new Date())}" /></div><div><label>Time</label><input id="lrTime" type="time" value="08:00" /></div></div><div id="lrTypeFields"></div>`;
  setLogisticsTypeFields(p, selected);
  $("lrType").onchange=()=>setLogisticsTypeFields(p, selected);
  openModal("logisticsRequestModal");
}
function findProjectBySO(so){
  const key = cleanSO(so);
  if(!key) return null;
  return state.projects.find(p=>cleanSO(p.SONumber) === key) || null;
}
function selectableDeliveryItems(projectId){
  return projectItems(projectId).filter(i=>i.Active!=="N" && String(i.ItemStatus||"")==="Delivery" && !isDeliveredItem(i));
}
function itemDefaultChecked(i){
  return String(i.ItemStatus||"")==="Delivery" && !isDeliveredItem(i);
}
function renderDeliveryItemPicker(project, preselectedIds=[]){
  const box = $("lrItemPicker");
  if(!box) return;
  if(!project){
    box.innerHTML = `<div class="hint">Enter an SO# to auto-fill project details and choose specific items for delivery.</div>`;
    syncDeliveryItemsTextarea();
    return;
  }
  const items = selectableDeliveryItems(project.ProjectID);
  if(!items.length){
    box.innerHTML = `<div class="hint">No active deliverable items found for SO# ${escapeHtml(cleanSO(project.SONumber))}.</div>`;
    syncDeliveryItemsTextarea();
    return;
  }
  const selected = new Set((preselectedIds||[]).map(String));
  box.innerHTML = `
    <div class="line" style="justify-content:space-between;margin-bottom:8px">
      <h3 style="margin:0">Select Items to Deliver</h3>
      <div class="line"><button type="button" id="lrSelectAllItems">Select all</button><button type="button" id="lrClearItems">Clear</button></div>
    </div>
    <div class="hint" style="margin-bottom:8px">Tick only the items included in this delivery request. This supports partial delivery per SO#.</div>
    ${items.map(i=>{
      const checked = selected.size ? selected.has(String(i.ItemID)) : itemDefaultChecked(i);
      return `<label class="checkLine compactCheck"><input type="checkbox" class="lrSelectedItem" value="${escapeAttr(i.ItemID)}" ${checked?"checked":""} /> <span><b>${escapeHtml(i.ItemDescription)}</b> <span class="small">${escapeHtml(i.Quantity||"")} ${escapeHtml(i.Unit||"")} • ${escapeHtml(i.ItemStatus||"—")} • ${escapeHtml(i.DeliveryStatus||"Not Requested")}</span></span></label>`;
    }).join("")}
  `;
  box.querySelectorAll(".lrSelectedItem").forEach(ch=>ch.addEventListener("change", syncDeliveryItemsTextarea));
  if($("lrSelectAllItems")) $("lrSelectAllItems").onclick=()=>{ box.querySelectorAll(".lrSelectedItem").forEach(ch=>ch.checked=true); syncDeliveryItemsTextarea(); };
  if($("lrClearItems")) $("lrClearItems").onclick=()=>{ box.querySelectorAll(".lrSelectedItem").forEach(ch=>ch.checked=false); syncDeliveryItemsTextarea(); };
  syncDeliveryItemsTextarea();
}
function getCheckedDeliveryItems(){
  const ids = Array.from(document.querySelectorAll(".lrSelectedItem:checked")).map(x=>x.value);
  return ids.map(id=>state.items.find(i=>String(i.ItemID)===String(id))).filter(Boolean);
}
function syncDeliveryItemsTextarea(){
  const ta = $("lrItems");
  if(!ta) return;
  const items = getCheckedDeliveryItems();
  ta.value = items.map(i=>i.ItemDescription).join("\n");
}
function autoFillDeliveryFromSO(preselectedIds=[]){
  const so = val("lrSO");
  const project = findProjectBySO(so);
  const status = $("lrSOStatus");
  if(!project){
    if(status) status.textContent = so ? "No matching project found." : "";
    renderDeliveryItemPicker(null);
    return null;
  }
  if($("lrProjectID")) $("lrProjectID").value = project.ProjectID || "";
  if($("lrClient")) $("lrClient").value = project.ClientName || "";
  if($("lrContact")) $("lrContact").value = project.ContactNumber || "";
  if($("lrAddress")) $("lrAddress").value = project.DeliveryAddress || projectSiteAddress(project) || "";
  if(status) status.textContent = `Auto-filled from SO# ${cleanSO(project.SONumber)}.`;
  renderDeliveryItemPicker(project, preselectedIds);
  return project;
}
function bindDeliveryAutofill(project=null, preselectedItems=[]){
  const so = $("lrSO");
  if(!so) return;
  const selectedIds = (preselectedItems||[]).map(i=>i.ItemID);
  so.addEventListener("change", ()=>autoFillDeliveryFromSO());
  so.addEventListener("input", debounce(()=>autoFillDeliveryFromSO(), 250));
  if(project) autoFillDeliveryFromSO(selectedIds);
  else renderDeliveryItemPicker(null);
}
function setLogisticsTypeFields(project=null, selectedItems=[]){
  const type=$("lrType").value; const wrap=$("lrTypeFields");
  if(type==="Delivery"){
    wrap.innerHTML=`<input type="hidden" id="lrProjectID" value="${escapeAttr(project?.ProjectID||"")}" /><div class="twoCol"><div><label title="Type the SO number only. The app will auto-fill client, contact, address, and item list when a matching project is found.">SO# / Number only</label><input id="lrSO" value="${escapeAttr(project?.SONumber||"")}" placeholder="Example: 3564" /><div class="hint" id="lrSOStatus"></div></div><div><label>Client Name</label><input id="lrClient" value="${escapeAttr(project?.ClientName||"")}" /></div><div><label>Contact Number</label><input id="lrContact" value="${escapeAttr(project?.ContactNumber||"")}" /></div><div><label>Delivery Address</label><input id="lrAddress" value="${escapeAttr(project?.DeliveryAddress || projectSiteAddress(project) || "")}" /></div><div><label>Area</label><select id="lrArea"><option value="NON_NCR">Non-NCR</option><option value="NCR">NCR</option></select></div></div><div class="panel" id="lrItemPicker"></div><div><label>Items to Deliver</label><textarea id="lrItems" readonly placeholder="Selected items will appear here automatically."></textarea></div><div><label>Special Instructions</label><textarea id="lrNotes"></textarea></div>`;
    bindDeliveryAutofill(project, selectedItems);
  } else if(type==="Client Call"){
    wrap.innerHTML=`<div class="twoCol"><div><label>Client Name</label><input id="lrClient" value="${escapeAttr(project?.ClientName||"")}" /></div><div><label>Destination</label><input id="lrDestination" value="${escapeAttr(project?.DeliveryAddress || projectSiteAddress(project) || "")}" /></div><div><label>Area</label><select id="lrArea"><option value="NON_NCR">Non-NCR</option><option value="NCR">NCR</option></select></div></div><div><label>Special Instructions</label><textarea id="lrNotes"></textarea></div>`;
  } else {
    wrap.innerHTML=`<div class="twoCol"><div><label>Client Name (optional)</label><input id="lrClient" value="${escapeAttr(project?.ClientName||"")}" /></div><div><label>Destination</label><input id="lrDestination" value="${escapeAttr(project?.DeliveryAddress || projectSiteAddress(project) || "")}" /></div><div><label>Area</label><select id="lrArea"><option value="NON_NCR">Non-NCR</option><option value="NCR">NCR</option></select></div><div><label>Purpose</label><select id="lrPurpose"><option>Purchasing</option><option>Item Pick-up</option><option>Installation / Servicing</option></select></div><div><label>Required Vehicle</label><select id="lrVehicleReq"><option>Car</option><option>Pick-Up</option><option>Van</option><option>Truck</option><option>Others</option></select></div></div><div><label>Special Instructions</label><textarea id="lrNotes"></textarea></div>`;
  }
}
function val(id){ const el=$(id); return el ? el.value.trim() : ""; }
async function submitLogisticsRequest(){
  const type=$("lrType").value; const date=val("lrDate"), time=val("lrTime"); const start=new Date(`${date}T${time}:00`), end=new Date(start.getTime()+4*3600000);
  let payload={};
  if(type==="Delivery"){
    const selectedItems = getCheckedDeliveryItems();
    payload={ SONumber:cleanSO(val("lrSO")), ProjectID:val("lrProjectID"), ClientName:val("lrClient"), ContactNumber:val("lrContact"), Address:val("lrAddress"), Items:val("lrItems"), ItemIDs:selectedItems.map(i=>i.ItemID), ItemDetails:selectedItems.map(i=>({ItemID:i.ItemID, ItemDescription:i.ItemDescription, Quantity:i.Quantity, Unit:i.Unit})), Notes:val("lrNotes"), AreaClass:val("lrArea")||"NON_NCR" };
  }
  else if(type==="Client Call") payload={ ClientName:val("lrClient"), Destination:val("lrDestination"), Notes:val("lrNotes"), AreaClass:val("lrArea")||"NON_NCR" };
  else payload={ ClientName:val("lrClient"), Destination:val("lrDestination"), Purpose:val("lrPurpose"), RequiredVehicle:val("lrVehicleReq"), Notes:val("lrNotes"), AreaClass:val("lrArea")||"NON_NCR" };
  const request={ Type:type, Status:"PENDING", RequestedBy:val("lrRequestedBy"), ViberUserID:"PRODUCTION-DASHBOARD", StartDT:start.toISOString(), EndDT:end.toISOString(), Payload:payload, TripStatus:"READY", DriverCode:"", VehicleCode:"" };
  if(!request.RequestedBy || !date || !time) return alert("Requestor, date, and time are required.");
  if(type==="Delivery" && (!payload.SONumber || !payload.ClientName || !payload.Address || !payload.Items)) return alert("For Delivery, SO#, client, address, and items are required.");
  if(type==="Client Call" && (!payload.ClientName || !payload.Destination)) return alert("For Client Call, client and destination are required.");
  if(type==="Service" && (!payload.Destination || !payload.Purpose || !payload.RequiredVehicle)) return alert("For Service, destination, purpose, and required vehicle are required.");
  try{
    const res = await api("submitLogisticsRequest", { request });
    closeModal("logisticsRequestModal");
    await load({silent:true});
    alert("Logistics request submitted as PENDING.");
  }catch(e){ alert("Failed to submit logistics request: "+(e.message||e)); }
}


function currentWeekConfirmedRequests(){
  const dates=currentWeekDates();
  const start=dates[0]; const end=new Date(dates[6]); end.setDate(end.getDate()+1);
  return state.logisticsRequests.filter(r=>String(r.Status||"").toUpperCase()==="CONFIRMED" && r.StartDT && new Date(r.StartDT)>=start && new Date(r.StartDT)<end).sort((a,b)=>new Date(a.StartDT)-new Date(b.StartDT));
}
function openDispatchView(){
  const confirmed=currentWeekConfirmedRequests();
  const groups={};
  confirmed.forEach(r=>{
    const k=`${ymd(new Date(r.StartDT))}||${r.DriverCode||"Unassigned"}||${r.VehicleCode||"Unassigned"}`;
    (groups[k] ||= []).push(r);
  });
  const html = Object.entries(groups).map(([k,list])=>{
    const [date,driver,vehicle]=k.split("||");
    return `<div class="requestDetailBox"><h3>${escapeHtml(new Date(date+"T00:00:00").toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}))}</h3><div class="small"><b>Driver:</b> ${escapeHtml(displayPerson(driver)||"—")} &nbsp; <b>Vehicle:</b> ${escapeHtml(displayVehicle(vehicle)||"—")}</div><div style="display:grid;gap:8px;margin-top:8px">${list.map(r=>logisticsCard(r)).join("")}</div></div>`;
  }).join("") || `<div class="hint">No confirmed dispatches for this week.</div>`;
  $("logisticsDetailTitle").textContent="Dispatch View";
  $("logisticsDetailStatus").textContent=`${confirmed.length} confirmed`;
  $("logisticsDetailBody").innerHTML=html;
  $("logisticsDetailFooter").innerHTML=`<button data-close="logisticsDetailModal">Close</button><button class="ok" id="btnPrintDispatchGatePasses">Print Gate Passes</button>`;
  bindCloseButtons();
  $("btnPrintDispatchGatePasses").onclick=(e)=>runAction(e,"Preparing gate passes...",async()=>printGatePassesForCurrentWeek());
  bindLogisticsDetailOpeners();
  openModal("logisticsDetailModal");
}
function gatePassSlipHTML(r){
  const p=r.Payload||{};
  const passengers=normalizePassengers(p).join(", ") || "—";
  const date=r.StartDT ? new Date(r.StartDT).toLocaleDateString() : "";
  const time=r.StartDT ? new Date(r.StartDT).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}) : "";
  return `<section class="gpSlip"><h2>SJTC MANUFACTURING INC.</h2><h3>GATE PASS</h3><p><b>Date:</b> ${escapeHtml(date)} &nbsp; <b>Time:</b> ${escapeHtml(time)}</p><p><b>Vehicle:</b> ${escapeHtml(displayVehicle(r.VehicleCode)||"—")} &nbsp; <b>Driver:</b> ${escapeHtml(displayPerson(r.DriverCode)||"—")}</p><p><b>SO#:</b> ${escapeHtml(cleanSO(p.SONumber)||"—")} &nbsp; <b>Client:</b> ${escapeHtml(p.ClientName||"—")}</p><p><b>Itinerary:</b> ${escapeHtml(p.Address||p.Destination||"—")}</p><p><b>Items/Purpose:</b> ${escapeHtml(p.Items||p.Purpose||displayType(r.Type)||"—")}</p><p><b>Passengers/Personnel:</b> ${escapeHtml(passengers)}</p><p><b>Remarks:</b> ${escapeHtml(p.Notes||"—")}</p><div class="gpSign"><span>Requested by: ${escapeHtml(r.RequestedBy||"")}</span><span>Approved by: __________________</span></div></section>`;
}
function printGatePassesForCurrentWeek(){
  const list=currentWeekConfirmedRequests();
  if(!list.length){ alert("No confirmed dispatches for the selected week."); return; }
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Gate Passes</title><style>@page{size:Letter;margin:.35in}body{font-family:Arial,sans-serif;color:#111}.sheet{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gpSlip{border:1px solid #333;border-radius:10px;padding:10px;min-height:3.1in;break-inside:avoid}.gpSlip h2,.gpSlip h3{text-align:center;margin:2px 0}.gpSlip h2{font-size:13px}.gpSlip h3{font-size:12px}.gpSlip p{font-size:11px;line-height:1.25;margin:6px 0}.gpSign{display:flex;justify-content:space-between;gap:10px;margin-top:18px;font-size:11px}</style></head><body><div class="sheet">${list.map(gatePassSlipHTML).join("")}</div><script>window.onload=()=>window.print();<\/script></body></html>`;
  const w=window.open("","_blank");
  if(!w){ alert("Pop-up blocked. Please allow pop-ups to print gate passes."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}


/** SJTC Dashboard v3.0.8 — draggable collapsed SO groups + full-height drop zones */
function processNamesForStage(stage){
  return [...(stage.processes || []), ...(stage.legacyProcesses || [])];
}
function kanbanStageForProcess(process){
  const value = String(process || "").trim();
  return KANBAN_STAGES.find(stage=>processNamesForStage(stage).includes(value)) || null;
}
function boardItemMatchesSearch(item){
  const query = String(state.boardSearch || "").trim().toLowerCase();
  if(!query) return true;
  const project = state.projects.find(p=>String(p.ProjectID)===String(item.ProjectID)) || {};
  return [
    item.SONumber, item.ItemDescription, item.ItemStatus, item.AssignedPersonnel,
    project.ClientName, project.ProjectSummary, teamName(item.AssignedTeamID), item.AssignedPersonnel
  ].some(value=>String(value || "").toLowerCase().includes(query));
}
function unmappedBoardItems(){
  return activeItems().filter(i=>!kanbanStageForProcess(i.ItemStatus) && boardItemMatchesSearch(i));
}
function renderBoard(){
  const oldSearch = $("boardSearch");
  const hadFocus = document.activeElement && document.activeElement.id === "boardSearch";
  const cursorPos = oldSearch && typeof oldSearch.selectionStart === "number" ? oldSearch.selectionStart : null;
  const q = oldSearch ? oldSearch.value : state.boardSearch;
  state.boardSearch = q || "";
  const unmapped = unmappedBoardItems();
  $("page-board").innerHTML = `
    <div class="pageTitle">
      <div><h1>Production Board</h1><div class="hint">Major-stage Kanban. Each tile shows its exact detailed process. ${canOfficer() ? "Officer/Admin can move production tiles." : "Staff view is read-only."}</div></div>
      <div class="boardSearchBox"><input id="boardSearch" placeholder="Search SO#, client, item, process, team..." value="${escapeAttr(state.boardSearch||"")}" /></div>
    </div>
    ${unmapped.length ? `<div class="panel boardWarning"><b>${unmapped.length} item${unmapped.length===1?" has":"s have"} an unmapped detailed process.</b><div class="small">Update these item statuses to one of the configured production processes: ${unmapped.map(i=>`${escapeHtml(i.SONumber)} — ${escapeHtml(i.ItemDescription)} (${escapeHtml(i.ItemStatus||"Blank")})`).join("; ")}</div></div>` : ""}
    <div class="kanbanTopScroll" id="kanbanTopScroll"><div class="kanbanScrollInner"></div></div>
    <div class="panel kanbanWrap" id="kanbanWrap"><div class="kanban compactKanban" id="kanbanBoardInner">${KANBAN_STAGES.map(stage=>renderKanbanStage(stage)).join("")}</div></div>`;
  const search = $("boardSearch");
  if(search){
    search.oninput = debounce(()=>{ state.boardSearch = search.value; renderBoard(); }, 220);
    if(hadFocus){
      search.focus();
      const pos = cursorPos === null ? search.value.length : Math.min(cursorPos, search.value.length);
      try{ search.setSelectionRange(pos,pos); }catch(_){ }
    }
  }
  syncKanbanTopScrollbar();
  bindKanbanDnD();
  document.querySelectorAll("[data-open-item]").forEach(el=>el.onclick=()=>openItemDetails(el.dataset.openItem));
}

function syncKanbanTopScrollbar(){
  const top = $("kanbanTopScroll");
  const wrap = $("kanbanWrap");
  const inner = $("kanbanBoardInner");
  const topInner = top ? top.querySelector(".kanbanScrollInner") : null;
  if(!top || !wrap || !inner || !topInner) return;
  topInner.style.width = inner.scrollWidth + "px";
  let locked = false;
  top.onscroll = ()=>{ if(locked) return; locked = true; wrap.scrollLeft = top.scrollLeft; locked = false; };
  wrap.onscroll = ()=>{ if(locked) return; locked = true; top.scrollLeft = wrap.scrollLeft; locked = false; };
}

function boardGroupKey(stageKey, soNumber){
  return `${String(stageKey||"")}::${cleanSO(soNumber)}`;
}
function isBoardGroupCollapsed(stageKey, soNumber){
  state.boardCollapsedGroups = state.boardCollapsedGroups || {};
  const key = boardGroupKey(stageKey, soNumber);
  // Multi-item SO groups are collapsed by default.
  return state.boardCollapsedGroups[key] !== false;
}
function setBoardGroupCollapsed(stageKey, soNumber, collapsed){
  state.boardCollapsedGroups = state.boardCollapsedGroups || {};
  const key = boardGroupKey(stageKey, soNumber);
  state.boardCollapsedGroups[key] = collapsed;
}
function groupStageItemsBySO(items){
  const groups=[];
  const bySO=new Map();
  items.forEach(item=>{
    const so=cleanSO(item.SONumber) || "NO-SO";
    if(!bySO.has(so)){
      const group={so,items:[]};
      bySO.set(so,group);
      groups.push(group);
    }
    bySO.get(so).items.push(item);
  });
  return groups;
}
function renderKanbanStage(stage){
  const items = activeItems()
    .filter(i=>kanbanStageForProcess(i.ItemStatus)?.key===stage.key && boardItemMatchesSearch(i))
    .sort((a,b)=>String(a.SONumber||"").localeCompare(String(b.SONumber||""), undefined, {numeric:true}) || String((state.projects.find(p=>p.ProjectID===a.ProjectID)||{}).ClientName||"").localeCompare(String((state.projects.find(p=>p.ProjectID===b.ProjectID)||{}).ClientName||"")) || String(a.ItemDescription||"").localeCompare(String(b.ItemDescription||"")));
  const details = stage.processes.join(" • ");
  const groups = groupStageItemsBySO(items);
  return `<div class="kanbanCol" data-stage="${escapeAttr(stage.key)}"><div class="kanbanHead"><div><span>${escapeHtml(stage.label)}</span><div class="kanbanStageProcesses">${escapeHtml(details)}</div></div><span class="badge">${items.length}</span></div><div class="kanbanBody">${groups.map(group=>renderSOGroup(stage,group)).join("") || `<div class="hint">No items.</div>`}</div></div>`;
}
function renderSOGroup(stage, group){
  const items=group.items || [];
  if(items.length===1) return compactTileHTML(items[0], {showSO:true});
  const p=state.projects.find(x=>String(x.ProjectID)===String(items[0].ProjectID))||{};
  const collapsed=isBoardGroupCollapsed(stage.key,group.so);
  const processes=[...new Set(items.map(i=>String(i.ItemStatus||"").trim()).filter(Boolean))];
  const groupItemIds=items.map(i=>String(i.ItemID||"")).filter(Boolean).join(",");
  return `<details class="kanbanSOGroup" data-so-group="${escapeAttr(group.so)}" data-stage-group="${escapeAttr(stage.key)}" data-group-items="${escapeAttr(groupItemIds)}" draggable="${canOfficer() && collapsed}" ${collapsed?"":"open"}>
    <summary class="kanbanSOSummary" title="${canOfficer() && collapsed ? "Drag this collapsed SO to move all items in this stage" : "Click to expand/collapse"}">
      <div class="kanbanSOInfo"><span class="kanbanSOChevron">›</span><div><div class="kanbanSONumber">SO ${escapeHtml(group.so)}</div><div class="kanbanSOClient">${escapeHtml(p.ClientName||"")}</div></div></div>
      <div class="kanbanSOCount">${items.length} items</div>
    </summary>
    <div class="kanbanSOProcesses">${escapeHtml(processes.join(" • "))}</div>
    <div class="kanbanSOItems">${items.map(i=>compactTileHTML(i,{showSO:false})).join("")}</div>
  </details>`;
}
function compactTileHTML(i, options={}){
  const p=state.projects.find(x=>x.ProjectID===i.ProjectID)||{};
  const team=teamName(i.AssignedTeamID);
  const assignee=String(i.AssignedPersonnel||"").trim();
  const tooltip=[`SO ${i.SONumber||""}`,p.ClientName||"",i.ItemDescription||"",`Process: ${i.ItemStatus||"Unspecified"}`,team?`Team: ${team}`:"",assignee?`Assigned: ${assignee}`:""].filter(Boolean).join(" | ");
  return `<div class="tile smallTile compactBoardTile" draggable="${canOfficer()}" data-item="${escapeAttr(i.ItemID)}" data-open-item="${escapeAttr(i.ItemID)}" title="${escapeAttr(tooltip)}">
    ${options.showSO?`<div class="compactTileTop"><span class="tileSO">SO ${escapeHtml(i.SONumber)}</span><span class="compactTileClient">${escapeHtml(p.ClientName||"")}</span></div>`:""}
    <div class="compactTileMain"><span class="tileItem">${escapeHtml(i.ItemDescription)}</span><span class="compactProcessPill">${escapeHtml(i.ItemStatus||"Unspecified")}</span></div>
    ${(team||assignee)?`<div class="compactTileAssign">${escapeHtml([team,assignee].filter(Boolean).join(" • "))}</div>`:""}
  </div>`;
}
function tileHTML(i){ return compactTileHTML(i,{showSO:true}); }
function kanbanDragPayloadFromEvent(e){
  try{
    const raw=e.dataTransfer.getData("application/x-sjtc-kanban");
    if(raw) return JSON.parse(raw);
  }catch(_){ }
  const fallback=e.dataTransfer.getData("text/plain") || "";
  if(fallback.startsWith("GROUP:")) return {type:"group",itemIds:fallback.slice(6).split(",").filter(Boolean)};
  if(fallback.startsWith("ITEM:")) return {type:"item",itemId:fallback.slice(5)};
  return fallback ? {type:"item",itemId:fallback} : null;
}
function setKanbanDragPayload(e,payload){
  e.dataTransfer.effectAllowed="move";
  try{ e.dataTransfer.setData("application/x-sjtc-kanban", JSON.stringify(payload)); }catch(_){ }
  if(payload.type==="group") e.dataTransfer.setData("text/plain", `GROUP:${(payload.itemIds||[]).join(",")}`);
  else e.dataTransfer.setData("text/plain", `ITEM:${payload.itemId||""}`);
}
function bindKanbanDnD(){
  document.querySelectorAll(".kanbanSOGroup").forEach(group=>{
    const syncGroupDrag=()=>{
      const canDrag=canOfficer() && !group.open;
      group.draggable=canDrag;
      group.classList.toggle("soGroupDraggable",canDrag);
    };
    group.addEventListener("toggle",()=>{
      setBoardGroupCollapsed(group.dataset.stageGroup, group.dataset.soGroup, !group.open);
      syncGroupDrag();
    });
    syncGroupDrag();
    if(canOfficer()){
      group.addEventListener("dragstart",e=>{
        if(group.open || e.target.closest(".tile[data-item]")) return;
        const itemIds=String(group.dataset.groupItems||"").split(",").filter(Boolean);
        if(!itemIds.length){ e.preventDefault(); return; }
        setKanbanDragPayload(e,{type:"group",itemIds,so:group.dataset.soGroup,sourceStage:group.dataset.stageGroup});
        group.classList.add("draggingSO");
      });
      group.addEventListener("dragend",()=>group.classList.remove("draggingSO"));
    }
  });
  if(!canOfficer()) return;
  document.querySelectorAll(".tile[data-item]").forEach(t=>{
    t.addEventListener("dragstart", e=>{
      e.stopPropagation();
      setKanbanDragPayload(e,{type:"item",itemId:t.dataset.item});
      t.classList.add("dragging");
    });
    t.addEventListener("dragend",()=>t.classList.remove("dragging"));
  });
  // The entire major-stage column is a drop target, not only the tile/content area.
  document.querySelectorAll(".kanbanCol[data-stage]").forEach(zone=>{
    zone.addEventListener("dragenter", e=>{
      e.preventDefault();
      zone.classList.add("dragOver");
    });
    zone.addEventListener("dragover", e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect="move";
      zone.classList.add("dragOver");
    });
    zone.addEventListener("dragleave", e=>{
      if(!zone.contains(e.relatedTarget)) zone.classList.remove("dragOver");
    });
    zone.addEventListener("drop", e=>{
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragOver");
      const payload=kanbanDragPayloadFromEvent(e);
      if(!payload) return;
      if(payload.type==="group") openMoveSOGroupModal(payload.itemIds||[], zone.dataset.stage, payload.so||"");
      else if(payload.itemId) openMoveModal(payload.itemId, zone.dataset.stage);
    });
  });
}
async function openItemDetails(itemId, options={}){
  const item=state.items.find(x=>x.ItemID===itemId); if(!item)return;
  if(!options.skipFetch){
    try{ await ensureItemLogs(itemId); }
    catch(err){ console.error(err); alert(err.message || err); }
  }
  const p=state.projects.find(x=>x.ProjectID===item.ProjectID)||{}; const logs=itemLogs(itemId);
  $("itemDetailTitle").textContent = `${item.SONumber} — ${item.ItemDescription}`;
  const moveActionHtml = canOfficer() && !isDeliveredItem(item) ? `
    <div class="panel itemActionPanel">
      <div class="line" style="justify-content:space-between;align-items:center">
        <div>
          <div class="cardTitle">Process Movement</div>
          <div class="small">Use this if drag-and-drop is difficult on your screen.</div>
        </div>
        <button class="primary" id="btnMoveItemFromDetails">Move To...</button>
      </div>
    </div>` : ``;
  const logsHtml = logs.length ? `<div class="tableScroll"><table class="productionLogMiniTable"><thead><tr><th>Process</th><th>Team / PIC</th><th>Start</th><th>End</th><th>Moved By</th><th>Remarks</th><th></th></tr></thead><tbody>${logs.map(log=>`
    <tr>
      <td><b>${escapeHtml(log.ToStatus||"—")}</b>${log.FromStatus?`<div class="small">${escapeHtml(log.FromStatus)} → ${escapeHtml(log.ToStatus)}</div>`:""}</td>
      <td>${escapeHtml(teamName(log.AssignedTeamID))}<div class="small">${escapeHtml(log.AssignedPersonnel||"—")}</div></td>
      <td>${niceDT(log.StartedAt)}</td>
      <td>${log.FinishedAt?niceDT(log.FinishedAt):`<span class="pill ok">Ongoing</span>`}</td>
      <td>${escapeHtml(log.MovedBy||"—")}</td>
      <td>${escapeHtml(log.Remarks||"—")}${log.CorrectionNote?`<div class="small">Correction: ${escapeHtml(log.CorrectionNote)}</div>`:""}</td>
      <td>${state.admin?`<button class="primary smallBtn" data-edit-log="${escapeAttr(log.LogID)}">Edit</button>`:""}</td>
    </tr>`).join("")}</tbody></table></div>` : `<div class="hint">No production movement logs yet.</div>`;
  $("itemDetailBody").innerHTML = `${moveActionHtml}<div class="grid2"><div class="panel"><h3>Item Details</h3>${detail("SO#", item.SONumber)}${detail("Client", p.ClientName)}${detail("Item", item.ItemDescription)}${detail("Quantity", `${item.Quantity || ""} ${item.Unit || ""}`)}${detail("Current Process", item.ItemStatus)}${detail("Team", teamName(item.AssignedTeamID))}${detail("Personnel Assigned", item.AssignedPersonnel)}${detail("Delivery Status", item.DeliveryStatus)}${detail("Due Date", niceDate(item.ItemDueDate))}</div><div class="panel"><h3>Production Logs</h3>${logsHtml}</div></div>`;
  const moveBtn = $("btnMoveItemFromDetails");
  if(moveBtn) moveBtn.onclick = ()=>openMoveToSelectorModal(item.ItemID);
  document.querySelectorAll("[data-edit-log]").forEach(btn=>btn.onclick=()=>openEditLogModal(btn.dataset.editLog));
  openModal("itemDetailModal");
}

function openEditLogModal(logId){
  if(!state.admin) return alert("Admin Mode is required to edit production logs.");
  const log = state.logs.find(x=>String(x.LogID)===String(logId));
  if(!log) return alert("Production log not found.");
  state.editingLogId = logId;
  $("editLogModalBody").innerHTML = `
    <div class="panel">
      <div class="cardTitle">${escapeHtml(log.SONumber || "")} — ${escapeHtml(log.ItemDescription || "")}</div>
      <div class="small">Log ID: ${escapeHtml(log.LogID || "")}</div>
    </div>
    <div class="twoCol">
      <div><label>Process / Status</label><select id="editLogToStatus">${PROCESS_COLUMNS.map(c=>`<option ${String(log.ToStatus||"")===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select></div>
      <div><label>Assigned Team</label><select id="editLogTeam">${activeTeamOptions(log.AssignedTeamID)}</select></div>
      <div><label>Personnel Assigned / PIC</label><input id="editLogPersonnel" value="${escapeAttr(log.AssignedPersonnel || "")}" /></div>
      <div><label>Started At</label><input id="editLogStartedAt" type="datetime-local" value="${toLocalDTInput(log.StartedAt)}" /></div>
      <div><label>Finished At</label><input id="editLogFinishedAt" type="datetime-local" value="${toLocalDTInput(log.FinishedAt)}" /></div>
      <div><label>Moved By</label><input id="editLogMovedBy" value="${escapeAttr(log.MovedBy || "")}" /></div>
      <div><label>Remarks</label><input id="editLogRemarks" value="${escapeAttr(log.Remarks || "")}" /></div>
    </div>
    <div><label>Correction Note <span class="required">*</span></label><textarea id="editLogCorrectionNote" placeholder="Required. Explain why this log was corrected.">${escapeHtml(log.CorrectionNote || "")}</textarea></div>
    <div class="hint">This updates the production log only. Use this for correcting wrong personnel, timestamps, process name, or remarks.</div>`;
  closeModal("itemDetailModal");
  openModal("editLogModal");
}

async function saveProductionLogEdit(){
  const logId = state.editingLogId;
  const log = state.logs.find(x=>String(x.LogID)===String(logId));
  if(!log) return alert("Production log not found.");
  const correctionNote = $("editLogCorrectionNote").value.trim();
  if(!correctionNote) return alert("Correction Note is required.");
  const updates = {
    ToStatus: $("editLogToStatus").value,
    AssignedTeamID: $("editLogTeam").value,
    AssignedPersonnel: $("editLogPersonnel").value.trim(),
    StartedAt: fromLocalDTInput($("editLogStartedAt").value),
    FinishedAt: fromLocalDTInput($("editLogFinishedAt").value),
    MovedBy: $("editLogMovedBy").value.trim(),
    Remarks: $("editLogRemarks").value.trim()
  };
  await api("editProductionLog", { pin: accessPin(), logId, updates, CorrectionNote: correctionNote, editedBy:"Admin" });
  closeModal("editLogModal");
  state.editingLogId = null;
  state.productionLogsLoaded = false;
  if(log.ItemID){
    await ensureItemLogs(log.ItemID, true);
    await openItemDetails(log.ItemID, {skipFetch:true});
  }
}

function openMoveSOGroupModal(itemIds,stageKey,soNumber=""){
  if(!canOfficer()) return alert("Officer or Admin access is required to move production items.");
  const stage=KANBAN_STAGES.find(s=>s.key===stageKey);
  const items=(itemIds||[]).map(id=>state.items.find(i=>String(i.ItemID)===String(id))).filter(Boolean);
  if(!stage || !items.length) return;
  const available=stage.processes || [];
  const selected=available[0] || "";
  state.pendingMove={mode:"group",itemIds:items.map(i=>i.ItemID),toStatus:selected,stageKey,soNumber:cleanSO(soNumber || items[0].SONumber)};
  const options=available.map(process=>`<option value="${escapeAttr(process)}">${escapeHtml(process)}</option>`).join("");
  const rows=items.map(item=>`<div class="bulkMoveItemRow" data-bulk-move-item="${escapeAttr(item.ItemID)}">
      <div class="bulkMoveItemName"><b>${escapeHtml(item.ItemDescription||item.ItemID)}</b><span>${escapeHtml(item.ItemStatus||"Blank")}</span></div>
      <select class="bulkMoveTeam">${activeTeamOptions(item.AssignedTeamID)}</select>
      <input class="bulkMovePersonnel" list="personnelNames" value="${escapeAttr(item.AssignedPersonnel||"")}" placeholder="Person in charge" />
    </div>`).join("");
  $("moveModalBody").innerHTML=`
    <div class="panel"><div class="cardTitle">Move SO ${escapeHtml(state.pendingMove.soNumber)} — ${items.length} items</div><div class="small">All items inside the collapsed SO card will move together. Items from this SO that are already in other Kanban columns are not included.<br>Target major stage: <b>${escapeHtml(stage.label)}</b></div></div>
    <div><label>Detailed Process for All Items</label><select id="moveToStatusSelect">${options}</select></div>
    <div><label>Team / Person in Charge per Item</label><div class="bulkMoveHeader"><span>Item / Current Process</span><span>Team</span><span>Person in Charge</span></div><div class="bulkMoveList">${rows}</div></div>
    ${personnelDatalist()}
    <div><label>Remarks for All Items</label><textarea id="moveRemarks" placeholder="Optional remarks"></textarea></div>
    <div class="hint">Each item is saved as its own production movement. The previous process is ended and the selected process is started separately for every item, preserving individual production logs.${stage.key==="Delivery"?" Moving the group to Delivery also places the items in Logistics → Items for Delivery.":""}</div>`;
  openModal("moveModal");
}

function openMoveModal(itemId,stageKey){
  const item=state.items.find(i=>i.ItemID===itemId);
  const stage=KANBAN_STAGES.find(s=>s.key===stageKey);
  if(!item || !stage) return;
  const available = stage.processes || [];
  const selected = available.includes(String(item.ItemStatus||"")) ? item.ItemStatus : available[0];
  state.pendingMove={itemId,toStatus:selected,stageKey};
  const options = available.map(process=>`<option value="${escapeAttr(process)}" ${String(selected)===process?"selected":""}>${escapeHtml(process)}</option>`).join("");
  $("moveModalBody").innerHTML = `
    <div class="panel"><div class="cardTitle">${escapeHtml(item.SONumber)} — ${escapeHtml(item.ItemDescription)}</div><div class="small">Current detailed process: <b>${escapeHtml(item.ItemStatus||"Blank")}</b><br>Target major stage: <b>${escapeHtml(stage.label)}</b></div></div>
    <div><label>Detailed Process</label><select id="moveToStatusSelect">${options}</select></div>
    <div><label>Assigned Team</label><select id="moveTeam">${activeTeamOptions(item.AssignedTeamID)}</select></div>
    <div><label>Personnel Assigned for this task/process</label><input id="movePersonnel" list="personnelNames" placeholder="Name of assigned personnel" value="${escapeAttr(item.AssignedPersonnel||"")}" /></div>
    ${personnelDatalist()}
    <div><label>Remarks</label><textarea id="moveRemarks" placeholder="Optional remarks"></textarea></div>
    <div class="hint">The board column is the major stage, but Google Sheets and production logs will save the detailed process selected above.${stage.key==="Delivery"?" Moving the item to Delivery also places it in Logistics → Items for Delivery.":""}</div>`;
  openModal("moveModal");
}

function openMoveToSelectorModal(itemId){
  if(!canOfficer()) return alert("Officer or Admin access is required to move production items.");
  const item=state.items.find(i=>i.ItemID===itemId);
  if(!item) return alert("Item not found.");
  state.pendingMove={itemId,toStatus:item.ItemStatus||PROCESS_COLUMNS[0]};
  const options = PROCESS_COLUMNS.map(c=>`<option value="${escapeAttr(c)}" ${String(item.ItemStatus||"")===c?"selected":""}>${escapeHtml(c)}</option>`).join("");
  $("moveModalBody").innerHTML = `
    <div class="panel">
      <div class="cardTitle">${escapeHtml(item.SONumber)} — ${escapeHtml(item.ItemDescription)}</div>
      <div class="small">Current detailed process: <b>${escapeHtml(item.ItemStatus||"Blank")}</b></div>
    </div>
    <div><label>Move To Detailed Process</label><select id="moveToStatusSelect">${options}</select></div>
    <div><label>Assigned Team</label><select id="moveTeam">${activeTeamOptions(item.AssignedTeamID)}</select></div>
    <div><label>Personnel Assigned for this task/process</label><input id="movePersonnel" list="personnelNames" placeholder="Name of assigned personnel" value="${escapeAttr(item.AssignedPersonnel||"")}" /></div>
    ${personnelDatalist()}
    <div><label>Remarks</label><textarea id="moveRemarks" placeholder="Optional remarks"></textarea></div>
    <div class="hint">This will be processed the same way as drag-and-drop: the previous process is finished, the new process is started, and a production log is created.</div>`;
  closeModal("itemDetailModal");
  openModal("moveModal");
}

async function confirmMove(){
  if(!state.pendingMove) return;
  const select=$("moveToStatusSelect");
  if(select) state.pendingMove.toStatus=select.value;

  if(state.pendingMove.mode==="group"){
    const toStatus=state.pendingMove.toStatus;
    const remarks=$("moveRemarks") ? $("moveRemarks").value.trim() : "";
    const rows=Array.from(document.querySelectorAll("[data-bulk-move-item]"));
    const moves=rows.map(row=>{
      const itemId=row.dataset.bulkMoveItem;
      const item=state.items.find(i=>String(i.ItemID)===String(itemId));
      const assignedTeamId=row.querySelector(".bulkMoveTeam")?.value || "";
      const assignedPersonnel=row.querySelector(".bulkMovePersonnel")?.value.trim() || "";
      return {item,itemId,assignedTeamId,assignedPersonnel};
    }).filter(x=>x.item);
    if(!moves.length) return alert("No items were found in this SO group.");
    const missing=moves.filter(x=>!x.assignedTeamId && !x.assignedPersonnel);
    if(missing.length) return alert(`Assign a team or person for: ${missing.map(x=>x.item.ItemDescription||x.itemId).join(", ")}`);
    const actionable=moves.filter(x=>
      String(x.item.ItemStatus||"")!==String(toStatus||"") ||
      String(x.item.AssignedTeamID||"")!==String(x.assignedTeamId||"") ||
      String(x.item.AssignedPersonnel||"")!==String(x.assignedPersonnel||"")
    );
    if(!actionable.length) return alert("All items already have this process and assignment. Choose a different process or assignment.");

    const result=await api("moveProductionItemsBulk",{
      pin:accessPin(), toStatus, remarks, movedBy:state.accessLevel==="admin"?"Admin":"Officer",
      moves:actionable.map(move=>({
        itemId:move.itemId, assignedTeamId:move.assignedTeamId, assignedPersonnel:move.assignedPersonnel
      }))
    });
    state.pendingMove=null;
    state.productionLogsLoaded=false;
    closeModal("moveModal");
    await load();
    const failed=Array.isArray(result.errors)?result.errors:[];
    if(failed.length){
      alert(`${actionable.length-failed.length} item(s) moved successfully. ${failed.length} item(s) failed and stayed in their previous state:\n- ${failed.map(x=>x.itemDescription||x.itemId).join("\n- ")}`);
    }
    return;
  }

  const item=state.items.find(i=>i.ItemID===state.pendingMove.itemId);
  if(item && String(item.ItemStatus||"")===String(state.pendingMove.toStatus||"")) return alert("Please select a different process.");
  const assignedPersonnel=$("movePersonnel").value.trim();
  const assignedTeamId=$("moveTeam") ? $("moveTeam").value : (item?.AssignedTeamID || "");
  if(!assignedPersonnel && !assignedTeamId) return alert("Assign a team or a person before moving the item.");
  await api("moveProductionItem", { pin:accessPin(), itemId:state.pendingMove.itemId, toStatus:state.pendingMove.toStatus, assignedTeamId, assignedPersonnel, remarks:$("moveRemarks").value.trim(), movedBy:state.accessLevel==="admin"?"Admin":"Officer" });
  state.pendingMove=null; state.productionLogsLoaded=false; closeModal("moveModal"); await load();
}

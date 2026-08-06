/** SJTC Dashboard v3.0.0 — read-only project history */
async function ensureHistoryIndex(force=false){
  if(state.historyLoaded&&!force)return state.historyProjects;
  const res=await api('getProjectHistoryIndex',{});
  state.historyProjects=res.projects||[];
  state.historyLoaded=true;
  renderHistory();
  return state.historyProjects;
}
function historyStatusClass(status){const s=String(status||'').toUpperCase();return s==='DELIVERED'?'ok':s==='CANCELLED'?'bad':'info';}
function renderHistory(){
  const page=$('page-history');if(!page)return;
  const old=$('historySearch'),q=(old?.value||'').trim().toLowerCase();
  if(!state.historyLoaded){
    page.innerHTML=`<div class="pageTitle"><div><h1>Project History</h1><div class="hint">Delivered, cancelled and closed projects are kept here instead of remaining on the active Kanban.</div></div></div><div class="panel"><button class="primary" id="btnLoadHistory">Load Project History</button></div>`;
    if($('btnLoadHistory'))$('btnLoadHistory').onclick=e=>runAction(e,'Loading project history...',async()=>ensureHistoryIndex(true));
    return;
  }
  const list=state.historyProjects.filter(p=>[p.SONumber,p.ClientName,p.ProjectSummary,p.OverallStatus,p.Coordinator,projectSiteAddress(p)].join(' ').toLowerCase().includes(q));
  page.innerHTML=`
    <div class="pageTitle"><div><h1>Project History</h1><div class="hint">Read-only archive. A project moves here automatically when all of its active items are marked Delivered.</div></div><button id="btnReloadHistory">Refresh History</button></div>
    <div class="toolbar"><input id="historySearch" placeholder="Search SO#, client, project or status..." value="${escapeAttr(q)}" /></div>
    <div class="panel tableScroll"><table><thead><tr><th>SO#</th><th>Client</th><th>Project</th><th>Status</th><th>Items</th><th>Coordinator</th><th>Completed / Delivered</th></tr></thead><tbody>
      ${list.map(p=>`<tr class="click" data-history-project="${escapeAttr(p.ProjectID)}"><td><b>${escapeHtml(p.SONumber)}</b></td><td>${escapeHtml(p.ClientName)}</td><td>${escapeHtml(p.ProjectSummary||'—')}</td><td><span class="pill ${historyStatusClass(p.OverallStatus)}">${escapeHtml(p.OverallStatus||'Closed')}</span></td><td>${escapeHtml(p.ItemCount||0)}</td><td>${escapeHtml(p.Coordinator||'—')}</td><td>${niceDate(p.DeliveredAt||p.CompletedAt||p.UpdatedAt)}</td></tr>`).join('')||`<tr><td colspan="7" class="hint">No projects in history yet.</td></tr>`}
    </tbody></table></div>`;
  $('historySearch').oninput=renderHistory;
  $('btnReloadHistory').onclick=e=>runAction(e,'Refreshing history...',async()=>ensureHistoryIndex(true));
  document.querySelectorAll('[data-history-project]').forEach(el=>el.onclick=()=>openHistoryProject(el.dataset.historyProject));
}
function historyEventTitle(event){
  const map={PROJECT_CREATED:'Project created',PROJECT_UPDATED:'Project updated',PROJECT_STATUS:'Project status',ITEM_CREATED:'Item added',ITEM_UPDATED:'Item updated',ITEM_REMOVED:'Item removed',PROCESS_MOVED:'Process movement',NOTE:'Project note',LOGISTICS_REQUESTED:'Logistics request',LOGISTICS_SCHEDULED:'Logistics scheduled',LOGISTICS_RETURNED:'Returned to pending',LOGISTICS_CANCELLED:'Logistics cancelled',DELIVERED:'Item delivered',CORRECTION:'History correction'};
  return map[String(event.EventType||'').toUpperCase()]||String(event.EventType||'Activity').replaceAll('_',' ');
}
function historyEventDescription(h){
  const parts=[];
  if(h.FromValue||h.ToValue)parts.push(`${h.FromValue||'—'} → ${h.ToValue||'—'}`);
  if(h.TeamID)parts.push(`Team: ${teamName(h.TeamID)}`);
  if(h.Personnel)parts.push(`Assigned: ${h.Personnel}`);
  if(h.Message)parts.push(h.Message);
  if(h.RequestID)parts.push(`Request: ${h.RequestID}`);
  return parts.join(' • ')||'Recorded activity';
}
async function openHistoryProject(projectId){
  const res=await api('getProjectHistory',{projectId});
  const p=res.project||{},items=res.items||[],history=res.history||[],requests=res.logisticsRequests||[];
  state.currentHistoryProject=res;
  $('projectModalTitle').textContent=`Project History — ${p.SONumber||''}`;
  $('projectModalBadge').textContent=p.OverallStatus||'Closed';
  $('projectModalBody').innerHTML=`
    <div class="grid2">
      <div class="panel"><h3>Project Summary</h3>${detail('SO#',p.SONumber)}${detail('Client',p.ClientName)}${detail('Contact',p.ContactNumber)}${detail('Site Address',projectSiteAddress(p))}${detail('Delivery Address',p.DeliveryAddress)}${detail('Project',p.ProjectSummary)}${detail('Priority',p.Priority)}${detail('Status',p.OverallStatus)}${detail('Coordinator',p.Coordinator)}${detail('Delivered',niceDT(p.DeliveredAt))}</div>
      <div class="panel"><h3>Final Item Record</h3><div class="tableScroll"><table><thead><tr><th>Item</th><th>Last Process</th><th>Team</th><th>Assigned</th><th>Delivery</th><th>Delivered</th></tr></thead><tbody>
        ${items.map(i=>`<tr><td><b>${escapeHtml(i.ItemDescription)}</b><div class="small">${escapeHtml(i.Quantity||'')} ${escapeHtml(i.Unit||'')}</div></td><td>${escapeHtml(i.ItemStatus||'—')}</td><td>${escapeHtml(teamName(i.AssignedTeamID))}</td><td>${escapeHtml(i.AssignedPersonnel||'—')}</td><td>${escapeHtml(i.DeliveryStatus||'—')}</td><td>${niceDT(i.DeliveredAt)}</td></tr>`).join('')||`<tr><td colspan="6" class="hint">No item records.</td></tr>`}
      </tbody></table></div></div>
    </div>
    <div class="grid2">
      <div class="panel"><h3>Complete Activity Timeline</h3><div class="historyTimeline">${history.map(h=>`<div class="historyEvent"><div class="line" style="justify-content:space-between"><b>${escapeHtml(historyEventTitle(h))}</b><span class="small">${niceDT(h.EventAt)}</span></div><div class="small">${escapeHtml(historyEventDescription(h))}</div><div class="meta">${escapeHtml(h.Actor||'System')}</div></div>`).join('')||`<div class="hint">No history events.</div>`}</div></div>
      <div class="panel"><h3>Logistics Record</h3><div class="historyTimeline">${requests.map(r=>`<div class="historyEvent"><div class="line" style="justify-content:space-between"><b>${escapeHtml(displayType(r.Type))}</b><span class="pill ${String(r.Status).toUpperCase()==='DELIVERED'?'ok':'info'}">${escapeHtml(r.Status)}</span></div><div class="small">${niceDT(r.StartDT)} • ${escapeHtml(displayVehicle(r.VehicleCode)||'No vehicle')} • ${escapeHtml(displayPerson(r.DriverCode)||'No driver')}</div><div class="small">${escapeHtml((r.Payload||{}).Items||(r.Payload||{}).Purpose||'')}</div></div>`).join('')||`<div class="hint">No logistics records.</div>`}</div></div>
    </div>`;
  $('projectModalFooter').innerHTML=`<button data-close="projectModal">Close</button>`;
  bindCloseButtons();openModal('projectModal');
}

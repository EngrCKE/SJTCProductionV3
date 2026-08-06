/** SJTC Dashboard v3.0.0 — active projects and item-level team assignment */
function renderProjects(){
  const old=$('projectSearch');
  const q=(old?.value||'').trim().toLowerCase();
  const list=activeProjects().filter(p=>[
    p.SONumber,p.ClientName,p.ContactNumber,projectSiteAddress(p),p.DeliveryAddress,p.ProjectSummary,p.OverallStatus,
    p.Coordinator,projectTeamSummary(p.ProjectID),projectPersonnelSummary(p.ProjectID)
  ].join(' ').toLowerCase().includes(q)).sort((a,b)=>new Date(b.CreatedAt||0)-new Date(a.CreatedAt||0));

  $('page-projects').innerHTML=`
    <div class="pageTitle"><div><h1>Active Projects</h1><div class="hint">An SO may use several teams. The team and person responsible are assigned per item, not forced at project level.</div></div></div>
    <div class="toolbar">
      <button class="primary" id="btnAddProject" ${state.admin?'':'disabled'}>+ Add New Project</button>
      <input id="projectSearch" placeholder="Search SO#, client, item, team or person..." value="${escapeAttr(q)}" />
    </div>
    <div class="panel tableScroll"><table><thead><tr><th>SO#</th><th>Client</th><th>Project</th><th>Due</th><th>Status</th><th>Teams Involved</th><th>Coordinator</th><th>Items</th></tr></thead><tbody>
      ${list.map(p=>{
        const due=daysToDue(p.DueDate), items=projectItems(p.ProjectID), delivered=items.filter(isDeliveredItem).length;
        return `<tr class="click" data-project="${escapeAttr(p.ProjectID)}">
          <td><b>${escapeHtml(p.SONumber)}</b></td><td>${escapeHtml(p.ClientName)}</td>
          <td>${escapeHtml(p.ProjectSummary||'—')}<div class="small">${escapeHtml(projectSiteAddress(p)||'')}</div></td>
          <td>${niceDate(p.DueDate)}<div><span class="pill ${due.cls}">${due.text}</span></div></td>
          <td>${escapeHtml(p.OverallStatus||'In Production')}</td><td>${escapeHtml(projectTeamSummary(p.ProjectID))}</td>
          <td>${escapeHtml(p.Coordinator||'—')}</td><td>${items.length}<div class="small">${delivered} delivered</div></td>
        </tr>`;
      }).join('')||`<tr><td colspan="8" class="hint">No active projects.</td></tr>`}
    </tbody></table></div>`;
  $('projectSearch').oninput=renderProjects;
  $('btnAddProject').onclick=()=>openProjectForm();
  document.querySelectorAll('[data-project]').forEach(el=>el.onclick=()=>openProjectDetails(el.dataset.project));
}

async function openProjectDetails(projectId,options={}){
  const p=state.projects.find(x=>String(x.ProjectID)===String(projectId));
  if(!p)return;
  if(!options.skipFetch){
    try{await ensureProjectNotes(projectId);}catch(err){console.error(err);alert(err.message||err);}
  }
  state.currentProjectId=projectId;
  const items=projectItems(projectId),notes=projectNotes(projectId);
  $('projectModalTitle').textContent=`Project Details — ${p.SONumber}`;
  $('projectModalBadge').textContent=p.OverallStatus||'Active';
  $('projectModalBody').innerHTML=`
    <div class="grid2">
      <div class="panel"><h3>Project Information</h3>
        ${detail('SO#',p.SONumber)}${detail('Client',p.ClientName)}${detail('Contact',p.ContactNumber)}
        ${detail('Site Address',projectSiteAddress(p))}${detail('Delivery Address',p.DeliveryAddress||projectSiteAddress(p))}
        ${detail('Due Date',niceDate(p.DueDate))}${detail('Priority',p.Priority)}${detail('Status',p.OverallStatus)}
        ${detail('Default Team',teamName(p.DefaultTeamID||p.AssignedTeamID))}${detail('Project Coordinator',p.Coordinator||p.AssignedTeamLead)}
        ${detail('Teams Involved',projectTeamSummary(projectId))}
      </div>
      <div class="panel"><div class="line" style="justify-content:space-between"><h3>Items</h3>${state.admin?`<button class="primary" id="btnEditItemsInline">Edit Items</button>`:''}</div>
        <div class="tableScroll"><table><thead><tr><th></th><th>Item</th><th>Process</th><th>Team</th><th>Assigned</th><th>Delivery</th></tr></thead><tbody>
          ${items.map(i=>{
            const ready=String(i.ItemStatus||'')==='Delivery'&&!isDeliveredItem(i);
            return `<tr>
              <td><input type="checkbox" class="projectItemCheck" value="${escapeAttr(i.ItemID)}" ${ready?'':'disabled'} /></td>
              <td class="click" data-open-item="${escapeAttr(i.ItemID)}"><b>${escapeHtml(i.ItemDescription)}</b><div class="small">${escapeHtml(i.Quantity||'')} ${escapeHtml(i.Unit||'')}</div></td>
              <td>${escapeHtml(i.ItemStatus||'—')}</td><td>${escapeHtml(teamName(i.AssignedTeamID))}</td>
              <td>${escapeHtml(i.AssignedPersonnel||'—')}</td><td><span class="pill ${isDeliveredItem(i)?'ok':'info'}">${escapeHtml(i.DeliveryStatus||'Not Requested')}</span></td>
            </tr>`;
          }).join('')||`<tr><td colspan="6" class="hint">No items.</td></tr>`}
        </tbody></table></div>
        <div class="hint">Only items currently in the Delivery stage can be selected for a logistics request.</div>
      </div>
    </div>
    <div class="panel"><h3>Project Notes</h3>
      <div class="twoCol"><div><label>Your Name / Signature</label><input id="noteSignature" /></div><div><label>Note</label><textarea id="noteText"></textarea></div></div>
      <div class="line" style="justify-content:flex-end;margin-top:8px"><button class="ok" id="btnAddNote">Add Note</button></div>
      <div class="historyTimeline" style="margin-top:12px">${notes.map(n=>`<div class="historyEvent"><div class="meta"><b>${escapeHtml(n.Signature)}</b><span>${niceDT(n.CreatedAt)}</span></div><div>${escapeHtml(n.NoteText)}</div></div>`).join('')||`<div class="hint">No notes yet.</div>`}</div>
    </div>`;
  $('projectModalFooter').innerHTML=`<button data-close="projectModal">Close</button>${state.admin?`<button class="primary" id="btnEditProject">Edit Project</button>`:''}<button class="primary" id="btnLogisticsFromProject">Create Logistics Request for Selected Items</button>`;
  bindCloseButtons();
  $('btnAddNote').onclick=addNote;
  if(state.admin){
    $('btnEditProject').onclick=()=>openProjectForm(projectId);
    $('btnEditItemsInline').onclick=()=>openItemEditor(projectId);
  }
  $('btnLogisticsFromProject').onclick=()=>openLogisticsRequestModal(projectId,getCheckedItemIds());
  document.querySelectorAll('[data-open-item]').forEach(el=>el.onclick=e=>{e.stopPropagation();openItemDetails(el.dataset.openItem);});
  openModal('projectModal');
}
function getCheckedItemIds(){return Array.from(document.querySelectorAll('.projectItemCheck:checked')).map(x=>x.value);}
async function addNote(){
  const p=state.projects.find(x=>String(x.ProjectID)===String(state.currentProjectId));if(!p)return;
  const Signature=$('noteSignature').value.trim(),NoteText=$('noteText').value.trim();
  if(!Signature||!NoteText)return alert('Signature and note are required.');
  await api('addProjectNote',{ProjectID:p.ProjectID,ItemID:'',SONumber:p.SONumber,Signature,NoteText});
  await ensureProjectNotes(p.ProjectID,true);await openProjectDetails(p.ProjectID,{skipFetch:true});
}

function activeTeamOptions(selected=''){
  return `<option value="">Unassigned</option>`+state.teams.filter(t=>t.Active!=='N').map(t=>`<option value="${escapeAttr(t.TeamID)}" ${String(selected)===String(t.TeamID)?'selected':''}>${escapeHtml(t.TeamName)}${t.TeamLead?` — ${escapeHtml(t.TeamLead)}`:''}</option>`).join('');
}
function personnelDatalist(){return `<datalist id="personnelNames">${activePersonnelSorted().map(p=>`<option value="${escapeAttr(personName(p))}">${escapeHtml(personRole(p))} • ${escapeHtml(personDept(p))}</option>`).join('')}</datalist>`;}
function openProjectForm(projectId){
  if(!state.admin)return alert('Admin mode required.');
  const p=projectId?state.projects.find(x=>String(x.ProjectID)===String(projectId)):{};
  state.editingProjectId=projectId||null;
  $('projectFormTitle').textContent=projectId?'Edit Project':'Add New Project';
  $('projectFormBody').innerHTML=`
    <div class="twoCol">
      ${inputField('SONumber','SO# / Number only',p.SONumber)}${inputField('ClientName','Client Name',p.ClientName)}
      ${inputField('ContactNumber','Contact Number',p.ContactNumber)}${inputField('SiteAddress','Site Address',projectSiteAddress(p))}
      <div><label>Delivery Address</label><input id="fDeliveryAddress" value="${escapeAttr(p.DeliveryAddress||projectSiteAddress(p)||'')}" /><label class="checkInline"><input type="checkbox" id="fSameDeliveryAddress" ${(p.DeliveryAddress&&p.DeliveryAddress!==projectSiteAddress(p))?'':'checked'} /> Same as site address</label></div>
      ${inputField('ProjectSummary','Project Summary',p.ProjectSummary)}${inputField('DueDate','Due Date',p.DueDate,'date')}
      <div><label>Priority</label><select id="fPriority"><option>Normal</option><option>High</option><option>Urgent</option></select></div>
      <div><label>Default Team <span class="small">(optional)</span></label><select id="fDefaultTeamID">${activeTeamOptions(p.DefaultTeamID||p.AssignedTeamID)}</select><div class="hint">Used only as the starting assignment for new items. Each item can be reassigned independently.</div></div>
      <div><label>Project Coordinator <span class="small">(optional)</span></label><input id="fCoordinator" list="personnelNames" value="${escapeAttr(p.Coordinator||p.AssignedTeamLead||'')}" /><div class="hint">Coordinates the SO but does not have to lead every item.</div></div>
    </div>${personnelDatalist()}
    ${projectId?`<div class="panel"><div class="line" style="justify-content:space-between"><h3>SO Items</h3><button class="primary" id="btnOpenItemEditorFromForm">Edit Item Assignments</button></div><div class="hint">Large projects can distribute items across different teams.</div></div>`:`<div class="panel"><h3>Initial Items</h3><div class="hint">One item per line: Item description | Quantity | Unit</div><textarea id="fInitialItems" placeholder="Kitchen Base Cabinet | 1 | set\nKitchen Wall Cabinet | 1 | set"></textarea></div>`}`;
  setTimeout(()=>{
    if(p.Priority)$('fPriority').value=p.Priority;
    const same=$('fSameDeliveryAddress'),site=$('fSiteAddress'),delivery=$('fDeliveryAddress');
    const sync=()=>{if(same.checked)delivery.value=site.value;delivery.disabled=same.checked;};
    same.onchange=sync;site.oninput=sync;sync();
    if($('btnOpenItemEditorFromForm'))$('btnOpenItemEditorFromForm').onclick=()=>openItemEditor(projectId);
  },0);
  openModal('projectFormModal');
}
function inputField(id,label,value,type='text'){return `<div><label>${label}</label><input id="f${id}" type="${type}" value="${escapeAttr(value||'')}" /></div>`;}
async function saveProject(){
  if(!state.admin)return alert('Admin mode required.');
  const project={
    SONumber:cleanSO($('fSONumber').value),ClientName:$('fClientName').value.trim(),ContactNumber:$('fContactNumber').value.trim(),
    SiteAddress:$('fSiteAddress').value.trim(),Address:$('fSiteAddress').value.trim(),
    DeliveryAddress:$('fSameDeliveryAddress').checked?$('fSiteAddress').value.trim():$('fDeliveryAddress').value.trim(),
    ProjectSummary:$('fProjectSummary').value.trim(),DueDate:$('fDueDate').value,Priority:$('fPriority').value,
    DefaultTeamID:$('fDefaultTeamID').value,Coordinator:$('fCoordinator').value.trim(),CreatedBy:'Admin'
  };
  if(!project.SONumber||!project.ClientName)return alert('SO# and Client Name are required.');
  if(state.editingProjectId)await api('updateProject',{pin:accessPin(),projectId:state.editingProjectId,project});
  else{
    const rows=($('fInitialItems').value||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
      const [ItemDescription,Quantity='1',Unit='pc']=line.split('|').map(x=>x.trim());
      return {ItemDescription,Quantity,Unit,ItemStatus:'Design',DeliveryStatus:'Not Requested',AssignedTeamID:project.DefaultTeamID,AssignedPersonnel:project.Coordinator,ItemDueDate:project.DueDate,Remarks:''};
    });
    await api('createProject',{pin:accessPin(),project,items:rows});
  }
  closeModal('projectFormModal');state.editingProjectId=null;await load();
}

function openItemEditor(projectId){
  if(!state.admin)return alert('Admin mode required.');
  const p=state.projects.find(x=>String(x.ProjectID)===String(projectId));if(!p)return;
  const rows=projectItems(projectId);
  $('itemEditorTitle').textContent=`Item Assignments — ${p.SONumber}`;
  $('itemEditorBody').innerHTML=`<div class="hint">Assign each item to the team and person actually responsible. Assignments can change again when the item moves to another process.</div>${personnelDatalist()}<div id="itemRows" class="itemRows">${rows.map(itemEditorRow).join('')}</div><button class="primary" id="btnAddItemRow">+ Add Item</button>`;
  state.itemEditorProjectId=projectId;
  $('btnAddItemRow').onclick=()=>{$('itemRows').insertAdjacentHTML('beforeend',itemEditorRow({ItemID:'',ItemDescription:'',Quantity:'1',Unit:'pc',ItemStatus:'Design',DeliveryStatus:'Not Requested',AssignedTeamID:p.DefaultTeamID||'',AssignedPersonnel:p.Coordinator||'',ItemDueDate:p.DueDate,Remarks:''}));bindItemRowButtons();};
  bindItemRowButtons();openModal('itemEditorModal');
}
function itemEditorRow(i){return `<div class="itemEditRow v3ItemRow" data-existing="${escapeAttr(i.ItemID||'')}">
  <input data-k="ItemDescription" placeholder="Item" value="${escapeAttr(i.ItemDescription||'')}" />
  <input data-k="Quantity" placeholder="Qty" value="${escapeAttr(i.Quantity||'1')}" />
  <input data-k="Unit" placeholder="Unit" value="${escapeAttr(i.Unit||'pc')}" />
  <select data-k="ItemStatus">${PROCESS_COLUMNS.map(c=>`<option ${String(i.ItemStatus)===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
  <select data-k="AssignedTeamID">${activeTeamOptions(i.AssignedTeamID)}</select>
  <input data-k="AssignedPersonnel" list="personnelNames" placeholder="Assigned person" value="${escapeAttr(i.AssignedPersonnel||'')}" />
  <input data-k="ItemDueDate" type="date" value="${escapeAttr(i.ItemDueDate||'')}" />
  <input data-k="Remarks" placeholder="Remarks" value="${escapeAttr(i.Remarks||'')}" />
  <input type="hidden" data-k="DeliveryStatus" value="${escapeAttr(i.DeliveryStatus||'Not Requested')}" />
  <button class="danger btnRemoveItemRow" type="button">Remove</button>
</div>`;}
function bindItemRowButtons(){document.querySelectorAll('.btnRemoveItemRow').forEach(b=>b.onclick=()=>b.closest('.itemEditRow').remove());}
async function saveProjectItems(){
  if(!state.admin)return alert('Admin mode required.');
  const p=state.projects.find(x=>String(x.ProjectID)===String(state.itemEditorProjectId));if(!p)return;
  const items=Array.from(document.querySelectorAll('.itemEditRow')).map((row,idx)=>{
    const obj={ItemID:row.dataset.existing||'',ProjectID:p.ProjectID,SONumber:p.SONumber,SortOrder:String(idx+1),Active:'Y'};
    row.querySelectorAll('[data-k]').forEach(el=>obj[el.dataset.k]=el.value.trim());return obj;
  }).filter(x=>x.ItemDescription);
  await api('saveProjectItems',{pin:accessPin(),projectId:p.ProjectID,items});
  closeModal('itemEditorModal');closeModal('projectFormModal');state.editingProjectId=null;await load();openProjectDetails(p.ProjectID);
}

/** SJTC Dashboard v3.0.0 — active projects and item-level team assignment */
const projectFilters={search:'',field:'SONumber',value:'',sort:'SONumber',direction:'desc'};
function projectField(p,key){
  if(key==='Teams')return projectTeamSummary(p.ProjectID);
  if(key==='Items')return projectItems(p.ProjectID).map(i=>i.ItemDescription).join('; ');
  return String(p[key]||'');
}
const projectColumns={SONumber:'SO#',ClientName:'Client',ProjectSummary:'Project',DueDate:'Due date',OverallStatus:'Status',Designers:'Designer',Teams:'Teams involved',Coordinator:'Coordinator',Items:'Items'};
function renderProjects(){
  const old=$('projectSearch'),focus=old===document.activeElement,pos=old?.selectionStart;
  const filters=projectFilters,q=filters.search.toLowerCase();
  const list=activeProjects().filter(p=>Object.keys(projectColumns).map(k=>projectField(p,k)).join(' ').toLowerCase().includes(q)&&projectField(p,filters.field).toLowerCase().includes(filters.value.toLowerCase())).sort((a,b)=>projectField(a,filters.sort).localeCompare(projectField(b,filters.sort),undefined,{numeric:true,sensitivity:'base'})*(filters.direction==='desc'?-1:1));
  const options=selected=>Object.entries(projectColumns).map(([k,label])=>`<option value="${k}" ${selected===k?'selected':''}>${label}</option>`).join('');
  $('page-projects').innerHTML=`<div class="pageTitle"><h1>Projects</h1></div><div class="toolbar"><button class="primary" id="btnAddProject" ${state.admin?'':'disabled'}>+ Add New Project</button><input id="projectSearch" placeholder="Search SO#, client, project, item, designer…" value="${escapeAttr(filters.search)}" /></div>
    <div class="filterGrid"><label>Filter field<select id="projectFilterField">${options(filters.field)}</select></label><label>Contains<input id="projectFilterValue" value="${escapeAttr(filters.value)}" placeholder="Any value" /></label><label>Sort by<select id="projectSort">${options(filters.sort)}</select></label><label>Order<select id="projectDirection"><option value="desc" ${filters.direction==='desc'?'selected':''}>Descending / Latest</option><option value="asc" ${filters.direction==='asc'?'selected':''}>Ascending</option></select></label></div>
    <div class="hint">${list.length} matching projects</div><div class="panel tableScroll"><table><thead><tr>${Object.entries(projectColumns).map(([k,v])=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${list.map(p=>`<tr class="click" data-project="${escapeAttr(p.ProjectID)}">${Object.keys(projectColumns).map(k=>`<td>${escapeHtml(projectField(p,k)||'—')}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="9">No matching projects.</td></tr>'}</tbody></table></div>`;
  $('projectSearch').oninput=e=>{filters.search=e.target.value;renderProjects();};
  const bind=(id,key)=>{$(id).onchange=e=>{filters[key]=e.target.value;renderProjects();};};bind('projectFilterField','field');bind('projectFilterValue','value');bind('projectSort','sort');bind('projectDirection','direction');
  $('btnAddProject').onclick=()=>openProjectForm();document.querySelectorAll('[data-project]').forEach(el=>el.onclick=()=>openProjectDetails(el.dataset.project));
  if(focus){$('projectSearch').focus();$('projectSearch').setSelectionRange(pos,pos);}
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
        ${detail('Designer(s)',p.Designers)}${detail('Detailer(s)',p.Detailers)}${detail('Special requirements',p.SpecialRequirements)}${detail('Special hardware notes',p.SpecialHardwareNotes)}${detail('SO#',p.SONumber)}${detail('Client',p.ClientName)}${detail('Contact',p.ContactNumber)}
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
  $('projectModalFooter').innerHTML=`<button data-close="projectModal">Close</button>${state.admin?`<button class="primary" id="btnEditProject">Edit Project</button><button class="danger" id="btnAdminCompletionOverride">Admin completion override</button>`:''}<button class="primary" id="btnLogisticsFromProject">Create Logistics Request for Selected Items</button>`;
  bindCloseButtons();
  $('btnAddNote').onclick=addNote;
  if(state.admin){
    $('btnEditProject').onclick=()=>openProjectForm(projectId);
    $('btnAdminCompletionOverride').onclick=()=>openAdminCompletionOverride(p,()=>openProjectDetails(projectId));
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
function personnelRolePool(role){
  const match=new RegExp('\\b'+role+'s?\\b','i');
  return activePersonnelSorted().filter(p=>match.test(String(p.Role||''))).sort((a,b)=>personName(a).localeCompare(personName(b)));
}
function projectPersonnelPicker(field,role,value){
  const pool=personnelRolePool(role),selected=new Set(splitMultiValue(value).map(n=>n.toLowerCase()));
  const available=new Set(pool.map(p=>personName(p).toLowerCase())),missing=splitMultiValue(value).filter(n=>!available.has(n.toLowerCase()));
  return `<div><label>${role}(s) ${field==='Designers'?'— required':'— optional'}</label><div id="f${field}" class="projectRolePicker">${pool.map(p=>`<label class="checkLine"><input type="checkbox" data-project-role="${field}" value="${escapeAttr(personName(p))}" ${selected.has(personName(p).toLowerCase())?'checked':''}><span>${escapeHtml(personName(p))}</span></label>`).join('')||`<div class="hint">No active personnel tagged as ${role}. Set the Personnel Role in Settings first.</div>`}</div>${missing.length?`<div class="hint">Saved assignment outside the active ${role} pool: ${escapeHtml(missing.join('; '))}. Update the Personnel Role or choose a replacement before saving.</div>`:''}</div>`;
}
function selectedProjectPersonnel(field){return [...document.querySelectorAll(`[data-project-role="${field}"]:checked`)].map(el=>el.value).join('; ');}
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
      ${inputField('DueDate','Due Date',p.DueDate,'date')}${projectPersonnelPicker('Designers','Designer',p.Designers)}${projectPersonnelPicker('Detailers','Detailer',p.Detailers)}
      <div><label>Priority</label><select id="fPriority"><option>Normal</option><option>High</option><option>Urgent</option></select></div>
      <div><label>Default Team <span class="small">(optional)</span></label><select id="fDefaultTeamID">${activeTeamOptions(p.DefaultTeamID||p.AssignedTeamID)}</select><div class="hint">Used only as the starting assignment for new items. Each item can be reassigned independently.</div></div>
      <div><label>Project Coordinator <span class="small">(optional)</span></label><input id="fCoordinator" list="personnelNames" value="${escapeAttr(p.Coordinator||p.AssignedTeamLead||'')}" /><div class="hint">Coordinates the SO but does not have to lead every item.</div></div>
    <div><label>Special requirements</label>${['Glass','Fabric','Stone','Other special hardware'].map(x=>`<label class="checkInline"><input type="checkbox" class="specialRequirement" value="${escapeAttr(x)}" ${splitMultiValue(p.SpecialRequirements).includes(x)?'checked':''}>${x}</label>`).join('')}</div>${inputField('SpecialHardwareNotes','Special hardware / requirements notes',p.SpecialHardwareNotes)}</div>${personnelDatalist()}
    ${projectId?`<div class="panel"><div class="line" style="justify-content:space-between"><h3>SO Items</h3><button class="primary" id="btnOpenItemEditorFromForm">Edit Item Assignments</button></div><div class="hint">Large projects can distribute items across different teams.</div></div>`:`<div class="panel"><h3>Initial Items</h3><div class="hint">One item per line: Item description | Quantity | Unit</div><textarea id="fInitialItems" placeholder="Kitchen Base Cabinet | 1 | set\nKitchen Wall Cabinet | 1 | set"></textarea></div>`}`;
  setTimeout(()=>{
    if(projectId)$('fSONumber').readOnly=true;
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
    Designers:selectedProjectPersonnel('Designers'),Detailers:selectedProjectPersonnel('Detailers'),SpecialRequirements:[...document.querySelectorAll('.specialRequirement:checked')].map(x=>x.value).join('; '),SpecialHardwareNotes:$('fSpecialHardwareNotes').value.trim(),DueDate:$('fDueDate').value,Priority:$('fPriority').value,
    DefaultTeamID:$('fDefaultTeamID').value,Coordinator:$('fCoordinator').value.trim(),CreatedBy:'Admin'
  };
  if(!project.SONumber||!project.ClientName||!project.Designers)return alert('SO#, Client Name, and Designer are required.');
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
  $('itemEditorBody').innerHTML=`<div class="hint"><b>Process changes must be done through the Production Board</b> so Start/End times and movement history stay complete. This editor is for item details, team/person assignment, due date and remarks.</div>${personnelDatalist()}<div id="itemRows" class="itemRows">${rows.map(itemEditorRow).join('')}</div><button class="primary" id="btnAddItemRow">+ Add Item</button>`;
  state.itemEditorProjectId=projectId;
  $('btnAddItemRow').onclick=()=>{$('itemRows').insertAdjacentHTML('beforeend',itemEditorRow({ItemID:'',ItemDescription:'',Quantity:'1',Unit:'pc',ItemStatus:'Design',DeliveryStatus:'Not Requested',AssignedTeamID:p.DefaultTeamID||'',AssignedPersonnel:p.Coordinator||'',ItemDueDate:p.DueDate,Remarks:''}));bindItemRowButtons();};
  bindItemRowButtons();openModal('itemEditorModal');
}
function itemEditorRow(i){return `<div class="itemEditRow v3ItemRow" data-existing="${escapeAttr(i.ItemID||'')}">
  <input data-k="ItemDescription" placeholder="Item" value="${escapeAttr(i.ItemDescription||'')}" />
  <input data-k="Quantity" placeholder="Qty" value="${escapeAttr(i.Quantity||'1')}" />
  <input data-k="Unit" placeholder="Unit" value="${escapeAttr(i.Unit||'pc')}" />
  <select data-k="ItemStatus" ${i.ItemID?"disabled title=\"Move this item through the Production Board so the movement is logged.\"":""}>${PROCESS_COLUMNS.map(c=>`<option ${String(i.ItemStatus)===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
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

function openAdminCompletionOverride(project,back){
  if(!state.admin)return alert('Admin mode required.');
  $('projectModalTitle').textContent='Admin completion override — SO '+project.SONumber;
  $('projectModalBadge').textContent='Admin override';
  $('projectModalBody').innerHTML=`<div class="panel">${detail('Client',project.ClientName)}${detail('Items',project.ProjectSummary)}<p>Mark this entire project and its remaining items complete without a logistics request. It will leave the active Board and appear in Project History.</p></div><label>Outcome<select id="overrideStatus"><option value="Delivered">Delivered — items have been delivered / collected</option><option value="Finished">Finished — close the project without recording delivery</option></select></label><label>Admin name<input id="overrideName" maxlength="120"></label><label>Override reason<textarea id="overrideReason" maxlength="2000" placeholder="Example: Previously completed and delivered; no logistics request was recorded."></textarea></label><div class="hint">Your name, reason, outcome and timestamp are recorded in the project and item history. Existing completed items retain their recorded completion details.</div>`;
  $('projectModalFooter').innerHTML='<button id="overrideBack">← Back</button><button class="danger" id="confirmAdminOverride">Confirm override</button>';
  $('overrideBack').onclick=back;
  $('confirmAdminOverride').onclick=e=>runAction(e,'Applying Admin completion override…',async()=>{const name=$('overrideName').value.trim(),reason=$('overrideReason').value.trim(),status=$('overrideStatus').value;if(!name||!reason)return alert('Admin name and override reason are required.');await api('updateProject',{pin:accessPin(),projectId:project.ProjectID,completionOverride:{name,reason,status}});closeModal('projectModal');state.historyLoaded=false;statusIndex=null;analyticsData=null;state.loadedItemLogs={};state.loadedProjectNotes={};await load();alert('SO '+project.SONumber+' marked '+status+' by Admin override. It is now in Project History.');});
  openModal('projectModal');
}

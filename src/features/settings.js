/** SJTC Dashboard v3.0.0 — simplified master data */
function yesNo(v){return String(v||'N').toUpperCase()==='Y'?'Y':'N';}
function personName(p){return p?(p.PersonnelName||p.FullName||p.Name||p.DriverName||''):'';}
function personRole(p){return p?(p.Role||'Personnel'):'Personnel';}
function personDept(p){return p?(p.Department||'—'):'—';}
function personnelLabel(p){return `${personName(p)||'Unnamed'}${personRole(p)?' — '+personRole(p):''}`;}
function canDrivePersonnel(p){return yesNo(p?.CanDrive)==='Y'||String(personRole(p)).toLowerCase().includes('driver');}
function driverPeople(){return state.personnel.filter(p=>p.Active!=='N'&&canDrivePersonnel(p));}
function activePersonnelSorted(){return state.personnel.filter(p=>String(p.Active||'Y').toUpperCase()!=='N').slice().sort((a,b)=>String(personDept(a)).localeCompare(String(personDept(b)))||String(personName(a)).localeCompare(String(personName(b))));}
function groupByDepartment(list){const groups={};(list||[]).forEach(p=>{const d=String(personDept(p)||'Unassigned').trim()||'Unassigned';(groups[d]||=[]).push(p);});return Object.keys(groups).sort().map(dept=>({dept,items:groups[dept].sort((a,b)=>String(personName(a)).localeCompare(String(personName(b))))}));}
function departmentGroupedRows(list,rowBuilder,emptyText='No records yet.'){const groups=groupByDepartment(list);if(!groups.length)return `<div class="hint">${escapeHtml(emptyText)}</div>`;return `<div class="deptGroupedList">${groups.map(g=>`<div class="deptGroup"><div class="deptHeader">${escapeHtml(g.dept)} <span>${g.items.length}</span></div>${settingsList(g.items.map(rowBuilder))}</div>`).join('')}</div>`;}
function settingValue(key,fallback=''){return state.settings&&Object.prototype.hasOwnProperty.call(state.settings,key)?state.settings[key]:fallback;}
function collapsible(title,body,opts={}){return `<details class="settingsBlock settingsTileBlock"${opts.open?' open':''}><summary><span>${escapeHtml(title)}</span>${opts.count!==undefined?`<span class="badge">${escapeHtml(opts.count)}</span>`:''}</summary><div class="settingsBody">${body}</div></details>`;}
function settingsList(rows,emptyText='No records yet.'){return `<div class="settingsList">${rows.length?rows.join(''):`<div class="hint">${escapeHtml(emptyText)}</div>`}</div>`;}
function settingsRow({title,role='—',dept='—',onClick=''}){return `<button type="button" class="settingsListRow" ${onClick?`onclick="${onClick}"`:''}><span class="setName">${escapeHtml(title||'Unnamed')}</span><span class="setRole">${escapeHtml(role||'—')}</span><span class="setDept">${escapeHtml(dept||'—')}</span></button>`;}

function openSettingsForm(title,fields,values,onSave){
  const disabled=!state.admin?' disabled':'';
  $('projectModalTitle').textContent=title;$('projectModalBadge').textContent=state.admin?'Admin edit':'View only';
  $('projectModalBody').innerHTML=`<div class="settingsForm compactSettingsForm">${fields.map(f=>{
    const val=values[f.key]??f.default??'',help=f.help?`<div class="hint">${escapeHtml(f.help)}</div>`:'';
    if(f.type==='textarea')return `<div><label>${escapeHtml(f.label)}</label><textarea id="sf_${escapeAttr(f.key)}"${disabled}>${escapeHtml(val)}</textarea>${help}</div>`;
    if(f.type==='select')return `<div><label>${escapeHtml(f.label)}</label><select id="sf_${escapeAttr(f.key)}"${disabled}>${(f.options||[]).map(o=>`<option value="${escapeAttr(o.value??o)}" ${String(val)===String(o.value??o)?'selected':''}>${escapeHtml(o.label??o)}</option>`).join('')}</select>${help}</div>`;
    return `<div><label>${escapeHtml(f.label)}</label><input id="sf_${escapeAttr(f.key)}" value="${escapeAttr(val)}" placeholder="${escapeAttr(f.placeholder||'')}"${disabled}/>${help}</div>`;
  }).join('')}</div>`;
  $('projectModalFooter').innerHTML=`<button data-close="projectModal">Close</button>${state.admin?`<button class="ok" id="btnSettingsFormSave">Save</button>`:''}`;
  openModal('projectModal');
  if($('btnSettingsFormSave'))$('btnSettingsFormSave').onclick=e=>runAction(e,'Saving...',async()=>{const data={};fields.forEach(f=>{const el=$('sf_'+f.key);data[f.key]=el?el.value.trim():'';});await onSave(data);closeModal('projectModal');await load({silent:true});});
}
function editSetting(key,label,help){
  const isPin=['ADMIN_PIN','OFFICER_PIN'].includes(key);
  openSettingsForm(`Edit ${label||key}`,[{key:'Value',label:isPin?'New PIN':(label||key),type:key==='PROCESS_COLUMNS'?'textarea':'input',help:isPin?'The current PIN is never displayed. Enter the replacement value.':help}],{Value:isPin?'':settingValue(key)},async data=>api('upsertSetting',{pin:accessPin(),key,value:data.Value}));
}
function editPersonnel(id=''){
  const p=state.personnel.find(x=>String(x.PersonnelID)===String(id))||{};
  openSettingsForm(p.PersonnelID?'Personnel Details':'Add Personnel',[
    {key:'PersonnelName',label:'Name'},{key:'Role',label:'Role'},{key:'Department',label:'Department'},{key:'ContactNumber',label:'Contact Number'},
    {key:'CanDrive',label:'Can Drive',type:'select',options:['N','Y']},{key:'CanInstall',label:'Can Install / Field Work',type:'select',options:['N','Y']},{key:'Active',label:'Active',type:'select',options:['Y','N']}
  ],Object.assign({Active:'Y',CanDrive:'N',CanInstall:'N'},p),async data=>api('upsertPersonnel',{pin:accessPin(),personnel:Object.assign({},p,data)}));
}
function editTeam(id=''){
  const t=state.teams.find(x=>String(x.TeamID)===String(id))||{};
  const options=[{value:'',label:'None'}].concat(activePersonnelSorted().map(p=>({value:personName(p),label:personnelLabel(p)})));
  openSettingsForm(t.TeamID?'Team Details':'Add Team',[
    {key:'TeamName',label:'Team Name'},{key:'TeamLead',label:'Default Team Lead',type:'select',options,help:'This is the team’s usual lead. It does not force every SO or item to use that person.'},{key:'Active',label:'Active',type:'select',options:['Y','N']}
  ],Object.assign({Active:'Y'},t),async data=>api('upsertTeam',{pin:accessPin(),team:Object.assign({},t,data)}));
}
function editVehicle(id=''){
  const v=state.vehicles.find(x=>String(x.VehicleID)===String(id))||{};
  openSettingsForm(v.VehicleID?'Vehicle Details':'Add Vehicle',[
    {key:'VehicleCode',label:'Vehicle Code'},{key:'VehicleLabel',label:'Vehicle Label'},{key:'PlateNo',label:'Plate Number'},{key:'PlateEnding',label:'Plate Ending'},{key:'Active',label:'Active',type:'select',options:['Y','N']}
  ],Object.assign({Active:'Y'},v),async data=>api('upsertVehicle',{pin:accessPin(),vehicle:Object.assign({},v,data)}));
}
function editAnnouncement(id=''){
  const a=state.announcements.find(x=>String(x.AnnouncementID)===String(id))||{};
  openSettingsForm(a.AnnouncementID?'Announcement Details':'Add Announcement',[
    {key:'Title',label:'Title'},{key:'Message',label:'Message',type:'textarea'},{key:'PostedBy',label:'Posted By'},{key:'ExpiryDate',label:'Expiry Date'},{key:'Active',label:'Active',type:'select',options:['Y','N']}
  ],Object.assign({Active:'Y'},a),async data=>api('upsertAnnouncement',{pin:accessPin(),announcement:Object.assign({},a,data)}));
}

function renderSettings(){
  const personnelBody=`${state.admin?`<div class="sectionActions"><button class="primary" onclick="editPersonnel('')">+ Add Personnel</button></div>`:''}${departmentGroupedRows(activePersonnelSorted(),p=>settingsRow({title:personName(p),role:personRole(p),dept:personDept(p),onClick:`editPersonnel('${escapeAttr(p.PersonnelID)}')`}))}`;
  const teamBody=`${state.admin?`<div class="sectionActions"><button class="primary" onclick="editTeam('')">+ Add Team</button></div>`:''}${settingsList(state.teams.map(t=>settingsRow({title:t.TeamName,role:t.TeamLead?`Usual lead: ${t.TeamLead}`:'No default lead',dept:t.Active==='N'?'Inactive':'Active',onClick:`editTeam('${escapeAttr(t.TeamID)}')`})),'No teams yet.')}`;
  const driverBody=`<div class="hint sectionNote">Drivers are personnel with Can Drive = Y. No separate Drivers sheet is needed.</div>${settingsList(driverPeople().map(p=>settingsRow({title:personName(p),role:personRole(p),dept:personDept(p),onClick:`editPersonnel('${escapeAttr(p.PersonnelID)}')`})),'No driver-capable personnel yet.')}`;
  const vehicleBody=`${state.admin?`<div class="sectionActions"><button class="primary" onclick="editVehicle('')">+ Add Vehicle</button></div>`:''}${settingsList(state.vehicles.map(v=>settingsRow({title:displayVehicle(v.VehicleID||v.VehicleCode)||v.VehicleLabel,role:v.PlateNo||'Vehicle',dept:v.Active==='N'?'Inactive':'Active',onClick:`editVehicle('${escapeAttr(v.VehicleID)}')`})),'No vehicles yet.')}`;
  const announcementBody=`${state.admin?`<div class="sectionActions"><button class="primary" onclick="editAnnouncement('')">+ Add Announcement</button></div>`:''}${settingsList(state.announcements.map(a=>settingsRow({title:a.Title,role:a.Active==='N'?'Inactive':'Active',dept:a.ExpiryDate?`Until ${a.ExpiryDate}`:'No expiry',onClick:`editAnnouncement('${escapeAttr(a.AnnouncementID)}')`})),'No announcements yet.')}`;
  const processBody=`<div class="pillWrap compactPills">${PROCESS_COLUMNS.map(x=>`<span class="pill info">${escapeHtml(x)}</span>`).join('')}</div>${state.admin?`<div class="sectionActions"><button class="primary" onclick="editSetting('PROCESS_COLUMNS','Detailed Processes','Separate processes with |. Major Kanban stages remain fixed.')">Edit Processes</button></div>`:''}`;
  const accessBody=state.admin?`<div class="sectionActions"><button class="primary" onclick="editSetting('ADMIN_PIN','Admin PIN','')">Change Admin PIN</button><button class="primary" onclick="editSetting('OFFICER_PIN','Officer PIN','')">Change Officer PIN</button></div>`:`<div class="hint">Admin access is required to change PINs.</div>`;
  $('page-settings').innerHTML=`<div class="pageTitle"><div><h1>Settings</h1><div class="hint">The clean database keeps only master lists needed by the app. Team members and default vehicle passengers are assigned during actual work instead of being stored in separate sheets.</div></div></div>
    <div class="settingsStack settingsTileGrid">
      ${collapsible('Personnel',personnelBody,{count:state.personnel.length})}
      ${collapsible('Teams',teamBody,{count:state.teams.length})}
      ${collapsible('Drivers',driverBody,{count:driverPeople().length})}
      ${collapsible('Vehicles',vehicleBody,{count:state.vehicles.length})}
      ${collapsible('Announcements',announcementBody,{count:state.announcements.length})}
      ${collapsible('Production Processes',processBody,{count:PROCESS_COLUMNS.length})}
      ${collapsible('Access',accessBody,{count:2})}
    </div>`;
}
function renderAbout(){$('page-about').innerHTML=`<div class="pageTitle"><div><h1>About</h1><div class="hint">System information and credits.</div></div></div><div class="panel aboutBox"><h2>SJTC Production Department Dashboard</h2><p><b>Version:</b> ${escapeHtml(APP_VERSION)}<br><b>Company:</b> SJTC Manufacturing Inc. / Focolare Carpentry</p><p>Version 3 uses item-level team assignments, immediate removal of delivered items from the active Kanban, a read-only Project History, and a clean nine-sheet Google Sheets database.</p><p><b>Developed by:</b> Engr. CK Empeynado</p></div>`;}
function openModal(id){$(id).style.display='flex';bindCloseButtons();applyFieldTips();}
function closeModal(id){$(id).style.display='none';}
function bindCloseButtons(){document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));}

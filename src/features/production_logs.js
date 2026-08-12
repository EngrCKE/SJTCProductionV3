/** SJTC Dashboard v3.0.4 — production movement log register */
function productionLogDuration(log){
  const start=new Date(log.StartedAt||0); if(isNaN(start.getTime())) return '—';
  const end=log.FinishedAt?new Date(log.FinishedAt):new Date(); if(isNaN(end.getTime())) return '—';
  const mins=Math.max(0,Math.round((end-start)/60000));
  if(mins<60)return `${mins}m`;
  const hrs=mins/60; if(hrs<24)return `${hrs.toFixed(hrs<10?1:0)}h`;
  const days=hrs/24; return `${days.toFixed(days<10?1:0)}d`;
}
async function ensureProductionLogs(force=false){
  if(!force && state.productionLogsLoaded)return state.productionLogs;
  const res=await api('getProductionLogs',{scope:state.productionLogsScope||'active'});
  state.productionLogs=res.logs||[];state.productionLogsLoaded=true;renderProductionLogs();return state.productionLogs;
}
function renderProductionLogs(){
  const page=$('page-production-logs'); if(!page)return;
  const old=$('productionLogSearch');const q=String(old?old.value:'').trim().toLowerCase();
  const list=(state.productionLogs||[]).filter(l=>[l.SONumber,l.ClientName,l.ItemDescription,l.FromStatus,l.ToStatus,l.TeamName,l.AssignedPersonnel,l.MovedBy,l.Remarks].join(' ').toLowerCase().includes(q));
  page.innerHTML=`
    <div class="pageTitle"><div><h1>Production Logs</h1><div class="hint">Process register generated from item movements. Each move closes the previous process and starts the next one automatically.</div></div><div class="line"><button id="btnReloadProductionLogs">Refresh Logs</button><button class="primary" id="btnExportProductionLogs">Export CSV</button></div></div>
    <div class="toolbar productionLogToolbar"><input id="productionLogSearch" placeholder="Search SO#, client, item, process, team or PIC..." value="${escapeAttr(q)}" /><select id="productionLogScope"><option value="active" ${state.productionLogsScope==='active'?'selected':''}>Active Projects</option><option value="all" ${state.productionLogsScope==='all'?'selected':''}>All Records</option></select></div>
    <div class="panel tableScroll productionLogRegister"><table><thead><tr><th>SO#</th><th>Client</th><th>Item</th><th>Process</th><th>Team</th><th>Person in Charge</th><th>Date Start</th><th>Date End</th><th>Duration</th><th>Moved By</th><th>Remarks</th></tr></thead><tbody>
      ${list.map(l=>`<tr data-production-log-item="${escapeAttr(l.ItemID||'')}"><td><b>${escapeHtml(l.SONumber||'')}</b></td><td>${escapeHtml(l.ClientName||'—')}</td><td>${escapeHtml(l.ItemDescription||'—')}</td><td><b>${escapeHtml(l.ToStatus||'—')}</b>${l.FromStatus?`<div class="small">${escapeHtml(l.FromStatus)} → ${escapeHtml(l.ToStatus)}</div>`:''}</td><td>${escapeHtml(l.TeamName||teamName(l.TeamID)||'—')}</td><td>${escapeHtml(l.AssignedPersonnel||'—')}</td><td>${niceDT(l.StartedAt)}</td><td>${l.FinishedAt?niceDT(l.FinishedAt):`<span class="pill ok">Ongoing</span>`}</td><td>${productionLogDuration(l)}</td><td>${escapeHtml(l.MovedBy||'—')}</td><td>${escapeHtml(l.Remarks||'—')}</td></tr>`).join('')||`<tr><td colspan="11" class="hint">${state.productionLogsLoaded?'No production logs match this view.':'Open this tab to load production logs.'}</td></tr>`}
    </tbody></table></div>`;
  const search=$('productionLogSearch');if(search)search.oninput=renderProductionLogs;
  const scope=$('productionLogScope');if(scope)scope.onchange=async()=>{state.productionLogsScope=scope.value;state.productionLogsLoaded=false;await ensureProductionLogs(true);};
  const reload=$('btnReloadProductionLogs');if(reload)reload.onclick=e=>runAction(e,'Refreshing production logs...',async()=>ensureProductionLogs(true));
  const exp=$('btnExportProductionLogs');if(exp)exp.onclick=()=>exportProductionLogsCSV(list);
  document.querySelectorAll('[data-production-log-item]').forEach(row=>row.onclick=()=>{const id=row.dataset.productionLogItem;if(id&&state.items.some(i=>String(i.ItemID)===String(id)))openItemDetails(id);});
}
function csvCell(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`;}
function exportProductionLogsCSV(rows){
  const headers=['SO#','Client','Item','Process','Team','Person in Charge','Date Start','Date End','Moved By','Remarks'];
  const lines=[headers.map(csvCell).join(',')].concat((rows||[]).map(l=>[l.SONumber,l.ClientName,l.ItemDescription,l.ToStatus,l.TeamName||teamName(l.TeamID),l.AssignedPersonnel,l.StartedAt,l.FinishedAt,l.MovedBy,l.Remarks].map(csvCell).join(',')));
  const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SJTC-Production-Logs-${ymd(new Date())}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

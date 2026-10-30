/** One logistics request, several destinations and scheduled activities. */
function logisticsItinerary(request){
  const payload=request.Payload||{};
  if(Array.isArray(payload.Itinerary) && payload.Itinerary.length)return payload.Itinerary.map(row=>({...row}));
  if(!request.StartDT)return [];
  const start=new Date(request.StartDT);
  if(isNaN(start.getTime()))return [];
  return [{Activity:displayType(request.Type)||'Delivery',Destination:payload.Address||payload.Destination||'',StartDT:start.toISOString(),EndDT:request.EndDT||new Date(start.getTime()+4*3600000).toISOString(),Notes:''}];
}
function itineraryBounds(rows){
  if(!rows.length || rows.length>20)throw new Error('Add between 1 and 20 destinations / schedules.');
  const normalized=rows.map((row,index)=>{
    const start=new Date(row.StartDT),end=new Date(row.EndDT);
    if(!row.StartDT||!row.EndDT||isNaN(start.getTime())||isNaN(end.getTime())||end<=start)throw new Error(`Schedule ${index+1}: enter a valid start and a later end.`);
    if(!String(row.Destination||'').trim())throw new Error(`Schedule ${index+1}: enter a destination or the main address.`);
    return {...row,Activity:String(row.Activity||'Delivery').trim(),Destination:String(row.Destination).trim(),StartDT:start.toISOString(),EndDT:end.toISOString(),Notes:String(row.Notes||'').trim()};
  });
  return {rows:normalized,StartDT:new Date(Math.min(...normalized.map(r=>new Date(r.StartDT)))).toISOString(),EndDT:new Date(Math.max(...normalized.map(r=>new Date(r.EndDT)))).toISOString()};
}
function itineraryLocalInput(value){
  if(!value)return '';
  const date=new Date(value);if(isNaN(date.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function itineraryEditorHTML(rows,prefix){
  const activities=['Delivery','Installation','Client pick-up','Client Call','Service','Collection / Return'];
  return `<section class="panel itineraryEditor" id="${prefix}Itinerary"><h3 data-it-title>Locations &amp; Schedules</h3><div class="hint">Add the locations or activities you need. Multiple schedules can use the same main address, such as Monday delivery followed by installation until Wednesday. Add separate entries for visits with gaps. Request details and assigned manpower apply to all entries.</div><div class="itineraryRows">${rows.map((row,index)=>`<div class="itineraryRow" data-it-row><div class="line" style="justify-content:space-between"><b data-it-label>Schedule ${index+1}</b><button type="button" data-remove-it>Remove</button></div><div class="twoCol"><div><label>Activity</label><select data-it-field="Activity">${[...new Set([...activities,row.Activity].filter(Boolean))].map(a=>`<option value="${escapeAttr(a)}" ${a===row.Activity?'selected':''}>${escapeHtml(a)}</option>`).join('')}</select></div><div data-it-location><label>Destination / Address</label><input data-it-field="Destination" maxlength="1000" value="${escapeAttr(row.Destination||'')}" placeholder="Use main address, or enter another destination"></div><div data-it-times><label>Start date &amp; time</label><input type="datetime-local" data-it-field="StartDT" value="${itineraryLocalInput(row.StartDT)}"></div><div data-it-times><label>End date &amp; time</label><input type="datetime-local" data-it-field="EndDT" value="${itineraryLocalInput(row.EndDT)}"></div></div><label>Activity notes</label><textarea data-it-field="Notes" maxlength="1000" rows="2">${escapeHtml(row.Notes||'')}</textarea></div>`).join('')}</div><button type="button" id="${prefix}AddSchedule">+ Add destination / schedule</button></section>`;
}
function itineraryEditorValues(prefix,fallback=''){
  const root=$(prefix+'Itinerary');
  if(!root)return [];
  return Array.from(root.querySelectorAll('[data-it-row]')).map(el=>{
    const row={};['Activity','Destination','StartDT','EndDT','Notes'].forEach(key=>{row[key]=el.querySelector(`[data-it-field="${key}"]`).value.trim();});
    if(!row.Destination)row.Destination=fallback;
    return row;
  });
}
function bindItineraryEditor(prefix){
  const root=$(prefix+'Itinerary');if(!root)return;
  const repaint=rows=>{root.outerHTML=itineraryEditorHTML(rows,prefix);bindItineraryEditor(prefix);applyItineraryOptionVisibility(prefix);};
  $(prefix+'AddSchedule').onclick=()=>{
    const rows=itineraryEditorValues(prefix);
    if(rows.length>=20)return alert('Use at most 20 schedule entries per request.');
    const last=rows[rows.length-1]||{},start=new Date(last.EndDT||Date.now());
    rows.push({Activity:'Installation',Destination:last.Destination||'',StartDT:isNaN(start.getTime())?'':start.toISOString(),EndDT:isNaN(start.getTime())?'':new Date(start.getTime()+4*3600000).toISOString(),Notes:''});
    repaint(rows);
  };
  root.querySelectorAll('[data-remove-it]').forEach((button,index)=>button.onclick=()=>{
    const rows=itineraryEditorValues(prefix);if(rows.length<=1)return alert('Keep at least one schedule.');rows.splice(index,1);repaint(rows);
  });
}
function itinerarySummaryHTML(request){
  return `<ol class="itinerarySummary">${logisticsItinerary(request).map(row=>`<li><b>${escapeHtml(row.Activity)}</b><div>${escapeHtml(niceDT(row.StartDT))} → ${escapeHtml(niceDT(row.EndDT))}</div><div>${escapeHtml(row.Destination)}</div>${row.Notes?`<div class="small">${escapeHtml(row.Notes)}</div>`:''}</li>`).join('')}</ol>`;
}
function shiftLogisticsItinerary(rows,targetDate,sourceDate){
  if(!targetDate||!rows.length)return rows;
  const first=Math.min(...rows.map(row=>new Date(row.StartDT).getTime()));
  if(!Number.isFinite(first))return rows;
  const anchor=sourceDate||ymd(new Date(first));
  const delta=Math.round((new Date(targetDate+'T12:00:00')-new Date(anchor+'T12:00:00'))/86400000);
  return rows.map(row=>{const shift=value=>{const d=new Date(value);d.setDate(d.getDate()+delta);return d.toISOString();};return {...row,StartDT:shift(row.StartDT),EndDT:shift(row.EndDT)};});
}
function logisticsOccurrencesForDay(request,date){
  const start=new Date(date+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
  return logisticsItinerary(request).flatMap((row,index)=>{
    const from=new Date(row.StartDT),to=new Date(row.EndDT);
    if(isNaN(from.getTime())||isNaN(to.getTime())||from>=end||to<=start)return [];
    return [{...request,StartDT:new Date(Math.max(from,start)).toISOString(),EndDT:new Date(Math.min(to,end)).toISOString(),OccurrenceDate:date,ItineraryIndex:index,Activity:row.Activity,Payload:{...(request.Payload||{}),Address:row.Destination,Destination:row.Destination,Notes:row.Notes||request.Payload?.Notes||''}}];
  });
}
function logisticsForDay(requests,date){
  return requests.flatMap(r=>logisticsOccurrencesForDay(r,date)).sort((a,b)=>new Date(a.StartDT)-new Date(b.StartDT));
}
function logisticsItineraryOptions(payload){
  const rows=Array.isArray(payload.Itinerary)?payload.Itinerary:[];
  return {locations:payload.MultipleLocations===true || payload.MultipleLocations===undefined&&new Set(rows.map(r=>r.Destination)).size>1,
    schedules:payload.MultipleSchedules===true || payload.MultipleSchedules===undefined&&rows.length>1};
}
function itineraryOptionsHTML(rows,prefix,options={}){
  const first=rows[0]||{},locations=!!options.locations,schedules=!!options.schedules;
  return `<div class="panel itineraryOptions"><div class="line"><label class="checkInline"><input type="checkbox" id="${prefix}MultipleLocations" ${locations?'checked':''}> Multiple locations</label><label class="checkInline"><input type="checkbox" id="${prefix}MultipleSchedules" ${schedules?'checked':''}> Multiple schedules</label></div><div id="${prefix}SingleSchedule" ${schedules?'hidden':''}><div class="twoCol"><div><label>Start date &amp; time</label><input type="datetime-local" id="${prefix}SingleStart" value="${itineraryLocalInput(first.StartDT)}"></div><div><label>End date &amp; time</label><input type="datetime-local" id="${prefix}SingleEnd" value="${itineraryLocalInput(first.EndDT)}"></div></div></div><div id="${prefix}MultiSchedule" ${locations||schedules?'':'hidden'}>${itineraryEditorHTML(rows,prefix)}</div></div>`;
}
function applyItineraryOptionVisibility(prefix){
  const locations=$(prefix+'MultipleLocations').checked,schedules=$(prefix+'MultipleSchedules').checked,root=$(prefix+'Itinerary');
  const title=root.querySelector('[data-it-title]');if(title)title.textContent=locations&&schedules?'Locations & Schedules':locations?'Locations':'Schedules';
  $(prefix+'SingleSchedule').hidden=schedules;
  $(prefix+'MultiSchedule').hidden=!locations&&!schedules;
  root.querySelectorAll('[data-it-location]').forEach(el=>el.hidden=!locations);
  root.querySelectorAll('[data-it-times]').forEach(el=>el.hidden=!schedules);
  root.querySelectorAll('[data-it-label]').forEach((el,index)=>el.textContent=(schedules?'Schedule ':'Location ')+(index+1));
  $(prefix+'AddSchedule').textContent=locations&&schedules?'+ Add location / schedule':locations?'+ Add location':'+ Add schedule';
}
function bindItineraryOptions(prefix){
  bindItineraryEditor(prefix);
  $(prefix+'MultipleLocations').onchange=()=>applyItineraryOptionVisibility(prefix);
  $(prefix+'MultipleSchedules').onchange=()=>{
    const first=$(prefix+'Itinerary').querySelector('[data-it-row]');
    if(first){
      ['Start','End'].forEach(key=>{
        const simple=$(prefix+'Single'+key),multi=first.querySelector(`[data-it-field="${key}DT"]`);
        if($(prefix+'MultipleSchedules').checked)multi.value=simple.value;else simple.value=multi.value;
      });
    }
    applyItineraryOptionVisibility(prefix);
  };
  applyItineraryOptionVisibility(prefix);
}
function readItineraryPlan(prefix,fallback,activity){
  const locations=$(prefix+'MultipleLocations').checked,schedules=$(prefix+'MultipleSchedules').checked;
  const single={Activity:activity,Destination:fallback,StartDT:$(prefix+'SingleStart').value,EndDT:$(prefix+'SingleEnd').value,Notes:''};
  const rows=locations||schedules?itineraryEditorValues(prefix,fallback).map(row=>({...row,Destination:locations?row.Destination:fallback,StartDT:schedules?row.StartDT:single.StartDT,EndDT:schedules?row.EndDT:single.EndDT})):[single];
  return {...itineraryBounds(rows),multiple:locations||schedules,locations,schedules};
}

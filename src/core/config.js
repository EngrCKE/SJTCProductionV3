/** SJTC Dashboard v3.0.8 — modular source */
/***********************
 * SJTC Production Department Dashboard v3.0.8
 * Frontend for GitHub Pages
 * Set PRODUCTION_API_URL to your Cloudflare Worker URL after deployment.
 ***********************/
const PRODUCTION_API_URL = "https://production.sjtc-kobempeynado.workers.dev/";
const APP_VERSION = "3.0.8";
// Logistics is now native to this Production Dashboard database.
const ADMIN_PIN_KEY = "sjtc_production_access_pin";
const DEMO_PIN = "123456";
const DEMO_OFFICER_PIN = "246810";
const AUTO_REFRESH_MS = 120000; // Auto-sync interval. Change to 30000 for 30 seconds, 120000 for 2 minutes.

const DEFAULT_PROCESS_COLUMNS = [
  "Design","Site Verification","Pre-Milling","Stripping","Milling","CNC","Wood Craft","Metal Craft","Repair","Assembly",
  "Sanding","Painting","Staining","Varnishing","Upholstery","Hardware Installation","Quality Control","Delivery"
];

// The board is grouped into major production stages, while ItemStatus remains the exact detailed process saved in Google Sheets.
const KANBAN_STAGES = [
  { key:"Design", label:"Design", processes:["Design","Site Verification"], legacyProcesses:["Project Briefing"] },
  { key:"Pre-Milling", label:"Pre-Milling", processes:["Pre-Milling","Stripping"] },
  { key:"Fabrication", label:"Fabrication", processes:["Milling","CNC","Wood Craft","Metal Craft","Repair","Assembly"] },
  { key:"Finishing", label:"Finishing", processes:["Sanding","Painting","Staining","Varnishing","Upholstery"] },
  { key:"Pre-Delivery", label:"Pre-Delivery", processes:["Hardware Installation","Quality Control"] },
  { key:"Delivery", label:"Delivery", processes:["Delivery"] }
];

function normalizeProcessColumns(raw){
  const configured = Array.isArray(raw) ? raw : String(raw || "").split("|");
  const extras = configured.map(x=>String(x||"").trim()).filter(Boolean).filter(x=>!DEFAULT_PROCESS_COLUMNS.includes(x));
  return [...DEFAULT_PROCESS_COLUMNS, ...extras.filter((x,i,a)=>a.indexOf(x)===i)];
}
let PROCESS_COLUMNS = [...DEFAULT_PROCESS_COLUMNS];

const REQUEST_TYPES = ["Delivery", "Client Call", "Service"];

const $ = id => document.getElementById(id);
function debounce(fn, wait=250){ let t; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), wait); }; }
const pad2 = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const nowISO = () => new Date().toISOString();
const niceDate = iso => iso ? new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "—";
const niceDT = iso => iso ? new Date(iso).toLocaleString() : "—";
function toLocalDTInput(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function fromLocalDTInput(value){
  if(!value) return "";
  const d = new Date(value);
  if(isNaN(d.getTime())) return "";
  return d.toISOString();
}
const escapeHtml = s => String(s ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const escapeAttr = s => escapeHtml(s).replace(/"/g,"&quot;");
const cleanSO = v => String(v || "").trim().replace(/^SO[-\s]*/i, "");

let autoRefreshTimer = null;
let isAutoRefreshing = false;
let actionBusy = false;

let state = {
  admin: false, officer: false, accessLevel: "staff",
  page: "overview",
  sidebarCollapsed: localStorage.getItem("sjtc_sidebar_collapsed") === "Y",
  projects: [], items: [], notes: [], logs: [], announcements: [],
  historyProjects: [], historyLoaded: false, currentHistoryProject: null,
  productionLogs: [], productionLogsLoaded: false, productionLogsScope: "active",
  logisticsRequests: [], logisticsItems: [],
  teams: [], teamMembers: [], personnel: [], drivers: [], vehicles: [], vehiclePassengers: [],
  settings: {}, currentProjectId: null, editingProjectId: null,
  pendingMove: null, pendingScheduleId: null, logisticsOffsetWeeks: 0, editingLogId: null, boardSearch: "",
  loadedProjectNotes: {}, loadedItemLogs: {}, syncMeta: {}
};

const demo = (() => {
  const today = new Date();
  const d = n => { const x = new Date(today); x.setDate(x.getDate()+n); return ymd(x); };
  const personnel = [
    { PersonnelID:"PER-0001", PersonnelName:"Juan D.", Role:"Team Lead", Department:"Production", PrimaryTeamID:"TEAM-0001", ContactNumber:"", CanDrive:"N", CanInstall:"Y", Active:"Y" },
    { PersonnelID:"PER-0002", PersonnelName:"Mark", Role:"Carpenter", Department:"Production", PrimaryTeamID:"TEAM-0001", ContactNumber:"", CanDrive:"N", CanInstall:"Y", Active:"Y" },
    { PersonnelID:"PER-0003", PersonnelName:"Allan", Role:"Helper", Department:"Production", PrimaryTeamID:"TEAM-0001", ContactNumber:"", CanDrive:"N", CanInstall:"Y", Active:"Y" },
    { PersonnelID:"PER-0004", PersonnelName:"Rico", Role:"Painter", Department:"Production", PrimaryTeamID:"TEAM-0002", ContactNumber:"", CanDrive:"N", CanInstall:"N", Active:"Y" },
    { PersonnelID:"PER-0005", PersonnelName:"Mang Tony", Role:"Driver", Department:"Logistics", PrimaryTeamID:"", ContactNumber:"0917 555 1111", CanDrive:"Y", CanInstall:"N", Active:"Y" },
    { PersonnelID:"PER-0006", PersonnelName:"CK Empeynado", Role:"Admin / Production Manager", Department:"Admin", PrimaryTeamID:"", ContactNumber:"", CanDrive:"Y", CanInstall:"N", Active:"Y" },
    { PersonnelID:"PER-0007", PersonnelName:"Design Staff", Role:"Designer", Department:"Design", PrimaryTeamID:"", ContactNumber:"", CanDrive:"N", CanInstall:"N", Active:"Y" }
  ];
  return {
    settings: { ADMIN_PIN: DEMO_PIN, OFFICER_PIN: DEMO_OFFICER_PIN, APP_NAME: "SJTC Production Department Dashboard", VERSION: APP_VERSION, PROCESS_COLUMNS: DEFAULT_PROCESS_COLUMNS.join("|") },
    personnel,
    drivers: [{ DriverID:"DRV-0001", PersonnelID:"PER-0005", DriverName:"Mang Tony", DriverPhone:"0917 555 1111", Active:"Y" }],
    vehicles: [{ VehicleID:"VEH-0001", VehicleCode:"TRUCK-1", VehicleLabel:"Truck 1", PlateNo:"ABC 1234", PlateEnding:"4", Active:"Y" }],
    vehiclePassengers: [{ PassengerID:"VP-0001", VehicleID:"VEH-0001", PersonnelID:"PER-0003", PassengerName:"Allan", Active:"Y" }],
    teams: [
      { TeamID:"TEAM-0001", TeamName:"Team A", TeamLead:"Juan D.", Active:"Y" },
      { TeamID:"TEAM-0002", TeamName:"Finishing Team", TeamLead:"Rico", Active:"Y" }
    ],
    teamMembers: [
      { TeamMemberID:"TM-0001", TeamID:"TEAM-0001", MemberName:"Mark", Role:"Carpenter", Active:"Y" },
      { TeamMemberID:"TM-0002", TeamID:"TEAM-0001", MemberName:"Allan", Role:"Helper", Active:"Y" },
      { TeamMemberID:"TM-0003", TeamID:"TEAM-0002", MemberName:"Rico", Role:"Painter", Active:"Y" }
    ],
    projects: [
      { ProjectID:"PROJ-0001", SONumber:"0264", ClientName:"Dela Cruz", ContactNumber:"0917 123 4567", SiteAddress:"BGC, Taguig", Address:"BGC, Taguig", ProjectSummary:"Kitchen Cabinet Package", DueDate:d(5), OverallStatus:"In Production", Priority:"High", DefaultTeamID:"TEAM-0001", Coordinator:"Juan D.", CreatedBy:"Kobee", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" },
      { ProjectID:"PROJ-0002", SONumber:"0265", ClientName:"Reyes", ContactNumber:"0918 222 3333", SiteAddress:"Makati", Address:"Makati", ProjectSummary:"Wardrobe and TV Console", DueDate:d(-2), OverallStatus:"In Production", Priority:"Urgent", DefaultTeamID:"TEAM-0002", Coordinator:"Rico", CreatedBy:"Kobee", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" }
    ],
    items: [
      { ItemID:"ITEM-0001", ProjectID:"PROJ-0001", SONumber:"0264", ItemDescription:"Kitchen Base Cabinet", Quantity:"1", Unit:"set", ItemStatus:"CNC", DeliveryStatus:"Not Requested", AssignedTeamID:"TEAM-0001", AssignedPersonnel:"Juan D.", ItemDueDate:d(5), Remarks:"", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" },
      { ItemID:"ITEM-0002", ProjectID:"PROJ-0001", SONumber:"0264", ItemDescription:"Kitchen Wall Cabinet", Quantity:"1", Unit:"set", ItemStatus:"Assembly", DeliveryStatus:"Not Requested", AssignedTeamID:"TEAM-0001", AssignedPersonnel:"Mark", ItemDueDate:d(5), Remarks:"", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" },
      { ItemID:"ITEM-0003", ProjectID:"PROJ-0001", SONumber:"0264", ItemDescription:"Tall Pantry Cabinet", Quantity:"1", Unit:"pc", ItemStatus:"Pre-Milling", DeliveryStatus:"Not Requested", AssignedTeamID:"TEAM-0001", AssignedPersonnel:"Allan", ItemDueDate:d(5), Remarks:"", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" },
      { ItemID:"ITEM-0004", ProjectID:"PROJ-0002", SONumber:"0265", ItemDescription:"Wardrobe Cabinet", Quantity:"1", Unit:"set", ItemStatus:"Sanding", DeliveryStatus:"Not Requested", AssignedTeamID:"TEAM-0002", AssignedPersonnel:"Rico", ItemDueDate:d(-2), Remarks:"", CreatedAt:nowISO(), UpdatedAt:nowISO(), Active:"Y" }
    ],
    notes: [{ NoteID:"NOTE-0001", ProjectID:"PROJ-0001", ItemID:"", SONumber:"0264", NoteText:"Initial production review completed.", Signature:"Kobee", CreatedAt:nowISO(), Active:"Y" }],
    logs: [{ LogID:"LOG-0001", ItemID:"ITEM-0001", ProjectID:"PROJ-0001", SONumber:"0264", ItemDescription:"Kitchen Base Cabinet", FromStatus:"Milling", ToStatus:"CNC", AssignedPersonnel:"Juan D.", StartedAt:nowISO(), FinishedAt:"", MovedBy:"Kobee", Remarks:"", CreatedAt:nowISO(), EditedAt:"", EditedBy:"", CorrectionNote:"" }],
    announcements: [{ AnnouncementID:"ANN-0001", Title:"Daily Reminder", Message:"Update production status before end of shift.", PostedBy:"Kobee", CreatedAt:nowISO(), ExpiryDate:"", Active:"Y" }],
    logisticsRequests: [{ RequestID:"REQ-DEMO-1", Type:"Delivery", Status:"PENDING", StartDT:new Date().toISOString(), EndDT:new Date(Date.now()+4*3600000).toISOString(), RequestedBy:"Production", DriverCode:"", VehicleCode:"", Payload:{ SONumber:"0264", ClientName:"Dela Cruz", Address:"BGC, Taguig", ContactNumber:"0917 123 4567", Items:"Kitchen Base Cabinet", Notes:"Partial delivery request", AreaClass:"NCR" }, TripStatus:"READY" }],
    logisticsItems: []
  };
})();

const API_TIMEOUT_MS = 45000;
const API_SAFE_RETRY_ACTIONS = new Set([
  "productionBootstrapV3", "productionBootstrapV2", "productionBootstrap", "getProjectNotes", "getItemLogs",
  "getProjectHistoryIndex", "getProjectHistory",
  "validateAccess", "validateAdmin"
]);


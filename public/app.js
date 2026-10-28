const $ = (id) => document.getElementById(id);
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
$("attendanceDate").value = localDate;
$("reportMonth").value = localDate.slice(0,7);
let students = [];
let attendanceRows = [];

async function api(url, options={}) {
  const response = await fetch(url, { headers: {"Content-Type":"application/json", ...(options.headers||{})}, ...options });
  if (!response.ok) {
    const body = await response.json().catch(()=>({error:"Request failed"}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}
function message(id, text, good=false) {
  $(id).textContent = text;
  $(id).style.color = good ? "#16804c" : "#b42318";
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
async function loadStudents() {
  students = await api("/api/students");
  $("studentCount").textContent = students.length;
  renderStudents();
  await loadAttendance();
  await loadReport();
}
function renderStudents() {
  const body = $("studentsBody");
  if (!students.length) {
    body.innerHTML = '<tr><td class="empty" colspan="4">No students yet. Add a student above to get started.</td></tr>';
    return;
  }
  body.innerHTML = students.map(s => `<tr><td>${escapeHtml(s.roll_no)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.department)}</td><td><button class="secondary edit-student" data-id="${s.id}">Edit</button> <button class="secondary delete-student" data-id="${s.id}">Delete</button></td></tr>`).join("");
  body.querySelectorAll(".edit-student").forEach(btn => btn.onclick = async () => {
    const s = students.find(x => x.id === Number(btn.dataset.id));
    const name = prompt("Student name:", s.name); if (name === null) return;
    const roll = prompt("Roll number:", s.roll_no); if (roll === null) return;
    const department = prompt("Department:", s.department); if (department === null) return;
    try {
      await api(`/api/students/${s.id}`, {method:"PUT",body:JSON.stringify({name,roll_no:roll,department})});
      message("studentMessage","Student updated.",true); await loadStudents();
    } catch(e) { message("studentMessage",e.message); }
  });
  body.querySelectorAll(".delete-student").forEach(btn => btn.onclick = async () => {
    const s = students.find(x => x.id === Number(btn.dataset.id));
    if (!confirm(`Delete ${s.name} and their attendance records?`)) return;
    try { await api(`/api/students/${s.id}`,{method:"DELETE"}); await loadStudents(); }
    catch(e) { message("studentMessage",e.message); }
  });
}
$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/students",{method:"POST",body:JSON.stringify({
      roll_no:$("rollNo").value, name:$("studentName").value, department:$("department").value
    })});
    $("studentForm").reset(); $("department").value="CSE (AI & ML)";
    message("studentMessage","Student added successfully.",true); await loadStudents();
  } catch(err) { message("studentMessage",err.message); }
});
function renderAttendance() {
  $("attendanceHead").innerHTML = `<tr><th>Roll no.</th><th>Student</th>${[1,2,3,4,5,6,7].map(p=>`<th>P${p}</th>`).join("")}</tr>`;
  const body=$("attendanceBody");
  if (!attendanceRows.length) { body.innerHTML='<tr><td class="empty" colspan="9">Add students to begin recording attendance.</td></tr>'; return; }
  body.innerHTML=attendanceRows.map(s=>`<tr><td>${escapeHtml(s.roll_no)}</td><td>${escapeHtml(s.name)}</td>${s.periods.map((status,i)=>`<td class="period-cell"><select aria-label="${escapeHtml(s.name)} period ${i+1}" class="period-select ${status.toLowerCase()}" data-student="${s.id}" data-period="${i+1}"><option value="" ${status===""?"selected":""}>—</option><option value="P" ${status==="P"?"selected":""}>P</option><option value="A" ${status==="A"?"selected":""}>A</option></select></td>`).join("")}</tr>`).join("");
  body.querySelectorAll("select").forEach(sel=>sel.onchange=()=>{sel.className=`period-select ${sel.value.toLowerCase()}`;});
  updateTodayCounts();
}
function updateTodayCounts() {
  const selects=[...$("attendanceBody").querySelectorAll("select")];
  $("presentCount").textContent=selects.filter(s=>s.value==="P").length;
  $("absentCount").textContent=selects.filter(s=>s.value==="A").length;
}
async function loadAttendance() {
  const date=$("attendanceDate").value;
  if (!date) return;
  attendanceRows=await api(`/api/attendance?date=${encodeURIComponent(date)}`);
  renderAttendance();
}
$("attendanceDate").addEventListener("change", async()=>{try{await loadAttendance();message("attendanceMessage","");}catch(e){message("attendanceMessage",e.message);}});
function markAll(value) { $("attendanceBody").querySelectorAll("select").forEach(s=>{s.value=value;s.className=`period-select ${value.toLowerCase()}`;}); updateTodayCounts(); }
$("allPresent").onclick=()=>markAll("P");
$("allAbsent").onclick=()=>markAll("A");
$("saveAttendance").onclick=async()=>{
  const records=[...$("attendanceBody").querySelectorAll("select")].map(s=>({student_id:Number(s.dataset.student),period:Number(s.dataset.period),status:s.value}));
  try {
    await api(`/api/attendance/${$("attendanceDate").value}`,{method:"PUT",body:JSON.stringify({records})});
    message("attendanceMessage","Attendance saved successfully.",true); await loadAttendance(); await loadReport();
  } catch(e) { message("attendanceMessage",e.message); }
};
async function loadReport() {
  const month=$("reportMonth").value;
  if(!month)return;
  const rows=await api(`/api/reports/monthly?month=${encodeURIComponent(month)}`);
  const body=$("reportBody");
  if(!rows.length){body.innerHTML='<tr><td colspan="7" class="empty">No students registered yet.</td></tr>';return;}
  body.innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.roll_no)}</td><td>${escapeHtml(r.name)}</td><td>${r.working_periods}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.percentage.toFixed(2)}%</td><td class="${r.low_attendance?"low":"ok"}">${r.working_periods===0?"No records":r.low_attendance?"Below 75%":"On track"}</td></tr>`).join("");
}
$("reportMonth").addEventListener("change",()=>loadReport().catch(e=>message("reportMessage",e.message)));
$("exportCsv").onclick=()=>{if($("reportMonth").value)window.location.href=`/api/reports/monthly.csv?month=${encodeURIComponent($("reportMonth").value)}`;};
loadStudents().catch(e=>{console.error(e);message("studentMessage",e.message);});

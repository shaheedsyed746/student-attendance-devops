const express = require("express");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "attendance.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'CSE (AI & ML)',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date TEXT NOT NULL,
    period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
    status TEXT NOT NULL CHECK(status IN ('P','A')),
    UNIQUE(student_id, attendance_date, period)
  );
`);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/students", (_req, res) => {
  res.json(db.prepare("SELECT id, roll_no, name, department FROM students ORDER BY roll_no").all());
});

app.post("/api/students", (req, res) => {
  const roll = String(req.body.roll_no || "").trim();
  const name = String(req.body.name || "").trim();
  const department = String(req.body.department || "CSE (AI & ML)").trim();
  if (!roll || !name) return badRequest(res, "Roll number and student name are required.");
  try {
    const result = db.prepare("INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)")
      .run(roll, name, department || "CSE (AI & ML)");
    res.status(201).json(db.prepare("SELECT id, roll_no, name, department FROM students WHERE id = ?").get(result.lastInsertRowid));
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That roll number already exists." });
    throw error;
  }
});


app.put("/api/attendance/:date", (req, res) => {
  const date = req.params.date;
  const records = req.body.records;

  if (!validDate(date)) {
    return badRequest(res, "Use a valid date in YYYY-MM-DD format.");
  }

  if (!Array.isArray(records)) {
    return badRequest(res, "records must be an array.");
  }

  const studentExists = db.prepare(
    "SELECT id FROM students WHERE id=?"
  );

  const save = db.prepare(`
    INSERT INTO attendance
      (student_id, attendance_date, period, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, attendance_date, period)
    DO UPDATE SET status=excluded.status
  `);

  const remove = db.prepare(
    "DELETE FROM attendance WHERE student_id=? AND attendance_date=? AND period=?"
  );

  try {
    db.exec("BEGIN");

    for (const record of records) {
      const studentId = Number(record.student_id);
      const period = Number(record.period);
      const status = record.status;

      if (!Number.isInteger(studentId) || !studentExists.get(studentId)) {
        throw new Error("A student record is invalid.");
      }

      if (!Number.isInteger(period) || period < 1 || period > 7) {
        throw new Error("Period must be between 1 and 7.");
      }

      if (status === "P" || status === "A") {
        save.run(studentId, date, period, status);
      } else if (status === "") {
        remove.run(studentId, date, period);
      } else {
        throw new Error("Status must be P, A, or blank.");
      }
    }

    db.exec("COMMIT");

    res.json({
      message: "Attendance saved.",
      date,
      recordsSaved: records.length
    });
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (_) {}

    badRequest(res, error.message);
  }
});


app.delete("/api/students/:id", (req, res) => {
  const result = db.prepare("DELETE FROM students WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Student not found." });
  res.status(204).end();
});

app.get("/api/attendance", (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return badRequest(res, "Use a valid date in YYYY-MM-DD format.");
  const students = db.prepare("SELECT id, roll_no, name, department FROM students ORDER BY roll_no").all();
  const rows = db.prepare("SELECT student_id, period, status FROM attendance WHERE attendance_date=?").all(date);
  const lookup = new Map(rows.map(r => [`${r.student_id}:${r.period}`, r.status]));
  res.json(students.map(s => ({
    ...s,
    periods: Array.from({ length: 7 }, (_, i) => lookup.get(`${s.id}:${i + 1}`) || "")
  })));
});

app.put("/api/attendance/:date", (req, res) => {
  const date = req.params.date;
  const records = req.body.records;
  if (!validDate(date)) return badRequest(res, "Use a valid date in YYYY-MM-DD format.");
  if (!Array.isArray(records)) return badRequest(res, "records must be an array.");
  const studentExists = db.prepare("SELECT id FROM students WHERE id=?");
  const save = db.prepare(`
    INSERT INTO attendance (student_id, attendance_date, period, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, attendance_date, period) DO UPDATE SET status=excluded.status
  `);
  const remove = db.prepare("DELETE FROM attendance WHERE student_id=? AND attendance_date=? AND period=?");
  const transaction = db.transaction(() => {
    for (const record of records) {
      const studentId = Number(record.student_id);
      const period = Number(record.period);
      const status = record.status;
      if (!Number.isInteger(studentId) || !studentExists.get(studentId)) throw new Error("A student record is invalid.");
      if (!Number.isInteger(period) || period < 1 || period > 7) throw new Error("Period must be between 1 and 7.");
      if (status === "P" || status === "A") save.run(studentId, date, period, status);
      else if (status === "") remove.run(studentId, date, period);
      else throw new Error("Status must be P, A, or blank.");
    }
  });
  try {
    transaction();
    res.json({ message: "Attendance saved.", date, recordsSaved: records.length });
  } catch (error) {
    badRequest(res, error.message);
  }
});

app.get("/api/reports/monthly", (req, res) => {
  const month = req.query.month;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return badRequest(res, "Use month format YYYY-MM.");
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 1)).toISOString().slice(0,10);
  const students = db.prepare("SELECT id, roll_no, name, department FROM students ORDER BY roll_no").all();
  const counts = db.prepare(`
    SELECT student_id,
      SUM(CASE WHEN status='P' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN status='A' THEN 1 ELSE 0 END) AS absent
    FROM attendance WHERE attendance_date >= ? AND attendance_date < ?
    GROUP BY student_id
  `).all(start, end);
  const map = new Map(counts.map(c => [c.student_id, c]));
  // Working periods are saved attendance entries. Blank/unmarked periods are not counted.
  res.json(students.map(s => {
    const c = map.get(s.id) || { present: 0, absent: 0 };
    const present = Number(c.present || 0), absent = Number(c.absent || 0);
    const working = present + absent;
    return { ...s, working_periods: working, present, absent,
      percentage: working ? Number((present / working * 100).toFixed(2)) : 0,
      low_attendance: working > 0 && present / working < 0.75 };
  }));
});

app.get("/api/reports/monthly.csv", (req, res) => {
  const month = req.query.month;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return badRequest(res, "Use month format YYYY-MM.");
  const rows = app.locals.getMonthly(month);
  const fields = ["roll_no","name","department","working_periods","present","absent","percentage"];
  const quote = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [fields.join(","), ...rows.map(r => fields.map(f => quote(r[f])).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}.csv"`);
  res.send(csv);
});
app.locals.getMonthly = (month) => {
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 1)).toISOString().slice(0,10);
  const students = db.prepare("SELECT id, roll_no, name, department FROM students ORDER BY roll_no").all();
  const counts = db.prepare(`SELECT student_id,
    SUM(CASE WHEN status='P' THEN 1 ELSE 0 END) present,
    SUM(CASE WHEN status='A' THEN 1 ELSE 0 END) absent
    FROM attendance WHERE attendance_date >= ? AND attendance_date < ? GROUP BY student_id`).all(start, end);
  const map = new Map(counts.map(c => [c.student_id,c]));
  return students.map(s => {
    const c = map.get(s.id) || {present:0,absent:0};
    const present=Number(c.present||0), absent=Number(c.absent||0), working=present+absent;
    return {...s,working_periods:working,present,absent,percentage:working?Number((present/working*100).toFixed(2)):0};
  });
};

app.use("/api", (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});
app.listen(PORT, "0.0.0.0", () => console.log(`Attendance app running on http://localhost:${PORT}`));

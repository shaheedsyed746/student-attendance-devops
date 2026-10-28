# Student Attendance Management System Using DevOps Tools

A starter implementation based on the submitted project outline. It supports student management, seven-period daily attendance, monthly summaries, and CSV export.

## Prerequisites

- Node.js 20 or newer and npm
- Git
- Docker Desktop for container work
- Optional: Jenkins, Kubernetes (Docker Desktop Kubernetes or Minikube), Google Chrome for Selenium

## 1. Run locally (Windows PowerShell)

Open PowerShell in this project folder:

```powershell
npm install
npm start
```

Open http://localhost:3000.

The SQLite database is created automatically in `data/attendance.db`. Keep the `data` folder to preserve records.

## 2. Suggested demo

1. Add 3–5 sample students using fictional demo data.
2. Select today's date and mark each student's P/A values for P1–P7.
3. Click **Save attendance**.
4. Change the date and return to confirm saved values reload.
5. Select the current month and inspect totals and percentages.
6. Export the report as CSV.
7. Restart the server and confirm records remain saved.

## 3. Git and GitHub

```powershell
git init
git add .
git commit -m "Build student attendance management system"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Create an empty GitHub repository first and replace the placeholder URL with your repository URL.

## 4. Docker

Build and run:

```powershell
docker build -t student-attendance:local .
docker run --name attendance-demo -p 3000:3000 -v attendance-data:/data student-attendance:local
```

Open http://localhost:3000. The named Docker volume persists the SQLite database. If a container with that name already exists, remove it before re-running.

## 5. Jenkins

Use a Jenkins agent that has Node.js 20, npm, Docker, and permission to run Docker commands. Add this repository as a Pipeline job and select **Pipeline script from SCM**, with `Jenkinsfile` as the script path. The included pipeline checks JavaScript syntax, runs the basic tests, and builds an image. Docker access must be configured by the administrator.

Note: the Jenkinsfile uses Unix `sh` commands. For a Windows Jenkins agent, replace `sh` with `bat` steps.

## 6. Kubernetes (local cluster)

This manifest uses a local image named `student-attendance:local` and a 1 GiB PersistentVolumeClaim.

1. Enable Kubernetes in Docker Desktop or start Minikube.
2. Build the image in the same image environment the cluster uses. With Minikube, you can use `minikube image load student-attendance:local`.
3. Apply the manifest:

```powershell
kubectl apply -f k8s/deployment.yaml
kubectl get pods
kubectl get services
```

4. Open http://localhost:30080 if your cluster exposes NodePort locally. With Minikube, use `minikube service student-attendance --url` if needed.
5. Clean up after the demo with `kubectl delete -f k8s/deployment.yaml`.

SQLite and a single replica are appropriate for a classroom demo. For a production multi-replica deployment, use a server database such as MySQL or PostgreSQL and managed persistent storage.

## 7. Selenium smoke test

Start the application in one terminal, then in another:

```powershell
npm install
npm run test:e2e
```

Selenium requires Chrome and a compatible driver. Selenium Manager may download/manage the driver if the environment permits it. This is an initial browser smoke test, not the full ten-case test suite described in the report.

## API endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students` with `{ "roll_no": "...", "name": "...", "department": "..." }`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`
- `GET /api/attendance?date=YYYY-MM-DD`
- `PUT /api/attendance/YYYY-MM-DD` with `{ "records": [{ "student_id": 1, "period": 1, "status": "P" }] }`
- `GET /api/reports/monthly?month=YYYY-MM`
- `GET /api/reports/monthly.csv?month=YYYY-MM`

## Attendance calculation

The current report calculates working periods from recorded P/A entries: `present + absent`. Unmarked periods are excluded from the denominator, so save attendance for every applicable period before treating a monthly percentage as final. The low-attendance flag uses a configurable threshold currently set to 75% in the frontend/server logic.

## Important limitations

- This is a functional starter project for learning and demonstration, not a hardened production system.
- Authentication/roles, audit logs, CSRF protections, and administrator controls are not implemented.
- The supplied Jenkins pipeline and Kubernetes manifests need environment-specific setup before use.
- Use fictional or authorized student data for demonstrations.

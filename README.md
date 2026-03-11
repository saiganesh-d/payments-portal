# Payment Portal Application

This repository contains:
1. A **FastAPI + Neon PostgreSQL** Backend (`/backend`)
2. A **React Web + Vite** Frontend (`/src`)

---

## 🚀 How to Run the Application

You need two separate terminal windows to run both the frontend and the backend at the same time.

### Step 1: Start the Backend (API & Database)
1. Open a new Terminal (or Command Prompt).
2. Navigate to the `backend` folder:
   ```cmd
   cd backend
   ```
3. Activate the virtual environment:
   ```cmd
   venv\Scripts\activate
   ```
4. Run the API Server:
   ```cmd
   python -m uvicorn main:app --reload --port 8000
   ```
*(Leave this terminal running in the background).*

### Step 2: Start the Frontend (UI)
1. Open a **second** Terminal window.
2. Navigate to the main project folder (`testture`).
3. Run the Vite development server:
   ```cmd
   npm run dev
   ```
4. Look at the terminal output for the Local URL (usually `http://localhost:5173/`) and Ctrl + Click it to open it in your browser.

---

## 🔑 Login Credentials (Testing)

The database has been seeded with three default test users. Use these to test the lock/payment queue features.

**Client (Business Owner) Account:**
- **Username:** `client`
- **Password:** `client`
*(Use this account to add workers and put payments into the pending queue.)*

**Staff (Outsourcing Worker) Accounts:**
- **Username:** `staff1`
- **Password:** `staff1`
- **Username:** `staff2`
- **Password:** `staff2`
*(Use these accounts to accept and lock payments, and submit UTR transaction codes.)*

**Admin Account:**
- **Username:** `admin`
- **Password:** `admin`

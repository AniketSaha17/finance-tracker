# Finance Tracker — Skeleton

## Overview

A simple and secure personal finance tracker built with FastAPI, SQLAlchemy, and JWT Authentication.
It allows you to register/login, add transactions, view charts, and export data — all from a modern web interface.

## Features

🔑 User authentication (register/login with JWT)
💰 Add, update, and delete transactions
📅 Automatic timestamping in IST (Asia/Kolkata)
📊 Visualize spending with charts and tables
📤 Export transactions (CSV/Excel)
🛠️ Deployed using Render
🐙 Version controlled with GitHub

🏗️ Tech Stack

Backend: FastAPI (Python)
Frontend: HTML, CSS, JavaScript (Vanilla)
Database: SQLite (local)
ORM: SQLAlchemy
Auth: JWT (python-jose, passlib)
Deployment: Render

## Getting Started

1. **Clone the repository:**
 ```git clone https://github.com/AniketSaha17/finance-tracker.git
cd finance-tracker```

2. **Create a virtual environment:**
```python -m venv .venv
source .venv/Scripts/activate   # On Windows PowerShell```

3. **Install dependencies:**
    ```pip install -r requirements.txt
    ```
4. **Run the backend (FastAPI + Uvicorn)**
    ```uvicorn main:app --reload```

🌍 Deployment

Push your repo to GitHub
Deploy backend on Render (Free tier works)
Add environment variables in Render:
SECRET_KEY (any random string for JWT security)
DATABASE_URL (optional if you move away from SQLite)

## Technologies Used

- React
- Node.js
- Express
- MongoDB

📂 Project Structure
finance-tracker/
│── backend/
│   ├── main.py          # FastAPI entrypoint
│   ├── models.py        # Database models
│   ├── auth.py          # JWT Authentication
│   ├── database.db      # SQLite DB (local only)
│   ├── requirements.txt # Dependencies
│
│── frontend/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│
└── README.md

✨ Future Improvements

✅ Multi-user accounts with shared budgets
✅ Deploy frontend with GitHub Pages
✅ Switch from SQLite → PostgreSQL for production



## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

📬 Contact

👤 Aniket Saha
GitHub: AniketSaha17
LinkedIn: https://www.linkedin.com/in/aniket-saha-7620301b3/

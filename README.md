# FinPortfolio — Personal Expense & Monthly Savings Goal Command Center

FinPortfolio ek ultra-premium, dark glassmorphic web application hai jo Python (Flask) aur SQLite par bani hai. Yeh aapke kharche, kamai, aur monthly savings/profit goal ko portfolio ki tarah live track karti hai.

---

## 🚀 Features (Aapke requirements ke anusar)

1. **Kharcha & Kamai Tracker (Expense & Income Tracking)**:
   - **Kisko Diya / Recipient**: Kis insaan ya vendor ko paise diye (e.g. *Rahul, Zomato, Landlord, Amazon*).
   - **Kab Diya & Time**: Exact date aur 24-hour time automatic record hota hai.
   - **Fizool Kharchi (Waste / Impulse Spend Audit)**: Kisi bhi kharche ko "Waste/Impulse" mark kar sakte hain taaki pata chale mahine me kitna paisa fizool gaya.
   - **Kamai (Income Source)**: Salary, Freelance clients, business profits ko track karein.

2. **Monthly Savings & Profit Goal Tracker**:
   - Monthly target set karein (default ₹10,000, 1-click edit option).
   - **Dynamic Target Reducer**: Jaise-jaise aap daily kamai karenge ya bachat badhegi, remaining amount dynamically kam hoga (e.g., ₹10,000 ➔ ₹8,000 ➔ ₹5,000 ➔ Goal Reached!).
   - **Live Month Countdown Timer**: Mahine ke kitne **Days : Hours : Minutes : Seconds** bache hain, real-time tick karta hai.
   - **Required Daily Pace**: Har din kitna bachana zaroori hai target meet karne ke liye.
   - **Celebration Confetti**: Goal hit hone par animated trophy aur confetti trigger hoti hai!

3. **Visual Analytics & Charts**:
   - Cashflow Trend (Income vs Expense vs Cumulative Net Savings).
   - Expense Breakdown (Donut chart by category).

4. **Ledger & Export**:
   - Filter tabs: *All*, *Incomes*, *Expenses*, *Waste / Impulse Only*.
   - Instant search by recipient / party name or note.
   - 1-Click CSV Report Download.
   - 1-Click Demo Data Reset.

---

## 💻 Kaise Chalayein (How to Run)

### Method 1: Double Click (Windows)
Project folder me `run.bat` par double click karein!

### Method 2: Command Line
```powershell
# 1. Dependency install karein (agar na ho):
pip install -r requirements.txt

# 2. Server start karein:
python app.py
```

Browser me open karein:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📁 File Structure
- `app.py`: Flask backend server aur REST API routes.
- `database.py`: SQLite database schema, initialization aur seed data.
- `finance.db`: Persistent database file.
- `templates/index.html`: Modern semantic HTML5 dashboard.
- `static/style.css`: Ultra-premium dark glassmorphism design system.
- `static/app.js`: Real-time countdown timer, dynamic goal logic aur Chart.js charts.
- `run.bat`: 1-click launch script.

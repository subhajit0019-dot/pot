import sqlite3
import os
from datetime import datetime

# Handle Vercel serverless environment (where root filesystem is read-only)
if os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
    DB_PATH = '/tmp/finance.db'
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'finance.db')

def get_db_connection():
    # If on Vercel and /tmp/finance.db does not exist, initialize it
    if not os.path.exists(DB_PATH):
        init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            party TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            is_waste INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Monthly goals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS monthly_goals (
            month_year TEXT PRIMARY KEY,
            target_amount REAL NOT NULL,
            notes TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    
    seed_demo_data_if_empty()

def seed_demo_data_if_empty():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as count FROM transactions')
    count = cursor.fetchone()['count']
    
    current_month_str = datetime.now().strftime('%Y-%m')
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    # Set default goal if not present
    cursor.execute('SELECT * FROM monthly_goals WHERE month_year = ?', (current_month_str,))
    if not cursor.fetchone():
        cursor.execute(
            'INSERT INTO monthly_goals (month_year, target_amount, notes) VALUES (?, ?, ?)',
            (current_month_str, 10000.0, 'Monthly Savings & Profit Target')
        )
    
    if count == 0:
        sample_transactions = [
            ('income', 25000.0, 'Salary Credit (Tech Corp)', 'Salary', today_str, '10:00', 0, 'Monthly base salary'),
            ('income', 5000.0, 'Freelance Web Design Client', 'Freelance', today_str, '14:30', 0, 'Landing page design payment'),
            ('expense', 350.0, 'Starbucks Coffee & Snacks', 'Food & Dining', today_str, '11:15', 1, 'Impulse afternoon cold brew (Waste)'),
            ('expense', 1800.0, 'Electricity & Wi-Fi Bill', 'Bills & Utilities', today_str, '12:45', 0, 'Monthly utility payment'),
            ('expense', 1200.0, 'Rahul (Dinner Party)', 'Food & Dining', today_str, '20:30', 0, 'Dinner contribution at restaurant'),
            ('expense', 650.0, 'Online Shopping (Unnecessary Gadget)', 'Shopping', today_str, '16:20', 1, 'Impulse flash sale purchase (Waste)'),
            ('expense', 200.0, 'Tea & Snacks Stall', 'Food & Dining', today_str, '17:00', 0, 'Chai with colleagues')
        ]
        
        cursor.executemany('''
            INSERT INTO transactions (type, amount, party, category, date, time, is_waste, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_transactions)
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at:", DB_PATH)

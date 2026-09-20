import calendar
import csv
import io
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response
from database import get_db_connection, init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, 'templates'),
            static_folder=os.path.join(BASE_DIR, 'static'))

# Initialize database tables on app start
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/summary', methods=['GET'])
def get_summary():
    current_dt = datetime.now()
    month_param = request.args.get('month', current_dt.strftime('%Y-%m'))
    
    # Parse year and month
    try:
        year, month = map(int, month_param.split('-'))
    except Exception:
        year, month = current_dt.year, current_dt.month
        month_param = f"{year:04d}-{month:02d}"

    conn = get_db_connection()
    cursor = conn.cursor()

    # Month start and end strings
    days_in_month = calendar.monthrange(year, month)[1]
    month_start = f"{month_param}-01"
    month_end = f"{month_param}-{days_in_month:02d}"

    # Current month metrics
    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
            COALESCE(SUM(CASE WHEN type = 'expense' AND is_waste = 1 THEN amount ELSE 0 END), 0) AS total_waste,
            COUNT(*) AS total_count
        FROM transactions
        WHERE date >= ? AND date <= ?
    ''', (month_start, month_end))
    
    month_row = cursor.fetchone()
    total_income = float(month_row['total_income'])
    total_expense = float(month_row['total_expense'])
    total_waste = float(month_row['total_waste'])
    net_savings = total_income - total_expense

    # All-time net balance
    cursor.execute('''
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS all_time_balance
        FROM transactions
    ''')
    all_time_balance = float(cursor.fetchone()['all_time_balance'])

    # Monthly goal
    cursor.execute('SELECT target_amount, notes FROM monthly_goals WHERE month_year = ?', (month_param,))
    goal_row = cursor.fetchone()
    if goal_row:
        goal_target = float(goal_row['target_amount'])
    else:
        goal_target = 10000.0  # Default ₹10,000 as requested
        cursor.execute(
            'INSERT INTO monthly_goals (month_year, target_amount, notes) VALUES (?, ?, ?)',
            (month_param, goal_target, 'Monthly savings goal')
        )
        conn.commit()

    # Calculate days remaining in the specified month
    if year == current_dt.year and month == current_dt.month:
        day_today = current_dt.day
        days_remaining = max(0, days_in_month - day_today + 1)
        # Exact month end target for timer countdown
        month_end_target_iso = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59"
    elif year > current_dt.year or (year == current_dt.year and month > current_dt.month):
        days_remaining = days_in_month
        month_end_target_iso = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59"
    else:
        days_remaining = 0
        month_end_target_iso = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59"

    # Goal Remaining calculation:
    # "monthly goal hoga mere ko chahiye 10,000 rupees main monthly save karu and mera profit ho.
    # Har din main jitna kamata hoon utna main add karunga toh woh dheere dheere kam hoga.
    # Jab 8,000 aa gaya, 10,000 aa gaya..."
    # Net savings = total_income - total_expense
    # Remaining needed = goal_target - net_savings
    remaining_to_goal = max(0.0, goal_target - net_savings)
    surplus_achieved = max(0.0, net_savings - goal_target)
    
    if goal_target > 0:
        goal_percent = round((net_savings / goal_target) * 100, 1)
    else:
        goal_percent = 100.0

    daily_needed = 0.0
    if days_remaining > 0 and remaining_to_goal > 0:
        daily_needed = round(remaining_to_goal / days_remaining, 2)

    conn.close()

    return jsonify({
        'status': 'success',
        'month': month_param,
        'year': year,
        'month_name': calendar.month_name[month],
        'total_income': round(total_income, 2),
        'total_expense': round(total_expense, 2),
        'net_savings': round(net_savings, 2),
        'total_waste': round(total_waste, 2),
        'all_time_balance': round(all_time_balance, 2),
        'goal_target': round(goal_target, 2),
        'remaining_to_goal': round(remaining_to_goal, 2),
        'surplus_achieved': round(surplus_achieved, 2),
        'goal_percent': goal_percent,
        'days_in_month': days_in_month,
        'days_remaining': days_remaining,
        'daily_needed': daily_needed,
        'month_end_target_iso': month_end_target_iso
    })

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    tx_type = request.args.get('type', 'all')  # all, income, expense, waste
    search = request.args.get('search', '').strip()
    month = request.args.get('month', '')
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))

    conn = get_db_connection()
    cursor = conn.cursor()

    query = 'SELECT * FROM transactions WHERE 1=1'
    params = []

    if tx_type == 'income':
        query += ' AND type = "income"'
    elif tx_type == 'expense':
        query += ' AND type = "expense"'
    elif tx_type == 'waste':
        query += ' AND type = "expense" AND is_waste = 1'

    if month:
        query += ' AND date LIKE ?'
        params.append(f"{month}%")

    if search:
        query += ' AND (party LIKE ? OR category LIKE ? OR notes LIKE ?)'
        keyword = f"%{search}%"
        params.extend([keyword, keyword, keyword])

    query += ' ORDER BY date DESC, time DESC, id DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()

    transactions = [dict(row) for row in rows]
    conn.close()

    return jsonify({
        'status': 'success',
        'count': len(transactions),
        'transactions': transactions
    })

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.get_json() or {}
    
    tx_type = data.get('type', 'expense').lower()
    if tx_type not in ['income', 'expense']:
        return jsonify({'status': 'error', 'message': 'Invalid transaction type'}), 400

    try:
        amount = float(data.get('amount', 0))
        if amount <= 0:
            return jsonify({'status': 'error', 'message': 'Amount must be greater than 0'}), 400
    except (ValueError, TypeError):
        return jsonify({'status': 'error', 'message': 'Invalid amount value'}), 400

    party = (data.get('party') or '').strip()
    if not party:
        party = 'Self / Miscellaneous'

    category = (data.get('category') or 'General').strip()
    
    now = datetime.now()
    date_val = (data.get('date') or now.strftime('%Y-%m-%d')).strip()
    time_val = (data.get('time') or now.strftime('%H:%M')).strip()
    is_waste = 1 if data.get('is_waste') in [1, True, '1', 'true', 'on'] else 0
    notes = (data.get('notes') or '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transactions (type, amount, party, category, date, time, is_waste, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (tx_type, amount, party, category, date_val, time_val, is_waste, notes))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'status': 'success',
        'message': f"{tx_type.capitalize()} of ₹{amount:,.2f} recorded successfully!",
        'id': new_id
    }), 201

@app.route('/api/transactions/<int:tx_id>', methods=['DELETE'])
def delete_transaction(tx_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM transactions WHERE id = ?', (tx_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()

    if affected == 0:
        return jsonify({'status': 'error', 'message': 'Transaction not found'}), 404
        
    return jsonify({'status': 'success', 'message': 'Transaction deleted'})

@app.route('/api/goal', methods=['POST'])
def update_goal():
    data = request.get_json() or {}
    current_dt = datetime.now()
    month_year = data.get('month_year', current_dt.strftime('%Y-%m'))
    
    try:
        target_amount = float(data.get('target_amount', 10000.0))
        if target_amount < 0:
            return jsonify({'status': 'error', 'message': 'Goal must be non-negative'}), 400
    except (ValueError, TypeError):
        return jsonify({'status': 'error', 'message': 'Invalid goal amount'}), 400

    notes = data.get('notes', 'Updated via dashboard')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO monthly_goals (month_year, target_amount, notes, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(month_year) DO UPDATE SET
            target_amount = excluded.target_amount,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
    ''', (month_year, target_amount, notes))
    conn.commit()
    conn.close()

    return jsonify({
        'status': 'success',
        'message': f"Monthly goal updated to ₹{target_amount:,.2f}",
        'target_amount': target_amount,
        'month_year': month_year
    })

@app.route('/api/chart-data', methods=['GET'])
def get_chart_data():
    current_dt = datetime.now()
    month_param = request.args.get('month', current_dt.strftime('%Y-%m'))
    try:
        year, month = map(int, month_param.split('-'))
    except Exception:
        year, month = current_dt.year, current_dt.month
        month_param = f"{year:04d}-{month:02d}"

    days_in_month = calendar.monthrange(year, month)[1]
    month_start = f"{month_param}-01"
    month_end = f"{month_param}-{days_in_month:02d}"

    conn = get_db_connection()
    cursor = conn.cursor()

    # Daily aggregation for current month
    cursor.execute('''
        SELECT 
            date,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as daily_income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as daily_expense
        FROM transactions
        WHERE date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date ASC
    ''', (month_start, month_end))
    
    daily_rows = {row['date']: row for row in cursor.fetchall()}

    # Fill all days of month up to today or all days if past month
    labels = []
    income_data = []
    expense_data = []
    savings_data = []
    
    max_day = days_in_month
    if year == current_dt.year and month == current_dt.month:
        max_day = current_dt.day

    running_savings = 0.0
    for d in range(1, max_day + 1):
        day_str = f"{year:04d}-{month:02d}-{d:02d}"
        labels.append(f"{d} {calendar.month_abbr[month]}")
        row = daily_rows.get(day_str)
        inc = float(row['daily_income']) if row else 0.0
        exp = float(row['daily_expense']) if row else 0.0
        running_savings += (inc - exp)
        
        income_data.append(round(inc, 2))
        expense_data.append(round(exp, 2))
        savings_data.append(round(running_savings, 2))

    # Category breakdown for expenses
    cursor.execute('''
        SELECT category, SUM(amount) as cat_total
        FROM transactions
        WHERE type = 'expense' AND date >= ? AND date <= ?
        GROUP BY category
        ORDER BY cat_total DESC
    ''', (month_start, month_end))
    cat_rows = cursor.fetchall()
    category_labels = [row['category'] for row in cat_rows]
    category_values = [round(float(row['cat_total']), 2) for row in cat_rows]

    conn.close()

    return jsonify({
        'status': 'success',
        'trend': {
            'labels': labels,
            'income': income_data,
            'expense': expense_data,
            'cumulative_savings': savings_data
        },
        'categories': {
            'labels': category_labels,
            'values': category_values
        }
    })

@app.route('/api/export-csv')
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, type, amount, party, category, date, time, is_waste, notes, created_at FROM transactions ORDER BY date DESC, time DESC')
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Type', 'Amount (INR)', 'Recipient / Source', 'Category', 'Date', 'Time', 'Is Waste / Impulse', 'Notes', 'Created At'])
    
    for row in rows:
        writer.writerow([
            row['id'],
            row['type'].upper(),
            row['amount'],
            row['party'],
            row['category'],
            row['date'],
            row['time'],
            'YES' if row['is_waste'] == 1 else 'NO',
            row['notes'] or '',
            row['created_at']
        ])
    
    output.seek(0)
    filename = f"finance_portfolio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

@app.route('/api/reset-data', methods=['POST'])
def reset_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM transactions')
    cursor.execute('DELETE FROM monthly_goals')
    conn.commit()
    conn.close()
    
    from database import seed_demo_data_if_empty
    seed_demo_data_if_empty()
    
    return jsonify({'status': 'success', 'message': 'Data reset to starter demo records'})

if __name__ == '__main__':
    print("Starting FinPortfolio Server at http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)

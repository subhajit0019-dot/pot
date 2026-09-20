# 🚀 Vercel Deployment & Setup Guide

FinPortfolio ko **Vercel** par 100% compatible aur deploy karne ke liye humne setup complete kar diya hai.

---

## 🛠️ Jo Files Add & Configure Ki Gayi Hain

1. **`vercel.json`**: Vercel ke Python serverless builder (`@vercel/python`) aur URL routes ko configure karta hai.
2. **`api/index.py`**: Vercel serverless function ka entry point jo Flask `app` ko export karta hai.
3. **`database.py` (Serverless Read-Only Fix)**: Vercel serverless functions me root folder read-only hota hai. Humne automatic detection lagayi hai jo Vercel par SQLite ko `/tmp/finance.db` me initialize karta hai taaki database write errors kabhi na aayein!
4. **`requirements.txt`**: Flask dependencies list karta hai.
5. **`.gitignore`**: Temporary files aur local database ko clean rakhta hai.

---

## ⚡ Deployment Methods (2 Simple Ways)

### Method 1: GitHub ke Zariye (Recommended - Sabse Aasan)

1. **Git Repository create aur push karein**:
   Apne terminal me project folder (`d:\Compressed\new bot\potfulo`) me yeh commands chalayein:
   ```bash
   git init
   git add .
   git commit -m "FinPortfolio initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Vercel me Import karein**:
   - [Vercel Dashboard](https://vercel.com/dashboard) par jayein aur Login karein.
   - **"Add New..."** ➔ **"Project"** par click karein.
   - Apna GitHub repository select karein.
   - Framework preset ko default rehne dein (Vercel automatic detect kar lega).
   - **"Deploy"** button par click karein!
   - 1 se 2 minute me aapki live link mil jayegi (e.g. `https://your-portfolio.vercel.app`).

---

### Method 2: Vercel CLI ke Zariye (Direct Terminal Se)

Agar aap bina GitHub ke direct terminal se deploy karna chahte hain:

1. **Vercel CLI install karein**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy Command chalayein**:
   ```bash
   vercel
   ```
   - Terminal me Vercel login puchega (apne account se authorize karein).
   - "Set up and deploy?" ➔ `Y` dabayein.
   - Baaki questions par **Enter (default)** dabate jayein.

3. **Production Deploy**:
   ```bash
   vercel --prod
   ```

Aapki website live ho jayegi aur URL terminal me print ho jayega!

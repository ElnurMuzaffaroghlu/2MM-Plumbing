# 2MM Plumbing

Plumbing & Handyman services website for 2MM Plumbing — built with Node.js and Express, featuring real-time customer notifications via Telegram bot and Gmail.

🌐 **Live site:** [2mmplumbing.com](https://2mmplumbing.com)

![2MM Plumbing homepage](docs/homepage.png)

## Tech stack

Node.js · Express · Nodemailer · Telegram Bot API · Multer · Helmet · Render

## Features

- 📋 Contact form with photo uploads (up to 5 images)
- 🔔 Real-time Telegram notifications to the business owner
- 📧 Email notifications with photo attachments
- 🛡️ Rate limiting, CORS, and input validation
- 📱 Responsive mobile-first design

## Run locally

```bash
npm install
cp .env.example .env   # fill in your credentials
node server.js
```

Server starts on `http://localhost:3000`.

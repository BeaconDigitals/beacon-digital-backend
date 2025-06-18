const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
mongoose.set('strictQuery', true); // or false, depending on your preference
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set.");
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("MongoDB error", err);
    process.exit(1);
  });

const Message = mongoose.model('Message', new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  page: String,
  createdAt: { type: Date, default: Date.now }
}));

const Newsletter = mongoose.model('Newsletter', new mongoose.Schema({
  email: String,
  createdAt: { type: Date, default: Date.now }
}));

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("Error: EMAIL_USER and/or EMAIL_PASS environment variables are not set.");
  process.exit(1);
}
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message, page } = req.body;
  try {
    const newMessage = await Message.create({ name, email, message, page });
    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_USER,
      subject: `New Contact from ${page}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    });
    res.status(200).json({ success: true, message: 'Message sent!' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send message.' });
  }
});

app.get('/admin-data', async (req, res) => {
  const password = req.query.password;
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).send('Admin password not set in environment.');
  }
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Unauthorized');
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    res.json({ messages, newsletters });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin data.' });
  }
});

let admin2FACode = null;
let admin2FACodeExpires = null;

// Route to request 2FA code
app.post('/admin-2fa-request', async (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, error: 'Wrong password' });
  }
  // Generate 6-digit code
  admin2FACode = Math.floor(100000 + Math.random() * 900000).toString();
  admin2FACodeExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Send code to your admin email
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'Your Beacon Digital Admin 2FA Code',
    text: `Your admin 2FA code is: ${admin2FACode}`
  });

  res.json({ success: true, message: '2FA code sent to admin email.' });
});

// Route to verify 2FA code and get admin data
app.post('/admin-2fa-verify', async (req, res) => {
  const { code } = req.body;
  if (!admin2FACode || !admin2FACodeExpires || Date.now() > admin2FACodeExpires) {
    return res.status(400).json({ success: false, error: '2FA code expired. Please request a new code.' });
  }
  if (code !== admin2FACode) {
    return res.status(403).json({ success: false, error: 'Invalid 2FA code.' });
  }
  // Reset code after successful use
  admin2FACode = null;
  admin2FACodeExpires = null;

  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    res.json({ success: true, messages, newsletters });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin data.' });
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

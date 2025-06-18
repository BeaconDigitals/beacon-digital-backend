const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error", err));

const Message = mongoose.model('Message', new mongoose.Schema({
  name: String, email: String, message: String, page: String, createdAt: { type: Date, default: Date.now }
}));

const Newsletter = mongoose.model('Newsletter', new mongoose.Schema({
  email: String, createdAt: { type: Date, default: Date.now }
}));

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
    res.status(500).json({ success: false, error: 'Error sending message.' });
  }
});

app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  try {
    await Newsletter.create({ email });
    res.status(200).json({ success: true, message: 'Subscribed!' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Subscription failed.' });
  }
});

app.use(express.static(path.join(__dirname, 'admin')));
app.get('/admin-data', async (req, res) => {
  const password = req.query.password;
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Unauthorized');
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    res.json({ messages, newsletters });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin data.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const { GridFSBucket, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

// ─── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));
app.options("*", cors());
app.use(morgan("dev"));

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const PORT = process.env.PORT || 5000;

console.log("MONGO_URI:", MONGO_URI ? "found ✅" : "MISSING ❌");
console.log("PORT:", PORT);

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not set!");
  process.exit(1);
}

// ─── DB Connection ────────────────────────────────────────────
let bucket;
mongoose.connect(MONGO_URI).then(() => {
  console.log("MongoDB connected to:", mongoose.connection.db.databaseName);
  bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "pdfs" });
});

// ─── Models ───────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, enum: ["user", "admin"], default: "user" },
}, { timestamps: true });
const User = mongoose.model("User", UserSchema);

const PDFSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  fileId: mongoose.Schema.Types.ObjectId,
  size: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploaderName: String,
  sharedWith: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, default: null },
  }],
}, { timestamps: true });
const PDF = mongoose.model("PDF", PDFSchema);

const AccessRequestSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, trim: true, lowercase: true },
  password:     { type: String, required: true },
  about:        { type: String, required: true, trim: true },
  status:       { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });
const AccessRequest = mongoose.model("AccessRequest", AccessRequestSchema);

// ─── OTP Model ────────────────────────────────────────────────
const OTPSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  otp:       { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
const OTP = mongoose.model("OTP", OTPSchema);

// ─── Mailer ───────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendApprovalEmail(toEmail, name) {
  await mailer.sendMail({
    from: `"PDF Share" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: "🎉 Your PDF Share Access Has Been Approved!",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PDF Share, ${name}!</h2>
        <p>Your access request has been <strong>approved</strong>.</p>
        <p>You can now log in with the password you set during registration.</p>
        <p>— The PDF Share Team</p>
      </div>
    `,
  });
}

async function sendRejectionEmail(toEmail, name) {
  await mailer.sendMail({
    from: `"PDF Share" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: "PDF Share — Access Request Update",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#DC2626">Access Request Not Approved</h2>
        <p>Hi ${name}, unfortunately your request was not approved at this time.</p>
        <p>If you believe this is a mistake, please contact us.</p>
        <p>— The PDF Share Team</p>
      </div>
    `,
  });
}

// ─── Multer ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});

// ─── Auth Middleware ──────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ error: "Admins only." });
  next();
};

// ─── Auth Routes ──────────────────────────────────────────────

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already in use" });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: "7d" }
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: "7d" }
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/request-access", async (req, res) => {
  try {
    const { name, email, password, about } = req.body;
    if (!name || !email || !password || !about)
      return res.status(400).json({ error: "All fields required." });
    const existing = await AccessRequest.findOne({ email, status: "pending" });
    if (existing)
      return res.status(409).json({ error: "A pending request already exists for this email." });
    const hashed = await bcrypt.hash(password, 10);
    const request = await AccessRequest.create({ name, email, password: hashed,about });
    res.status(201).json({ message: "Request submitted successfully.", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/verify-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: "User not found." });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });
    res.json({ message: "Password verified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: "No account found with this email." });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OTP.deleteMany({ email });
    await OTP.create({ email, otp, expiresAt });
    await mailer.sendMail({
      from: `"PDF Share" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "🔐 Your PDF Share OTP",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#4F46E5">Password Reset OTP</h2>
          <p>Your one-time password is:</p>
          <div style="background:#f3f4f6;padding:16px 24px;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">
            ${otp}
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.
          </p>
          <p>— The PDF Share Team</p>
        </div>
      `,
    });
    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("Send OTP error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: "All fields are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    const record = await OTP.findOne({ email });
    if (!record) return res.status(400).json({ error: "No OTP found. Please request a new one." });
    if (record.otp !== otp) return res.status(400).json({ error: "Invalid OTP." });
    if (new Date() > record.expiresAt) return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { password: hashed });
    await OTP.deleteMany({ email });
    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/access-requests", auth, adminAuth, async (req, res) => {
  try {
    const requests = await AccessRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/access-requests/:id/approve", auth, adminAuth, async (req, res) => {
  try {
    const request = await AccessRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.status !== "pending")
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    await User.create({ name: request.name, email: request.email, password: request.password, role: "user" });
    request.status = "approved";
    await request.save();
    await sendApprovalEmail(request.email, request.name);
    res.json({ message: "User approved and notified via email." });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "A user with this email already exists." });
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/access-requests/:id/reject", auth, adminAuth, async (req, res) => {
  try {
    const request = await AccessRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.status !== "pending")
      return res.status(400).json({ error: `Request is already ${request.status}.` });
    request.status = "rejected";
    await request.save();
    await sendRejectionEmail(request.email, request.name);
    res.json({ message: "Request rejected and user notified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PDF Routes ───────────────────────────────────────────────

app.post("/api/pdfs/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF file received" });
    const cleanName = decodeURIComponent(req.file.originalname);
    const filename = `${Date.now()}-${cleanName}`;
    const uploadStream = bucket.openUploadStream(filename, { contentType: "application/pdf" });
    uploadStream.end(req.file.buffer);
    uploadStream.on("error", (err) => {
      console.error("GridFS upload error:", err);
      res.status(500).json({ error: "Failed to save file to GridFS" });
    });
    uploadStream.on("finish", async () => {
      try {
        const pdf = await PDF.create({
          filename, originalName: cleanName,
          fileId: uploadStream.id, size: req.file.size,
          uploadedBy: req.user.id, uploaderName: req.user.name,
        });
        res.json({ message: "Uploaded successfully", pdf });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pdfs", auth, async (req, res) => {
  try {
    const pdfs = await PDF.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(pdfs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pdfs/shared/with-me", auth, async (req, res) => {
  try {
    const now = new Date();
    const userId = new ObjectId(req.user.id);
    const pdfs = await PDF.find({
      sharedWith: {
        $elemMatch: {
          userId,
          $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        },
      },
    }).sort({ createdAt: -1 });
    const result = pdfs.map((pdf) => {
      const share = pdf.sharedWith.find((s) => s?.userId?.toString() === req.user.id);
      const obj = pdf.toObject();
      obj.expiresAt = share?.expiresAt || null;
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pdfs/:id", auth, async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) return res.status(404).json({ error: "Not found" });
    res.json(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pdfs/:id/download", (req, res, next) => {
  if (!req.headers.authorization && req.query.token)
    req.headers.authorization = `Bearer ${req.query.token}`;
  next();
}, auth, async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) return res.status(404).json({ error: "Not found" });
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="${pdf.originalName}"`);
    const stream = bucket.openDownloadStream(new ObjectId(pdf.fileId));
    stream.on("error", () => res.status(404).json({ error: "File not found in GridFS" }));
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/pdfs/:id/shared", auth, async (req, res) => {
  try {
    const result = await PDF.findByIdAndUpdate(
      req.params.id,
      { $pull: { sharedWith: { userId: new ObjectId(req.user.id) } } },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: "PDF not found" });
    res.json({ message: "Removed from your shared list" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/pdfs/:id", auth, async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) return res.status(404).json({ error: "Not found" });
    if (pdf.uploadedBy.toString() !== req.user.id)
      return res.status(403).json({ error: "Not authorized" });
    await bucket.delete(new ObjectId(pdf.fileId));
    await pdf.deleteOne();
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User Routes ──────────────────────────────────────────────

app.get("/api/users/search", auth, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email query required" });
    const users = await User.find({
      email: { $regex: email, $options: "i" },
      _id: { $ne: new ObjectId(req.user.id) },
    }).select("name email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Share Routes ─────────────────────────────────────────────

app.post("/api/pdfs/:id/share", auth, async (req, res) => {
  try {
    const { userId, expiryMinutes } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) return res.status(404).json({ error: "PDF not found" });
    if (pdf.uploadedBy.toString() !== req.user.id)
      return res.status(403).json({ error: "Only the owner can share this PDF" });
    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ error: "User not found" });
    const freshPdf = await PDF.findById(req.params.id);
    const alreadyShared = freshPdf.sharedWith.find(
      (s) => s?.userId?.toString() === userId.toString()
    );
    if (alreadyShared) return res.status(409).json({ error: "Already shared with this user" });
    const mins = expiryMinutes != null ? Number(expiryMinutes) : null;
    const expiresAt = mins && !isNaN(mins) && mins > 0
      ? new Date(Date.now() + mins * 60 * 1000) : null;
    freshPdf.sharedWith.push({ userId: new ObjectId(userId), expiresAt });
    await freshPdf.save();
    const expiryMsg = expiresAt ? `Expires at ${expiresAt.toLocaleString()}` : "No expiry";
    res.json({ message: `Shared with ${target.name}. ${expiryMsg}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ─── Keep Alive ───────────────────────────────────────────────
const http = require("http");
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
setInterval(() => {
  http.get(`${BACKEND_URL}/api/health`, () => {}).on("error", () => {});
}, 14 * 60 * 1000);

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
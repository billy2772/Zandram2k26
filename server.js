require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const TeraboxUploader = require('terabox-upload-tool');
const path = require('path');
const exceljs = require('exceljs');
const Registration = require('./models/Registration');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Upload directory setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, jpg, png) are allowed!'));
        }
    }
});

// Helper function to calculate file hash
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', err => reject(err));
    });
}

// MongoDB Connection with fallback
const { MongoMemoryServer } = require('mongodb-memory-server');

async function connectDB() {
    try {
        console.log('Attempting to connect to local MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zantram2k26', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 2000
        });
        console.log('✅ Connected to Local MongoDB.');
    } catch (err) {
        console.log('⚠️ Local MongoDB not found. Spinning up Embedded Sandbox MongoDB...');
        try {
            const mongoServer = await MongoMemoryServer.create();
            const mongoUri = mongoServer.getUri();
            await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log('✅ Connected to Embedded In-Memory MongoDB Server at:', mongoUri);
            console.log('NOTE: Since this is an in-memory DB, all registrations will be lost when the server stops. Install local MongoDB for persistent storage.');
        } catch (memErr) {
            console.error('❌ Failed to start embedded MongoDB:', memErr.message);
        }
    }
}
connectDB();

// ---------------- ROUTES ---------------- //

// Register Student
app.post('/api/register', upload.single('screenshot'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Screenshot is required.' });

        const { fullName, collegeName, department, email, phone, selectedEvents, teamSize, transactionId } = req.body;

        // Verify unique Transaction ID
        const existingTxn = await Registration.findOne({ transactionId });
        if (existingTxn) {
            fs.unlinkSync(req.file.path); // Remove uploaded file
            return res.status(400).json({ error: 'Duplicate Transaction ID. This transaction has already been used.' });
        }

        // Verify unique Screenshot Hash
        const hash = await calculateFileHash(req.file.path);
        const existingHash = await Registration.findOne({ screenshotHash: hash });
        if (existingHash) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Duplicate Screenshot detected. This payment proof has already been submitted.' });
        }

        const eventsArray = Array.isArray(selectedEvents) ? selectedEvents : (selectedEvents ? [selectedEvents] : []);

        let finalScreenshotPath = '/' + req.file.path.replace(/\\/g, '/');

        // TeraBox Upload Integration
        if (process.env.TERABOX_NDUS && process.env.TERABOX_JS_TOKEN && process.env.TERABOX_APP_ID) {
            try {
                const uploader = new TeraboxUploader({
                    ndus: process.env.TERABOX_NDUS,
                    jsToken: process.env.TERABOX_JS_TOKEN,
                    appId: process.env.TERABOX_APP_ID
                });
                
                const teraboxDir = '/Zantram2K26';
                const uploadResult = await uploader.uploadFile(req.file.path, null, teraboxDir);
                
                if (uploadResult.success) {
                    console.log('Successfully uploaded screenshot to TeraBox!');
                    finalScreenshotPath = `[TERABOX] ${teraboxDir}/${path.basename(req.file.path)}`;
                    
                    // Uncomment below to remove local file after upload if you strictly only want cloud copies
                    // fs.unlinkSync(req.file.path); 
                } else {
                    console.error('TeraBox Upload Failed:', uploadResult.message);
                }
            } catch (tError) {
                console.error('TeraBox Integration Error:', tError.message);
            }
        }

        const registration = new Registration({
            fullName,
            collegeName,
            department,
            email,
            phone,
            selectedEvents: eventsArray,
            teamSize: teamSize || 1,
            transactionId,
            screenshotPath: finalScreenshotPath,
            screenshotHash: hash
        });

        await registration.save();
        res.status(201).json({ message: 'Registration successful! Verification Pending.' });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {

        // Return a mock token for simplicity
        res.json({ token: 'admin-secret-token' });
    } else {
        res.status(401).json({ error: 'Invalid Credentials' });
    }
});

// Middleware for Admin Authorization
const adminAuth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token === 'Bearer admin-secret-token') {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized Access' });
    }
};

// Admin: Get all registrations
app.get('/api/admin/registrations', adminAuth, async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ registrationTime: -1 });
        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

// Admin: Update Status
app.put('/api/admin/registrations/:id/status', adminAuth, async (req, res) => {
    try {
        const { status } = req.body; 
        const registration = await Registration.findByIdAndUpdate(req.params.id, { paymentStatus: status }, { new: true });
        res.json({ message: 'Status updated', registration });
    } catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Admin: Delete Registration
app.delete('/api/admin/registrations/:id', adminAuth, async (req, res) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (reg) {
            // Delete associated file if it exists locally
            if (!reg.screenshotPath.startsWith('[TERABOX]')) {
                const filePath = path.join(__dirname, reg.screenshotPath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            await Registration.findByIdAndDelete(req.params.id);
            res.json({ message: 'Registration deleted' });
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Admin: Export to Excel
app.get('/api/admin/export', adminAuth, async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ registrationTime: -1 });
        
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Registrations');

        worksheet.columns = [
            { header: 'Name', key: 'fullName', width: 20 },
            { header: 'College', key: 'collegeName', width: 25 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Events Selected', key: 'events', width: 30 },
            { header: 'Transaction ID', key: 'transactionId', width: 20 },
            { header: 'Payment Status', key: 'paymentStatus', width: 20 },
            { header: 'Registration Date', key: 'date', width: 20 },
            { header: 'Screenshot', key: 'screenshotPath', width: 30 }
        ];

        registrations.forEach(reg => {
            worksheet.addRow({
                fullName: reg.fullName,
                collegeName: reg.collegeName,
                email: reg.email,
                phone: reg.phone,
                events: reg.selectedEvents.join(', '),
                transactionId: reg.transactionId,
                paymentStatus: reg.paymentStatus,
                date: new Date(reg.registrationTime).toLocaleString(),
                screenshotPath: reg.screenshotPath
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Zantram2K26_Registrations.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).send('Export failed');
    }
});

// Fallback for spa roots
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});

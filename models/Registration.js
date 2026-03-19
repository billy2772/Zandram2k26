const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    collegeName: { type: String, required: true },
    department: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    selectedEvents: [{ type: String }],
    teamSize: { type: Number, default: 1 },
    transactionId: { type: String, required: true, unique: true },
    screenshotPath: { type: String, required: true },
    screenshotHash: { type: String, required: true, unique: true },
    paymentStatus: { type: String, enum: ['Pending Verification', 'Verified', 'Rejected'], default: 'Pending Verification' },
    registrationTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Registration', registrationSchema);

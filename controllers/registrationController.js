const Registration = require('../models/Registration');
const { sendEmail } = require('../utils/email');
const { encrypt } = require('../utils/crypto');
const QRCode = require('qrcode');
const { logAction } = require('../utils/logger');

// Helpers
const generateQrId = () => 'SEB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

async function processApproval(id, adminReq = null) {
  const registration = await Registration.findById(id);
  if (!registration || (registration.status !== 'pending' && !adminReq)) return null;

  const qrId = generateQrId();
  registration.status = 'approved';
  registration.qrId = qrId;
  await registration.save();

  if (adminReq) {
    await logAction(adminReq, 'APPROVE_REGISTRATION', registration._id, 'Registration', { qrId });
  }

  const payload = JSON.stringify({
    qrId: qrId,
    category: registration.category,
    hash: encrypt(qrId + registration.category)
  });

  const qrDataUrl = await QRCode.toDataURL(payload);

  const emailHtml = `
      <div style="font-family: 'Outfit', sans-serif; max-width: 400px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background: #7B241C; padding: 20px; text-align: center; position: relative;">
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.2); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase;">${registration.category}</div>
          <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 2px;">SAAZ-E-BHARAT</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 12px;">Official Entry Pass</p>
        </div>
        <div style="padding: 30px; text-align: center;">
          <p style="color: #64748B; font-size: 14px; margin-bottom: 5px;">Participant</p>
          <h2 style="margin: 0; color: #1E293B; font-size: 20px;">${registration.fullName || registration.artistName || registration.businessName}</h2>
          <div style="margin: 30px 0;">
            <img src="${qrDataUrl}" alt="Ticket QR" style="width: 200px; border: 8px solid #F8FAFC; border-radius: 12px;" />
            <p style="color: #94A3B8; font-size: 12px; margin-top: 10px;">ID: ${qrId}</p>
          </div>
          <div style="border-top: 1px dashed #E2E8F0; padding-top: 20px; display: flex; justify-content: space-between; text-align: left;">
            <div>
              <p style="color: #94A3B8; font-size: 10px; margin: 0; text-transform: uppercase;">Date</p>
              <p style="color: #1E293B; font-size: 13px; font-weight: 600; margin: 0;">March 15-22, 2026</p>
            </div>
            <div style="text-align: right;">
              <p style="color: #94A3B8; font-size: 10px; margin: 0; text-transform: uppercase;">Venue</p>
              <p style="color: #1E293B; font-size: 13px; font-weight: 600; margin: 0;">Bharat Mandapam, Delhi</p>
            </div>
          </div>
        </div>
        <div style="background: #F8FAFC; padding: 15px; text-align: center; font-size: 11px; color: #94A3B8;">
          This ticket is non-transferable. Please carry a valid ID proof.
        </div>
      </div>
    `;

  await sendEmail(registration.email, 'Saaz-e-Bharat - Your Official Entry Pass', emailHtml);
  return registration;
}

// Routes
exports.register = async (req, res) => {
  try {
    const { email, phone, category, ...details } = req.body;
    const documentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const existing = await Registration.findOne({ email });
    if (existing) {
      if (existing.isEmailVerified) return res.status(400).json({ message: 'Email already registered and verified.' });
      const otp = generateOtp();
      existing.verificationOtp = otp;
      existing.otpExpires = new Date(Date.now() + 30 * 60 * 1000);
      if (documentUrl) existing.documentUrl = documentUrl;
      Object.assign(existing, details);
      await existing.save();
      console.log(`[VERIFICATION] Re-sent OTP for ${email}: ${otp}`);

      const verificationHtml = `
        <div style="font-family: 'Outfit', sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="background: #7B241C; padding: 30px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px;">SAAZ-E-BHARAT</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0; font-size: 13px;">Cultural Identity Verification</p>
          </div>
          <div style="padding: 40px 30px; text-align: center;">
            <p style="color: #64748B; font-size: 15px; line-height: 1.6;">Re-verification required. Please use the verification code below to continue your registration:</p>
            <div style="margin: 30px 0; background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0;">
              <span style="font-size: 32px; font-weight: 800; color: #1E293B; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #94A3B8; font-size: 12px;">This code will expire in 30 minutes.</p>
          </div>
          <div style="border-top: 1px solid #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #94A3B8;">
            © 2026 Saaz-e-Bharat Cultural Festival
          </div>
        </div>
      `;
      await sendEmail(email, 'Saaz-e-Bharat - Verify Your Identity', verificationHtml);
      return res.json({ message: 'Verification code sent.', registrationId: existing._id });
    }

    const otp = generateOtp();
    const registration = new Registration({
      email, phone, category, ...details, documentUrl,
      verificationOtp: otp,
      otpExpires: new Date(Date.now() + 30 * 60 * 1000),
      status: 'pending'
    });
    await registration.save();
    console.log(`[VERIFICATION] Initial OTP for ${email}: ${otp}`);
    const verificationHtml = `
      <div style="font-family: 'Outfit', sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; background: #fff;">
        <div style="background: #7B241C; padding: 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px;">SAAZ-E-BHARAT</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0; font-size: 13px;">Cultural Identity Verification</p>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <p style="color: #64748B; font-size: 15px; line-height: 1.6;">Welcome to the celebration of India's roots. To secure your application, please use the verification code below:</p>
          <div style="margin: 30px 0; background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0;">
            <span style="font-size: 32px; font-weight: 800; color: #1E293B; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #94A3B8; font-size: 12px;">This code will expire in 30 minutes. If you did not initiate this request, please ignore this email.</p>
        </div>
        <div style="border-top: 1px solid #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #94A3B8;">
          © 2026 Saaz-e-Bharat Cultural Festival
        </div>
      </div>
    `;
    await sendEmail(email, 'Saaz-e-Bharat - Verify Your Identity', verificationHtml);
    res.status(201).json({ message: 'Registration initiated. Verify email.', registrationId: registration._id });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { registrationId, otp } = req.body;
    const registration = await Registration.findById(registrationId);
    if (!registration) return res.status(404).json({ message: 'Not found' });
    if (registration.isEmailVerified) return res.status(400).json({ message: 'Already verified' });
    if (registration.verificationOtp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (registration.otpExpires < new Date()) return res.status(400).json({ message: 'Expired' });
    registration.isEmailVerified = true;
    registration.verificationOtp = undefined;
    registration.otpExpires = undefined;
    await registration.save();

    // Automatically issue ticket & approve on OTP success
    await processApproval(registrationId);

    res.json({ message: 'Verified' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.approveRegistration = async (req, res) => {
  try {
    const result = await processApproval(req.params.id, req);
    if (!result) return res.status(404).json({ message: 'Not found or processed' });
    res.json({ message: 'Approved' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const registration = await Registration.findById(id);

    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    registration.status = 'rejected';
    registration.rejectionReason = reason;
    await registration.save();

    await logAction(req, 'REJECT_REGISTRATION', registration._id, 'Registration', { reason });

    await sendEmail(registration.email, 'Saaz-e-Bharat - Registration Update', `
            <div style="font-family: 'Outfit', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px;">
                <h1 style="color: #7B241C;">Registration Update</h1>
                <p>Dear ${registration.fullName || 'Participant'},</p>
                <p>We regret to inform you that your registration for <strong>Saaz-e-Bharat</strong> has been rejected.</p>
                <p style="background: #FFF5F5; padding: 15px; border-left: 4px solid #EF4444; color: #991B1B;">
                    <strong>Reason:</strong> ${reason || 'Incomplete or unverified documentation.'}
                </p>
                <p>If you believe this is a mistake, please reach out to our support team.</p>
                <p>Best regards,<br/>The Saaz-e-Bharat Team</p>
            </div>
        `);

    res.json({ message: 'Registration rejected and email sent' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.batchApprove = async (req, res) => {
  const { ids } = req.body;
  try {
    let count = 0;
    for (let id of ids) { if (await processApproval(id, req)) count++; }
    res.json({ message: `Approved ${count} registrations.` });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.batchReject = async (req, res) => {
  const { ids, reason } = req.body;
  try {
    let count = 0;
    for (let id of ids) {
      const registration = await Registration.findById(id);
      if (registration && registration.status === 'pending') {
        registration.status = 'rejected';
        registration.rejectionReason = reason;
        await registration.save();
        await logAction(req, 'BATCH_REJECT', registration._id, 'Registration', { reason });
        await sendEmail(registration.email, 'Saaz-e-Bharat - Registration Update', `
          <div style="font-family: 'Outfit', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px;">
            <h1 style="color: #7B241C;">Registration Update</h1>
            <p>Your registration for Saaz-e-Bharat has been rejected.</p>
            <p style="background: #FFF5F5; padding: 15px; border-left: 4px solid #EF4444; color: #991B1B;">
              <strong>Reason:</strong> ${reason || 'Bulk rejection by admin.'}
            </p>
          </div>
        `);
        count++;
      }
    }
    res.json({ message: `Rejected ${count} registrations.` });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getRegistrations = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    const query = { isEmailVerified: true };
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { artistName: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }
    const registrations = await Registration.find(query).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const count = await Registration.countDocuments(query);
    res.json({ registrations, totalPages: Math.ceil(count / limit), currentPage: page });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getAnalytics = async (req, res) => {
  try {
    const total = await Registration.countDocuments({ isEmailVerified: true });

    const categoryStats = await Registration.aggregate([
      { $match: { isEmailVerified: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const growthToday = await Registration.countDocuments({ isEmailVerified: true, createdAt: { $gte: dayAgo } });

    // Registration trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trends = await Registration.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, isEmailVerified: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      total,
      growthToday,
      categoryStats: categoryStats.map(s => ({ name: s._id, value: s.count })),
      trends: trends.map(t => ({ date: t._id, count: t.count }))
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.exportRegistrations = async (req, res) => {
  try {
    const { category, from, to } = req.query;
    const query = { isEmailVerified: true };
    if (category) query.category = category;

    const skip = Math.max(0, parseInt(from) - 1 || 0);
    const limit = (parseInt(to) && parseInt(from)) ? (parseInt(to) - parseInt(from) + 1) : 1000;

    const registrations = await Registration.find(query)
      .sort({ createdAt: 1 }) // Export in chronological order
      .skip(skip)
      .limit(limit);

    if (registrations.length === 0) {
      return res.status(404).json({ message: 'No registrations found for this range/category' });
    }

    // Generate CSV manually
    const headers = ['Serial No', 'Name', 'Email', 'Phone', 'Category', 'City', 'State', 'Date'];
    const rows = registrations.map((reg, index) => [
      skip + index + 1,
      reg.fullName || reg.artistName || reg.businessName || 'N/A',
      reg.email,
      reg.phone,
      reg.category,
      reg.city || 'N/A',
      reg.state || 'N/A',
      new Date(reg.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Saaz_e_Bharat_Registrations_${category || 'All'}.csv`);
    res.status(200).send(csvContent);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

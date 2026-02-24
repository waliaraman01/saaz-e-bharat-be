const Registration = require('../models/Registration');
const Content = require('../models/Content');
const { sendEmail } = require('../utils/email');
const { logAction } = require('../utils/logger');
const fs = require('fs');

// Helpers
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();


async function processApproval(id, adminReq = null) {
  const registration = await Registration.findById(id);
  if (!registration || (registration.status !== 'pending_review' && !adminReq)) return null;

  registration.status = 'approved';
  await registration.save();

  if (adminReq) {
    await logAction(adminReq, 'APPROVE_REGISTRATION', registration._id, 'Registration', { status: 'approved' });
  }

  // Fetch customizable email content
  const emailSettings = await Content.find({ section: 'email_template' });
  const getSetting = (key, fallback) => {
    const found = emailSettings.find(s => s.key === key);
    return found ? found.value : fallback;
  };

  const subject = getSetting('EMAIL_CONFIRM_SUBJECT', 'Namaste! Your Saaz-e-Bharat Registration is Confirmed');
  const title = getSetting('EMAIL_CONFIRM_TITLE', 'SAAZ-E-BHARAT');
  const tagline = getSetting('EMAIL_CONFIRM_TAGLINE', 'Virasat Se Vikas Tak');
  const bodyText = getSetting('EMAIL_CONFIRM_BODY', `It gives us immense joy to inform you that your application for <strong>Saaz-e-Bharat 2026</strong> has been officially confirmed. We are honored to have you join us in this grand celebration of India's tribal roots and folk traditions.`);

  // Replace placeholders
  const name = registration.fullName || registration.artistName || 'Participant';
  const category = registration.category;
  const personalizedBody = bodyText.replace(/{name}/g, name).replace(/{category}/g, category);

  const emailHtml = `
      <div style="font-family: 'Playfair Display', serif; max-width: 600px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: #fffcf8; border: 1px solid #f1e4d1; box-shadow: 0 20px 40px rgba(123, 36, 28, 0.08);">
        <div style="background: #7B241C; padding: 40px 20px; text-align: center; background-image: linear-gradient(rgba(123, 36, 28, 0.9), rgba(123, 36, 28, 0.9)), url('https://www.transparenttextures.com/patterns/paper-fibers.png');">
          <h1 style="color: #D4AF37; margin: 0; font-size: 32px; letter-spacing: 4px; font-family: 'Playfair Display', serif;">${title}</h1>
          <div style="width: 50px; height: 2px; background: #D4AF37; margin: 15px auto;"></div>
          <p style="color: #F8FAFC; margin: 5px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">${tagline}</p>
        </div>
        
        <div style="padding: 50px 40px; text-align: center;">
          <h2 style="color: #7B241C; font-size: 28px; margin-bottom: 20px; font-family: 'Playfair Display', serif;">Namaste, ${name}</h2>
          
          <div style="color: #4A3728; font-size: 17px; line-height: 1.8; margin-bottom: 30px;">
            ${personalizedBody}
          </div>

          <div style="display: inline-block; background: #fff; padding: 25px 35px; border-radius: 16px; border: 1px solid #F1E4D1; margin-bottom: 30px; text-align: left;">
            <p style="margin: 0 0 10px; color: #94A3B8; font-size: 12px; text-transform: uppercase; font-weight: 700;">Registration Category</p>
            <p style="margin: 0; color: #7B241C; font-size: 18px; font-weight: 600;">${category}</p>
          </div>

          <p style="color: #64748B; font-size: 15px; line-height: 1.6;">
            Your presence will add a vibrant thread to the rich tapestry of stories we aim to tell at Bharat Mandapam. We look forward to creating unforgettable memories together.
          </p>
        </div>

        <div style="background: #fdf8f2; padding: 30px; border-top: 1px solid #f1e4d1; text-align: center;">
          <p style="margin: 0; color: #7B241C; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">May 23 - 25, 2026</p>
          <p style="margin: 5px 0 0; color: #4A3728; font-size: 14px;">Bharat Mandapam, Pragati Maidan, New Delhi</p>
        </div>

        <div style="padding: 20px; text-align: center; color: #94A3B8; font-size: 12px;">
          Saaz-e-Bharat: Celebrating our roots, Shaping our future.
        </div>
      </div>
    `;

  await sendEmail(registration.email, subject, emailHtml);
  return registration;
}


// Routes
exports.register = async (req, res) => {
  try {
    const { email, phone, category, fullName, ...details } = req.body;

    // Parse JSON strings from FormData for array fields
    const arrayFields = ['interests', 'availability'];
    arrayFields.forEach(field => {
      if (details[field] && typeof details[field] === 'string') {
        try { details[field] = JSON.parse(details[field]); } catch (e) { /* ignore */ }
      }
    });

    const documentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const existing = await Registration.findOne({ email });
    if (existing) {
      if (existing.isEmailVerified) return res.status(400).json({ message: 'Email already registered and verified.' });

      const otp = generateOtp();
      existing.verificationOtp = otp;
      existing.otpExpires = new Date(Date.now() + 30 * 60 * 1000);

      if (req.file) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const base64String = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
          existing.documentUrl = base64String;
          fs.unlinkSync(req.file.path);
        } catch (e) { console.error('Doc process error:', e); }
      }

      // Update fields
      existing.phone = phone;
      existing.category = category;
      existing.fullName = fullName;
      Object.assign(existing, details);

      await existing.save();
      console.log(`[VERIFICATION] Re-sent OTP for ${email}: ${otp}`);

      // EMAIL TEMPLATE FETCHING
      const emailSettings = await Content.find({ section: 'email_template' });
      const getSetting = (key, fallback) => {
        const found = emailSettings.find(s => s.key === key);
        return found ? found.value : fallback;
      };

      const otpSubject = getSetting('EMAIL_OTP_SUBJECT', 'Saaz-e-Bharat - Verify Your Identity');
      const otpTitle = getSetting('EMAIL_OTP_TITLE', 'SAAZ-E-BHARAT');
      const otpBody = getSetting('EMAIL_OTP_BODY', 'To continue your registration, please verify your identity with the code below:');

      const verificationHtml = `
        <div style="font-family: 'Outfit', sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="background: #7B241C; padding: 30px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; font-family: 'Playfair Display'">${otpTitle}</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0; font-size: 13px;">Identity verification</p>
          </div>
          <div style="padding: 40px 30px; text-align: center;">
            <p style="color: #64748B; font-size: 15px; line-height: 1.6;">${otpBody.replace(/{name}/g, fullName)}</p>
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
      await sendEmail(email, otpSubject, verificationHtml);
      return res.json({ message: 'Verification code sent.', registrationId: existing._id });
    }

    const otp = generateOtp();

    let base64Doc = undefined;
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        base64Doc = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
        fs.unlinkSync(req.file.path);
      } catch (e) { console.error('Doc process error:', e); }
    }

    const registration = new Registration({
      email, phone, category, fullName, ...details, documentUrl: base64Doc,
      verificationOtp: otp,
      otpExpires: new Date(Date.now() + 30 * 60 * 1000),
      status: 'pending_verification'
    });
    await registration.save();
    console.log(`[VERIFICATION] Initial OTP for ${email}: ${otp}`);

    // EMAIL TEMPLATE FETCHING
    const emailSettings = await Content.find({ section: 'email_template' });
    const getSetting = (key, fallback) => {
      const found = emailSettings.find(s => s.key === key);
      return found ? found.value : fallback;
    };

    const otpSubject = getSetting('EMAIL_OTP_SUBJECT', 'Saaz-e-Bharat - Verify Your Identity');
    const otpTitle = getSetting('EMAIL_OTP_TITLE', 'SAAZ-E-BHARAT');
    const otpBody = getSetting('EMAIL_OTP_BODY', 'Welcome to the celebration of India\'s roots. To secure your application, please use the verification code below:');

    const verificationHtml = `
      <div style="font-family: 'Outfit', sans-serif; max-width: 450px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; background: #fff;">
        <div style="background: #7B241C; padding: 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; font-family: 'Playfair Display'">${otpTitle}</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <p style="color: #64748B; font-size: 15px; line-height: 1.6;">${otpBody.replace(/{name}/g, fullName)}</p>
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
    await sendEmail(email, otpSubject, verificationHtml);
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
    registration.status = 'pending_review';
    registration.verificationOtp = undefined;
    registration.otpExpires = undefined;
    await registration.save();

    // EMAIL TEMPLATE FETCHING for Receipt
    const emailSettings = await Content.find({ section: 'email_template' });
    const getSetting = (key, fallback) => {
      const found = emailSettings.find(s => s.key === key);
      return found ? found.value : fallback;
    };

    const receiptSubject = getSetting('EMAIL_RECEIPT_SUBJECT', 'Saaz-e-Bharat - Application Received');
    const receiptBody = getSetting('EMAIL_RECEIPT_BODY', `Namaste {name}, your registration for the <strong>{category}</strong> category has been successfully verified. Our team is now reviewing your information. You will receive another update once your application is approved.`);

    const receiptHtml = `
      <div style="font-family: 'Outfit', sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; background: #fff;">
        <div style="background: #7B241C; padding: 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; font-family: 'Playfair Display'">SAAZ-E-BHARAT</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #7B241C; margin-bottom: 20px;">Application Received</h2>
          <p style="color: #64748B; font-size: 15px; line-height: 1.6;">${receiptBody.replace(/{name}/g, registration.fullName).replace(/{category}/g, registration.category)}</p>
          <div style="margin-top: 30px; padding: 20px; background: #FDF2F2; border-radius: 12px; color: #7B241C; font-weight: 700;">
            Status: Pending Review
          </div>
        </div>
      </div>
    `;
    await sendEmail(registration.email, receiptSubject, receiptHtml);

    res.json({ message: 'Identity verified. Application is now under review.' });
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

    // EMAIL TEMPLATE FETCHING for Rejection
    const emailSettings = await Content.find({ section: 'email_template' });
    const getSetting = (key, fallback) => {
      const found = emailSettings.find(s => s.key === key);
      return found ? found.value : fallback;
    };

    const rejectSubject = getSetting('EMAIL_REJECT_SUBJECT', 'Saaz-e-Bharat - Application Update');
    const rejectBody = getSetting('EMAIL_REJECT_BODY', 'Thank you for your interest in Saaz-e-Bharat. After a thorough review of your application and provided credentials, we regret to inform you that we cannot proceed with your registration at this time.');

    await sendEmail(registration.email, rejectSubject, `
      <div style="font-family: 'Outfit', sans-serif; max-width: 550px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: #fffcf8; border: 1px solid #f1e4d1; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <div style="background: #7B241C; padding: 30px; text-align: center;">
          <h1 style="color: #D4AF37; margin: 0; font-size: 24px; letter-spacing: 3px; font-family: 'Playfair Display', serif;">SAAZ-E-BHARAT</h1>
        </div>
        
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #7B241C; font-size: 24px; margin-bottom: 20px; font-family: 'Playfair Display', serif;">Application Update</h2>
          <p style="color: #4A3728; font-size: 16px; line-height: 1.6;">Dear ${registration.fullName || 'Participant'},</p>
          <p style="color: #4A3728; font-size: 16px; line-height: 1.6;">${rejectBody.replace(/{name}/g, registration.fullName)}</p>
          
          <div style="margin: 30px 0; padding: 25px; background: #FFF5F5; border-radius: 16px; border-left: 5px solid #EF4444; text-align: left;">
            <p style="margin: 0 0 8px; color: #991B1B; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Reason for Decision</p>
            <p style="margin: 0; color: #7F1D1D; font-size: 15px; font-weight: 500;">${reason || 'The provided identity document was unclear or did not meet our verification standards.'}</p>
          </div>

          <p style="color: #64748B; font-size: 14px; line-height: 1.6;">
            If you wish to appeal this decision or provide further clarification regarding your documents, please reply to this email.
          </p>
        </div>

        <div style="background: #fdf8f2; padding: 25px; text-align: center; border-top: 1px solid #f1e4d1; font-size: 13px; color: #94A3B8;">
          © 2026 Saaz-e-Bharat Cultural Festival • New Delhi
        </div>
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
      if (registration && registration.status === 'pending_review') {
        registration.status = 'rejected';
        registration.rejectionReason = reason;
        await registration.save();
        await logAction(req, 'BATCH_REJECT', registration._id, 'Registration', { reason });
        await sendEmail(registration.email, 'Saaz-e-Bharat - Application Update', `
          <div style="font-family: 'Outfit', sans-serif; max-width: 550px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: #fffcf8; border: 1px solid #f1e4d1; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            <div style="background: #7B241C; padding: 30px; text-align: center;">
              <h1 style="color: #D4AF37; margin: 0; font-size: 24px; letter-spacing: 3px; font-family: 'Playfair Display', serif;">SAAZ-E-BHARAT</h1>
            </div>
            
            <div style="padding: 40px; text-align: center;">
              <h2 style="color: #7B241C; font-size: 24px; margin-bottom: 20px; font-family: 'Playfair Display', serif;">Application Update</h2>
              <p style="color: #4A3728; font-size: 16px; line-height: 1.6;">Dear Participant,</p>
              <p style="color: #4A3728; font-size: 16px; line-height: 1.6;">Thank you for your interest in Saaz-e-Bharat. After reviewing our current capacity and selection criteria, we regret to inform you that we cannot confirm your registration at this time.</p>
              
              <div style="margin: 30px 0; padding: 25px; background: #FFF5F5; border-radius: 16px; border-left: 5px solid #EF4444; text-align: left;">
                <p style="margin: 0 0 8px; color: #991B1B; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Reason for Decision</p>
                <p style="margin: 0; color: #7F1D1D; font-size: 15px; font-weight: 500;">${reason || 'Selection criteria mismatch or capacity limits reached during the review process.'}</p>
              </div>

              <p style="color: #64748B; font-size: 14px; line-height: 1.6;">
                We appreciate your enthusiasm for our cultural heritage and hope to see you at future events.
              </p>
            </div>

            <div style="background: #fdf8f2; padding: 25px; text-align: center; border-top: 1px solid #f1e4d1; font-size: 13px; color: #94A3B8;">
              © 2026 Saaz-e-Bharat Cultural Festival • New Delhi
            </div>
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
    const { category, status, attendanceDay, search, page = 1, limit = 20 } = req.query;
    const query = { isEmailVerified: true };
    if (category) query.category = category;
    if (status) query.status = status;
    if (attendanceDay) query.attendanceDay = attendanceDay;
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
    const { category, from, to, startDate, endDate } = req.query;
    const query = { isEmailVerified: true };

    if (category) query.category = category;

    // Date Range Filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination/Range limit logic
    const skip = Math.max(0, parseInt(from) - 1 || 0);
    const limit = (parseInt(to) && parseInt(from)) ? (parseInt(to) - parseInt(from) + 1) : 5000;

    const registrations = await Registration.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for faster export and plain objects

    if (registrations.length === 0) {
      return res.status(404).json({ message: 'No registrations found for the selected filters.' });
    }

    // Comprehensive header list based on all possible fields in the schema
    const headers = [
      '_id', 'Status', 'Category', 'Full Name', 'Email', 'Phone', 'Organization',
      'Verified', 'Attendance Day', 'Interests', 'Referral Source',
      'Art Form', 'Performance Type', 'Group Size', 'Portfolio/YouTube', 'Performance Desc', 'Honorarium',
      'Company Name', 'Industry', 'Department', 'Interested As', 'Reason for Joining',
      'Stall Type', 'Products Displayed', 'State/Cuisine', 'Food Items',
      'Media House', 'Media Type', 'Preferred Role', 'Availability',
      'Checked In', 'Check-In Time', 'Registration Date'
    ];

    const rows = registrations.map(reg => [
      reg._id,
      reg.status || 'N/A',
      reg.category || 'N/A',
      reg.fullName || 'N/A',
      reg.email || 'N/A',
      reg.phone || 'N/A',
      reg.organization || 'N/A',
      reg.isEmailVerified ? 'YES' : 'NO',
      reg.attendanceDay || 'N/A',
      Array.isArray(reg.interests) ? reg.interests.join('; ') : (reg.interests || 'N/A'),
      reg.referralSource || 'N/A',
      reg.artForm || 'N/A',
      reg.performanceType || 'N/A',
      reg.groupSize || 'N/A',
      reg.portfolioUrl || 'N/A',
      reg.performanceDescription || 'N/A',
      reg.expectedHonorarium || 'N/A',
      reg.companyName || 'N/A',
      reg.industry || 'N/A',
      reg.department || 'N/A',
      reg.interestedAs || 'N/A',
      reg.reasonForJoining || 'N/A',
      reg.typeOfStall || 'N/A',
      reg.productsToDisplay || 'N/A',
      reg.stateCuisine || 'N/A',
      reg.foodItems || 'N/A',
      reg.mediaHouseName || 'N/A',
      reg.mediaType || 'N/A',
      reg.preferredRole || 'N/A',
      Array.isArray(reg.availability) ? reg.availability.join('; ') : (reg.availability || 'N/A'),
      reg.isCheckedIn ? 'YES' : 'NO',
      reg.checkInTime ? new Date(reg.checkInTime).toLocaleString() : 'N/A',
      new Date(reg.createdAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || 'N/A').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Saaz_e_Bharat_Full_Export_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('[EXPORT ERROR]', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DELETE REQUEST] Received ID: ${id}`);

    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      console.log(`[DELETE ERROR] ${id} is not a valid ObjectId`);
      return res.status(400).json({ message: 'Invalid registration ID format' });
    }

    const registration = await Registration.findById(id);
    if (!registration) {
      const total = await Registration.countDocuments();
      console.log(`[DELETE 404] Registration ${id} not found. Total records in DB: ${total}`);
      return res.status(404).json({
        message: `Registration not found. It may have been already deleted. (Total records: ${total})`
      });
    }

    await logAction(req, 'DELETE_REGISTRATION', id, 'Registration', { email: registration.email });
    await Registration.findByIdAndDelete(id);
    console.log(`[DELETE SUCCESS] Registration ${id} removed.`);

    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error(`[DELETE CRITICAL] ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

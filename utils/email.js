const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async (to, subject, html, attachments = []) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"Saaz-e-Bharat" <noreply@saazebharat.com>',
            to,
            subject,
            html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error.message);
        // We return null to indicate failure but don't throw, 
        // allowing the main process (like registration) to complete.
        return null;
    }
};

module.exports = { sendEmail };

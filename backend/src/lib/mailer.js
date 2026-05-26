import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'agarwalh2904@gmail.com',
    pass: process.env.EMAIL_PASS || 'dhtv etzh wghh rayp',
  },
});

export async function sendAlertEmail(to, subject, text, html) {
  try {
    const info = await transporter.sendMail({
      from: `"Sidroid Monitor" <${process.env.EMAIL_USER || 'agarwalh2904@gmail.com'}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Alert email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}

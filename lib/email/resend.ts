import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will not work.');
}

export const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || 'SeasonMath <no-reply@seasonmath.com>';
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@seasonmath.com';

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return resend !== null;
}

/**
 * Send an email with error handling
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return {
      success: false,
      error: 'Email service not configured. Please contact support.',
    };
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      replyTo: EMAIL_REPLY_TO,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

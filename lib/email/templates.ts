/**
 * Email templates with i18n support (EN/ES/CA)
 */

interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

const translations = {
  en: {
    welcome_subject: 'Welcome to SeasonMath',
    welcome_greeting: 'Welcome to SeasonMath!',
    welcome_intro: 'Your account has been created. Here are your login credentials:',
    email_label: 'Email',
    password_label: 'Temporary Password',
    welcome_instructions: 'Please log in and change your password as soon as possible.',
    login_button: 'Log In to SeasonMath',
    security_note: 'For security reasons, you will be required to change your password on first login.',
    
    reset_subject: 'Your SeasonMath password has been reset',
    reset_greeting: 'Password Reset',
    reset_intro: 'Your password has been reset. Here is your new temporary password:',
    reset_instructions: 'Please log in with this password and change it immediately.',
    
    email_changed_subject: 'Your SeasonMath email has been changed',
    email_changed_greeting: 'Email Address Changed',
    email_changed_intro: 'Your email address has been changed.',
    email_changed_old: 'Old email',
    email_changed_new: 'New email',
    email_changed_notice: 'If you did not make this change, please contact support immediately.',
    
    footer_contact: 'Questions? Contact us at',
    footer_platform: 'SeasonMath - Basketball Statistics Platform',
  },
  es: {
    welcome_subject: 'Bienvenido a SeasonMath',
    welcome_greeting: '¡Bienvenido a SeasonMath!',
    welcome_intro: 'Tu cuenta ha sido creada. Aquí están tus credenciales de acceso:',
    email_label: 'Correo electrónico',
    password_label: 'Contraseña temporal',
    welcome_instructions: 'Por favor inicia sesión y cambia tu contraseña lo antes posible.',
    login_button: 'Iniciar sesión en SeasonMath',
    security_note: 'Por razones de seguridad, se te pedirá que cambies tu contraseña en el primer inicio de sesión.',
    
    reset_subject: 'Tu contraseña de SeasonMath ha sido restablecida',
    reset_greeting: 'Restablecimiento de contraseña',
    reset_intro: 'Tu contraseña ha sido restablecida. Aquí está tu nueva contraseña temporal:',
    reset_instructions: 'Por favor inicia sesión con esta contraseña y cámbiala inmediatamente.',
    
    email_changed_subject: 'Tu correo de SeasonMath ha sido cambiado',
    email_changed_greeting: 'Correo electrónico cambiado',
    email_changed_intro: 'Tu dirección de correo electrónico ha sido cambiada.',
    email_changed_old: 'Correo anterior',
    email_changed_new: 'Correo nuevo',
    email_changed_notice: 'Si no realizaste este cambio, por favor contacta a soporte inmediatamente.',
    
    footer_contact: '¿Preguntas? Contáctanos en',
    footer_platform: 'SeasonMath - Plataforma de Estadísticas de Baloncesto',
  },
  ca: {
    welcome_subject: 'Benvingut a SeasonMath',
    welcome_greeting: 'Benvingut a SeasonMath!',
    welcome_intro: 'El teu compte ha estat creat. Aquí tens les teves credencials d\'accés:',
    email_label: 'Correu electrònic',
    password_label: 'Contrasenya temporal',
    welcome_instructions: 'Si us plau, inicia sessió i canvia la teva contrasenya tan aviat com sigui possible.',
    login_button: 'Iniciar sessió a SeasonMath',
    security_note: 'Per raons de seguretat, se t\'exigirà que canviïs la teva contrasenya en el primer inici de sessió.',
    
    reset_subject: 'La teva contrasenya de SeasonMath ha estat restablerta',
    reset_greeting: 'Restabliment de contrasenya',
    reset_intro: 'La teva contrasenya ha estat restablerta. Aquí tens la teva nova contrasenya temporal:',
    reset_instructions: 'Si us plau, inicia sessió amb aquesta contrasenya i canvia-la immediatament.',
    
    email_changed_subject: 'El teu correu de SeasonMath ha estat canviat',
    email_changed_greeting: 'Correu electrònic canviat',
    email_changed_intro: 'La teva adreça de correu electrònic ha estat canviada.',
    email_changed_old: 'Correu anterior',
    email_changed_new: 'Correu nou',
    email_changed_notice: 'Si no has fet aquest canvi, si us plau contacta amb suport immediatament.',
    
    footer_contact: 'Preguntes? Contacta\'ns a',
    footer_platform: 'SeasonMath - Plataforma d\'Estadístiques de Bàsquet',
  },
};

function getBaseHtml(content: string, locale: 'en' | 'es' | 'ca' = 'en'): string {
  const t = translations[locale];
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SeasonMath</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #f97316;
      margin: 0;
      font-size: 32px;
    }
    h2 {
      color: #1f2937;
      margin-top: 0;
    }
    .credentials {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .credentials p {
      margin: 10px 0;
    }
    .credentials strong {
      display: inline-block;
      width: 140px;
    }
    .password {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: bold;
      color: #f97316;
      background-color: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      display: inline-block;
      border: 1px solid #fbbf24;
    }
    .button {
      display: inline-block;
      background-color: #f97316;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: bold;
    }
    .notice {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .footer a {
      color: #f97316;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🏀 SeasonMath</h1>
    </div>
    ${content}
    <div class="footer">
      <p>${t.footer_platform}</p>
      <p>${t.footer_contact} <a href="mailto:support@seasonmath.com">support@seasonmath.com</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailTemplate(
  email: string,
  password: string,
  locale: 'en' | 'es' | 'ca' = 'en'
): EmailTemplateContent {
  const t = translations[locale];
  
  const content = `
    <h2>${t.welcome_greeting}</h2>
    <p>${t.welcome_intro}</p>
    <div class="credentials">
      <p><strong>${t.email_label}:</strong> ${email}</p>
      <p><strong>${t.password_label}:</strong><br><span class="password">${password}</span></p>
    </div>
    <p>${t.welcome_instructions}</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">${t.login_button}</a>
    <div class="notice">
      <p>${t.security_note}</p>
    </div>
  `;

  const text = `
${t.welcome_greeting}

${t.welcome_intro}

${t.email_label}: ${email}
${t.password_label}: ${password}

${t.welcome_instructions}

${t.login_button}: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login

${t.security_note}

${t.footer_platform}
${t.footer_contact} support@seasonmath.com
  `.trim();

  return {
    subject: t.welcome_subject,
    html: getBaseHtml(content, locale),
    text,
  };
}

export function getPasswordResetEmailTemplate(
  email: string,
  password: string,
  locale: 'en' | 'es' | 'ca' = 'en'
): EmailTemplateContent {
  const t = translations[locale];
  
  const content = `
    <h2>${t.reset_greeting}</h2>
    <p>${t.reset_intro}</p>
    <div class="credentials">
      <p><strong>${t.email_label}:</strong> ${email}</p>
      <p><strong>${t.password_label}:</strong><br><span class="password">${password}</span></p>
    </div>
    <p>${t.reset_instructions}</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">${t.login_button}</a>
    <div class="notice">
      <p>${t.security_note}</p>
    </div>
  `;

  const text = `
${t.reset_greeting}

${t.reset_intro}

${t.email_label}: ${email}
${t.password_label}: ${password}

${t.reset_instructions}

${t.login_button}: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login

${t.security_note}

${t.footer_platform}
${t.footer_contact} support@seasonmath.com
  `.trim();

  return {
    subject: t.reset_subject,
    html: getBaseHtml(content, locale),
    text,
  };
}

export function getEmailChangedNoticeTemplate(
  oldEmail: string,
  newEmail: string,
  locale: 'en' | 'es' | 'ca' = 'en'
): EmailTemplateContent {
  const t = translations[locale];
  
  const content = `
    <h2>${t.email_changed_greeting}</h2>
    <p>${t.email_changed_intro}</p>
    <div class="credentials">
      <p><strong>${t.email_changed_old}:</strong> ${oldEmail}</p>
      <p><strong>${t.email_changed_new}:</strong> ${newEmail}</p>
    </div>
    <div class="notice">
      <p>${t.email_changed_notice}</p>
    </div>
  `;

  const text = `
${t.email_changed_greeting}

${t.email_changed_intro}

${t.email_changed_old}: ${oldEmail}
${t.email_changed_new}: ${newEmail}

${t.email_changed_notice}

${t.footer_platform}
${t.footer_contact} support@seasonmath.com
  `.trim();

  return {
    subject: t.email_changed_subject,
    html: getBaseHtml(content, locale),
    text,
  };
}

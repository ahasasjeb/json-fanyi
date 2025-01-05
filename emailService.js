import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: '1196444919@qq.com',
    pass: 'zgxjocgucnhshcdj',
  },
})

export async function sendTranslationEmail(recipientEmail, translatedContent, originalFileName) {
  const mailOptions = {
    from: '1196444919@qq.com',
    to: recipientEmail,
    subject: 'Your Translation Result 您的翻译结果',
    text: 'Please find your translation result attached.请查收附件中的翻译结果。',
    attachments: [
      {
        filename: `${originalFileName.replace('.json', '')}_translated.json`,
        content: translatedContent,
        contentType: 'application/json',
      },
    ],
  }

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error)
        reject(error)
      } else {
        console.log('Email sent:', info.messageId)
        resolve(info)
      }
    })
  })
}

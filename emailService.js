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

// 添加验证连接函数
async function verifyConnection() {
  try {
    await transporter.verify()
    return true
  } catch (error) {
    console.error('Email server connection error:', error)
    return false
  }
}

export async function sendTranslationEmail(recipientEmail, translatedContent, originalFileName) {
  try {
    // 首先验证连接
    const isConnected = await verifyConnection()
    if (!isConnected) {
      throw new Error('Unable to connect to email server')
    }

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

    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', info.messageId)
    return info
  } catch (error) {
    console.error('Detailed email sending error:', error)
    throw new Error(`Email sending failed: ${error.message}`)
  }
}

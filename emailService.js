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
    const isConnected = await verifyConnection()
    if (!isConnected) {
      console.error('Email server connection failed during verification')
      throw new Error('邮件服务器连接失败')
    }

    // 增加详细的错误日志
    console.log('Attempting to send email to:', recipientEmail)
    console.log('Original filename:', originalFileName)

    const mailOptions = {
      from: '"JSON翻译服务" <1196444919@qq.com>', // 添加发件人名称
      to: recipientEmail,
      subject: 'Your Translation Result 您的翻译结果',
      text: 'Please find your translation result attached.\n请查收附件中的翻译结果。',
      attachments: [
        {
          filename: `${originalFileName.replace('.json', '')}_translated.json`,
          content: Buffer.from(translatedContent), // 将内容转换为 Buffer
          contentType: 'application/json; charset=utf-8',
        },
      ],
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', info.messageId)
    return info
  } catch (error) {
    console.error('Detailed email sending error:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
    })
    throw new Error(`邮件发送失败: ${error.message}`)
  }
}

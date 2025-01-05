import nodemailer from 'nodemailer'

// 创建一个SMTP客户端配置
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com', // QQ 邮箱的 SMTP 服务器地址
  port: 465, // SMTP 端口号，QQ邮箱一般是 465（SSL）
  secure: true, // 启用 SSL
  auth: {
    user: '1196444919@qq.com', // 你的 QQ 邮箱
    pass: 'zgxjocgucnhshcdj', // 你的授权码
  },
})

// 设置邮件内容
const mailOptions = {
  from: '1196444919@qq.com', // 发件人
  to: 'h@lvjia.cc', // 收件人
  subject: '邮件主题', // 邮件主题
  text: '这是一封来自 Node.js 的测试邮件！', // 文本内容
  html: '<p>这是一封来自 <b>Node.js</b> 的测试邮件！</p>', // HTML 内容
}

// 发送邮件
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log('邮件发送失败:', error)
  }
  console.log('邮件发送成功:', info.messageId)
})

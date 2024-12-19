export default {
  uploadForm: {
    title: 'JSON 翻译工具',
    description: '上传一个 JSON 文件，可以自动翻译成中文，请务必选择非嵌套json文件。',
    loadingText:
      '如果卡在某个值半天没有翻译进展，多等等，不要刷新，因为上游负载满了，1分钟左右可能就恢复了。',
    modelInfo:
      '使用gpt-4o-mini与deepseek-chat进行翻译，随机选择。没听过DeepSeek？这模型和gpt-4o-mini差不多，便宜还快。',
    mcInfo: 'Minecraft模组苦苦汉化？上传到这里自动汉化翻译Java版Minecraft模组。',
    emailContact: "对于基岩版，可以通过邮箱 h{'@'}lvjia.cc 来告诉我，需要的人多就开发一个。",
    uploadButton: '上传 JSON 文件',
    translatingButton: '翻译中...',
    saveButton: '保存翻译结果',
    tutorialButton: 'Java版模组翻译教程',
    privacyTitle: '帮助我们改进服务',
    privacyDesc: '我们仅收集匿名访问统计，不含个人信息',
    learnMore: '了解更多',
    disagree: '不用了',
    agree: '同意',
    later: '稍后再说',
    noTranslation: '没有可保存的翻译内容',
    saveSuccess: '文件已保存！',
    saveError: '保存文件失败：',
    dntEnabled: '已启用请勿追踪，我们将不会收集任何统计信息',
    dntEnabledPrevious:
      '已启用请勿追踪，虽然曾经同意过，但现在开启了DNT，我们将不会收集任何统计信息',
    thankYou: '感谢您的支持！您的ID是：',
    connectionError: '连接中断',
    translationError: '未收到完整的翻译内容',
    translationComplete: '翻译完成！',
    // 教程相关
    tutorialTitle: 'Java版模组翻译教程',
    tutorialContent1:
      '下载一个压缩软件，例如 7-zip，右键jar打开或者解压，找到 assets 文件夹，里面就是模组的资源文件。',
    tutorialContent2: 'assets里，会有个名字非Minecraft的文件夹，打开它，里面的json就是语言文件。',
    tutorialContent3: '将其上传到这个网站，翻译完后保存，重命名为zh_cn.json，拖动放进去。',
    tutorialContent4:
      '如果你解压了，就重新压缩为普通zip格式，确保压缩后的一级目录不是单个文件夹，大概率就是压缩成功了，把后缀改成jar。',
    // 隐私相关
    privacyModalTitle: '隐私说明',
    privacyModalSubtitle: '收集数据做什么？',
    privacyModalContent: '很简单，统计真实用户人数，且不与任何第三方共享。',
  },
}

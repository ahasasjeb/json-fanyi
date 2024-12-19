export default {
  uploadForm: {
    title: 'JSON Translation Tool',
    description:
      'Upload a JSON file to automatically translate it into Chinese. Please ensure that the JSON file is not nested.',
    loadingText:
      'If it gets stuck on a value for a long time without making progress, please wait a bit longer instead of refreshing the page, as the upstream server might be overloaded and could recover in about one minute.',
    modelInfo:
      "Translation is performed using either gpt-4o-mini or deepseek-chat, chosen randomly. Haven't heard of DeepSeek? It's similar to gpt-4o-mini but cheaper and faster.",
    mcInfo:
      'Struggling with translating Java Edition Minecraft mods? Upload them here for automatic translation.',
    emailContact:
      "For Bedrock Edition, you can contact via email h{'@'}lvjia.cc. We will develop one if there are enough requests.",
    uploadButton: 'Upload JSON File',
    translatingButton: 'Translating...',
    saveButton: 'Save Translation Result',
    tutorialButton: 'Java Edition Mod Translation Tutorial',
    privacyTitle: 'Help Us Improve Our Service',
    privacyDesc: 'We only collect anonymous usage statistics, no personal information is included.',
    learnMore: 'Learn More',
    disagree: 'No Thanks',
    agree: 'Agree',
    later: 'Later',
    noTranslation: 'No translatable content to save',
    saveSuccess: 'File saved successfully!',
    saveError: 'Failed to save file:',
    dntEnabled: 'Do Not Track is enabled, we will not collect any statistics.',
    dntEnabledPrevious:
      'Do Not Track is enabled, although you previously agreed, now enabling DNT means we will not collect any statistics.',
    thankYou: 'Thank you for your support! Your ID is:',
    connectionError: 'Connection interrupted',
    translationError: 'Incomplete translation received',
    translationComplete: 'Translation completed!',
    // Tutorial related
    tutorialTitle: 'Java Edition Mod Translation Tutorial',
    tutorialContent1:
      'Download a compression software such as 7-zip, right-click the jar file to open or extract it. Locate the assets folder where the mod resources are stored.',
    tutorialContent2:
      'Inside the assets folder, find another folder named something other than Minecraft; this contains the language files in json format.',
    tutorialContent3:
      'Upload these json files to this website, save after translation, rename them to zh_cn.json, and place them back inside.',
    tutorialContent4:
      'If you extracted the files, recompress them into a regular zip format ensuring that the root directory does not contain just a single folder. This should indicate successful compression; change the extension to .jar.',
    // Privacy related
    privacyModalTitle: 'Privacy Policy',
    privacyModalSubtitle: 'What data do we collect?',
    privacyModalContent:
      'Simply put, we count real users and do not share this data with any third parties.',
  },
}

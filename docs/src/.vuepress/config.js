const { description } = require('../../package')

module.exports = {
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'Obsidian Reminder Plugin',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: description,

  base: '/obsidian-reminder/',

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['meta', { name: 'google-site-verification', content: 'x-FMnla97z654niFxL3xjrvLhoCJU0eaFJyIKk5Z-ZM' }]
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    repo: '',
    editLinks: false,
    docsDir: '',
    editLinkText: '',
    lastUpdated: false,
    nav: [
      {
        text: 'Guide',
        link: '/guide/',
      },
      {
        text: 'Setting',
        link: '/setting/'
      },
      {
        text: 'Privacy Policy',
        link: '/privacy-policy.html'
      },
      {
        text: 'GitHub',
        link: 'https://github.com/uphy/obsidian-reminder'
      }
    ],
    sidebar: {
      '/guide/': [
        {
          title: 'Quick Start',
          collapsable: false,
          children: [
            '',
          ]
        },
        {
          title: 'Guide',
          collapsable: false,
          children: [
            'set-reminders',
            'list-reminders',
            'notification'
          ]
        },
        {
          title: 'Interoperability',
          collapsable: false,
          children: [
            'interop-tasks',
            'interop-kanban',
            'interop-nldates'
          ]
        },
        {
          title: 'Service Integration',
          collapsable: false,
          children: [
            'integration',
            'integration-google-tasks',
            'integration-google-calendar'
          ]
        }
      ]
    }
  },

  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
    [
      "sitemap",
      {
        hostname: 'https://uphy.github.io/obsidian-reminder/',
        changefreq: "weekly"
      }
    ]
  ]
}

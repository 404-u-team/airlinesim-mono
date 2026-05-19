import type { Preview } from '@storybook/vue3-vite'

import '../src/styles/index.css'

const preview: Preview = {
  decorators: [
    (story, context) => {
      const isDark = context.globals.theme === 'dark'
      document.documentElement.classList.toggle('dark', isDark)
      document.body.style.background = isDark ? '#020617' : '#f3f4f6'
      document.body.style.color = isDark ? '#f9fafb' : '#0f172a'

      return story()
    },
  ],
  globalTypes: {
    theme: {
      defaultValue: 'light',
      description: 'Theme',
      toolbar: {
        dynamicTitle: true,
        icon: 'circlehollow',
        items: [
          { title: 'Light', value: 'light' },
          { title: 'Dark', value: 'dark' },
        ],
        title: 'Theme',
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;

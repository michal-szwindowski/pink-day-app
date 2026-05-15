import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pink Day',
    short_name: 'Pink Day',
    description: 'Prywatna checklista zadań, punktów i nagród dla dwóch osób.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff7fb',
    theme_color: '#ff8eb4',
    lang: 'pl',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}

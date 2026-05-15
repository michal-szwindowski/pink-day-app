import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: 'linear-gradient(145deg, #ffb7ce 0%, #ff80ac 100%)',
        borderRadius: 60,
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: '#fff8fc',
          borderRadius: 48,
          display: 'flex',
          height: 120,
          justifyContent: 'center',
          width: 120,
        }}
      >
        <svg aria-hidden="true" fill="none" height="60" viewBox="0 0 180 180" width="60">
          <path
            d="M42 96L74 128L138 54"
            stroke="#C43F78"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="20"
          />
        </svg>
      </div>
    </div>,
    size,
  )
}

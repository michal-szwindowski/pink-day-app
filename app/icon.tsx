import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: 'linear-gradient(145deg, #ffb2cc 0%, #ff7ea9 100%)',
        borderRadius: 140,
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: '#fff8fc',
          borderRadius: 120,
          display: 'flex',
          height: 336,
          justifyContent: 'center',
          width: 336,
        }}
      >
        <svg aria-hidden="true" fill="none" height="180" viewBox="0 0 180 180" width="180">
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

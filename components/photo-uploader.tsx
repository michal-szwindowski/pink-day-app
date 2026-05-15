'use client'

import { ImagePlus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type PhotoUploaderProps = {
  files: File[]
  onChange: (files: File[]) => void
}

export function PhotoUploader({ files, onChange }: PhotoUploaderProps) {
  const previews = files.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  }))

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[22px] border border-dashed border-[#f0b7ca] bg-[#fff7fa] px-4 py-5 text-sm font-medium text-[#7b5f69] transition hover:bg-[#fff0f5]">
        <ImagePlus size={18} />
        Dodaj zdjęcia
        <input
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          multiple
          onChange={(event) => {
            onChange(Array.from(event.target.files ?? []))
            event.currentTarget.value = ''
          }}
          type="file"
        />
      </label>

      {files.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <Card
              className="space-y-2 p-3"
              key={`${preview.file.name}-${preview.file.lastModified}-${preview.file.size}`}
            >
              {/* biome-ignore lint/performance/noImgElement: local blob previews are only used before upload. */}
              <img
                alt={`Podgląd zdjęcia ${index + 1}`}
                className="aspect-square w-full rounded-2xl object-cover"
                src={preview.url}
              />
              <Button
                className="px-3 py-2 text-xs"
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                variant="ghost"
              >
                <Trash2 size={14} />
              </Button>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

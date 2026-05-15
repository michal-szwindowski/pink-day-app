import { isValidDateKey } from '@/lib/dates'

export const MAX_PHOTOS = 3
export const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type TaskFormValues = {
  title: string
  description: string
  points: string
  type: 'daily' | 'one_time'
  date: string
  requiresPhoto: boolean
  active: boolean
}

export type RewardFormValues = {
  title: string
  description: string
  cost: string
  active: boolean
}

export function validateSetupSecret(expectedValue: string | undefined, actualValue: string) {
  if (!expectedValue) {
    return 'Brakuje wartości w zmiennych środowiskowych.'
  }

  if (actualValue.trim() !== expectedValue.trim()) {
    return 'Kod jest nieprawidłowy.'
  }

  return null
}

export function validateTaskForm(values: TaskFormValues) {
  if (!values.title.trim()) {
    return 'Podaj nazwę zadania.'
  }

  const points = Number.parseInt(values.points, 10)
  if (!Number.isInteger(points) || points <= 0) {
    return 'Punkty muszą być dodatnią liczbą całkowitą.'
  }

  if (values.type === 'one_time' && !isValidDateKey(values.date)) {
    return 'Zadanie jednorazowe musi mieć datę w formacie RRRR-MM-DD.'
  }

  if (values.type === 'daily' && values.date) {
    return 'Zadanie codzienne nie powinno mieć daty.'
  }

  return null
}

export function validateRewardForm(values: RewardFormValues) {
  if (!values.title.trim()) {
    return 'Podaj nazwę nagrody.'
  }

  const cost = Number.parseInt(values.cost, 10)
  if (!Number.isInteger(cost) || cost <= 0) {
    return 'Koszt musi być dodatnią liczbą całkowitą.'
  }

  return null
}

export function validatePhotoFiles(files: File[], requiresPhoto: boolean) {
  if (requiresPhoto && files.length === 0) {
    return 'To zadanie wymaga przynajmniej jednego zdjęcia.'
  }

  if (files.length > MAX_PHOTOS) {
    return `Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęcia.`
  }

  for (const file of files) {
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      return 'Dozwolone są tylko pliki JPG, PNG i WEBP.'
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return 'Jedno zdjęcie może mieć maksymalnie 4 MB.'
    }
  }

  return null
}

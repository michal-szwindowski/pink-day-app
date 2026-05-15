'use client'

import { ArrowLeft, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'

import { LoadingScreen } from '@/components/loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { useToast } from '@/components/providers/toast-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModalOverlay } from '@/components/ui/modal'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import { useBodyScrollLock } from '@/components/use-body-scroll-lock'
import { fetchAllowedUsers } from '@/lib/data'
import { getErrorMessage } from '@/lib/errors'
import type { ProfileRole } from '@/lib/supabase/types'

type AllowedUserForm = {
  email: string
  displayName: string
  role: ProfileRole
}

const emptyAllowedUserForm: AllowedUserForm = {
  email: '',
  displayName: '',
  role: 'member',
}

function ownerCount(users: Awaited<ReturnType<typeof fetchAllowedUsers>>) {
  return users.filter((user) => user.active && user.role === 'owner').length
}

function getRoleLabel(role: ProfileRole) {
  if (role === 'owner') {
    return 'Owner'
  }

  if (role === 'admin') {
    return 'Admin'
  }

  return 'Member'
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, supabase } = useAppContext()
  const { showToast } = useToast()
  const [allowedUsers, setAllowedUsers] = useState<Awaited<ReturnType<typeof fetchAllowedUsers>>>(
    [],
  )
  const [allowedUserForm, setAllowedUserForm] = useState<AllowedUserForm>(emptyAllowedUserForm)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<
    Awaited<ReturnType<typeof fetchAllowedUsers>>[number] | null
  >(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useBodyScrollLock(Boolean(userToDelete) || isUserModalOpen)

  const loadData = useEffectEvent(async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const nextAllowedUsers = await fetchAllowedUsers(supabase)
      setAllowedUsers(nextAllowedUsers)
      setError(null)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Nie udało się wczytać dashboardu.'))
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    void loadData(true)
  }, [])

  useAutoRefresh(async () => {
    await loadData(false)
  })

  const openCreateUserModal = () => {
    setEditingUserId(null)
    setAllowedUserForm(emptyAllowedUserForm)
    setError(null)
    setMessage(null)
    setIsUserModalOpen(true)
  }

  const openEditUserModal = (
    allowedUser: Awaited<ReturnType<typeof fetchAllowedUsers>>[number],
  ) => {
    setEditingUserId(allowedUser.id)
    setAllowedUserForm({
      displayName: allowedUser.display_name ?? '',
      email: allowedUser.email,
      role: allowedUser.role,
    })
    setError(null)
    setMessage(null)
    setIsUserModalOpen(true)
  }

  const closeUserModal = () => {
    setEditingUserId(null)
    setAllowedUserForm(emptyAllowedUserForm)
    setIsUserModalOpen(false)
  }

  if (isLoading) {
    return <LoadingScreen label="Ładowanie dashboardu..." />
  }

  return (
    <main className="section-stack">
      <Button fullWidth onClick={() => router.push('/account')} variant="ghost">
        <ArrowLeft className="mr-2" size={16} />
        Wróć do aplikacji
      </Button>

      <section className="space-y-2 px-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
          Dashboard
        </p>
        <h1 className="text-3xl font-black text-[#422c36]">Dostęp do aplikacji</h1>
        <p className="text-sm leading-6 text-[#7f6870]">
          Ownerzy i admini zarządzają tym, kto może korzystać z aplikacji. Admin może robić prawie
          wszystko to samo, ale nie może odebrać roli ownerowi.
        </p>
      </section>

      {message ? <Card className="bg-[#eefaf3] text-sm text-[#2f7753]">{message}</Card> : null}
      {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[#fff0f6] p-3 text-[#d34d7d]">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#422c36]">Uczestnicy aplikacji</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Owner i admin mogą dodawać użytkowników oraz zmieniać role. W aplikacji musi zostać
                przynajmniej jeden aktywny owner.
              </p>
            </div>
          </div>
          <Button disabled={isPending} onClick={openCreateUserModal}>
            <Plus className="mr-2" size={16} />
            Dodaj osobę
          </Button>
        </div>
      </Card>

      <section className="section-stack lg:grid lg:grid-cols-2 lg:items-start">
        {allowedUsers.map((allowedUser) => {
          const wouldRemoveLastOwner =
            allowedUser.active && allowedUser.role === 'owner' && ownerCount(allowedUsers) <= 1
          const adminCannotChangeOwner = profile?.role === 'admin' && allowedUser.role === 'owner'

          return (
            <Card className="space-y-3" key={allowedUser.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#422c36]">
                    {allowedUser.display_name || allowedUser.email}
                  </p>
                  <p className="text-sm text-[#7f6870]">{allowedUser.email}</p>
                </div>
                <span className="rounded-full bg-[#fff3f7] px-3 py-1 text-xs font-semibold text-[#a54568]">
                  {getRoleLabel(allowedUser.role)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  disabled={isPending}
                  onClick={() => openEditUserModal(allowedUser)}
                  variant="secondary"
                >
                  <Pencil className="mr-2" size={16} />
                  Edytuj
                </Button>

                <Button
                  disabled={isPending || wouldRemoveLastOwner || adminCannotChangeOwner}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        setError(null)
                        setMessage(null)

                        const response = await supabase
                          .from('allowed_users')
                          .update({ active: !allowedUser.active })
                          .eq('id', allowedUser.id)

                        if (response.error) {
                          throw response.error
                        }

                        const profileResponse = await supabase
                          .from('profiles')
                          .update({ active: !allowedUser.active })
                          .eq('email', allowedUser.email)

                        if (profileResponse.error) {
                          throw profileResponse.error
                        }

                        const nextMessage = allowedUser.active
                          ? 'Dostęp został wyłączony.'
                          : 'Dostęp został ponownie włączony.'
                        setMessage(nextMessage)
                        showToast(nextMessage, 'success')
                        await loadData(false)
                      } catch (caughtError) {
                        const nextError = getErrorMessage(
                          caughtError,
                          'Nie udało się zmienić dostępu.',
                        )
                        setError(nextError)
                        showToast(nextError, 'error')
                      }
                    })
                  }}
                  variant="ghost"
                >
                  {allowedUser.active ? 'Wyłącz' : 'Włącz'}
                </Button>
              </div>

              {wouldRemoveLastOwner ? (
                <p className="text-sm text-[#9a5266]">Nie można wyłączyć ostatniego ownera.</p>
              ) : null}

              {adminCannotChangeOwner ? (
                <p className="text-sm text-[#9a5266]">Admin nie może zmieniać statusu ownera.</p>
              ) : null}

              <Button
                disabled={isPending || wouldRemoveLastOwner || adminCannotChangeOwner}
                fullWidth
                onClick={() => setUserToDelete(allowedUser)}
                variant="danger"
              >
                <Trash2 className="mr-2" size={16} />
                Usuń dostęp
              </Button>
            </Card>
          )
        })}
      </section>

      {isUserModalOpen ? (
        <ModalOverlay>
          <Card className="max-h-full w-full max-w-md space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                  Dostęp
                </p>
                <h2 className="text-xl font-black text-[#422c36]">
                  {editingUserId ? 'Edytuj osobę' : 'Dodaj osobę'}
                </h2>
              </div>
              <button
                className="rounded-full bg-[#fff3f7] p-2 text-[#8d6f79]"
                onClick={closeUserModal}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()

                startTransition(async () => {
                  const email = allowedUserForm.email.trim().toLowerCase()

                  if (!email?.includes('@')) {
                    setError('Wpisz poprawny adres e-mail Google.')
                    return
                  }

                  try {
                    setError(null)
                    setMessage(null)

                    const response = await supabase.from('allowed_users').upsert(
                      {
                        email,
                        display_name: allowedUserForm.displayName.trim() || null,
                        role: allowedUserForm.role,
                        active: true,
                        invited_by: profile?.id ?? null,
                      },
                      { onConflict: 'email' },
                    )

                    if (response.error) {
                      throw response.error
                    }

                    closeUserModal()
                    const nextMessage = editingUserId
                      ? 'Dostęp został zapisany.'
                      : 'Osoba została dodana.'
                    setMessage(nextMessage)
                    showToast(nextMessage, 'success')
                    await loadData(false)
                  } catch (caughtError) {
                    const nextError = getErrorMessage(
                      caughtError,
                      'Nie udało się zapisać użytkownika.',
                    )
                    setError(nextError)
                    showToast(nextError, 'error')
                  }
                })
              }}
            >
              <label>
                <span className="field-label">Adres Google</span>
                <input
                  onChange={(event) =>
                    setAllowedUserForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="np. lena@gmail.com"
                  type="email"
                  value={allowedUserForm.email}
                />
              </label>

              <label>
                <span className="field-label">Nazwa w aplikacji</span>
                <input
                  onChange={(event) =>
                    setAllowedUserForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  placeholder="np. Lena"
                  value={allowedUserForm.displayName}
                />
              </label>

              <label>
                <span className="field-label">Rola dostępu</span>
                <select
                  disabled={
                    profile?.role === 'admin' &&
                    allowedUsers.find((user) => user.id === editingUserId)?.role === 'owner'
                  }
                  onChange={(event) =>
                    setAllowedUserForm((current) => ({
                      ...current,
                      role: event.target.value as ProfileRole,
                    }))
                  }
                  value={allowedUserForm.role}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </label>

              <Button disabled={isPending} fullWidth type="submit">
                {isPending ? 'Zapisywanie...' : editingUserId ? 'Zapisz zmiany' : 'Dodaj osobę'}
              </Button>
            </form>
          </Card>
        </ModalOverlay>
      ) : null}

      {userToDelete ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Usunąć dostęp?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Ten adres zniknie z listy dostępu i profil zostanie wyłączony. Jeśli ta osoba
                zaloguje się ponownie, aplikacja jej nie wpuści.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  const selectedUser = userToDelete

                  startTransition(async () => {
                    try {
                      setError(null)
                      setMessage(null)
                      setUserToDelete(null)

                      const deleteResponse = await supabase
                        .from('allowed_users')
                        .delete()
                        .eq('id', selectedUser.id)

                      if (deleteResponse.error) {
                        throw deleteResponse.error
                      }

                      const profileResponse = await supabase
                        .from('profiles')
                        .update({ active: false })
                        .eq('email', selectedUser.email)

                      if (profileResponse.error) {
                        throw profileResponse.error
                      }

                      setMessage('Dostęp został usunięty.')
                      showToast('Dostęp został usunięty.', 'success')
                      await loadData(false)
                    } catch (caughtError) {
                      const nextError = getErrorMessage(
                        caughtError,
                        'Nie udało się usunąć dostępu.',
                      )
                      setError(nextError)
                      showToast(nextError, 'error')
                    }
                  })
                }}
                variant="danger"
              >
                Tak, usuń
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setUserToDelete(null)}
                variant="secondary"
              >
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}
    </main>
  )
}

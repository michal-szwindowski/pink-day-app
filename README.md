# Pink Day

Prywatna, prosta aplikacja PWA do zadań, punktów i nagród. Logowanie działa przez Google, a dane synchronizują się przez Supabase.

## Model aplikacji

- Każda osoba, która ma dostęp, jest zwykłym użytkownikiem aplikacji i może wejść na `/`.
- Role `owner` i `admin` służą do zarządzania dostępem do aplikacji pod `/dashboard`.
- Aplikacja musi mieć minimum jednego aktywnego ownera.
- `NEXT_PUBLIC_ADMIN_EMAIL` wskazuje pierwszego ownera, np. `michal.szwindowski@gmail.com`.
- Owner może dodać kolejne adresy Google i nadać im rolę `member`, `admin` albo `owner`.
- Admin może zarządzać dostępem podobnie jak owner, ale nie może odebrać roli żadnemu ownerowi.
- Każdy użytkownik ma własny kod zaproszenia. Wpisanie kodu drugiej osoby wysyła prośbę o połączenie w parę.
- Każdy użytkownik może mieć jedną aktywną parę.

## Co jest w środku

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Storage
- Supabase Google OAuth
- PWA bez App Store i Google Play

## Czego aplikacja celowo nie robi

- brak email/password
- brak anonymous/device setup
- brak płatności i subskrypcji
- brak czatu
- brak AI
- brak ciężkiej analityki

## Wymagane env

Utwórz `.env` na podstawie [.env.example](/C:/Projects/nasze-punkty/.env.example):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=michal.szwindowski@gmail.com
```

## Supabase SQL

W Supabase SQL Editor uruchom migracje.

Jeśli baza jest świeża, uruchom wszystkie pliki z `supabase/migrations/` po kolei według numeru w nazwie, od `001` do `018`.

Jeśli aktualizujesz starszą wersję aplikacji, uruchom tylko brakujące migracje w kolejności rosnącej. Ostatnie migracje dodają między innymi prośby o połączenie, kierunkowe zadania i nagrody, pseudonimy partnera oraz subskrypcje powiadomień push.

## Google OAuth

W Supabase włącz Google Provider i wklej `Client ID` oraz `Client Secret` z Google Cloud.

W Google Cloud OAuth Client dodaj redirect URI:

```text
https://gspugvtpjoxxumbshdxt.supabase.co/auth/v1/callback
```

Dla lokalnego działania aplikacja wraca potem na:

```text
http://localhost:3000/auth/callback
```

## Pierwsze uruchomienie

1. Ustaw `.env`.
2. Uruchom `pnpm dev`.
3. Wejdź na `http://localhost:3000`.
4. Zaloguj się Google kontem z `NEXT_PUBLIC_ADMIN_EMAIL`.
5. Jako owner wejdź na `/dashboard` i dodaj inne adresy Google.
6. Wróć na `/`, skopiuj swój kod albo wpisz kod drugiej osoby.
7. Druga osoba loguje się Google, właściciel dodaje jej email w `/dashboard`, a jedno z Was wpisuje kod drugiej osoby.

## Lokalny start

```bash
cd C:\Projects\nasze-punkty
pnpm install
pnpm dev
```

## Deployment za darmo

Najprościej:

- frontend: Vercel Free
- baza i storage: Supabase Free

Na Vercelu ustaw te same env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ADMIN_EMAIL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

W Google/Supabase dodaj też produkcyjny redirect URL dla swojej domeny.

## Powiadomienia push

Push działa przez Web Push API i wymaga:

- migracji `supabase/migrations/20260515_017_push_subscriptions.sql`
- kluczy VAPID
- `SUPABASE_SERVICE_ROLE_KEY` ustawionego tylko po stronie serwera/Vercel
- aplikacji dodanej do ekranu początkowego na iPhonie

Wygeneruj klucze:

```bash
pnpm exec web-push generate-vapid-keys
```

Do `.env` dodaj:

```env
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:twoj-email@example.com
```

Na iPhonie Web Push działa dla aplikacji dodanych do ekranu początkowego na iOS 16.4+. Na Androidzie działa w Chrome/instalowanej PWA. Każde urządzenie trzeba włączyć osobno w `Konto -> Powiadomienia push`.

## Główne trasy

- `/` - normalna aplikacja dla każdego zalogowanego użytkownika.
- `/pair` - zgłoszenia drugiej osoby, zadania i nagrody Waszej pary.
- `/rewards` - odbieranie nagród za punkty.
- `/history` - ostatnia historia.
- `/account` - nazwa profilu, rola, wylogowanie i odłączenie od pary.
- `/dashboard` - owner i admin: zarządzanie dostępem do aplikacji.
- `/auth` - logowanie Google.

## Instalacja jako PWA

iPhone:

1. Otwórz aplikację w Safari.
2. Kliknij `Udostępnij`.
3. Wybierz `Dodaj do ekranu głównego`.

Android:

1. Otwórz aplikację w Chrome.
2. Kliknij menu przeglądarki.
3. Wybierz `Dodaj do ekranu głównego` albo `Zainstaluj aplikację`.

## Jak utrzymać to za darmo

- wrzucaj małe zdjęcia
- nie wrzucaj filmów
- nie dodawaj ciężkiej analityki
- nie włączaj niepotrzebnego realtime
- trzymaj krótkie listy historii

## Ograniczenia bezpieczeństwa

- `NEXT_PUBLIC_ADMIN_EMAIL` nie jest sekretem, tylko wskazuje pierwszego ownera.
- Dostęp opiera się na Google OAuth i prywatnej liście dozwolonych emaili.
- Owner i admin mogą zarządzać dostępem, ale nie są osobnymi postaciami w zadaniach. Obie role normalnie korzystają z aplikacji jako użytkownicy.
- To nadal prywatny projekt dla małej liczby osób, nie system enterprise.

## Manualna checklista

- [ ] Konto z `NEXT_PUBLIC_ADMIN_EMAIL` loguje się jako pierwszy owner.
- [ ] Konto spoza allowlisty nie ma dostępu.
- [ ] Owner dodaje email drugiej osoby w `/dashboard`.
- [ ] Nie da się wyłączyć albo zdegradować ostatniego ownera.
- [ ] Admin może zarządzać użytkownikami, ale nie może odebrać roli ownerowi.
- [ ] Użytkownik widzi swój osobisty kod zaproszenia.
- [ ] Drugi użytkownik wysyła prośbę o połączenie przez wpisanie osobistego kodu.
- [ ] Użytkownik widzi zadania dzienne na `/`.
- [ ] Użytkownik nie wyśle drugi raz zadania ze statusem `pending` albo `approved` tego samego dnia.
- [ ] W `/pair` widać oczekujące zgłoszenie.
- [ ] Akceptacja zgłoszenia dodaje punkty.
- [ ] Przed akceptacją zgłoszenia pojawia się potwierdzenie.
- [ ] Odrzucenie wymaga powodu.
- [ ] Po odrzuceniu można wysłać zgłoszenie ponownie.
- [ ] Odebranie nagrody tworzy ujemną transakcję.
- [ ] Historia pokazuje ostatnie zgłoszenia, punkty i nagrody.
- [ ] Konto pozwala zmienić nazwę i opuścić parę.
- [ ] `/dashboard` jest dostępny dla ownerów i adminów.

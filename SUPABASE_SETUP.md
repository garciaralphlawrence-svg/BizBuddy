# Supabase Setup (Biz Buddy)

## Current status: demo mode (cloud sync OFF)
The app ships in **demo mode**. `BIZBUDDY_SUPABASE_URL` and
`BIZBUDDY_SUPABASE_ANON_KEY` in `supabase-client.js` are empty, so:

- All data (users, tasks, profiles, messages, call invites, courses, inquiries)
  is stored in the browser's `localStorage`.
- On the first visit the app is pre-filled with realistic sample data.
- The **Reset demo data** button in the footer restores that sample data.
- The Supabase JS library is not downloaded and no network calls are made.

The previous Supabase project (`nhpkbtufspediqiudern`) no longer exists, so its
URL and key have been removed.

Demo logins (seeded on first visit / after reset):

| Role   | Email                 | Password  |
|--------|-----------------------|-----------|
| Admin  | admin@bizbuddy.com    | admin123  |
| Client | client@bizbuddy.com   | client123 |
| VA     | va@bizbuddy.com       | va12345   |

## Re-enabling cloud sync later

### 1) Create a Supabase project
- Open the Supabase dashboard and create a new project.

### 2) Run SQL setup
- Open SQL Editor.
- Run the contents of `supabase-setup.sql` (creates the `app_state` table).

### 3) Add your keys
Open `supabase-client.js` and fill in the two values at the top:

```javascript
window.BIZBUDDY_SUPABASE_URL = window.BIZBUDDY_SUPABASE_URL || 'https://your-project-ref.supabase.co';
window.BIZBUDDY_SUPABASE_ANON_KEY = window.BIZBUDDY_SUPABASE_ANON_KEY || 'your-anon-key';
```

When both are set, `supabase-client.js` loads the Supabase JS library from
jsDelivr, creates the client, and `app.js` will:
- read every row of `app_state` on page load (cloud data wins over local), and
- upsert each changed key (`tasks`, `users`, `userProfiles`, `courses`,
  `courseProgress`, `inquiries`, `conversations`, `schedules`) on every save.

If the library or the project cannot be reached, the app keeps working in
local mode.

### 4) Test
- Reload the app.
- Create/update data (tasks, profile, messages).
- Check that rows appear in the `app_state` table.

## Important production note
The policy in `supabase-setup.sql` allows anonymous full access for easy
migration, and passwords are stored in plain text inside `users`. Before
production, move to Supabase Auth + strict RLS per user role.

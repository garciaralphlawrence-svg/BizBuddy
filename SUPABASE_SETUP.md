# Supabase Setup (Biz Buddy)

## 1) Create Supabase project
- Open Supabase dashboard.
- Create a new project.

## 2) Run SQL setup
- Open SQL Editor.
- Run the contents of `supabase-setup.sql`.

## 3) Add your keys
- Open `supabase-client.js`.
- Set:
  - `window.BIZBUDDY_SUPABASE_URL`
  - `window.BIZBUDDY_SUPABASE_ANON_KEY`

Example:

```javascript
window.BIZBUDDY_SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.BIZBUDDY_SUPABASE_ANON_KEY = 'your-anon-key';
```

## 4) Test
- Reload app.
- Create/update data (tasks, profile, messages).
- Data syncs to `app_state` table.

## 5) Important production note
Current policy in `supabase-setup.sql` allows anonymous full access for easy migration.
Before production, move to Supabase Auth + strict RLS per user role.

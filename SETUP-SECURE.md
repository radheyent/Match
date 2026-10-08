# Secure setup (server-side admin)

Browser ke paas ab koi Supabase key ya admin password nahi hai. Sab kuch Vercel server function
(`api/app.ts`) se hota hai.

## 1. Vercel Environment Variables (Production)
| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase -> Project Settings -> API -> Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Project Settings -> API -> `service_role` (secret) |
| `ADMIN_PASSWORD` | **naya** strong password (purana `Ricky@1212` public code me tha, use mat karo) |
| `SESSION_SECRET` (optional) | koi bhi lamba random text |
| `TZ_OFFSET_MINUTES` (optional) | default 330 = IST (daily quota ka din isi se badalta hai) |

Purane `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ab zaruri nahi, hata sakte ho.
Service-role key ko kabhi `VITE_` prefix ke saath mat daalo.

## 2. Code push -> Vercel deploy (Ready hone do)

## 3. Supabase SQL Editor me `supabase-secure-setup.sql` run karo (ek baar)
Ye anon access band karta hai aur atomic pull function banata hai.

## 4. Test
1. Site -> Admin -> naya password -> unlock.
2. Users tab me test user banao, file upload karo, refresh karo (data wahi rehna chahiye).
3. Agent se login karke pull karo, Supabase Table Editor me `customers` / `pull_history` dekho.

## Local development
`npm run dev` sirf frontend chalata hai; API ke liye `vercel dev` use karo (env vars `.env` me).

# ERP MERN Server v3

## Setup
```bash
cp .env.example .env
npm i
npm run dev
```

## APIs
- `/api/auth/register` (أول مستخدم يصير admin تلقائيًا)
- `/api/auth/login`
- `/api/auth/me`

- `/api/departments` CRUD مع RBAC
- `/api/users` CRUD مع RBAC

## ملاحظات
- CORS مضبوط لـ 127.0.0.1 و localhost:5173
- Response time + compression للتطوير
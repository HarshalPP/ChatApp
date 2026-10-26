# Chat Backend

Node.js + TypeScript chat API.


## Setup



```bash
npm install
cp .env.example .env        # then fill in the values
```

**PostgreSQL** — create an empty database and put its connection string in `DATABASE_URL`:

```bash
psql -U postgres -c "CREATE DATABASE chat_app;"
```

(or create it from pgAdmin). Any hosted Postgres (Neon, Supabase, etc.) works too — just paste its connection string.

**Firestore** — either:


```bash
npm run migrate   # creates the tables (also runs automatically on server start)
npm run seed      # creates 3 test users and prints their ids
npm run dev       # starts the API with auto-reload
```

Production build: `npm run build && npm start`.

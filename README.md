# BookNook API (Express + MongoDB)

Private book CRUD and borrowing API for the BookNook Next.js client.

## Environment

Copy `.env.example` to `.env` and fill in:

```env
MONGODB_URI=mongodb://...
MONGODB_DB=booknook
PORT=8000
CLIENT_URL=http://localhost:3000
```

`MONGODB_DB` must match the database used by the client (`booknook` by default).
`CLIENT_URL` is the Next.js origin that is allowed to call this API with
credentials.

## Run

```bash
npm install
npm run dev
```

The API listens on `http://localhost:8000`.

## Routes

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/books` | Public | List books. `?mine=true` returns only the signed-in user's books. |
| GET | `/books/:id` | Public | Get one book. |
| POST | `/books` | Session | Add a book for the signed-in user. |
| PATCH | `/books/:id` | Session + owner | Update a book. |
| DELETE | `/books/:id` | Session + owner | Delete a book and its borrow records. |
| POST | `/borrows` | Session | Borrow a book for 14 days. |
| GET | `/borrows` | Session | The signed-in user's active borrows. `?bookId=` filters one book. |
| DELETE | `/borrows/:id` | Session + owner | Return a borrowed book. |

## Authentication

The client signs in through better-auth on the Next.js app. Requests to this
API use `credentials: "include"`, so the browser sends the better-auth session
cookie. Protected routes forward that cookie to
`CLIENT_URL/api/auth/get-session` and trust the user returned by that endpoint.
Client-supplied emails are never used to identify a user.

Run both apps on the same hostname in development (`localhost` for both). The
session cookie is `SameSite=Lax`, so `localhost:3000` and `localhost:8000`
share it; mixing `localhost` and `127.0.0.1` does not.
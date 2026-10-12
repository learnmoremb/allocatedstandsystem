# Stand Allocation Tracking System

A digital system for tracking council stand (land) allocations. Authorised users can view their allocation status, payment history and planned infrastructure. Record-linkage techniques find possible duplicate stand allocations.

**Stack:** MongoDB · Node.js/Express (`backend/`) · Angular 21 (`frontend/`)

## Roles (one shared login page, a separate dashboard for each role)

| Role | Can do |
|---|---|
| **General user** (resident) | Register, read news, browse open stands, apply, track the allocation stage, upload payment receipts, view payment history, view planned infrastructure for their area, get notifications |
| **Council** | Add or import stands and announce them on the news list, review applications, approve (which allocates the stand), allocate directly, verify receipts and approve or reject payments, move stages (title processing → completed), cancel allocations, manage infrastructure (published to the news list automatically), run duplicate checks |
| **Admin** | Everything the council can do, plus user management (create council/admin accounts, change roles, disable accounts, reset passwords) |

## Allocation & payment stages
`Awaiting deposit → Deposit paid → Paying instalments → Fully paid → Title deed processing → Completed`

Users upload a receipt (PDF/JPG/PNG) for every payment. Only **council-approved** payments count towards `amountPaid`. The stage moves forward automatically as approved payments arrive, and the council moves an allocation to the final stages once it is fully paid.

### First-login password change
Accounts created by an admin, and accounts whose password an admin resets, are flagged `mustChangePassword`. The user can sign in with the temporary password, but they are taken to a **Change password** screen and can't go anywhere else. The API enforces this too: every endpoint except `GET /api/auth/me` and `PUT /api/auth/me/password` returns `403 PASSWORD_CHANGE_REQUIRED` until the password is changed. The new password must differ from the temporary one. The admin user list shows a "Must change password" tag until the user has done it. Self-registered accounts are not affected.

### Email notifications
Users are emailed when:
- **a stand is allocated to them**, either by approving their application or by direct allocation. The email gives the allocation number, stand details, price and the deposit due.
- **a payment is approved**. The email shows the amount, the reference, the total paid so far, the balance and the current stage. Once the stand is fully paid, the email says so instead.
- **a payment is rejected**. The email gives the council's reason and confirms the amount was not credited, with a link to resubmit.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `backend/.env`. If `SMTP_HOST` is empty, emails are logged to the console rather than sent. A failed send is logged and never blocks the approval.

## Double-booking prevention
1. **Atomic stand claim:** an allocation only succeeds if `Stand.status` is still `available`/`reserved` (a single `findOneAndUpdate`). Two concurrent approvals for one stand → one succeeds, the other gets `409`.
2. **Database constraint:** a partial unique index on `Allocation.stand` where `holdsStand: true`, so a stand can never have two live allocations.
3. **Per-person limit:** `MAX_ACTIVE_STANDS_PER_USER` (default 1), plus a unique national ID per account.
4. **Same person under another account:** before allocating, the applicant is fuzzy-matched against existing holders. A close match blocks the allocation unless an officer explicitly overrides it.
5. Other pending applications for an allocated stand are automatically rejected and those applicants are notified.

## Record linkage (CSV duplicate detection) — `backend/src/utils/recordLinkage.js`
Upload any allocation register as a CSV. Column names are flexible: `Stand No`, `Suburb`, `Name`, `ID Number`, etc.
- **Normalisation:** stand numbers (`Stand 0202` → `202`), national IDs (`08-765432-B-21` → `08765432B21`), phones (last 9 digits), names (token-sorted, so `Moyo Tendai` = `Tendai Moyo`).
- **Blocking:** by stand key, national ID, phone, and the Soundex of the surname.
- **Scoring:** national ID 45% + Jaro-Winkler name similarity 35% + phone 20%. A score of ≥ 0.8 counts as the same person.
- **Findings:** double allocation (one stand, different people) · conflict with the system (the CSV holder differs from the holder recorded in the DB) · same person holding multiple stands · duplicate rows.
- "Scan system allocations" runs the same checks over the database itself.

A sample file with planted duplicates: `backend/samples/allocations-with-duplicates.csv`.

## Deploying on a server with Docker

The three containers run on one Docker network, `stand-net`, and nginx is not used:

| Service | Container | Port on the server | Purpose |
|---|---|---|---|
| `frontend` | stand-frontend | `APP_PORT` (8080) | Angular app served by a small Node server, which also forwards `/api` to the backend |
| `backend` | stand-backend | `API_PORT` (5000) | Express API |
| `mongo` | stand-mongo | `127.0.0.1:MONGO_PORT` (27017) | MongoDB with authentication, reachable only from the server itself |

Data is kept in the Docker volumes `mongo-data` (database) and `receipts` (uploaded receipts).

```bash
# 1. copy the project to the server, then in the project folder:
cp .env.example .env        # (a .env with random secrets is already included; review it)
nano .env                   # set PUBLIC_URL=http://<server-ip>:8080 and ADMIN_EMAIL

# 2. build and start
docker compose up -d --build

# 3. check
docker compose ps           # all three should become "healthy"
curl http://localhost:8080/api/health
```
Open **http://&lt;server-ip&gt;:8080** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. You will be asked to choose a new password. That admin is created only when the database has no admin yet.

Open port 8080 in the server firewall (e.g. `sudo ufw allow 8080/tcp`). Port 5000 only needs to be open if something other than the frontend calls the API directly.

Useful commands:
```bash
docker compose logs -f backend                       # API logs (emails are logged here if SMTP is not set)
docker compose exec backend npm run seed             # load DEMO data. WARNING: wipes the database
docker compose exec -T mongo sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive' > backup.archive   # backup
docker compose up -d --build                         # redeploy after code changes
docker compose down                                  # stop (data is kept; add -v to delete it)
```
Change `MONGO_ROOT_PASSWORD` **before** the first start. MongoDB only reads it when the data volume is created.

## Running locally for development
Requires Node 20+ and MongoDB on `127.0.0.1:27017`.

```bash
cd backend && npm install && npm run seed && npm run dev     # API on :5000
cd frontend && npm install && npm start                       # UI on :4200 (proxies /api)
```
Then open http://localhost:4200. Settings live in `backend/.env` (see `.env.example`). **Change `JWT_SECRET` before deploying.**

### Demo accounts (created by `npm run seed`, which **wipes the database**)
| Email | Password | Role |
|---|---|---|
| admin@council.gov | admin123 | admin |
| council@council.gov | council123 | council |
| tendai@example.com | user123 | user (has a stand, partly paid) |
| chipo@example.com | user123 | user (pending application) |
| farai@example.com | user123 | user |

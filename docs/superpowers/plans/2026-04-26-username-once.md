# Username Once Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to set a username exactly once from the Profile page, with clear UI feedback before and after.

**Architecture:** Add `username_set boolean` column to `users.profiles`. A dedicated `PATCH /user/profile/username` endpoint checks the flag and rejects updates if already set. The frontend Profile page shows an editable field + warning message when unset, and a greyed-out read-only field once locked.

**Tech Stack:** Go (net/http, database/sql, pq), PostgreSQL, React + TypeScript, CSS Modules.

---

## File Map

| File | Change |
|------|--------|
| `infra/postgres/init.sql` | Add `username_set BOOLEAN DEFAULT FALSE` to `users.profiles` |
| `services/user-service/repository/user.go` | Add `SetUsername(userID, username string) error` + update `GetProfile` to return `username_set` |
| `services/user-service/service/user.go` | Add `SetUsername` method + update `UserRepoIface` |
| `services/user-service/handler/user.go` | Add `SetUsername` handler + update `UserServiceIface` |
| `services/user-service/cmd/server/main.go` | Register `PATCH /user/profile/username` route |
| `web/src/api/user.ts` | Add `setUsername(username: string)` function |
| `web/src/pages/Profile/Profile.tsx` | Username edit UI: editable field + warning / greyed field |
| `web/src/pages/Profile/Profile.module.css` | Styles for username form |

---

### Task 1: DB migration — add `username_set` column

**Files:**
- Modify: `infra/postgres/init.sql`

- [ ] **Step 1: Add column to profiles table definition**

In `infra/postgres/init.sql`, find the `users.profiles` CREATE TABLE and add the column:

```sql
CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT,
    consent_ai BOOLEAN DEFAULT FALSE,
    username_set BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 2: Apply migration to running postgres**

```bash
docker compose exec postgres psql -U mogged -d mogged -c \
  "ALTER TABLE users.profiles ADD COLUMN IF NOT EXISTS username_set BOOLEAN DEFAULT FALSE;"
```

Expected output: `ALTER TABLE`

- [ ] **Step 3: Verify column exists**

```bash
docker compose exec postgres psql -U mogged -d mogged -c \
  "\d users.profiles"
```

Expected: column `username_set` of type `boolean` appears in the list.

- [ ] **Step 4: Commit**

```bash
git add infra/postgres/init.sql
git commit -m "feat: add username_set column to users.profiles"
```

---

### Task 2: Repository — `SetUsername` + updated `GetProfile`

**Files:**
- Modify: `services/user-service/repository/user.go`

- [ ] **Step 1: Update `GetProfile` to return `username_set`**

Replace the `GetProfile` method:

```go
func (r *UserRepo) GetProfile(userID string) (map[string]interface{}, error) {
	row := r.db.QueryRow(`
		SELECT id, username, avatar_url, consent_ai, username_set
		FROM users.profiles WHERE id = $1
	`, userID)
	var id, username string
	var avatarURL *string
	var consentAI, usernameSet bool
	if err := row.Scan(&id, &username, &avatarURL, &consentAI, &usernameSet); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"id":           id,
		"username":     username,
		"avatar_url":   avatarURL,
		"consent_ai":   consentAI,
		"username_set": usernameSet,
	}, nil
}
```

- [ ] **Step 2: Add `SetUsername` method**

Add after `UpsertProfile`:

```go
func (r *UserRepo) SetUsername(userID, username string) error {
	res, err := r.db.Exec(`
		UPDATE users.profiles
		SET username = $2, username_set = TRUE, updated_at = NOW()
		WHERE id = $1 AND username_set = FALSE
	`, userID, username)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("username already set")
	}
	return nil
}
```

Add `"fmt"` to the import block if not already present.

- [ ] **Step 3: Commit**

```bash
git add services/user-service/repository/user.go
git commit -m "feat: add SetUsername repo method and return username_set in GetProfile"
```

---

### Task 3: Service layer — `SetUsername`

**Files:**
- Modify: `services/user-service/service/user.go`

- [ ] **Step 1: Add `SetUsername` to `UserRepoIface`**

In the `UserRepoIface` interface, add:

```go
SetUsername(userID, username string) error
```

- [ ] **Step 2: Add `SetUsername` service method**

```go
func (s *UserService) SetUsername(userID, username string) error {
	if len(username) < 3 || len(username) > 20 {
		return fmt.Errorf("username must be 3–20 characters")
	}
	for _, c := range username {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return fmt.Errorf("username may only contain letters, digits and underscores")
		}
	}
	return s.repo.SetUsername(userID, username)
}
```

Add `"fmt"` to the import block if not already present.

- [ ] **Step 3: Commit**

```bash
git add services/user-service/service/user.go
git commit -m "feat: add SetUsername service method with validation"
```

---

### Task 4: Handler — `SetUsername` + route registration

**Files:**
- Modify: `services/user-service/handler/user.go`
- Modify: `services/user-service/cmd/server/main.go`

- [ ] **Step 1: Add `SetUsername` to `UserServiceIface`**

In the `UserServiceIface` interface in `handler/user.go`, add:

```go
SetUsername(userID, username string) error
```

- [ ] **Step 2: Add `SetUsername` handler method**

Add after `UpsertProfile`:

```go
func (h *UserHandler) SetUsername(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.SetUsername(userID, body.Username); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 3: Register route in `cmd/server/main.go`**

Add after the existing `/user/profile/upsert` line:

```go
mux.HandleFunc("/user/profile/username", h.SetUsername)
```

- [ ] **Step 4: Build to verify no compile errors**

```bash
cd services/user-service && go build ./...
```

Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add services/user-service/handler/user.go services/user-service/cmd/server/main.go
git commit -m "feat: add SetUsername handler and route"
```

---

### Task 5: Frontend API

**Files:**
- Modify: `web/src/api/user.ts`

- [ ] **Step 1: Add `setUsername` function**

Open `web/src/api/user.ts` and add:

```ts
export async function setUsername(username: string): Promise<void> {
  return apiRequest<void>('/user/profile/username', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api/user.ts
git commit -m "feat: add setUsername API call"
```

---

### Task 6: Profile page UI

**Files:**
- Modify: `web/src/pages/Profile/Profile.tsx`
- Modify: `web/src/pages/Profile/Profile.module.css`

- [ ] **Step 1: Update `ProfileData` type and add state**

Replace the `ProfileData` interface and update the component state:

```tsx
interface ProfileData { id: string; username: string; username_set: boolean; consent_ai: boolean }
```

Add inside the component (after existing state):

```tsx
const [usernameInput, setUsernameInput] = useState('');
const [usernameError, setUsernameError] = useState('');
const [usernameSaving, setUsernameSaving] = useState(false);
```

- [ ] **Step 2: Add save handler**

Add inside the component before the return:

```tsx
const handleSetUsername = async () => {
  setUsernameError('');
  setUsernameSaving(true);
  try {
    await setUsername(usernameInput.trim());
    setProfile((p) => p ? { ...p, username: usernameInput.trim(), username_set: true } : p);
  } catch (e: unknown) {
    setUsernameError((e as Error).message);
  } finally {
    setUsernameSaving(false);
  }
};
```

Add `setUsername` to the import from `@/api/user`.

- [ ] **Step 3: Replace username display with conditional UI**

Replace the `{profile && (...)}` section with:

```tsx
{profile && (
  <div className={styles.section}>
    {profile.username_set ? (
      <div className={styles.usernameBlock}>
        <span className={styles.usernameLabel}>Pseudo</span>
        <input
          className={styles.usernameInputLocked}
          value={profile.username}
          disabled
        />
      </div>
    ) : (
      <div className={styles.usernameBlock}>
        <span className={styles.usernameLabel}>Pseudo</span>
        <p className={styles.usernameWarning}>
          Attention : le pseudo ne peut être modifié qu'une seule fois.
        </p>
        <div className={styles.usernameRow}>
          <input
            className={styles.usernameInput}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="3–20 caractères, lettres/chiffres/_"
            maxLength={20}
          />
          <button
            className={styles.usernameBtn}
            onClick={handleSetUsername}
            disabled={usernameSaving || usernameInput.trim().length < 3}
          >
            {usernameSaving ? '…' : 'Enregistrer'}
          </button>
        </div>
        {usernameError && <p className={styles.usernameError}>{usernameError}</p>}
      </div>
    )}
    <p className={styles.id}>{userID}</p>
  </div>
)}
```

- [ ] **Step 4: Add CSS**

Add to `Profile.module.css`:

```css
.usernameBlock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 320px;
}

.usernameLabel {
  color: #888;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.usernameWarning {
  color: #f5a623;
  font-size: 0.78rem;
  margin: 0;
}

.usernameRow {
  display: flex;
  gap: 8px;
}

.usernameInput {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
  padding: 8px 12px;
  font-size: 0.9rem;
}

.usernameInput:focus {
  outline: none;
  border-color: #555;
}

.usernameInputLocked {
  flex: 1;
  background: #111;
  border: 1px solid #222;
  border-radius: 8px;
  color: #555;
  padding: 8px 12px;
  font-size: 0.9rem;
  cursor: not-allowed;
  width: 100%;
}

.usernameBtn {
  background: #fff;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.usernameBtn:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.usernameError {
  color: #e05252;
  font-size: 0.78rem;
  margin: 0;
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Profile/Profile.tsx web/src/pages/Profile/Profile.module.css
git commit -m "feat: username set-once UI in Profile page"
```

---

### Task 7: Rebuild and validate

- [ ] **Step 1: Rebuild user-service and web**

```bash
docker compose build user-service web
```

Expected: both images build with no errors.

- [ ] **Step 2: Restart services**

```bash
docker compose up -d user-service web
```

- [ ] **Step 3: Manual test — first set**

1. Open `http://localhost:3000/profile`
2. See the warning message and an editable input
3. Type a valid username (e.g. `cledtest`) and click Enregistrer
4. Input becomes greyed and locked — warning message disappears

- [ ] **Step 4: Manual test — already set**

1. Refresh the page
2. Input is still greyed and locked with the saved username

- [ ] **Step 5: Manual test — validation**

1. Create a new account or reset `username_set = FALSE` in DB:
   ```bash
   docker compose exec postgres psql -U mogged -d mogged -c \
     "UPDATE users.profiles SET username_set = FALSE, username = '';"
   ```
2. Try submitting a username with spaces or special chars → see error message
3. Try submitting fewer than 3 chars → button stays disabled

- [ ] **Step 6: Final commit if any fixes**

```bash
git add -p
git commit -m "fix: username validation edge cases"
```

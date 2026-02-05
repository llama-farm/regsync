# RegSync Development Skills

## Commit Frequently

**When to commit:**
- After completing each discrete feature or fix (even small ones)
- After making UI changes that work correctly
- Before starting a new unrelated task
- After fixing bugs
- After refactoring that doesn't break anything

**Commit message format:**
```
type(scope): short description

- detail 1
- detail 2
```

**Types:** feat, fix, refactor, style, chore, docs

**Examples:**
- `feat(chat): add New chat button to header`
- `fix(auth): clear chat history on logout`
- `style(docs): make document cards clickable`

**Rule:** If you've made 2-3 working changes without committing, stop and commit now.

---

## No Mock Data in Production Views

Real documents should come from the API. Mock data is only acceptable:
- As fallback when API is unavailable
- For placeholder items clearly marked as unavailable
- During initial development before API exists

Always prefer real data over mock data.

---

## Keep Headers Compact

UI headers should be minimal:
- Use `py-1.5` or `py-2` max for header padding
- No borders on buttons in headers unless necessary
- Keep button text short (e.g., "New chat" not "Start a new conversation")

---

## Test After Each Change

After making UI changes:
1. Check the browser to verify the change works
2. Test both user roles if the change affects auth/permissions
3. Verify mobile responsiveness for layout changes

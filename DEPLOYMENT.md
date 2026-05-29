# HalalCart — Deployment & Social Login

## Live URLs
- 🌐 **Frontend**: https://ashy-sky-04731fd0f.7.azurestaticapps.net
- 🔌 **Backend API**: https://halalcart-api.azurewebsites.net
- Azure Resource Group: `eu-hack-rg`

---

## Social Login — Auth0

**7 providers** — zero user management. Enable new ones from the Auth0 dashboard with no code changes.

| Button | Provider | Audience |
|---|---|---|
| 🔵 Google | google-oauth2 | Everyone |
| 🍎 Apple | apple | iPhone users |
| 📘 Facebook | facebook | Instagram / WhatsApp users |
| 🎮 Discord | discord | Gamers, college crowd |
| 🐦 Twitter / X | twitter | Trending crowd |
| 👻 Snapchat | snap | Teens & young adults |
| 🎮 Microsoft | windowslive | Xbox gamers |

Phone login kept as fallback. Admin detected by phone `7327184414` OR email `teabreaktechnology@gmail.com`.

**Auth0 Tenant**: `dev-ar8owfhn6wo6v5p6.us.auth0.com`

---

## GitHub Secrets (all set ✅)

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Azure deployment identity |
| `AZURE_TENANT_ID` | Azure deployment identity |
| `AZURE_SUBSCRIPTION_ID` | Azure deployment identity |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Frontend deploy to SWA |
| `REACT_APP_AUTH0_DOMAIN` | Auth0 tenant domain |
| `REACT_APP_AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `REACT_APP_ADMIN_EMAIL` | Admin email for social login |

---

## Azure App Service Settings (all set ✅)

| Setting | Value |
|---|---|
| `DATA_DIR` | `/home/data` |
| `ADMIN_EMAIL` | `teabreaktechnology@gmail.com` |

---

## CI/CD Workflows

| Workflow | Triggers on push to |
|---|---|
| `deploy-backend.yml` | `backend/**` |
| `deploy-frontend.yml` | `frontend/**` |

Both also support manual trigger via `workflow_dispatch`.

---

## Adding More Social Providers (no code needed)

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → Authentication → Social
2. Enable the new provider, paste its Client ID + Secret
3. Add the connection name to `SOCIAL_PROVIDERS` array in `frontend/src/components/LoginModal.tsx`
4. Push — auto-deploys

---

## Auth0 One-Time Setup (already done ✅)

If you ever need to recreate:
1. Create SPA app at https://auth0.com
2. Set Allowed Callback/Logout/Web Origins URLs:
   - `http://localhost:3000`
   - `https://ashy-sky-04731fd0f.7.azurestaticapps.net`
3. Enable social connections (Google has built-in dev keys for quick testing)
4. Add the 3 `REACT_APP_AUTH0_*` secrets to GitHub
5. Add `ADMIN_EMAIL` to Azure App Service app settings

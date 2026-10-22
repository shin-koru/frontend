# ShinFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## SHIN streaming interface

The responsive interface follows the SHIN Figma design at desktop (1440px), tablet (768px), and mobile (390px) sizes. Shared colors, spacing, buttons, cards, navigation, dialogs, and form controls live in `src/styles.css` and `src/app/shared`.

| Page                       | Route                                        |
| -------------------------- | -------------------------------------------- |
| Home                       | `/`                                          |
| Movie catalog              | `/movies`                                    |
| Movie details              | `/movies/:id` (content UUID)                 |
| Sign in                    | `/auth/login` (`/login` also redirects here) |
| User profile and watchlist | `/profile` (requires sign-in)                |

The catalog loads real data from `GET /api/content/limit/:limit/offset/:offset` and details from `GET /api/content/:id`. Both require authentication. Only published titles appear. The gateway’s serialized 64-bit pagination totals are normalized before advancing the server offset. Search, type/year filtering, and sorting apply to loaded titles; “Load more titles” fetches the next server page. Ratings, cast, and genre filters are omitted because the API does not expose those fields. Catalog poster object keys are resolved to expiring signed read URLs; legacy public HTTP(S) URLs also render directly. Watchlists persist per account on this browser and resolve saved UUIDs through the content API; there is no backend watchlist endpoint. Figma artwork and the licensed Inter font are served from `public/assets`.

Sign-in uses the existing six-digit email/phone OTP API. The development proxy forwards `/api` to `http://localhost:4000` and rewrites cookie domains so the HttpOnly refresh cookie also works on `127.0.0.1`. Concurrent expired requests share one refresh request and retry with the new access token. Protected routes preserve their return URL. A missing profile leads to profile creation; existing profiles load from `/api/profile/@me`. Logout clears the backend refresh cookie and local access token.

Start gateway, auth, profile, content, and upload services along with PostgreSQL, Redis, RabbitMQ, and MinIO. Email delivery also requires the configured notification service; the current backend SMS path is a stub. Live integration checks use the development-issued OTP for a reserved local test phone identity, not an external SMS delivery. Movies with an uploaded video play in the native video player. General profile-field editing, Google sign-in, and paid plans remain unavailable. The existing `/users` screen still uses the installed licensed PrimeNG release; profile creation and the five streaming pages use native Angular controls and dialogs.

Run `npm run build` for a production build and `npm test -- --watch=false` for the unit suite.


## Uploads

- Profile: choose **Change photo** on `/profile`. JPG, PNG, GIF and WebP images up to 5 MiB are uploaded privately and saved through `PATCH /api/profile/@me/avatar`. The server derives ownership from the access token.
- Admin Studio: `/admin/media` (also linked in the header for admins). Create a draft or choose an existing movie, edit its details, and upload its poster or video. Admin status comes from `/api/auth/me`; the server independently protects all movie changes with its role guard.
- Images show transfer progress and can be cancelled. Videos use direct-to-MinIO multipart PUTs with hashing progress, transfer progress, pause/resume and cancellation. SHA-256 runs incrementally in a worker with 4 MiB reads; videos are not buffered whole in browser memory. Default video limit is 100 GiB.
- Session IDs and file metadata are saved per authenticated account. After reloading, choose the same movie and original video to resume; the whole-file checksum is rechecked and completed parts are skipped. File contents, tokens and signed URLs are not stored in upload records. Resume is available until the backend session expires (normally 24 hours). Small image retries restart their transfer.
- Transfers continue while navigating within the app. Successful saves refresh the profile/catalog. During server verification or record saving, wait for confirmation; pausing/cancellation controls apply to the file transfer. Cancelling a replacement does not remove the previously saved movie video.
- Catalog posters/videos use public upload visibility with expiring signed read links; profile photos use owner-only private reads. App credentials are never sent to MinIO. This is not a paid-content entitlement or DRM system.
- Apply the reviewed content migration with `npm run migration:run` from `shin-backend/content-service` against the intended local database before starting the updated service. It adds a nullable `video_object_key`; existing catalog records remain intact. The local development migration has been verified.

Both profile-service and content-service now use the shared local contracts package. Build that package when preparing a standalone deployment. MinIO must be browser-reachable and allow frontend-origin PUT preflights.

## Movie management

Studio supports title, description, movie/series type, release date, runtime in whole seconds, and age rating. Save a new draft before uploading media. Uploads save independently of the details form; editing details preserves saved media and publication status. Unsaved details trigger a discard prompt when switching movies or leaving Studio, and failed saves retain the form values.

Publishing requires a title, poster, and video. Archiving requires confirmation, hides the title from viewer catalog/detail/season reads, and preserves its details and media for republishing. Studio lists all statuses through admin-only `GET /api/content/admin/limit/:limit/offset/:offset`. Changes use `POST /api/content`, `PUT /api/content/:id`, `PATCH /api/content/:id/publish`, and `DELETE /api/content/:id` (archive). The server returns the created/updated movie, including its UUID. Optional detail clearing uses explicit `clearReleaseDate`, `clearDurationSeconds`, and `clearAgeRating` flags; media and lifecycle changes have separate endpoints.

Deploy the content service and gateway together with the updated shared content contract. No additional database migration is required for these movie-management features.

## Series management

Create a title with type **Series** in Studio, then use **Seasons & episodes** to create and edit numbered seasons and episodes. Numbers must be unique within their parent. Episode details include title, description, release date, and runtime in whole seconds. Save an episode draft before uploading its video. Upload progress, cancellation, and multipart resume work as for movie videos; after reload, select the same series, season, episode, and original video file.

Seasons and episodes start as drafts. Episodes require a saved video to publish; series require a poster, without requiring a movie-level video. Viewers can retrieve an episode only when the series, season, and episode are all published. Archiving any parent hides its children while preserving their individual states and files; republishing restores eligible children. Archive actions require confirmation. All create, edit, media, publish, archive, and unpublished-read APIs require the admin role.

Admin reads use `GET /api/content/admin/:id/season`, `GET /api/season/admin/:id/episode`, and `GET /api/episode/admin/:id`. Season creation uses `POST /api/content/:id/season`; episode creation uses `POST /api/season/:id/episode`. Edits use `PUT /api/season/:id` and `PUT /api/episode/:id`. Both support `PATCH /:id/publish` and `DELETE /:id` (archive). Episode media is validated and saved through `PATCH /api/episode/:id/media` with `videoKey`; detail edits cannot change media, parent IDs, or status.

Apply the `SeriesLifecycle1792569600000` content migration with `npm run migration:run` against the intended database before deploying the updated content service, gateway, frontend, and shared contracts together. It adds constrained status columns, preserves existing seasons/episodes as published, and defaults new records to draft. The migration has been applied to the local development database. Rolling it back removes publication states; it does not delete seasons, episodes, or files.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Catalog discovery API

The viewer API adapter routes movie and series lists to `/api/movies` and
`/api/series`, searches to `/api/search?q=...`, genre options to `/api/genres`,
and genre-filtered movie pages to `/api/genres/:id/movies`. Genre searches pass
`query` to that endpoint so text, year, ordering and pagination stay combined
on the server. All-type browsing without a search term, anime/cartoon browsing,
and detail links whose type is unknown continue using the generic content API.

Catalog state remains in ContentStore; genre options and retry/loading state live
in GenreStore, backed by GenreApi. URL parameters are `q`, `type`, `year`, `sort`,
and `genre` (UUID). Selecting a genre sets the type to movie; choosing a different
type clears the genre. Each filter change cancels the previous request and resets
pagination after the search debounce. Genre options load independently and can be
retried without discarding movie results. Movie cards include the content type in
detail links so known movies/series use their typed detail endpoints, while old
bookmarks and ID-only watchlist entries remain compatible.

Deploy the backend catalog routes and regenerated contracts before this frontend.
Browser validation uses HTTP fixtures; it does not verify a live deployed database.

## Plans and membership

The authenticated `/plans` page is available from desktop and mobile navigation.
It lists active plans, shows the current subscription and expiry, accepts promo
codes, and confirms immediate cancellation. Test-only one-time KZT payment activation is available; real charges are disabled.

The subscriptions feature separates typed HTTP access (`subscription.api.ts`),
request/state coordination (`subscription.store.ts`), and the OnPush page.
Plans and current membership have independent loading, error and retry states.
The store preserves an idempotency UUID when retrying the same promo code during
the page session. Authentication changes cancel pending requests and clear state.
The gateway derives account ownership; the frontend never sends a user ID.

Deploy the gateway subscription routes and subscription-service promo migration
before this frontend. Unit tests cover retry identity, cancellation, session
cleanup and currency formatting. Browser checks use API fixtures, including
desktop/mobile layouts and the redeem/cancel interactions.

The admin-only `/admin/subscriptions` page (Memberships in the header) separates
typed HTTP access, a page-scoped signal store and presentation. Admins can create
plans and activate/deactivate them; commercial terms stay immutable. Promo creation
accepts a future local date/time (converted to UTC) and total usage limit. The
secret is displayed once in memory with a copy action; issued-code listings show
usage counts and allow confirmed revocation. No secrets are saved in browser
storage. Session changes clear state and cancel pending requests. Admin authorization
is enforced in the gateway as well as the route guard. Deploy the updated contracts,
subscription service and gateway admin listing routes before this UI.

## Feature organization

The movies and subscriptions features follow the profile feature layout:

- `model/`: shared interfaces, types, and pure model helpers.
- `service/`: HTTP APIs and feature services.
- `state/`: stores and their adjacent tests.
- `pages/`: page components, templates, and styles. Subscription pages use
  `pages/plans/` and `pages/admin/` subfolders.
- `<feature>.routes.ts`: feature-owned lazy routes, with existing URLs and guards.

API tests stay beside their services, and component tests stay beside components.
Import shared types directly from model files rather than through HTTP services.

## Study checkout

`/plans` offers **Try test payment** for active, positive-price KZT plans.
`/plans/payment/:id` shows the server-recorded result. The default offline simulator
needs no account or card and can simulate success/failure. Freedom Pay test mode
shows a hosted checkout link only; real card details must never be entered.
Payment APIs, models, state, and pages follow the same feature folders as profile.
The frontend sends only plan and retry IDs, never amounts or owners, and ignores
provider return query parameters as evidence of success. No live billing or renewal
is offered. For setup and migration details see the backend subscription-service
`docs/payments.md`. Browser verification uses fixtures, not a real provider account.

Payment history: `/payments` for users, `/admin/payments` for administrators. Both use the subscriptions feature model/service/state/pages structure. All payments remain test-only. The gateway now requires the separate payment-service; see the sibling backend payment-service README for setup and existing-data transfer.

# Trattoria POS Frontend — Documentation

Documentation index for the React frontend of the Trattoria restaurant POS. If you are picking up this project cold, read the docs in this order:

1. **[Architecture](./architecture.md)** — the big picture: what this app is, how it fits together with the backend, and the mental model to hold in your head.
2. **[Getting Started](./getting-started.md)** — install, configure, and run the app locally in five minutes.
3. **[Project Structure](./project-structure.md)** — every file and folder, what it does, and where to look for X.
4. **[Routing](./routing.md)** — every URL the app exposes and what renders at each one.
5. **[Authentication](./authentication.md)** — customer phone-login, staff JWT, admin PIN.
6. **[Roles & Permissions](./roles-and-permissions.md)** — what each of the four roles can and cannot do.
7. **[Data Flow](./data-flow.md)** — the REST-as-source-of-truth + WebSocket-as-optimization model.
8. **[API Integration](./api-integration.md)** — how `lib/api.js` speaks to the backend, endpoint by endpoint.
9. **[WebSockets](./websockets.md)** — STOMP topics, when each one fires, and how the UI reconciles.
10. **[Views](./views.md)** — every top-level screen and what it does.
11. **[Components](./components.md)** — the shared component catalogue.
12. **[Customizations](./customizations.md)** — how portion size / add-ons / etc. flow end-to-end.
13. **[Styling](./styling.md)** — the design system, Tailwind config, and animation conventions.
14. **[Contributing](./contributing.md)** — coding conventions, PR checklist, test IDs.
15. **[Changelog](./changelog.md)** — significant changes.

## Backend reference

The **[API reference](../API_REFERENCE.md)** (kept at the repo root) is the single source of truth for every backend endpoint, DTO, and WebSocket topic. All frontend logic is downstream of that document — if the two ever disagree, the API reference wins.

## Repository layout at a glance

```
/app
├── README.md                # Short project overview (Quick Start)
├── API_REFERENCE.md         # Backend API spec (source of truth)
├── design_guidelines.json   # Original design tokens brief
├── docs/                    # ← you are here
├── memory/                  # Product/PRD notes
└── frontend/                # The React app
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── public/
    └── src/
        ├── App.js                 # Route registry
        ├── index.js               # ReactDOM entry
        ├── index.css              # Tailwind + globals
        ├── components/            # Reusable UI
        ├── views/                 # Route-level screens
        ├── hooks/                 # Custom hooks
        └── lib/                   # api, ws, session, debug
```

## One-line summary

Four user roles (**Customer**, **Waiter**, **Kitchen**, **Cashier**, plus an **Admin** superuser) all share a single React SPA that talks to a Spring Boot backend via REST + STOMP-over-SockJS.

# DocMind — Frontend Application Client

This is the React client application for DocMind, built on **Vite**, featuring a customizable dark theme, interactive document intelligence chat interface, allowed domain controls, and Razorpay standard payment checkout.

---

## Features Built-in

*   🤖 **AI RAG Chat Interface**: Real-time response stream render support, inline code formatting, Markdown parsing, and follow-up suggestion chips.
*   📂 **Interactive Sidebar**: Live list of uploaded documents and crawled websites with processing progress bars and remove buttons.
*   💳 **Pricing Tier Plans**: Exposes Free/Pro/Enterprise plans with Monthly/Yearly toggle rates and sandbox checkout loading using Razorpay SDK.
*   ⚙️ **Allowed Domains Widget Lock**: Dashboard panel to specify whitelisted domains for CORS lock on embedded widgets.
*   💬 **Copyable Widgets**: Renders copy-to-clipboard code snippets for both iframe embeds and floating bubble widget scripts.

---

## Core Components

*   **`App.jsx`**: Manages app state, custom popstate/location routing switch, user credentials session persistence, and primary dashboard structure.
*   **`PricingPage.jsx`**: Handles Monthly/Yearly plan toggles, UI card animations, and Razorpay standard checkout overlay instantiation.
*   **`LoginPage.jsx`**: Provides full forms for auth actions (login, signup, forgot password, and reset password) and displays the pricing page shortcut in the footer.
*   **`config.js`**: Contains constants such as `ACCEPTED_FILE_TYPES`, `SUGGESTED_QUESTIONS`, and checks the environment for `VITE_API_BASE_URL`.

---

## Setup & Running Locally

### 1. Configure Public Keys
Create a `.env` file in this directory (`react/my-app/`):
```env
VITE_RAZORPAY_KEY_ID=rzp_test_T7eCikyyB6M44t
VITE_API_BASE_URL=http://localhost:3001
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
This compiles the optimized production build into the `dist/` directory, ready to deploy to Netlify, Vercel, or static web hosts.

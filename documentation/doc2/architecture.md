src/
│── api/               # appels API
│   ├── axios.js
│   ├── userApi.js
│   ├── productApi.js
│
│── assets/            # images, icons, css global
│
│── components/        # composants réutilisables
│   ├── Navbar.jsx
│   ├── Button.jsx
│   ├── Card.jsx
│
│── pages/             # pages principales
│   ├── Home.jsx
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Products.jsx
│
│── layouts/           # structure page
│   ├── MainLayout.jsx
│   ├── AdminLayout.jsx
│
│── hooks/             # custom hooks
│   ├── useAuth.js
│   ├── useFetch.js
│
│── context/           # global state simple
│   ├── AuthContext.jsx
│
│── store/             # Redux / Zustand si gros projet
│
│── routes/            # routing
│   ├── AppRoutes.jsx
│   ├── PrivateRoute.jsx
│
│── utils/             # fonctions helpers
│   ├── formatDate.js
│   ├── validator.js
│
│── App.jsx
│── main.jsx
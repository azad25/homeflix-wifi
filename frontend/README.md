# HomeFlix Frontend

This is the frontend for HomeFlix, a Netflix clone built with Next.js 14 and TypeScript. It provides a beautiful, responsive interface for browsing and streaming your personal media collection.

## Features

- 🎨 **Netflix-like UI**: Beautiful interface using ScrollXUI components with parallax effects
- 🎭 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- 🎬 **Media Browsing**: Browse your media library with beautiful posters and thumbnails
- 🔍 **Advanced Search**: Search by title, genre, and more
- 🎭 **User Profiles**: Multiple user profiles with watchlists and viewing history
- 🎞️ **Video Player**: Built-in video player with support for subtitles and quality settings

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **ScrollXUI** - UI components and design system
- **React Query** - Data fetching and state management
- **Zustand** - State management
- **Framer Motion** - Animations and transitions

## Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- HomeFlix backend service (see main README for setup)

## Getting Started

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

2. Create a `.env.local` file in the root of the frontend directory with the following variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
# Add other environment variables as needed
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

- `/src/app` - Application routes and pages
- `/src/components` - Reusable UI components
- `/src/lib` - Utility functions and API clients
- `/src/types` - TypeScript type definitions
- `/public` - Static assets

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Contributing

Contributions are welcome! Please read the main project's CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

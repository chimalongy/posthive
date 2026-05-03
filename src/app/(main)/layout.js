import Navbar from '@/components/Navbar';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-zinc-500 text-sm">
            © 2026 PostHive. All rights reserved.
          </div>
          <div className="flex gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a href="/about" className="hover:text-indigo-600 transition-colors">About Us</a>
            <a href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <a href="/login" className="hover:text-indigo-600 transition-colors">Login</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "PostHive — Social Media Posting Platform",
  description: "Connect your social accounts and post everywhere at once",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}

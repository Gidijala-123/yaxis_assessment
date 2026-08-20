import type { Metadata } from "next";
import "./globals.css";
import { QueryClientProvider } from "./providers";
import SidebarToggle from "./sidebar-toggle";

export const metadata: Metadata = {
  title: "Customer Management System | Y-Axis",
  description: "Operations workspace for managing customer applications.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%236f2c92'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,sans-serif' font-size='18' font-weight='900' fill='white'>Y</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryClientProvider>{children}</QueryClientProvider>
        <SidebarToggle />
      </body>
    </html>
  );
}

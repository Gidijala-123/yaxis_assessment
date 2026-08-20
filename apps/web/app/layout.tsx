import "./globals.css";
import { QueryClientProvider } from "./providers";
import SidebarToggle from "./sidebar-toggle";
export const metadata = { title: "Customer Management System | Y-Axis" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><QueryClientProvider>{children}</QueryClientProvider><SidebarToggle /></body></html>; }

import "./globals.css";
import { QueryClientProvider } from "./providers";
export const metadata = { title: "Flowdesk | Customer Operations" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><QueryClientProvider>{children}</QueryClientProvider></body></html>; }

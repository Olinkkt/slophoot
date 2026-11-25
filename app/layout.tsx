import "./globals.css";
export const metadata = { title: "Slophoot" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#2a1566" };
export default function L({ children }: { children: React.ReactNode }) {
  return <html lang="cs"><body className="min-h-screen">{children}</body></html>;
}

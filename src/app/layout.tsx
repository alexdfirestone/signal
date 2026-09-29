import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — startup discovery",
  description: "Find tomorrow's companies through the people VCs follow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

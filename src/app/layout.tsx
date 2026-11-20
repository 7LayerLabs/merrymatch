import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

// Last Christmas by Mans Greback. Personal-use license; buy a commercial license before charging for the app.
const lastChristmas = localFont({
  variable: "--font-last-christmas",
  display: "swap",
  src: [
    { path: "./fonts/LastChristmas-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/LastChristmas-Bold.otf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Merry Match",
  description: "Secret Santa and family wishlists, minus the group-text chaos.",
  applicationName: "Merry Match",
  appleWebApp: { capable: true, title: "Merry Match", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#214337",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} ${lastChristmas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <div className="relative z-[1] flex min-h-full flex-1 flex-col">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}

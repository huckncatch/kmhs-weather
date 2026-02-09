import type { Metadata } from "next";
import "@/styles/globals.css";
import { Navigation } from "@/components/layout/Navigation";

export const metadata: Metadata = {
  title: "KMHS Weather Dashboard",
  description: "Personal weather station dashboard aggregating data from Ambient Weather, PWS Weather, Weather Underground, and CoCoRaHS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}

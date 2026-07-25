import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "문장달력소",
  description: "매일 한 문장을 꺼내 보는 문장 달력",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 电梯选型顾问",
  description: "AI 电梯选型顾问 V1.0 开发骨架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

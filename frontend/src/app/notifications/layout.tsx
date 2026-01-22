import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Activity",
  description: "Real-time notifications and recommendations from your HomeFlix library",
  keywords: ["notifications", "live activity", "recommendations", "updates", "homeflix"],
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
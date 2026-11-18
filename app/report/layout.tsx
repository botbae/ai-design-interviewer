import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your report · AI Design Interviewer' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

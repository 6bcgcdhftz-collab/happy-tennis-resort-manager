import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Happy Tennis Resort Manager",
  description: "Gestione professionale di tennis, padel e pickleball per resort."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}

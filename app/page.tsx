import type { Metadata } from "next";
import DoodhKhata from "./DoodhKhata";

export const metadata: Metadata = {
  title: "Doodh Khata | Dairy sales, stock & ledgers",
  description: "A Firebase-powered dairy business book for farmers, collectors, and shop owners, with AI daily guidance.",
};

export default function Home() {
  return <DoodhKhata />;
}

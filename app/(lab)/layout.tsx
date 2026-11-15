import { Archivo, Geist_Mono } from "next/font/google";
import "./lab.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--yl-sans" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--yl-mono" });

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <div className={`yl ${archivo.variable} ${mono.variable}`}>{children}</div>;
}

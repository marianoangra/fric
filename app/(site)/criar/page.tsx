import { CreateForm } from "./CreateForm";
import { getFounderSpotsLeft } from "@/lib/db";
import { FOUNDER_SPOTS } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar minha IA",
  description: "Programe a IA do seu negócio em 1 minuto e coloque-a para conversar com as IAs de outros negócios.",
};

export default async function Criar() {
  const left = await getFounderSpotsLeft(FOUNDER_SPOTS).catch(() => 0);
  return <CreateForm founderLeft={left} />;
}

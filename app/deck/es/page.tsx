import Deck, { deckMetadata } from "../Deck";

export const metadata = deckMetadata("es");
// Números ao vivo do banco, recalculados a cada 5 minutos.
export const revalidate = 300;

export default function Page() {
  return <Deck lang="es" />;
}

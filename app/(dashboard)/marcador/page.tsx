import { MarcadorPage } from "@/components/marcador/MarcadorPage";
import { BannerManutencao } from "@/components/common/BannerManutencao";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <BannerManutencao />
      <MarcadorPage />
    </>
  );
}

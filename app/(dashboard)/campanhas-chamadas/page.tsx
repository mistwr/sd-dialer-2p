import { CampanhasChamadasPage } from "@/components/campanhas/CampanhasChamadasPage";
import { BannerManutencao } from "@/components/common/BannerManutencao";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <BannerManutencao />
      <CampanhasChamadasPage />
    </>
  );
}

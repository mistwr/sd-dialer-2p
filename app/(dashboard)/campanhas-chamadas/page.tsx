import { CampanhasChamadasPage } from "@/components/campanhas/CampanhasChamadasPage";
import { AUTO_DIALER_MANUTENCAO, MSG_MANUTENCAO } from "@/lib/server/call-campaigns";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      {AUTO_DIALER_MANUTENCAO && (
        <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", color: "#92400E", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontWeight: 600 }}>
          🛠️ {MSG_MANUTENCAO}
        </div>
      )}
      <CampanhasChamadasPage />
    </>
  );
}

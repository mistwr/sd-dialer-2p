import { redirect } from "next/navigation";
import { MarcadorPage } from "@/components/marcador/MarcadorPage";
import { BannerManutencao } from "@/components/common/BannerManutencao";
import { createClient } from "@/lib/supabase/server";
import { podeMarcador } from "@/lib/marcador-acesso";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!podeMarcador(user?.id)) redirect("/parceiro");
  return (
    <>
      <BannerManutencao />
      <MarcadorPage />
    </>
  );
}

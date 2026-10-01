"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { BookOpen, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { formacaoService } from "@/lib/services";
import { Modal } from "@/components/ui/Modal";
import { PageSpinner } from "@/components/ui/Spinner";
import type { CompanyTrainingMaterial } from "@/lib/types";

type Draft = {
  title: string;
  description: string;
  operator: string;
  category: string;
  content: string;
  url: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  operator: "Geral",
  category: "Geral",
  content: "",
  url: "",
  sort_order: 0,
  is_active: true,
};

const OPERADORAS = ["Geral", "MEO", "NOS", "Vodafone", "DIGI", "Endesa", "EDP", "Iberdrola", "Repsol"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #E2E8F0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

function FormacaoForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: CompanyTrainingMaterial;
  onSave: (data: Partial<CompanyTrainingMaterial>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Draft>({
    ...EMPTY,
    ...(initial
      ? {
          title: initial.title,
          description: initial.description ?? "",
          operator: initial.operator,
          category: initial.category,
          content: initial.content ?? "",
          url: initial.url ?? "",
          sort_order: initial.sort_order,
          is_active: initial.is_active,
        }
      : {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
          await onSave({
            title: form.title.trim(),
            description: form.description.trim() || null,
            operator: form.operator.trim() || "Geral",
            category: form.category.trim() || "Geral",
            content: form.content.trim() || null,
            url: form.url.trim() || null,
            sort_order: Number(form.sort_order) || 0,
            is_active: form.is_active,
          });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível guardar a formação.");
        } finally {
          setSaving(false);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {error && (
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#FEE2E2", color: "#991B1B", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Título *</label>
        <input required value={form.title} onChange={(e) => set("title", e.target.value)} style={inputStyle} placeholder="Ex.: Guião de abordagem porta a porta" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Operadora</label>
          <input list="operadoras-formacao" value={form.operator} onChange={(e) => set("operator", e.target.value)} style={inputStyle} placeholder="Geral, MEO, NOS, Vodafone..." />
          <datalist id="operadoras-formacao">
            {OPERADORAS.map((operadora) => <option key={operadora} value={operadora} />)}
          </datalist>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Categoria</label>
          <input value={form.category} onChange={(e) => set("category", e.target.value)} style={inputStyle} placeholder="Ex.: Vendas, Produto, Objeções" />
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Descrição</label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Resumo curto do material." />
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Conteúdo / guia</label>
        <textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={7} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="Cole aqui o guião, passos, argumentos, notas de formação..." />
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Link opcional</label>
        <input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} style={inputStyle} placeholder="https://... (vídeo, PDF, Drive, página interna, etc.)" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5, color: "#374151" }}>Ordem</label>
          <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} style={{ ...inputStyle, width: 90 }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Visível para a equipa
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} style={{ padding: "9px 20px", borderRadius: 10, border: 0, background: "#2563EB", color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1 }}>
          {saving ? "A guardar..." : "Guardar formação"}
        </button>
      </div>
    </form>
  );
}

export function FormacaoPage() {
  const { profile, loading: authLoading } = useAuth();
  const companyId = profile?.company_id ?? null;
  const isAdmin = profile?.role === "admin";

  const { data: materiais = [], isLoading, mutate } = useSWR(
    companyId ? ["company-training", companyId, isAdmin] : null,
    () => formacaoService.getByCompany(companyId!, isAdmin)
  );

  const [operadora, setOperadora] = useState("Todas");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing?: CompanyTrainingMaterial }>({ open: false });
  const [pageError, setPageError] = useState("");

  const operadoras = useMemo(
    () => ["Todas", ...Array.from(new Set(materiais.map((m) => m.operator || "Geral"))).sort()],
    [materiais]
  );

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return materiais.filter((material) => {
      const byOperator = operadora === "Todas" || material.operator === operadora;
      const byText =
        !term ||
        [material.title, material.description, material.category, material.operator, material.content]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return byOperator && byText;
    });
  }, [materiais, operadora, search]);

  const handleSave = async (data: Partial<CompanyTrainingMaterial>) => {
    if (!companyId) throw new Error("Empresa não associada ao utilizador.");
    if (modal.editing) {
      await formacaoService.update(modal.editing.id, data);
    } else {
      await formacaoService.create({ ...data, company_id: companyId });
    }
    await mutate();
  };

  const handleDelete = async (material: CompanyTrainingMaterial) => {
    if (!confirm(`Eliminar a formação "${material.title}"?`)) return;
    setPageError("");
    try {
      await formacaoService.delete(material.id);
      await mutate();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Não foi possível eliminar.");
    }
  };

  if (authLoading) return <PageSpinner />;

  if (!companyId) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
        <div style={{ padding: 24, borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0", color: "#64748B" }}>
          Este utilizador ainda não está associado a uma empresa.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A" }}>Formação</h1>
          <p style={{ margin: "5px 0 0", fontSize: 14, color: "#64748B" }}>
            Conteúdos definidos pela sua empresa. Pode separar por operadora e categoria.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal({ open: true })}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: 0, background: "#2563EB", color: "#fff", fontWeight: 800, cursor: "pointer" }}
          >
            <Plus size={16} /> Adicionar formação
          </button>
        )}
      </div>

      {pageError && (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#FEE2E2", color: "#991B1B", fontSize: 13 }}>
          {pageError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar formação..."
            style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {operadoras.map((item) => (
            <button
              key={item}
              onClick={() => setOperadora(item)}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                border: operadora === item ? "1px solid #2563EB" : "1px solid #E2E8F0",
                background: operadora === item ? "#EFF6FF" : "#fff",
                color: operadora === item ? "#1D4ED8" : "#64748B",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : filtrados.length === 0 ? (
        <div style={{ padding: "40px 22px", borderRadius: 16, background: "#fff", border: "1px dashed #CBD5E1", textAlign: "center" }}>
          <BookOpen size={34} style={{ margin: "0 auto 10px", color: "#94A3B8" }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#334155" }}>
            {materiais.length === 0 ? "Ainda não existe formação publicada" : "Nenhum conteúdo encontrado"}
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: "#94A3B8" }}>
            {isAdmin && materiais.length === 0 ? "Adicione o primeiro conteúdo para a sua equipa." : "Experimente outro filtro ou pesquisa."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filtrados.map((material) => (
            <article
              key={material.id}
              style={{
                padding: 18,
                borderRadius: 16,
                background: "#fff",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                opacity: material.is_active ? 1 : 0.62,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#EFF6FF", color: "#1D4ED8", fontSize: 11, fontWeight: 800 }}>
                      {material.operator}
                    </span>
                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#F1F5F9", color: "#475569", fontSize: 11, fontWeight: 700 }}>
                      {material.category}
                    </span>
                    {!material.is_active && (
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 800 }}>
                        Oculta
                      </span>
                    )}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>{material.title}</h2>
                  {material.description && (
                    <p style={{ margin: "7px 0 0", fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>{material.description}</p>
                  )}
                </div>

                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setModal({ open: true, editing: material })} title="Editar" style={{ display: "flex", padding: 7, borderRadius: 8, border: 0, background: "#F1F5F9", color: "#475569", cursor: "pointer" }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(material)} title="Eliminar" style={{ display: "flex", padding: 7, borderRadius: 8, border: 0, background: "#FEE2E2", color: "#DC2626", cursor: "pointer" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {material.content && (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "#F8FAFC", color: "#334155", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {material.content}
                </div>
              )}

              {material.url && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, color: "#2563EB", fontSize: 13, fontWeight: 800, textDecoration: "none" }}
                >
                  Abrir material <ExternalLink size={14} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}

      {isAdmin && (
        <Modal
          open={modal.open}
          onClose={() => setModal({ open: false })}
          title={modal.editing ? "Editar formação" : "Nova formação"}
        >
          <FormacaoForm
            key={modal.editing?.id ?? "new"}
            initial={modal.editing}
            onSave={handleSave}
            onClose={() => setModal({ open: false })}
          />
        </Modal>
      )}
    </div>
  );
}

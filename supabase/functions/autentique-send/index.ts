// Sends a prepared contract to Autentique for real e-signature. Auth is
// enforced by forwarding the caller's own JWT into a Supabase client that
// respects RLS (contracts is staff-only) — no service-role key needed.
// AUTENTIQUE_API_TOKEN is a secret set via `supabase secrets set` / the
// dashboard, never exposed to the browser.
//
// Nay's review (Oct 2026): Nay is the one who edits the contract text. The
// assistant can send only after Nay marked it reviewed
// (contracts.admin_reviewed_at — set only by admin, cleared automatically
// when anyone else changes the text; see migration contract_admin_review).
// Nay herself can always send.
//
// Real E2E test found and confirmed these problems here, all fixed:
//  1. Duplicate-send risk: refuses up front if a document already exists.
//  2. Autentique's GraphQL error shape puts the per-field detail in
//     errors[0].extensions.validation — extracted into the message.
//  3. Autentique's signer-email validator rejects a '+' in the local part —
//     caught up front with a specific message.
//  4. Autentique only lists the API token's own account (Nay) as a
//     non-signing participant — Nay is added as a real second signer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

function describeAutentiqueError(firstError: any): string {
  const validation = firstError?.extensions?.validation;
  if (validation && typeof validation === "object") {
    const details = Object.entries(validation)
      .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(" ") : messages}`)
      .join(" | ");
    if (details) return `Autentique recusou os dados enviados — ${details}`;
  }
  return firstError?.message || "erro na Autentique";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function hasAutentiqueIncompatiblePlus(email: string): boolean {
  return email.split("@")[0]?.includes("+") ?? false;
}

async function bodyTextToPdf(bodyText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const pageWidth = 595.28, pageHeight = 841.89, margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 11, lineHeight = fontSize * 1.4;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPageIfNeeded(needed: number) {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function sanitizeForWinAnsi(text: string): string {
    return text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x00-\xFF]/g, "?");
  }

  function wrapText(text: string, useFont: any, size: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (useFont.widthOfTextAtSize(test, size) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawParagraph(text: string, opts: { bold?: boolean; center?: boolean; size?: number } = {}) {
    const { bold = false, center = false, size = fontSize } = opts;
    const useFont = bold ? boldFont : font;
    const safeText = sanitizeForWinAnsi(text);
    for (const line of wrapText(safeText, useFont, size)) {
      newPageIfNeeded(lineHeight);
      const width = useFont.widthOfTextAtSize(line, size);
      const x = center ? (pageWidth - width) / 2 : margin;
      page.drawText(line, { x, y, size, font: useFont, color: rgb(0.07, 0.07, 0.07) });
      y -= lineHeight;
    }
    y -= lineHeight * 0.4;
  }

  const blocks = bodyText.split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed === "MENTORIA PERSEA") {
      drawParagraph(trimmed, { bold: true, center: true, size: 14 });
    } else if (/^CLÁUSULA\b/i.test(trimmed) || trimmed === "DAS PARTES" || trimmed === "TESTEMUNHAS:") {
      drawParagraph(trimmed, { bold: true });
    } else if (/_{3,}/.test(trimmed)) {
      for (const line of trimmed.split("\n")) drawParagraph(line);
    } else {
      drawParagraph(trimmed.replace(/\n/g, " "));
    }
  }

  return pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { contract_id } = await req.json();
    if (!contract_id) return json({ error: "contract_id required" }, 400);

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*, clients(full_name, email)")
      .eq("id", contract_id)
      .maybeSingle();
    if (cErr || !contract) return json({ error: cErr?.message || "contrato não encontrado (verifique permissões)" }, 404);
    if (!contract.body_text) return json({ error: "contrato ainda não foi gerado — gere o texto do contrato antes de enviar" }, 400);

    // The assistant sends only what Nay already reviewed; Nay can always send.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: caller } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
    if (caller?.role !== "admin" && !contract.admin_reviewed_at) {
      return json({ error: "A Nay ainda não revisou este contrato. O envio para assinatura libera assim que ela marcar \"Contrato revisado\"." }, 403);
    }

    if (contract.autentique_document_id) {
      return json({ error: "este contrato já foi enviado para a Autentique — use 'Verificar Assinatura' em vez de enviar novamente" }, 409);
    }

    const client = (contract as any).clients;
    if (!client?.email) return json({ error: "cliente sem e-mail cadastrado" }, 400);
    const signerEmail = client.email.trim();
    if (!isValidEmail(signerEmail)) return json({ error: "e-mail da cliente em formato inválido — corrija o cadastro antes de enviar" }, 400);
    if (hasAutentiqueIncompatiblePlus(signerEmail)) {
      return json({ error: "a Autentique não aceita o caractere '+' no e-mail da signatária (ex.: nome+algo@dominio.com) — corrija o e-mail cadastrado da cliente antes de enviar" }, 400);
    }

    const AUTENTIQUE_TOKEN = Deno.env.get("AUTENTIQUE_API_TOKEN");
    if (!AUTENTIQUE_TOKEN) return json({ error: "AUTENTIQUE_API_TOKEN não configurado" }, 500);

    const adminSignerEmail = (Deno.env.get("AUTENTIQUE_ADMIN_SIGNER_EMAIL") || "naymurta@gmail.com").trim();
    const signers = [{ email: signerEmail, action: "SIGN" }];
    if (adminSignerEmail.toLowerCase() !== signerEmail.toLowerCase()) {
      signers.push({ email: adminSignerEmail, action: "SIGN" });
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await bodyTextToPdf(contract.body_text);
    } catch (e) {
      console.log("PDF generation failed:", String(e));
      return json({ error: "não foi possível gerar o PDF do contrato — verifique o texto por caracteres incomuns" }, 500);
    }
    if (!pdfBytes || pdfBytes.length < 100) {
      return json({ error: "o PDF gerado ficou vazio ou inválido — não enviado" }, 500);
    }

    const query = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) { id name }
    }`;
    const variables = {
      document: { name: `Contrato - ${client.full_name}` },
      signers,
      file: null,
    };
    const form = new FormData();
    form.append("operations", JSON.stringify({ query, variables }));
    form.append("map", JSON.stringify({ file: ["variables.file"] }));
    form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "contrato.pdf");

    let autRes: Response;
    try {
      autRes = await fetch("https://api.autentique.com.br/v2/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` },
        body: form,
      });
    } catch (e) {
      console.log("Autentique network error:", String(e));
      return json({ error: "não foi possível conectar à Autentique agora — tente novamente em instantes" }, 502);
    }

    if (autRes.status === 401 || autRes.status === 403) {
      console.log("Autentique auth error, status:", autRes.status);
      return json({ error: "a Autentique recusou a autenticação — verifique o token configurado (AUTENTIQUE_API_TOKEN)" }, 502);
    }

    const autJson = await autRes.json().catch(() => null);
    if (!autJson) {
      console.log("Autentique returned non-JSON response, status:", autRes.status);
      return json({ error: "a Autentique retornou uma resposta inesperada" }, 502);
    }
    if (autJson.errors) {
      console.log("Autentique createDocument errors:", JSON.stringify(autJson.errors));
      return json({ error: describeAutentiqueError(autJson.errors[0]), raw: autJson.errors }, 502);
    }
    if (!autJson.data?.createDocument?.id) {
      console.log("Autentique response missing createDocument.id:", JSON.stringify(autJson));
      return json({ error: "a Autentique não retornou um documento válido" }, 502);
    }

    const docId = autJson.data.createDocument.id;
    const { error: updErr } = await supabase.from("contracts").update({
      autentique_document_id: docId, status: "sent_for_signature", sent_for_signature_at: new Date().toISOString(),
    }).eq("id", contract_id);
    if (updErr) {
      console.log("Autentique document created but DB update failed. autentique_document_id:", docId, "error:", updErr.message);
      return json({
        error: `o documento foi criado na Autentique (id ${docId}) mas não foi possível salvar isso no PERSEA — não tente enviar novamente; peça para o suporte reconciliar manualmente`,
      }, 500);
    }

    return json({ ok: true, autentique_document_id: docId });
  } catch (e) {
    console.log("autentique-send unexpected error:", String(e));
    return json({ error: String(e) }, 500);
  }
});

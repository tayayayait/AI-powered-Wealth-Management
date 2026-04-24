import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, Check, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { computeValuation } from "@/lib/valuation";
import { parseIntentWithGemini } from "@/lib/gemini-parser";
import { getOrCreatePortfolio } from "@/lib/portfolio";
import { ensureAndSync } from "@/lib/stock-api";
import { mergeAssetPosition } from "@/lib/portfolio-assets";
import type { ParsedIntent, ParsedItem } from "@/lib/intent-parser";
import { CHATBOT_OPEN_EVENT, type ChatbotOpenEventDetail } from "@/lib/chatbot-launcher";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type _Used = ParsedItem; void (null as unknown as _Used);

interface ChatMsg {
  role: "user" | "assistant" | "system";
  text: string;
  intent?: ParsedIntent;
  intentId?: string;
  status?: "pending" | "confirmed" | "cancelled" | "failed";
  missingPrompt?: MissingFieldPrompt;
}

type RequiredAssetField = "ticker" | "quantity" | "avg_price";

interface MissingFieldPrompt {
  fields: RequiredAssetField[];
  sourceText: string;
  submitted?: boolean;
}

const REQUIRED_ASSET_FIELD_LABELS: Record<RequiredAssetField, string> = {
  ticker: "종목명",
  quantity: "보유 수량",
  avg_price: "평균단가",
};

const REQUIRED_ASSET_FIELD_PLACEHOLDERS: Record<RequiredAssetField, string> = {
  ticker: "예: AAPL 또는 애플",
  quantity: "예: 10",
  avg_price: "예: 180",
};

const ADD_ASSET_KEYWORDS = /(추가|매수|매입|buy|add)/i;
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s*주/i;
const PRICE_PATTERN = /(\d+(?:\.\d+)?)\s*(달러|원|usd|krw|원에서)/i;
const ALT_PRICE_PATTERN = /평단\s*(\d+(?:\.\d+)?)/i;
const AT_PRICE_PATTERN = /@\s*(\d+(?:\.\d+)?)/;

function formatMissingFieldLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]}과 ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, ${labels.at(-1)}`;
}

function getMissingAddAssetFields(rawText: string, intent: ParsedIntent): RequiredAssetField[] {
  const hasTicker = intent.items.some((item) => item.ticker?.trim().length > 0);
  const hasQuantityFromIntent = intent.items.some(
    (item) => typeof item.quantity === "number" && item.quantity > 0,
  );
  const hasAvgPriceFromIntent = intent.items.some((item) => typeof item.avg_price === "number");

  const hasQuantity = hasQuantityFromIntent || QUANTITY_PATTERN.test(rawText);
  const hasAvgPrice =
    hasAvgPriceFromIntent ||
    PRICE_PATTERN.test(rawText) ||
    ALT_PRICE_PATTERN.test(rawText) ||
    AT_PRICE_PATTERN.test(rawText);

  const missing: RequiredAssetField[] = [];
  if (!hasTicker) missing.push("ticker");
  if (!hasQuantity) missing.push("quantity");
  if (!hasAvgPrice) missing.push("avg_price");
  return missing;
}

export function ChatbotPanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "안녕하세요! 자산 관리를 도와드리겠습니다.\n보유 자산을 자연어로 입력하세요." },
  ]);
  const [missingFieldInputs, setMissingFieldInputs] = useState<
    Record<number, Partial<Record<RequiredAssetField, string>>>
  >({});
  const { user } = useAuth();
  const qc = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ChatbotOpenEventDetail>).detail;
      setOpen(true);
      if (detail?.prefill) {
        setText(detail.prefill);
      }
    };

    window.addEventListener(CHATBOT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHATBOT_OPEN_EVENT, onOpen);
  }, []);

  const updateMissingFieldInput = (idx: number, field: RequiredAssetField, value: string) => {
    setMissingFieldInputs((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [field]: value,
      },
    }));
  };

  const sendMessage = async (rawText: string) => {
    if (!rawText.trim() || !user) return;
    const userText = rawText.trim();

    setMessages((m) => [...m, { role: "user", text: userText }]);
    setBusy(true);

    try {
      // Use Gemini parser (falls back to local regex)
      const intent = await parseIntentWithGemini(userText);

      const needsAddAssetValidation =
        intent.intent_type === "ADD_ASSET" ||
        (intent.intent_type === "UNKNOWN" && ADD_ASSET_KEYWORDS.test(userText));

      if (needsAddAssetValidation) {
        const missingFields = getMissingAddAssetFields(userText, intent);
        if (missingFields.length > 0) {
          const labels = missingFields.map((field) => REQUIRED_ASSET_FIELD_LABELS[field]);
          const formatted = formatMissingFieldLabels(labels);
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              text: `다음 항목을 입력해주세요: ${formatted}`,
              missingPrompt: {
                fields: missingFields,
                sourceText: userText,
              },
            },
          ]);
          return;
        }
      }

      // store intent in chat_intents table
      const { data: row } = await supabase
        .from("chat_intents")
        .insert({
          user_id: user.id,
          raw_text: userText,
          intent_type: intent.intent_type,
          parsed_payload: intent as never,
          confidence: intent.confidence,
          status: "pending",
        })
        .select()
        .single();

      const needsConfirm =
        intent.intent_type !== "QUERY_PORTFOLIO" && intent.intent_type !== "UNKNOWN";
      let assistantText = intent.summary ?? "분석 결과입니다.";

      if (intent.intent_type === "UNKNOWN") {
        assistantText = '의도를 파악하지 못했습니다. 예: "애플 5주 180달러로 추가"';
      } else if (intent.intent_type === "QUERY_PORTFOLIO") {
        const { data: assets } = await supabase
          .from("portfolio_assets")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active");
        if (intent.items.length > 0) {
          const target = intent.items[0];
          const found = assets?.find(
            (a) => a.ticker.toUpperCase() === target.ticker.toUpperCase(),
          );
          assistantText = found
            ? `${found.name} (${found.ticker}) 보유: ${Number(found.quantity)}주 평단가 ${Number(found.avg_price)}`
            : `${target.ticker} 종목은 보유하고 있지 않습니다.`;
        } else {
          assistantText = `총 ${assets?.length ?? 0}개 종목을 보유 중입니다.`;
        }
      } else if (needsConfirm) {
        // Check for duplicate assets (ADD_ASSET only)
        if (intent.intent_type === "ADD_ASSET" && intent.items.length > 0) {
          const { data: existingAssets } = await supabase
            .from("portfolio_assets")
            .select("ticker, market")
            .eq("user_id", user.id)
            .eq("status", "active");
          const dupes = intent.items.filter((item) =>
            existingAssets?.some(
              (a) => a.market === item.market && a.ticker.toUpperCase() === item.ticker.toUpperCase(),
            ),
          );
          if (dupes.length > 0) {
            assistantText = `주의: ${dupes.map((d) => d.ticker).join(", ")}은(는) 이미 보유 중입니다. 확인하면 기존 행에 수량을 합산하고 평균단가를 가중평균으로 갱신합니다.`;
          }
        }
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: assistantText,
          intent: needsConfirm ? intent : undefined,
          intentId: row?.id,
          status: needsConfirm ? "pending" : undefined,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "system", text: "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요." },
      ]);
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!text.trim() || !user || busy) return;
    const userText = text.trim();
    setText("");
    await sendMessage(userText);
  };

  const submitMissingPrompt = async (idx: number) => {
    if (busy || !user) return;
    const msg = messages[idx];
    if (!msg?.missingPrompt || msg.missingPrompt.submitted) return;

    const values = missingFieldInputs[idx] ?? {};
    const parts: string[] = [];

    for (const field of msg.missingPrompt.fields) {
      const rawValue = values[field]?.trim() ?? "";
      if (!rawValue) {
        toast.error(`${REQUIRED_ASSET_FIELD_LABELS[field]}을 입력해주세요.`);
        return;
      }

      if (field === "ticker") {
        parts.push(rawValue);
        continue;
      }

      const numeric = Number(rawValue.replace(/,/g, ""));
      if (!Number.isFinite(numeric)) {
        toast.error(`${REQUIRED_ASSET_FIELD_LABELS[field]}은 숫자로 입력해주세요.`);
        return;
      }

      if (field === "quantity" && numeric <= 0) {
        toast.error("보유 수량은 0보다 커야 합니다.");
        return;
      }

      if (field === "avg_price" && numeric < 0) {
        toast.error("평균단가는 0 이상이어야 합니다.");
        return;
      }

      parts.push(field === "quantity" ? `${numeric}주` : `평단 ${numeric}`);
    }

    const completedText = `${msg.missingPrompt.sourceText} ${parts.join(" ")}`.trim();

    setMessages((prev) =>
      prev.map((item, i) => {
        if (i !== idx || !item.missingPrompt) return item;
        return {
          ...item,
          missingPrompt: {
            ...item.missingPrompt,
            submitted: true,
          },
        };
      }),
    );

    setMissingFieldInputs((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });

    await sendMessage(completedText);
  };

  const confirm = async (idx: number) => {
    const msg = messages[idx];
    if (!msg.intent || !msg.intentId || !user) return;
    const intent = msg.intent;

    // REMOVE_ASSET requires confirmation dialog
    if (intent.intent_type === "REMOVE_ASSET") {
      setDeleteConfirmIdx(idx);
      return;
    }

    await executeConfirm(idx);
  };

  const executeConfirm = async (idx: number) => {
    const msg = messages[idx];
    if (!msg.intent || !msg.intentId || !user) return;
    const intent = msg.intent;

    if (intent.confidence < 0.85) {
      toast.warning("신뢰도가 낮아 자동 확정이 불가합니다. 자산 페이지에서 직접 입력해주세요.");
      return;
    }

    try {
      const portfolio = await getOrCreatePortfolio(user.id);
      const failedTickers: string[] = [];
      let appliedCount = 0;

      for (const item of intent.items) {
        const ticker = item.ticker.toUpperCase();

        if (!item.quantity && intent.intent_type !== "REMOVE_ASSET") {
          failedTickers.push(ticker);
          toast.error(`${ticker}: 수량 정보가 누락됐습니다.`);
          continue;
        }

        // Yahoo Finance price sync: refresh snapshot before DB write
        await ensureAndSync(ticker, item.market, item.name);
        const { data: priceRow } = await supabase
          .from("price_snapshots")
          .select("*")
          .eq("ticker", ticker)
            .eq("market", item.market)
          .maybeSingle();

        if (intent.intent_type === "ADD_ASSET") {
          if (!priceRow && item.avg_price == null) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 시세 정보가 없어 평균단가가 필요합니다.`);
            continue;
          }

          const insertPayload = priceRow
            ? {
                portfolio_id: portfolio.id,
                user_id: user.id,
                ticker: priceRow.ticker,
                market: priceRow.market,
                name: priceRow.name,
                quantity: item.quantity ?? 1,
                avg_price: item.avg_price ?? Number(priceRow.current_price),
                currency: priceRow.currency,
              }
            : {
                portfolio_id: portfolio.id,
                user_id: user.id,
                ticker,
                market: item.market,
                name: item.name ?? ticker,
                quantity: item.quantity ?? 1,
                avg_price: Number(item.avg_price),
                currency: item.market === "KR" ? "KRW" : "USD",
              };

          const { data: existingAssets } = await supabase
            .from("portfolio_assets")
            .select("*")
            .eq("portfolio_id", portfolio.id)
            .ilike("ticker", insertPayload.ticker)
            .eq("market", insertPayload.market)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1);

          const existingAsset = existingAssets?.[0];
          const { data: savedAsset, error: saveError } = existingAsset
            ? await supabase
                .from("portfolio_assets")
                .update({
                  ...mergeAssetPosition(existingAsset, insertPayload),
                  ticker: insertPayload.ticker,
                  name: insertPayload.name,
                  currency: insertPayload.currency,
                })
                .eq("id", existingAsset.id)
                .select()
                .single()
            : await supabase
                .from("portfolio_assets")
                .insert(insertPayload)
                .select()
                .single();

          if (saveError || !savedAsset) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 자산 저장에 실패했습니다.`);
            continue;
          }

          const valuationCurrentPrice = priceRow
            ? Number(priceRow.current_price)
            : Number(item.avg_price);
          const v = computeValuation({
            currentPrice: valuationCurrentPrice,
            eps: priceRow?.eps != null ? Number(priceRow.eps) : null,
            per: priceRow?.per != null ? Number(priceRow.per) : null,
            industryPer: priceRow?.industry_per != null ? Number(priceRow.industry_per) : null,
          });

          await supabase.from("valuation_results").insert({
            asset_id: savedAsset.id,
            user_id: user.id,
            rule_version: "v1",
            fair_value: v.fairValue,
            current_price: valuationCurrentPrice,
            gap_percent: v.gapPercent,
            score: v.score,
            band: v.band,
            reason_codes: v.reasonCodes,
          });

          appliedCount += 1;
          continue;
        }

        if (intent.intent_type === "UPDATE_ASSET") {
          const { data: existing } = await supabase
            .from("portfolio_assets")
            .select("*")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 보유 자산을 찾을 수 없습니다.`);
            continue;
          }

          const { error: updateError } = await supabase
            .from("portfolio_assets")
            .update({
              quantity: item.quantity ?? existing.quantity,
              avg_price: item.avg_price ?? existing.avg_price,
            })
            .eq("id", existing.id);

          if (updateError) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 수정에 실패했습니다.`);
            continue;
          }

          appliedCount += 1;
          continue;
        }

        if (intent.intent_type === "REMOVE_ASSET") {
          const { data: existing } = await supabase
            .from("portfolio_assets")
            .select("id")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 삭제할 보유 자산이 없습니다.`);
            continue;
          }

          const { error: removeError } = await supabase
            .from("portfolio_assets")
            .update({ status: "archived" })
            .eq("id", existing.id);

          if (removeError) {
            failedTickers.push(ticker);
            toast.error(`${ticker}: 삭제에 실패했습니다.`);
            continue;
          }

          appliedCount += 1;
        }
      }

      const finalStatus = appliedCount > 0 ? "confirmed" : "failed";
      const resultSummary =
        appliedCount > 0
          ? failedTickers.length > 0
            ? `부분 적용 (${appliedCount}건, 실패: ${failedTickers.join(", ")})`
            : "처리 완료"
          : "유효한 처리 항목이 없습니다";

      await supabase
        .from("chat_intents")
        .update({ status: finalStatus, result_summary: resultSummary })
        .eq("id", msg.intentId);

      setMessages((m) => m.map((x, i) => (i === idx ? { ...x, status: finalStatus } : x)));
      qc.invalidateQueries();

      if (appliedCount === 0) {
        toast.error("저장된 자산이 없습니다. 종목과 평균단가를 확인해주세요.");
      } else if (failedTickers.length > 0) {
        toast.warning(`부분 적용: ${failedTickers.join(", ")}`);
      } else {
        toast.success("처리되었습니다. 시세가 곧 갱신됩니다.");
      }
    } catch (err) {
      toast.error("처리 실패");
      console.error(err);
    }
  };

  const cancel = async (idx: number) => {
    const msg = messages[idx];
    if (msg.intentId) await supabase.from("chat_intents").update({ status: "cancelled" }).eq("id", msg.intentId);
    setMessages((m) => m.map((x, i) => i === idx ? { ...x, status: "cancelled" } : x));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-16 w-16 md:h-16 md:w-16 rounded-full bg-navy text-primary-foreground flex items-center justify-center hover:bg-navy-soft transition-colors z-50"
        style={{ boxShadow: "var(--shadow-floating)" }}
        aria-label="AI 챗봇 열기"
      >
        <MessageSquare className="h-6 w-6" />
        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-gold" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 w-[420px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[calc(100vh-3rem)] surface-card shadow-2xl flex flex-col z-50 rounded-2xl overflow-hidden">
        {/* Header: 64px */}
        <div className="h-16 px-4 border-b flex items-center justify-between bg-navy text-primary-foreground">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-gold" />
            AI 자산 어시스턴트
            <span className="ml-2 h-2 w-2 rounded-full bg-green-400 animate-pulse" title="연결됨" />
          </div>
          <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100" aria-label="닫기"><X className="h-4 w-4" /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-navy text-primary-foreground" :
                m.role === "system" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                "bg-secondary"
              }`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.missingPrompt && !m.missingPrompt.submitted && (
                  <div className="mt-2 p-3 bg-card border rounded-lg text-xs text-foreground space-y-2">
                    {m.missingPrompt.fields.map((field) => (
                      <div key={field} className="space-y-1">
                        <div className="text-muted-foreground">{REQUIRED_ASSET_FIELD_LABELS[field]}</div>
                        <Input
                          type={field === "ticker" ? "text" : "number"}
                          inputMode={field === "ticker" ? "text" : "decimal"}
                          step={field === "ticker" ? undefined : "any"}
                          value={missingFieldInputs[i]?.[field] ?? ""}
                          onChange={(e) => updateMissingFieldInput(i, field, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !busy) {
                              e.preventDefault();
                              void submitMissingPrompt(i);
                            }
                          }}
                          placeholder={REQUIRED_ASSET_FIELD_PLACEHOLDERS[field]}
                          disabled={busy}
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={() => void submitMissingPrompt(i)}
                      disabled={busy}
                    >
                      입력 반영
                    </Button>
                  </div>
                )}
                {m.missingPrompt?.submitted && (
                  <div className="mt-1 text-xs text-muted-foreground">보완 입력 반영 완료</div>
                )}
                {m.intent && m.status === "pending" && (
                  <div className="mt-2 p-3 bg-card border rounded-lg text-xs text-foreground">
                    <div className="font-medium mb-1.5">등록 내용을 확인해주세요</div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-muted-foreground">의도:</span> {m.intent.intent_type}
                      <span className="text-muted-foreground ml-2">신뢰도:</span> {(m.intent.confidence * 100).toFixed(0)}%
                      {m.intent.confidence < 0.85 && <AlertTriangle className="h-3 w-3 text-warning" />}
                    </div>
                    {m.intent.items.map((it, idx) => (
                      <div key={idx} className="num text-muted-foreground border-t pt-1 mt-1">
                        <div>종목명/티커: <span className="text-foreground font-medium">{it.name ?? it.ticker}</span></div>
                        {it.quantity != null && <div>수량: <span className="text-foreground">{it.quantity}주</span></div>}
                        {it.avg_price != null && <div>평균단가: <span className="text-foreground">{it.avg_price}</span></div>}
                        <div>시장: <span className="text-foreground">{it.market}</span></div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="h-7" onClick={() => confirm(i)}>
                        <Check className="h-3 w-3" /> 확인 후 적용
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => cancel(i)}>
                        <XCircle className="h-3 w-3" /> 취소
                      </Button>
                    </div>
                  </div>
                )}
                {m.status === "confirmed" && <div className="mt-1 text-xs text-success font-medium">적용 완료</div>}
                {m.status === "cancelled" && <div className="mt-1 text-xs text-muted-foreground">취소됨</div>}
                {m.status === "failed" && <div className="mt-1 text-xs text-destructive font-medium">적용 실패</div>}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground animate-pulse">AI 분석 중...</div></div>}
          <div ref={chatEndRef} />
        </div>

        {/* Quick prompts + Input */}
        <div className="border-t">
          {messages.length <= 2 && (
            <div className="px-3 pt-2 flex gap-2">
              {["애플 주식 10주 보유", "테슬라 3주 추가 매수"].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setText(prompt); }}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <div className="p-3 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) send(); }}
              placeholder="자연어로 입력하세요..."
              disabled={busy}
            />
            <Button size="sm" onClick={send} disabled={busy || !text.trim()} aria-label="전송">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmIdx !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>자산 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              해당 자산이 포트폴리오에서 제거됩니다. 정말 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmIdx !== null) { executeConfirm(deleteConfirmIdx); setDeleteConfirmIdx(null); } }} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




"use client";

import { useEffect, useState } from "react";
import SellerPrivateFields, { EMPTY_SELLER_PRIVATE, type LinkedCheck, type SellerPrivateDraft, type SellerPrivateErrors } from "@/components/admin/SellerPrivateFields";
import { formatPhone } from "@/lib/phone";

// 2026-10-04 feat/deal-seller-private — 매물 수정 카드의 "실제 판매자(내부 전용)" 편집. 기존 실매물 채우기용.
// /api/admin/deals/manage/seller: GET으로 불러와 채우고(신청 매물이면 비었을 때 신청 정보를 참고용으로 미리 채움 — 저장해야 DB에 들어감),
// [판매자 정보 저장]은 매물 내용 저장("변경사항 저장")과 별개 — 알림을 다시 보내지 않음.
// 이미 사업자 조회가 붙은 매물은 표시만, 안 붙은 매물은 통과한 직접 조회 기록을 골라 연결할 수 있음.

type LoadedState = { draft: SellerPrivateDraft; linkedCheck: LinkedCheck | null; fromSellerRequest: boolean; prefilled: boolean };

export default function DealSellerPrivateEditor({
  adminKey,
  dealId,
  onToast,
  onGoBizCheck,
}: {
  adminKey: string;
  dealId: string;
  onToast: (message: string) => void;
  onGoBizCheck: () => void;
}) {
  const [state, setState] = useState<LoadedState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<SellerPrivateDraft>(EMPTY_SELLER_PRIVATE);
  const [errors, setErrors] = useState<SellerPrivateErrors>({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/deals/manage/seller?dealId=${encodeURIComponent(dealId)}`, { headers: { "x-admin-key": adminKey } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("load");
        if (cancelled) return;
        const src = data.item ?? data.suggest ?? null;
        const next: SellerPrivateDraft = {
          company: src?.company_name ?? "",
          name: src?.contact_name ?? "",
          phone: src?.contact_phone ? formatPhone(src.contact_phone) : "",
          checkId: "",
        };
        setDraft(next);
        setState({ draft: next, linkedCheck: data.linkedCheck ?? null, fromSellerRequest: !!data.fromSellerRequest, prefilled: !data.item && !!data.suggest });
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminKey, dealId, reloadKey]);

  const save = async () => {
    setErrors({});
    const next: SellerPrivateErrors = {};
    if (!draft.company.trim()) next.company = "실제 판매자 상호를 입력해주세요.";
    if (!draft.phone.trim()) next.phone = "실제 판매자 연락처를 입력해주세요.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/deals/manage/seller", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          dealId,
          sellerPrivateCompany: draft.company,
          sellerPrivateName: draft.name,
          sellerPrivatePhone: draft.phone,
          businessCheckId: draft.checkId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const field = data.field as string | undefined;
        const map: Record<string, keyof SellerPrivateDraft> = { sellerPrivateCompany: "company", sellerPrivatePhone: "phone", sellerPrivateName: "name", businessCheckId: "checkId" };
        if (field && map[field]) setErrors({ [map[field]]: data.error ?? "값을 확인해주세요." });
        onToast(data.error ?? "저장하지 못했어요. 다시 시도해주세요");
        if (data.saved) setReloadKey((k) => k + 1); // 판매자 정보는 저장됨 — 연결 상태를 다시 읽기
        return;
      }
      onToast("판매자 정보를 저장했어요");
      setReloadKey((k) => k + 1);
    } catch {
      onToast("저장하지 못했어요. 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  };

  const dirty = !!state && (draft.company !== state.draft.company || draft.name !== state.draft.name || draft.phone !== state.draft.phone || !!draft.checkId || state.prefilled);

  if (loadError) {
    return (
      <p className="mt-3 text-sm font-medium" style={{ color: "#DC2626" }}>
        판매자 정보를 불러오지 못했어요.{" "}
        <button type="button" className="underline font-bold" onClick={() => setReloadKey((k) => k + 1)}>
          다시 불러오기
        </button>
      </p>
    );
  }
  if (!state) return <p className="mt-3 text-sm text-gray500">판매자 정보 불러오는 중…</p>;

  return (
    <div className="mt-3">
      <SellerPrivateFields
        adminKey={adminKey}
        idPrefix={`deal-${dealId}`}
        value={draft}
        onChange={(n) => {
          setDraft(n);
          setErrors({});
        }}
        errors={errors}
        showCheckPicker={!state.linkedCheck}
        linkedCheck={state.linkedCheck}
        onGoBizCheck={onGoBizCheck}
        disabled={saving}
      />
      {state.prefilled && (
        <p className="mt-1.5 text-xs text-gray500">판매 신청 정보로 미리 채웠어요. 확인 후 저장해야 반영돼요.</p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="w-full text-sm font-bold text-white bg-navy rounded-lg py-2.5 mt-2 disabled:opacity-50"
      >
        {saving ? "저장 중..." : "판매자 정보 저장"}
      </button>
    </div>
  );
}

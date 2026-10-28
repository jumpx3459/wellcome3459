// 2026-10-28 관리자 [복사해서 새로 등록](PR-B C) — 판매자 비공개 정보 읽기.
// 상호·연락처·보조 연락처·담당자는 deals 목록에 없어서 GET /api/admin/deals/manage/seller?dealId= 로 따로 읽음(서버가 seller_private_view 감사 1행을 남기고,
// 점핑매니저는 담당 매물만 — 비담당·권한 없음은 403). 실패해도 복사 폼은 열리고 판매자 칸만 비워 둔 채 안내 문구를 보여 줌.

export type CopySellerCarry = { company: string; name: string; phone: string; phone2: string; checkId: string };

export type CopySellerResult = {
  /** null = 판매자 정보를 못 가져옴(칸 비움) */
  carry: CopySellerCarry | null;
  /** 폼 위 띠에 보일 안내(없으면 null) */
  note: string | null;
};

export const COPY_SELLER_FORBIDDEN_NOTE = "담당 매물이 아니라 판매자 정보는 복사하지 않았어요. 판매자 칸은 직접 입력해 주세요.";
export const COPY_SELLER_FAILED_NOTE = "판매자 정보를 불러오지 못했어요. 판매자 칸은 직접 입력해 주세요.";
export const COPY_NO_CHECK_NOTE = "이 매물에는 연결된 사업자 조회 기록이 없어요. 아래에서 조회하거나 기록을 직접 골라 주세요.";
export const COPY_PROTECTED_NOTE = "보호 사진·브랜드 보호는 복사되지 않아요. 다시 올려주세요";

type SellerGet = {
  item?: { company_name?: string | null; contact_name?: string | null; contact_phone?: string | null; contact_phone_2?: string | null } | null;
  suggest?: { company_name?: string | null; contact_name?: string | null; contact_phone?: string | null } | null;
  linkedCheck?: { id?: string | null } | null;
};

export async function fetchCopySeller(adminKey: string, dealId: string, fetchFn: typeof fetch = fetch): Promise<CopySellerResult> {
  try {
    const res = await fetchFn(`/api/admin/deals/manage/seller?dealId=${encodeURIComponent(dealId)}`, { headers: { "x-admin-key": adminKey } });
    if (res.status === 403) return { carry: null, note: COPY_SELLER_FORBIDDEN_NOTE };
    if (!res.ok) return { carry: null, note: COPY_SELLER_FAILED_NOTE };
    const data = (await res.json().catch(() => ({}))) as SellerGet;
    // 신청 매물인데 비공개 정보가 아직 비어 있으면 서버가 돌려주는 신청 정보(suggest)를 참고값으로
    const src = data.item ?? (data.suggest ? { ...data.suggest, contact_phone_2: null } : null);
    const checkId = typeof data.linkedCheck?.id === "string" ? data.linkedCheck.id : "";
    return {
      carry: {
        company: src?.company_name ?? "",
        name: src?.contact_name ?? "",
        phone: src?.contact_phone ?? "",
        phone2: src?.contact_phone_2 ?? "",
        checkId,
      },
      note: checkId ? null : COPY_NO_CHECK_NOTE,
    };
  } catch {
    return { carry: null, note: COPY_SELLER_FAILED_NOTE };
  }
}

// 아래에 더 볼 내용이 있다는 걸 알려주는 손 모양 힌트 — 깜빡이며 아래를 가리킴
export default function ScrollHint() {
  return (
    <div className="flex justify-center mt-3" aria-hidden="true">
      <span className="text-2xl animate-scroll-hint">👇</span>
    </div>
  );
}

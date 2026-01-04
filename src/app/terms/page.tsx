'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="戻る"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-2 text-lg font-bold">利用規約</h1>
        </div>
      </header>

      {/* 本文 */}
      <main className="px-4 py-6 max-w-2xl mx-auto">
        <p className="text-xs text-muted-foreground mb-6">
          最終更新日: 2025年1月1日
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          {/* 第1条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第1条（適用）</h2>
            <p className="text-muted-foreground">
              本規約は、GOCHISOKOJI（以下「当社」といいます）が提供するサービス（以下「本サービス」といいます）の利用条件を定めるものです。ユーザーの皆様には、本規約に従って本サービスをご利用いただきます。
            </p>
          </section>

          {/* 第2条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第2条（利用登録）</h2>
            <p className="text-muted-foreground">
              登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。
            </p>
          </section>

          {/* 第3条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第3条（禁止事項）</h2>
            <p className="text-muted-foreground mb-2">
              ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当社のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
              <li>当社のサービスの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          {/* 第4条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第4条（本サービスの提供の停止等）</h2>
            <p className="text-muted-foreground">
              当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
            </p>
          </section>

          {/* 第5条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第5条（免責事項）</h2>
            <p className="text-muted-foreground">
              当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。
            </p>
          </section>

          {/* 第6条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第6条（サービス内容の変更等）</h2>
            <p className="text-muted-foreground">
              当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
            </p>
          </section>

          {/* 第7条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第7条（利用規約の変更）</h2>
            <p className="text-muted-foreground">
              当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
            </p>
          </section>

          {/* 第8条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第8条（準拠法・裁判管轄）</h2>
            <p className="text-muted-foreground">
              本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>

          {/* プレースホルダー注記 */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              ※ この利用規約はサンプルです。正式リリース前に法務確認のうえ、内容を更新してください。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}


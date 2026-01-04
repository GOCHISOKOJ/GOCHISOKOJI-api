'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
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
          <h1 className="ml-2 text-lg font-bold">プライバシーポリシー</h1>
        </div>
      </header>

      {/* 本文 */}
      <main className="px-4 py-6 max-w-2xl mx-auto">
        <p className="text-xs text-muted-foreground mb-6">
          最終更新日: 2025年1月1日
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          {/* はじめに */}
          <section>
            <p className="text-muted-foreground">
              GOCHISOKOJI（以下「当社」といいます）は、本サービスにおけるユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
            </p>
          </section>

          {/* 第1条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第1条（個人情報）</h2>
            <p className="text-muted-foreground">
              「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
            </p>
          </section>

          {/* 第2条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第2条（個人情報の収集方法）</h2>
            <p className="text-muted-foreground mb-2">
              当社は、ユーザーが利用登録をする際に以下の情報を収集することがあります。
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>メールアドレス</li>
              <li>ユーザー名（表示名）</li>
              <li>プロフィール画像</li>
              <li>その他当社が定める入力フォームにユーザーが入力する情報</li>
            </ul>
          </section>

          {/* 第3条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第3条（個人情報を収集・利用する目的）</h2>
            <p className="text-muted-foreground mb-2">
              当社が個人情報を収集・利用する目的は、以下のとおりです。
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>本サービスの提供・運営のため</li>
              <li>ユーザーからのお問い合わせに回答するため</li>
              <li>ユーザーが利用中のサービスの新機能、更新情報等を案内するため</li>
              <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
              <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
              <li>ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
              <li>上記の利用目的に付随する目的</li>
            </ul>
          </section>

          {/* 第4条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第4条（利用目的の変更）</h2>
            <p className="text-muted-foreground">
              当社は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。利用目的の変更を行った場合には、変更後の目的について、当社所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。
            </p>
          </section>

          {/* 第5条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第5条（個人情報の第三者提供）</h2>
            <p className="text-muted-foreground mb-2">
              当社は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
            </ul>
          </section>

          {/* 第6条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第6条（個人情報の開示）</h2>
            <p className="text-muted-foreground">
              当社は、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。
            </p>
          </section>

          {/* 第7条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第7条（個人情報の訂正および削除）</h2>
            <p className="text-muted-foreground">
              ユーザーは、当社の保有する自己の個人情報が誤った情報である場合には、当社が定める手続きにより、当社に対して個人情報の訂正、追加または削除（以下「訂正等」といいます）を請求することができます。
            </p>
          </section>

          {/* 第8条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第8条（プライバシーポリシーの変更）</h2>
            <p className="text-muted-foreground">
              本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。当社が別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
            </p>
          </section>

          {/* 第9条 */}
          <section>
            <h2 className="text-base font-bold mb-3">第9条（お問い合わせ窓口）</h2>
            <p className="text-muted-foreground">
              本ポリシーに関するお問い合わせは、アプリ内のお問い合わせ機能よりご連絡ください。
            </p>
          </section>

          {/* プレースホルダー注記 */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              ※ このプライバシーポリシーはサンプルです。正式リリース前に法務確認のうえ、内容を更新してください。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}


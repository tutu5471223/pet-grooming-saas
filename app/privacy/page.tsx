import Link from "next/link"
import { Scissors } from "lucide-react"

export const metadata = {
  title: "隱私權政策 | PetOS71",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">PetOS71</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">隱私權政策</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {/* Title block */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">PetOS71 隱私權政策</h1>
          <p className="mt-2 text-sm text-gray-400">最後更新日期：2026年06月29日</p>
          <p className="mt-4 text-gray-600 leading-relaxed">
            PetOS71（以下簡稱「本服務」）重視使用者及其客戶之個人資料保護，並依據《個人資料保護法》及相關法令蒐集、處理及利用個人資料。
          </p>
          <p className="mt-2 text-gray-600 leading-relaxed">
            當您註冊、登入或使用本服務時，即表示您已閱讀、瞭解並同意本隱私權政策之內容。
          </p>
        </div>

        <div className="space-y-10 text-sm sm:text-base text-gray-700 leading-relaxed">

          {/* 一 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">一、資料控制角色說明</h2>
            <div className="space-y-2">
              <p>本服務為提供寵物美容、住宿、寄養及相關業務管理功能之雲端系統。</p>
              <p>店家透過本服務蒐集、建立及管理其客戶資料時，店家應自行確認已依法取得相關個人資料，並符合個人資料保護法及其他相關法令規定。</p>
              <p>本服務主要作為資料儲存、管理及處理之平台，不負責審查店家蒐集個人資料之合法性。</p>
            </div>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 二 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">二、本服務蒐集之資料</h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1.5">（一）店家帳號資料</h3>
                <p className="mb-2">本服務可能蒐集以下資料：</p>
                <ul className="list-disc list-outside pl-5 space-y-1">
                  <li>店家名稱、負責人姓名</li>
                  <li>聯絡電話、電子郵件地址</li>
                  <li>登入帳號資訊</li>
                  <li>付款與訂閱紀錄</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1.5">（二）店家建立之客戶資料</h3>
                <p className="mb-2">店家得依自身業務需求建立客戶資料，包括但不限於：</p>
                <ul className="list-disc list-outside pl-5 space-y-1">
                  <li>姓名、聯絡電話、電子郵件</li>
                  <li>通訊地址、備註資料</li>
                  <li>身分證字號（非必填）</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1.5">（三）寵物資料</h3>
                <ul className="list-disc list-outside pl-5 space-y-1">
                  <li>寵物名稱、品種、性別、出生日期或年齡</li>
                  <li>體重、毛色、健康狀況</li>
                  <li>疫苗紀錄、美容紀錄、住宿紀錄</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1.5">（四）系統使用資料</h3>
                <ul className="list-disc list-outside pl-5 space-y-1">
                  <li>IP位址、登入時間、操作紀錄</li>
                  <li>裝置資訊、Cookie資訊</li>
                  <li>系統錯誤紀錄</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 三 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">三、資料使用目的</h2>
            <ul className="list-disc list-outside pl-5 space-y-1">
              <li>提供系統服務功能</li>
              <li>建立及管理會員帳號</li>
              <li>客戶資料管理、預約與排程管理</li>
              <li>契約文件產生與管理</li>
              <li>帳務與訂閱管理</li>
              <li>系統安全維護</li>
              <li>服務優化及統計分析</li>
            </ul>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 四 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">四、身分證字號等敏感資料之處理</h2>
            <div className="space-y-2">
              <p>如店家基於契約簽署、法令遵循或其他合法目的輸入身分證字號，本服務將於提供系統功能之必要範圍內進行儲存與處理。</p>
              <p>本服務不會將身分證字號用於行銷、廣告或其他與原蒐集目的無關之用途。</p>
            </div>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 五 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">五、第三方服務</h2>
            <div className="space-y-2">
              <p>本服務可能使用第三方服務提供商協助營運，包括但不限於：LINE、Google、雲端主機服務、電子郵件服務。</p>
              <p>本服務不會出售、出租或交換個人資料予第三人。</p>
            </div>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 六 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">六、Cookie 政策</h2>
            <p className="mb-2">本服務使用 Cookie 以：</p>
            <ul className="list-disc list-outside pl-5 space-y-1">
              <li>維持登入狀態</li>
              <li>提升使用體驗</li>
              <li>記錄偏好設定</li>
            </ul>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 七 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">七、資料安全措施</h2>
            <p className="mb-2">本服務採取以下措施保護資料安全：</p>
            <ul className="list-disc list-outside pl-5 space-y-1">
              <li>HTTPS 加密傳輸</li>
              <li>帳號密碼保護機制</li>
              <li>權限控管</li>
              <li>系統存取限制</li>
            </ul>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 八 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">八、資料保存期間</h2>
            <p>帳號終止後，使用者資料原則上保存 30 日後進行刪除或匿名化處理。</p>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 九 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">九、使用者權利</h2>
            <p className="mb-2">依個人資料保護法規定，資料當事人得依法行使以下權利：</p>
            <ul className="list-disc list-outside pl-5 space-y-1">
              <li>查詢閱覽</li>
              <li>請求複製</li>
              <li>補充更正</li>
              <li>停止蒐集處理</li>
              <li>請求刪除</li>
            </ul>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 十 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">十、政策修訂</h2>
            <p>本服務保留隨時修訂本隱私權政策之權利，修訂後內容將公告於本服務網站。</p>
            <div className="mt-8 border-t border-gray-100" />
          </section>

          {/* 十一 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">十一、聯絡方式</h2>
            <p>
              電子郵件：
              <a href="mailto:tutu5471223@gmail.com" className="text-indigo-600 hover:underline ml-1">
                tutu5471223@gmail.com
              </a>
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-indigo-600 hover:underline">服務條款</Link>
          <Link href="/" className="hover:text-indigo-600 hover:underline">返回首頁</Link>
        </div>
      </main>
    </div>
  )
}

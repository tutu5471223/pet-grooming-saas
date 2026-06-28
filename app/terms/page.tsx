import Link from "next/link"
import { Scissors } from "lucide-react"

export const metadata = {
  title: "服務條款 | PetOS71",
}

const sections = [
  {
    title: "一、服務內容",
    content: [
      "本服務提供寵物美容店、寵物住宿及相關業者之管理系統，包括但不限於會員管理、預約管理、寵物資料管理、消費紀錄管理、報表功能及其他相關服務。",
      "本服務將盡力維持系統穩定運作，但不保證服務不中斷、無錯誤或完全符合使用者需求。",
    ],
  },
  {
    title: "二、帳號與密碼",
    content: [
      "使用者應妥善保管帳號、密碼及相關登入資訊。",
      "因帳號、密碼保管不當、遭第三人使用或外洩所造成之損害，由使用者自行負責，本服務不承擔相關責任。",
    ],
  },
  {
    title: "三、使用規範",
    preamble: "使用者不得從事以下行為：",
    list: [
      "提供不實資料或冒用他人身分。",
      "干擾、破壞或影響本服務正常運作。",
      "嘗試未經授權存取系統、資料庫或其他使用者資料。",
      "進行反向工程、破解、複製或散布本服務程式碼。",
      "利用本服務從事違反法令之行為。",
    ],
    postscript: "如有上述情形，本服務得立即停止或終止帳號使用權限，且無須事先通知。",
  },
  {
    title: "四、費用與退款政策",
    content: [
      "本服務採月費訂閱制。",
      "使用者完成付款後，即取得相應期間之使用權限。",
      "除法律另有規定外，已支付之費用不予退還。",
      "本服務保留調整收費方案及價格之權利，並將於合理期間前公告。",
    ],
  },
  {
    title: "五、資料使用",
    content: [
      "使用者所提供或建立之資料，其所有權仍歸使用者所有。",
      "本服務僅於提供系統功能、維護服務、安全管理及客戶支援之必要範圍內使用相關資料。",
    ],
  },
  {
    title: "六、資料備份",
    content: [
      "本服務將採取合理措施保護資料安全。",
      "然而，使用者仍應自行定期備份重要資料。",
      "因設備故障、網路異常、人為操作錯誤、第三方服務中斷或其他不可歸責於本服務之因素造成資料遺失，本服務不負賠償責任。",
    ],
  },
  {
    title: "七、智慧財產權",
    content: [
      "本服務之軟體、程式碼、介面設計、商標、文件、資料庫結構及相關內容，均受智慧財產權法令保護。",
      "未經授權，任何人不得重製、修改、散布、公開傳輸或進行反向工程。",
    ],
  },
  {
    title: "八、服務變更與終止",
    content: [
      "本服務得隨時新增、修改、暫停或終止部分功能。",
      "如使用者違反本條款或相關法令，本服務得立即停止其使用權限。",
    ],
  },
  {
    title: "九、免責聲明",
    preamble: "本服務係依現況提供。對於因下列原因所造成之損害，本服務不負任何賠償責任：",
    list: [
      "系統故障或維護。",
      "網路中斷或通訊異常。",
      "資料遺失、毀損或誤刪除。",
      "第三方服務異常或中斷。",
      "不可抗力事件。",
    ],
    postscript: "如依法須負擔責任，其責任上限以使用者最近一個月已支付之服務費用為限。",
  },
  {
    title: "十、準據法與管轄法院",
    content: [
      "本條款之解釋與適用，均依中華民國法律辦理。",
      "因本服務所生之爭議，雙方同意以台灣地方法院為第一審管轄法院。",
    ],
  },
]

export default function TermsPage() {
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
          <span className="text-sm text-gray-500">服務條款</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {/* Title block */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">PetOS71 服務條款</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">
            歡迎使用 PetOS71（以下簡稱「本服務」）。當您註冊、登入或使用本服務時，即表示您已閱讀、瞭解並同意遵守本服務條款。
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((sec) => (
            <section key={sec.title}>
              <h2 className="text-lg font-bold text-gray-900 mb-3">{sec.title}</h2>
              <div className="space-y-2 text-gray-700 leading-relaxed text-sm sm:text-base">
                {"preamble" in sec && sec.preamble && (
                  <p>{sec.preamble}</p>
                )}
                {"list" in sec && sec.list && (
                  <ol className="list-decimal list-outside pl-5 space-y-1.5">
                    {sec.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                )}
                {"postscript" in sec && sec.postscript && (
                  <p className="mt-2">{sec.postscript}</p>
                )}
                {"content" in sec && sec.content?.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-8 border-t border-gray-100" />
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-indigo-600 hover:underline">隱私權政策</Link>
          <Link href="/" className="hover:text-indigo-600 hover:underline">返回首頁</Link>
        </div>
      </main>
    </div>
  )
}

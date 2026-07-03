export type OcrKeywords = {
  ownerNameKeys: string[]
  phoneKeys: string[]
  notesKeys: string[]
  petNameKeys: string[]
  breedKeys: string[]
  birthdayKeys: string[]
}

export const DEFAULT_OCR_KEYWORDS: OcrKeywords = {
  ownerNameKeys: ["第一聯絡人", "飼主", "姓名"],
  phoneKeys: ["電話", "手機"],
  notesKeys: ["第二聯絡人"],
  petNameKeys: ["寵物名稱", "名字", "小名"],
  breedKeys: ["品種"],
  birthdayKeys: ["生日", "出生日期"],
}
